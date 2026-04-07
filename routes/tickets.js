const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { isCloud, db, readAll, writeOne, ensureDataDir } = require('../services/db');

const router = express.Router();
const TICKETS_PATH = path.join(__dirname, '../data/tickets.json');

// --- Updated Persistence: Google Firestore (Cloud) + JSON (Local) ---
// removed readTickets in favor of readAll directly

const writeTickets = async (tickets) => {
  ensureDataDir(TICKETS_PATH);
  fs.writeFileSync(TICKETS_PATH, JSON.stringify(tickets, null, 2));

  // Cloud Mirroring (Sync to Google)
  if (isCloud) {
    await Promise.all(tickets.map(t => 
      writeOne('tickets', t.id, t, TICKETS_PATH)
    ));
  }
};

// GET all tickets (with optional accountId filter)
router.get('/', async (req, res) => {
  try {
    let tickets = await readAll('tickets', TICKETS_PATH);
    const accountsPath = path.join(__dirname, '../data/accounts.json');
    let rawAccounts = await readAll('accounts', accountsPath);

    // EMERGENCY FAIL-SAFE: If DB is empty, use SEED_TICKETS from seedData
    if (!tickets || tickets.length === 0) {
      const { SEED_TICKETS } = require('../services/seedData');
      tickets = SEED_TICKETS;
      console.log('[X-Ray] DB empty, using hardcoded SEED_TICKETS fail-safe.');
    }
    
    // Multi-tenant Filter (Isolate by PartnerTag)
    if (req.user && req.user.role !== 'admin') {
      const pTag = (req.user.partnerTag || '').split('_')[0].toLowerCase(); // Handle potential sub-tags
      const partnerTag = (req.user.partnerTag || '').toLowerCase().trim();
      
      const allowedAccounts = rawAccounts
        .filter(a => (a.partnerTag || '').toLowerCase().trim() === partnerTag)
        .map(a => a.id);
      
      tickets = tickets.filter(t => allowedAccounts.includes(t.accountId));
      console.log(`[X-Ray] Client Filter: UserTag=${partnerTag}, AllowedAccs=${allowedAccounts.length}, ResultTickets=${tickets.length}`);
    } else if (req.query.partnerTag && req.query.partnerTag !== 'all' && req.query.partnerTag !== '') {
      const pTag = req.query.partnerTag.toLowerCase().trim();
      const allowedAccounts = rawAccounts
        .filter(a => (a.partnerTag || '').toLowerCase().trim() === pTag)
        .map(a => a.id);
      
      tickets = tickets.filter(t => allowedAccounts.includes(t.accountId));
      console.log(`[X-Ray] Admin Filter: QueryTag=${pTag}, AllowedAccs=${allowedAccounts.length}, ResultTickets=${tickets.length}`);
    }
    
    console.log(`[X-Ray] Tickets Route: Returning ${tickets.length} tickets.`);
    
    if (req.query.accountId) {
      tickets = tickets.filter(t => t.accountId === req.query.accountId);
    }
    if (req.query.status) {
      tickets = tickets.filter(t => t.status === req.query.status);
    }
    if (req.query.priority) {
      tickets = tickets.filter(t => t.priority === req.query.priority);
    }
    // Update daysOpen dynamically
    tickets = tickets.map(t => ({
      ...t,
      daysOpen: Math.ceil((new Date() - new Date(t.createdAt)) / (1000 * 60 * 60 * 24))
    }));
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single ticket
router.get('/:id', async (req, res) => {
  try {
    const tickets = await readAll('tickets', TICKETS_PATH);
    const ticket = tickets.find(t => t.id === req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    res.json(ticket);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create ticket
router.post('/', async (req, res) => {
  try {
    const tickets = await readAll('tickets', TICKETS_PATH);
    const newTicket = {
      id: `tkt-${uuidv4().split('-')[0]}`,
      ...req.body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      daysOpen: 0
    };
    tickets.push(newTicket);
    await writeTickets(tickets);
    res.status(201).json(newTicket);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update ticket
router.put('/:id', async (req, res) => {
  try {
    const tickets = await readAll('tickets', TICKETS_PATH);
    const idx = tickets.findIndex(t => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Ticket not found' });
    tickets[idx] = { ...tickets[idx], ...req.body, updatedAt: new Date().toISOString() };
    await writeTickets(tickets);
    res.json(tickets[idx]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE ticket
router.delete('/:id', async (req, res) => {
  try {
    const tickets = await readAll('tickets', TICKETS_PATH);
    const filtered = tickets.filter(t => t.id !== req.params.id);
    await writeTickets(filtered);
    res.json({ message: 'Ticket deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET ticket summary stats
router.get('/meta/summary', async (req, res) => {
  try {
    let tickets = await readAll('tickets', TICKETS_PATH);
    
    // Auth & Project Filter
    const accountsPath = path.join(__dirname, '../data/accounts.json');
    let rawAccounts = await readAll('accounts', accountsPath);

    // EMERGENCY FAIL-SAFE
    if (!tickets || tickets.length === 0) {
      const { SEED_TICKETS } = require('../services/seedData');
      tickets = SEED_TICKETS;
    }

    // Isolate by Partner for accurate stats
    if (req.user && req.user.role !== 'admin') {
      const partnerTag = (req.user.partnerTag || '').toLowerCase().trim();
      const allowedAccounts = rawAccounts
        .filter(a => (a.partnerTag || '').toLowerCase().trim() === partnerTag)
        .map(a => a.id);
      tickets = tickets.filter(t => allowedAccounts.includes(t.accountId));
    } else if (req.query.partnerTag && req.query.partnerTag !== 'all' && req.query.partnerTag !== '') {
      const pTag = req.query.partnerTag.toLowerCase().trim();
      const allowedAccounts = rawAccounts
        .filter(a => (a.partnerTag || '').toLowerCase().trim() === pTag)
        .map(a => a.id);
      tickets = tickets.filter(t => allowedAccounts.includes(t.accountId));
    }
    
    const open = tickets.filter(t => t.status === 'Open');
    const escalated = tickets.filter(t => t.status === 'Escalated');
    const critical = tickets.filter(t => t.priority === 'Critical');
    const high = tickets.filter(t => t.priority === 'High');
    const avgDaysOpen = tickets.length
      ? tickets.reduce((s, t) => s + (t.daysOpen || 0), 0) / tickets.length
      : 0;
    res.json({
      total: tickets.length,
      open: open.length,
      escalated: escalated.length,
      critical: critical.length,
      high: high.length,
      avgDaysOpen: parseFloat(avgDaysOpen.toFixed(1))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
