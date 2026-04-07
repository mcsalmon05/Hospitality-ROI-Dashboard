const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { isCloud, db, writeOne, ensureDataDir } = require('../services/db');

const router = express.Router();
const DATA_PATH = path.join(__dirname, '../data/accounts.json');

// --- Updated Persistence: Google Firestore (Cloud) + JSON (Local) ---
const readAccounts = () => {
  try {
    ensureDataDir(DATA_PATH);
    if (!fs.existsSync(DATA_PATH)) {
      fs.writeFileSync(DATA_PATH, '[]');
      return [];
    }
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  } catch (e) {
    console.error('[DB] Read error:', e.message);
    return [];
  }
};

const writeAccounts = async (accounts) => {
  ensureDataDir(DATA_PATH);
  fs.writeFileSync(DATA_PATH, JSON.stringify(accounts, null, 2));
  
  // Cloud Sync (Mirroring)
  if (isCloud) {
    for (const acc of accounts) {
      await writeOne('accounts', acc.id || acc.name, acc, DATA_PATH);
    }
  }
};

// ─── Hotel ROI Health Engine: 9 Hospitality Signals, 100 Points ──────────────
// Signal breakdown:
//   Occupancy Performance   0–15
//   RevPAR Performance      0–15
//   Direct Booking Shift    0–12
//   ADR (Yield Mgmt)        0–10
//   Guest Review Score      0–10
//   Platform Usage/Adopt    0–10
//   Exec Sponsor Engmt      0–10
//   Payment Status          0–10
//   QBR Recency             0–8
//   TOTAL                   100
function calculateHealthScore(account) {
  const now = new Date();

  // 1. OCCUPANCY (0–15)
  const occ = account.occupancyPct || 0;
  let occScore = 0;
  if (occ >= 85) occScore = 15;
  else if (occ >= 75) occScore = 12;
  else if (occ >= 60) occScore = 8;
  else if (occ >= 45) occScore = 4;

  // 2. RevPAR (0–15)
  const rev = account.revPar || 0;
  let revScore = 0;
  if (rev >= 300) revScore = 15;
  else if (rev >= 200) revScore = 12;
  else if (rev >= 100) revScore = 8;
  else if (rev >= 50)  revScore = 4;

  // 3. DIRECT BOOKING SHIFT — ROI driver (0–12)
  const direct = account.directBookingPct || 0;
  let directScore = 0;
  if (direct >= 40) directScore = 12;
  else if (direct >= 30) directScore = 9;
  else if (direct >= 20) directScore = 6;
  else if (direct >= 10) directScore = 3;

  // 4. ADR — Yield Mgmt health (0–10)
  const adr = account.adr || 0;
  let adrScore = 0;
  if (adr >= 400) adrScore = 10;
  else if (adr >= 250) adrScore = 8;
  else if (adr >= 150) adrScore = 6;
  else if (adr >= 100) adrScore = 4;

  // 5. GUEST REVIEW SCORE (0–10)
  const score = account.reviewScore || 0;
  let sentimentScore = 0;
  if (score >= 4.5) sentimentScore = 10;
  else if (score >= 4.0) sentimentScore = 8;
  else if (score >= 3.5) sentimentScore = 5;
  else if (score >= 3.0) sentimentScore = 2;

  // 6. PLATFORM ADOPTION SCORE (0–10)
  const featureAdopt = account.featureAdoptionScore || 0;
  let featureScore = Math.min(10, Math.floor(featureAdopt / 10));

  // 7. EXECUTIVE SPONSOR ENGAGEMENT (0–10)
  let execScore = 0;
  if (account.executiveSponsorEngaged) {
    const lastTouch = account.executiveSponsorLastTouch
      ? Math.ceil((now - new Date(account.executiveSponsorLastTouch)) / 86400000)
      : 999;
    if (lastTouch <= 30)       execScore = 10;
    else if (lastTouch <= 90)  execScore = 7;
    else if (lastTouch <= 180) execScore = 4;
  } else { execScore = 2; }

  // 8. PAYMENT STATUS (0–10)
  const paymentMap = { good: 10, late: 5, 'at-risk': 0 };
  const paymentScore = paymentMap[account.paymentStatus] ?? 10;

  // 9. QBR RECENCY (0–8)
  let qbrScore = 0;
  if (account.lastQBR) {
    const qbrDaysAgo = Math.ceil((now - new Date(account.lastQBR)) / 86400000);
    if (qbrDaysAgo <= 90)       qbrScore = 8;
    else if (qbrDaysAgo <= 180) qbrScore = 5;
    else if (qbrDaysAgo <= 365) qbrScore = 2;
  }

  const total = occScore + revScore + directScore + adrScore + sentimentScore +
                featureScore + execScore + paymentScore + qbrScore;
  return Math.min(100, Math.max(0, total));
}

