const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { isCloud, db, writeOne } = require('../services/db');

const router = express.Router();

// --- Updated Persistence: Google Firestore (Cloud) + JSON (Local) ---
const readTickets = () => {
  const filePath = path.join(__dirname, '../data/tickets.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
};

const writeTickets = (tickets) => {
  const filePath = path.join(__dirname, '../data/tickets.json');
  fs.writeFileSync(filePath, JSON.stringify(tickets, null, 2));

  // Cloud Mirroring (Sync to Google)
  if (isCloud) {
    tickets.forEach(ticket => {
      writeOne('tickets', ticket.id, ticket);
    });
  }
};

// GET all tickets (with optional accountId filter)
router.get('/', (req, res) => {
  try {
    let tickets = readTickets();
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
router.get('/:id', (req, res) => {
  try {
    const tickets = readTickets();
    const ticket = tickets.find(t => t.id === req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    res.json(ticket);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create ticket
router.post('/', (req, res) => {
  try {
    const tickets = readTickets();
    const newTicket = {
      id: `tkt-${uuidv4().split('-')[0]}`,
      ...req.body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      daysOpen: 0
    };
    tickets.push(newTicket);
    writeTickets(tickets);
    res.status(201).json(newTicket);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update ticket
router.put('/:id', (req, res) => {
  try {
    const tickets = readTickets();
    const idx = tickets.findIndex(t => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Ticket not found' });
    tickets[idx] = { ...tickets[idx], ...req.body, updatedAt: new Date().toISOString() };
    writeTickets(tickets);
    res.json(tickets[idx]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE ticket
router.delete('/:id', (req, res) => {
  try {
    const tickets = readTickets();
    const filtered = tickets.filter(t => t.id !== req.params.id);
    writeTickets(filtered);
    res.json({ message: 'Ticket deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET ticket summary stats
router.get('/meta/summary', (req, res) => {
  try {
    const tickets = readTickets();
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
