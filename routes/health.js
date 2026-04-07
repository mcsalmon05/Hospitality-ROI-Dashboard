const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const ACCOUNTS_PATH = path.join(__dirname, '../data/accounts.json');
const TICKETS_PATH = path.join(__dirname, '../data/tickets.json');

const readAccounts = () => JSON.parse(fs.readFileSync(ACCOUNTS_PATH, 'utf8'));
const readTickets = () => JSON.parse(fs.readFileSync(TICKETS_PATH, 'utf8'));

// GET full portfolio health overview
router.get('/overview', (req, res) => {
  try {
    let accounts = readAccounts();
    
    // Auth filter
    if (req.user && req.user.role !== 'admin') {
      const allowed = req.user.accountIds || [];
      accounts = accounts.filter(acc => allowed.includes(acc.id));
    } else if (req.query.projectId && req.query.projectId !== 'all') {
      accounts = accounts.filter(acc => acc.id === req.query.projectId);
    }

    const tickets = readTickets();
    const now = new Date();

    const enriched = accounts.map(acc => {
      const daysToRenewal = Math.ceil((new Date(acc.contractEnd) - now) / 86400000);
      const accTickets = tickets.filter(t => t.accountId === acc.id);

      const actions = [];
      if (daysToRenewal <= 30) actions.push({ type: 'RENEWAL_CRITICAL', message: `Renewal in ${daysToRenewal} days — start save/close process immediately` });
      else if (daysToRenewal <= 90) actions.push({ type: 'RENEWAL_WARNING', message: `Renewal in ${daysToRenewal} days — schedule QBR and renewal conversation` });

      if (acc.escalatedTickets > 0) actions.push({ type: 'ESCALATED_TICKETS', message: `${acc.escalatedTickets} escalated ticket(s) require executive attention` });
      if (acc.openTickets > 7) actions.push({ type: 'HIGH_TICKET_VOLUME', message: `${acc.openTickets} open tickets — potential dissatisfaction signal` });
      if ((acc.productUsagePct || 0) < 40) actions.push({ type: 'LOW_ADOPTION', message: `Product adoption at ${acc.productUsagePct}% — schedule onboarding/training session` });
      if ((acc.npsScore || 0) < 30) actions.push({ type: 'LOW_NPS', message: `NPS score of ${acc.npsScore} — account is actively dissatisfied` });

      const upsellSignals = [];
      if ((acc.productUsagePct || 0) > 85 && acc.tier !== 'Enterprise') upsellSignals.push('High product usage — candidate for tier upgrade');
      if (acc.tags && acc.tags.includes('upsell-candidate')) upsellSignals.push('Tagged as upsell candidate by CSM');
      if (acc.tags && acc.tags.includes('api-interest')) upsellSignals.push('Expressed interest in API add-on');
      if ((acc.npsScore || 0) > 60) upsellSignals.push('High NPS — strong candidate for advocacy/referral program');

      return {
        id: acc.id,
        name: acc.name,
        csm: acc.csm,
        tier: acc.tier,
        contractValue: acc.contractValue,
        daysToRenewal,
        healthScore: acc.healthScore,
        status: acc.status,
        requiredActions: actions,
        upsellSignals,
        ticketCount: accTickets.length,
        escalatedCount: accTickets.filter(t => t.status === 'Escalated').length
      };
    });

    // Sort by priority: critical first, then at-risk, then by daysToRenewal
    enriched.sort((a, b) => {
      const priority = { Critical: 0, 'At Risk': 1, Healthy: 2 };
      if (priority[a.status] !== priority[b.status]) return priority[a.status] - priority[b.status];
      return a.daysToRenewal - b.daysToRenewal;
    });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET triage queue — accounts needing immediate action
router.get('/triage', (req, res) => {
  try {
    let accounts = readAccounts();
    
    // Auth filter
    if (req.user && req.user.role !== 'admin') {
      const allowed = req.user.accountIds || [];
      accounts = accounts.filter(acc => allowed.includes(acc.id));
    } else if (req.query.projectId && req.query.projectId !== 'all') {
      accounts = accounts.filter(acc => acc.id === req.query.projectId);
    }
    
    const now = new Date();
    const triage = accounts
      .map(acc => {
        const daysToRenewal = Math.ceil((new Date(acc.contractEnd) - now) / 86400000);
        const urgencyScore =
          (daysToRenewal < 30 ? 40 : daysToRenewal < 60 ? 20 : 0) +
          ((acc.escalatedTickets || 0) * 10) +
          ((acc.openTickets || 0) * 3) +
          ((acc.productUsagePct || 100) < 40 ? 15 : 0) +
          ((acc.npsScore || 100) < 25 ? 20 : 0);

        return { ...acc, daysToRenewal, urgencyScore };
      })
      .filter(acc => acc.urgencyScore > 20)
      .sort((a, b) => b.urgencyScore - a.urgencyScore);

    res.json(triage);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET renewal pipeline
router.get('/renewals', (req, res) => {
  try {
    let accounts = readAccounts();
    
    // Auth filter
    if (req.user && req.user.role !== 'admin') {
      const allowed = req.user.accountIds || [];
      accounts = accounts.filter(acc => allowed.includes(acc.id));
    } else if (req.query.projectId && req.query.projectId !== 'all') {
      accounts = accounts.filter(acc => acc.id === req.query.projectId);
    }

    const now = new Date();
    const renewals = accounts
      .map(acc => ({
        id: acc.id,
        name: acc.name,
        csm: acc.csm,
        contractValue: acc.contractValue,
        contractEnd: acc.contractEnd,
        daysToRenewal: Math.ceil((new Date(acc.contractEnd) - now) / 86400000),
        healthScore: acc.healthScore,
        status: acc.status,
        tier: acc.tier
      }))
      .sort((a, b) => a.daysToRenewal - b.daysToRenewal);
    res.json(renewals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