// ─── Score Breakdown for display ─────────────────────────────────────────────
function getScoreBreakdown(account) {
  const now = new Date();

  // Occupancy (15)
  const occ = account.occupancyPct || 0;
  let occScore = 0;
  if (occ >= 85) occScore = 15; else if (occ >= 75) occScore = 12; else if (occ >= 60) occScore = 8; else if (occ >= 45) occScore = 4;

  // RevPAR (15)
  const rev = account.revPar || 0;
  let revScore = 0;
  if (rev >= 300) revScore = 15; else if (rev >= 200) revScore = 12; else if (rev >= 100) revScore = 8; else if (rev >= 50) revScore = 4;

  // Direct Booking Shift (12)
  const direct = account.directBookingPct || 0;
  let directScore = 0;
  if (direct >= 40) directScore = 12; else if (direct >= 30) directScore = 9; else if (direct >= 20) directScore = 6; else if (direct >= 10) directScore = 3;

  // ADR (10)
  const adr = account.adr || 0;
  let adrScore = 0;
  if (adr >= 400) adrScore = 10; else if (adr >= 250) adrScore = 8; else if (adr >= 150) adrScore = 6; else if (adr >= 100) adrScore = 4;

  // Guest Review Score (10)
  const score = account.reviewScore || 0;
  let sentimentScore = 0;
  if (score >= 4.5) sentimentScore = 10; else if (score >= 4.0) sentimentScore = 8; else if (score >= 3.5) sentimentScore = 5; else if (score >= 3.0) sentimentScore = 2;

  // Usage (10)
  const featureScore = Math.min(10, Math.floor((account.featureAdoptionScore || 0) / 10));

  // Exec (10)
  let execScore = 2;
  if (account.executiveSponsorEngaged) {
     const lastTouch = account.executiveSponsorLastTouch ? Math.ceil((now - new Date(account.executiveSponsorLastTouch)) / 86400000) : 999;
     if (lastTouch <= 30) execScore = 10; else if (lastTouch <= 90) execScore = 7; else if (lastTouch <= 180) execScore = 4;
  }

  // Payment (10)
  const paymentScore = { good: 10, late: 5, 'at-risk': 0 }[account.paymentStatus] ?? 10;

  // QBR (8)
  let qbrScore = 0;
  if (account.lastQBR) {
    const qbrDaysAgo = Math.ceil((now - new Date(account.lastQBR)) / 86400000);
    if (qbrDaysAgo <= 90) qbrScore = 8; else if (qbrDaysAgo <= 180) qbrScore = 5; else if (qbrDaysAgo <= 365) qbrScore = 2;
  }

  return {
    occupancy:  { score: occScore,      max: 15, label: 'Occupancy %' },
    revpar:     { score: revScore,      max: 15, label: 'RevPAR' },
    direct:     { score: directScore,   max: 12, label: 'Direct Booking Shift' },
    adr:        { score: adrScore,      max: 10, label: 'ADR (Yield Mgmt)' },
    sentiment:  { score: sentimentScore, max: 10, label: 'Guest Sentiment' },
    platform:   { score: featureScore,  max: 10, label: 'Platform Adoption' },
    exec:       { score: execScore,     max: 10, label: 'Exec Engagement' },
    payment:    { score: paymentScore,  max: 10, label: 'Payment Health' },
    qbr:        { score: qbrScore,      max: 8,  label: 'QBR Recency' }
  };
}

function getStatus(score) {
  if (score >= 75) return 'Healthy';
  if (score >= 50) return 'At Risk';
  return 'Critical';
}

function getDaysToRenewal(contractEnd) {
  const now = new Date();
  const renewal = new Date(contractEnd);
  return Math.ceil((renewal - now) / (1000 * 60 * 60 * 24));
}

// GET all accounts
router.get('/', (req, res) => {
  try {
    let rawAccounts = readAccounts();
    
    // Auth & Project Filter
    if (req.user && req.user.role !== 'admin') {
      // Automatic Tag-based filtering
      const partnerTag = req.user.partnerTag;
      if (partnerTag) {
        rawAccounts = rawAccounts.filter(acc => acc.partnerTag === partnerTag);
      } else {
        rawAccounts = []; // No tag = no access
      }
    } else if (req.query.partnerTag && req.query.partnerTag !== 'all') {
      rawAccounts = rawAccounts.filter(acc => acc.partnerTag === req.query.partnerTag);
    } else if (req.query.projectId && req.query.projectId !== 'all') {
      const ids = req.query.projectId.split(',');
      rawAccounts = rawAccounts.filter(acc => ids.includes(acc.id));
    }

    const accounts = rawAccounts.map(acc => {
      const healthScore = calculateHealthScore(acc);
      return {
        ...acc,
        healthScore,
        status: getStatus(healthScore),
        daysToRenewal: getDaysToRenewal(acc.contractEnd)
      };
    });
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single account with score breakdown
router.get('/:id', (req, res) => {
  try {
    const accounts = readAccounts();
    const acc = accounts.find(a => a.id === req.params.id);
    if (!acc) return res.status(404).json({ error: 'Account not found' });
    
    // Auth restrict
    if (req.user && req.user.role !== 'admin') {
      const allowed = req.user.accountIds || [];
      if (!allowed.includes(acc.id)) return res.status(403).json({ error: 'Access denied to this property.' });
    }

    const healthScore = calculateHealthScore(acc);
    const scoreBreakdown = getScoreBreakdown(acc);
    res.json({ ...acc, healthScore, status: getStatus(healthScore), daysToRenewal: getDaysToRenewal(acc.contractEnd), scoreBreakdown });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create account
router.post('/', async (req, res) => {
  try {
    const accounts = readAccounts();
    const newAccount = {
      id: `acc-${uuidv4().split('-')[0]}`,
      ...req.body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    accounts.push(newAccount);
    await writeAccounts(accounts);
    const healthScore = calculateHealthScore(newAccount);
    res.status(201).json({ ...newAccount, healthScore, status: getStatus(healthScore) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update account
router.put('/:id', async (req, res) => {
  try {
    const accounts = readAccounts();
    const idx = accounts.findIndex(a => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Account not found' });
    accounts[idx] = { ...accounts[idx], ...req.body, updatedAt: new Date().toISOString() };
    await writeAccounts(accounts);
    const healthScore = calculateHealthScore(accounts[idx]);
    res.json({ ...accounts[idx], healthScore, status: getStatus(healthScore) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE account
router.delete('/:id', (req, res) => {
  try {
    const accounts = readAccounts();
    const filtered = accounts.filter(a => a.id !== req.params.id);
    if (filtered.length === accounts.length) return res.status(404).json({ error: 'Account not found' });
    writeAccounts(filtered);
    res.json({ message: 'Account deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST bulk import
router.post('/import/bulk', async (req, res) => {
  try {
    const { accounts: incoming } = req.body;
    if (!Array.isArray(incoming)) return res.status(400).json({ error: 'Expected array of accounts' });
    const existing = readAccounts();
    const newOnes = incoming.map(acc => ({
      id: acc.id || `acc-${uuidv4().split('-')[0]}`,
      ...acc,
      createdAt: acc.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
    const merged = [...existing, ...newOnes.filter(n => !existing.find(e => e.id === n.id))];
    await writeAccounts(merged);
    res.json({ imported: newOnes.length, total: merged.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET summary stats (Hotel Portfolio ROI)
router.get('/meta/summary', (req, res) => {
  try {
    let raw = readAccounts();
    
    // Auth & Project Filter
    if (req.user && req.user.role !== 'admin') {
      const partnerTag = req.user.partnerTag;
      if (partnerTag) {
        raw = raw.filter(acc => acc.partnerTag === partnerTag);
      } else {
        raw = [];
      }
    } else if (req.query.partnerTag && req.query.partnerTag !== 'all') {
      raw = raw.filter(acc => acc.partnerTag === req.query.partnerTag);
    } else if (req.query.projectId && req.query.projectId !== 'all') {
      const ids = req.query.projectId.split(',');
      raw = raw.filter(acc => ids.includes(acc.id));
    }

    const accounts = raw.map(acc => {
      const healthScore = calculateHealthScore(acc);
      return { ...acc, healthScore, status: getStatus(healthScore), daysToRenewal: getDaysToRenewal(acc.contractEnd) };
    });
    
    const totalPortfolioRev = accounts.reduce((sum, a) => sum + (a.contractValue || 0), 0);
    const totalExpansion = accounts.reduce((sum, a) => sum + (a.expansionRevenue || 0), 0);
    const atRisk = accounts.filter(a => a.status === 'At Risk');
    const critical = accounts.filter(a => a.status === 'Critical');
    const renewingSoon = accounts.filter(a => a.daysToRenewal <= 90 && a.daysToRenewal > 0);
    
    const avgOcc = accounts.length ? Math.round(accounts.reduce((s,a) => s + (a.occupancyPct || 0), 0) / accounts.length) : 0;
    const avgRevPar = accounts.length ? Math.round(accounts.reduce((s,a) => s + (a.revPar || 0), 0) / accounts.length) : 0;
    const avgHealth = accounts.length ? Math.round(accounts.reduce((s,a) => s + a.healthScore, 0) / accounts.length) : 0;

    res.json({
      total: accounts.length,
      totalMRR: totalPortfolioRev, // Kept key name to avoid full FE rewrite, but UI label will change
      expansionMRR: totalExpansion,
      avgOccupancy: avgOcc,
      avgRevPAR: avgRevPar,
      atRiskCount: atRisk.length,
      criticalCount: critical.length,
      healthyCount: accounts.filter(a => a.status === 'Healthy').length,
      renewingSoonCount: renewingSoon.length,
      avgHealthScore: avgHealth
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST sync from external URL (Zero-Touch Sync)
router.post('/sync', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Data Source URL is required' });

  try {
    const fetch = require('node-fetch');
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    
    const contentType = response.headers.get('content-type');
    let importedData = [];

    if (contentType?.includes('json')) {
      importedData = await response.json();
    } else {
      // Process CSV (Simple parser)
      const text = await response.text();
      const lines = text.split('\n').filter(l => l.trim());
      const headers = lines[0].split(',').map(h => h.trim());
      importedData = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const obj = {};
        headers.forEach((h, i) => obj[h] = values[i]);
        return obj;
      });
    }

    const payload = Array.isArray(importedData) ? importedData : [importedData];
    const existing = readAccounts();
    const merged = [...existing];

    payload.forEach(n => {
      const idx = merged.findIndex(e => e.id === n.id || e.name === n.name);
      if (idx > -1) {
        merged[idx] = { ...merged[idx], ...n };
      } else {
        merged.push(n);
      }
    });

    writeAccounts(merged);
    res.json({ success: true, count: payload.length });
  } catch (err) {
    console.error('[Sync] Error:', err.message);
    res.status(500).json({ error: `Sync Failed: ${err.message}` });
  }
});

module.exports = router;
