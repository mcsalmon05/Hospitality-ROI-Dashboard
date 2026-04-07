const express = require('express');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { XMLParser } = require('fast-xml-parser');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();
const ACCOUNTS_PATH = path.join(__dirname, '../data/accounts.json');
const SETTINGS_PATH = path.join(__dirname, '../data/settings.json');
const { isCloud, db, readAll, writeOne } = require('../services/db');

// --- Updated Persistence: Google Firestore (Cloud) + JSON (Local) ---
const INTEL_PATH = path.join(__dirname, '../data/intelligence.json');
const readIntelligence = async () => {
  return await readAll('news', INTEL_PATH);
};

const writeIntelligence = (alerts) => {
  const filePath = path.join(__dirname, '../data/intelligence.json');
  fs.writeFileSync(filePath, JSON.stringify(alerts, null, 2));

  // Cloud Mirroring
  if (isCloud) {
    alerts.forEach(alert => {
      writeOne('news', alert.id, alert);
    });
  }
};

const readAccounts = async () => await readAll('accounts', ACCOUNTS_PATH);
const readSettings = () => JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));

const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

// ─── Keyword Classification ───────────────────────────────────────────────────
function classifyArticle(title, description = '') {
  const text = `${title} ${description}`.toLowerCase();
  const settings = readSettings();
  const kw = settings.newsKeywords;

  for (const word of kw.critical) {
    if (text.includes(word.toLowerCase())) return { level: 'critical', keyword: word };
  }
  for (const word of kw.high) {
    if (text.includes(word.toLowerCase())) return { level: 'high', keyword: word };
  }
  for (const word of kw.medium) {
    if (text.includes(word.toLowerCase())) return { level: 'medium', keyword: word };
  }
  for (const word of kw.positive) {
    if (text.includes(word.toLowerCase())) return { level: 'positive', keyword: word };
  }
  return null;
}

function getLevelLabel(level) {
  const labels = {
    critical: '🔴 Critical Alert',
    high: '🟠 High Priority',
    medium: '🟡 Watch Item',
    positive: '🟢 Opportunity'
  };
  return labels[level] || '⚪ FYI';
}

// ─── Scrape Google News RSS for a company ────────────────────────────────────
async function scrapeCompanyNews(account) {
  const company = encodeURIComponent(account.name);
  const rssUrl = `https://news.google.com/rss/search?q=${company}&hl=en-US&gl=US&ceid=US:en`;
  const alerts = [];

  try {
    const res = await fetch(rssUrl, {
      headers: { 'User-Agent': 'CSM-Intelligence-Bot/1.0' },
      timeout: 10000
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const parsed = xmlParser.parse(xml);
    const items = parsed?.rss?.channel?.item || [];
    const itemArr = Array.isArray(items) ? items : [items];

    for (const item of itemArr.slice(0, 10)) {
      const title = item.title || '';
      const link = item.link || '';
      const pubDate = item.pubDate || new Date().toISOString();
      const description = item.description || '';
      const source = item.source?.['#text'] || item.source || 'Unknown Source';

      const classification = classifyArticle(title, description);
      if (classification) {
        alerts.push({
          id: `intel-${uuidv4().split('-')[0]}`,
          accountId: account.id,
          accountName: account.name,
          title,
          link,
          source: typeof source === 'string' ? source : 'Google News',
          pubDate,
          level: classification.level,
          levelLabel: getLevelLabel(classification.level),
          keyword: classification.keyword,
          summary: description.replace(/<[^>]+>/g, '').substring(0, 200),
          dismissed: false,
          createdAt: new Date().toISOString()
        });
      }
    }
  } catch (err) {
    console.warn(`[News] Failed to scrape for ${account.name}: ${err.message}`);
  }

  return alerts;
}

// ─── Main scrub runner (exported for cron + manual trigger) ──────────────────
async function runIntelligenceScrub(options = {}) {
  console.log('[Intelligence] Starting scrub...');
  const accounts = await readAccounts();
  const intel = await readIntelligence();
  const existingIds = new Set((intel.alerts || []).map(a => a.link));

  const allNewAlerts = [];
  for (const account of accounts) {
    const alerts = await scrapeCompanyNews(account);
    for (const alert of alerts) {
      // Deduplicate by link
      if (!existingIds.has(alert.link)) {
        existingIds.add(alert.link);
        allNewAlerts.push(alert);
      }
    }
    // Throttle to avoid rate limiting
    await new Promise(r => setTimeout(r, 1500));
  }

  // Keep max 200 alerts, newest first
  const combined = [...allNewAlerts, ...(intel.alerts || [])].slice(0, 200);

  const updated = {
    lastScrub: new Date().toISOString(),
    nextScrub: getNextScrubTime(),
    alerts: combined
  };
  writeIntelligence(updated);
  console.log(`[Intelligence] Scrub complete. Found ${allNewAlerts.length} new alerts.`);
  return { newAlerts: allNewAlerts.length, total: combined.length };
}

function getNextScrubTime() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(8, 0, 0, 0);
  return tomorrow.toISOString();
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET all alerts
router.get('/alerts', async (req, res) => {
  try {
    const data = await readIntelligence();
    let alerts = Array.isArray(data) ? data : (data.alerts || []);
    
    console.log(`[X-Ray] News Alerts Route: Found ${alerts.length} alerts. Filters:`, req.query);

    if (req.query.accountId) {
      alerts = alerts.filter(a => a.accountId === req.query.accountId);
    }
    if (req.query.level) {
      alerts = alerts.filter(a => a.level === req.query.level);
    }
    if (req.query.dismissed === 'false') {
      alerts = alerts.filter(a => !a.dismissed);
    }
    
    // Auth filtering for intelligence (Crucial for multi-tenant safety)
    const accounts = await readAll('accounts', ACCOUNTS_PATH);
    
    if (req.user && req.user.role !== 'admin') {
      const pTag = req.user.partnerTag;
      const myAccountIds = accounts.filter(acc => acc.partnerTag === pTag).map(acc => acc.id);
      alerts = alerts.filter(a => myAccountIds.includes(a.accountId));
    } else if (req.query.partnerTag && req.query.partnerTag !== 'all' && req.query.partnerTag !== '') {
      const pTag = req.query.partnerTag;
      const myAccountIds = accounts.filter(acc => acc.partnerTag === pTag).map(acc => acc.id);
      alerts = alerts.filter(a => myAccountIds.includes(a.accountId));
    }

    // Enrichment: Add partner name so admin can see who it's for in global dashboard
    alerts = alerts.map(a => {
      const acc = accounts.find(acc => acc.id === a.accountId);
      return {
        ...a,
        partnerTag: acc?.partnerTag || 'internal',
        partnerName: acc?.partnerTag === 'testpilot' ? 'Test Pilot' : acc?.partnerTag === 'testclient2' ? 'Test Client 2' : 'Global'
      };
    });

    res.json({
      alerts,
      lastScrub: new Date().toISOString(), // Fallback
      nextScrub: getNextScrubTime()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET intelligence summary
router.get('/summary', async (req, res) => {
  try {
    const data = await readIntelligence();
    let alerts = Array.isArray(data) ? data : (data.alerts || []);
    
    // Auth filtering
    if (req.user && req.user.role !== 'admin') {
      const pTag = req.user.partnerTag;
      const accounts = await readAll('accounts', ACCOUNTS_PATH);
      const myAccountIds = accounts.filter(acc => acc.partnerTag === pTag).map(acc => acc.id);
      alerts = alerts.filter(a => myAccountIds.includes(a.accountId));
    } else if (req.query.partnerTag && req.query.partnerTag !== 'all') {
      const pTag = req.query.partnerTag;
      const accounts = await readAll('accounts', ACCOUNTS_PATH);
      const myAccountIds = accounts.filter(acc => acc.partnerTag === pTag).map(acc => acc.id);
      alerts = alerts.filter(a => myAccountIds.includes(a.accountId));
    }

    const active = alerts.filter(a => !a.dismissed);
    res.json({
      total: alerts.length,
      active: active.length,
      critical: active.filter(a => a.level === 'critical').length,
      high: active.filter(a => a.level === 'high').length,
      lastScrub: data.lastScrub,
      alerts: alerts // Combined response for easier FE loading
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST trigger manual scrub
router.post('/scrub', async (req, res) => {
  try {
    console.log('[Intelligence] Manual scrub triggered via API');
    const result = await runIntelligenceScrub();
    res.json({ message: 'Scrub complete', ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST trigger scrub for single account
router.post('/scrub/:accountId', async (req, res) => {
  try {
    const accounts = await readAccounts();
    const account = accounts.find(a => a.id === req.params.accountId);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const alerts = await scrapeCompanyNews(account);
    const intel = await readIntelligence();
    const existingIds = new Set((intel.alerts || []).map(a => a.link));
    const newAlerts = alerts.filter(a => !existingIds.has(a.link));
    const combined = [...newAlerts, ...(intel.alerts || [])].slice(0, 200);
    writeIntelligence({ ...intel, alerts: combined, lastScrub: new Date().toISOString() });

    res.json({ message: `Scrub complete for ${account.name}`, newAlerts: newAlerts.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT dismiss an alert
router.put('/alerts/:id/dismiss', async (req, res) => {
  try {
    const intel = await readIntelligence();
    const alert = intel.alerts.find(a => a.id === req.params.id);
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    alert.dismissed = true;
    writeIntelligence(intel);
    res.json({ message: 'Alert dismissed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE clear all dismissed alerts
router.delete('/alerts/dismissed', async (req, res) => {
  try {
    const intel = await readIntelligence();
    intel.alerts = (intel.alerts || []).filter(a => !a.dismissed);
    writeIntelligence(intel);
    res.json({ message: 'Cleared dismissed alerts' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST generate daily recap (Synthesize news + ROI shifts)
router.post('/recap', async (req, res) => {
  try {
    const intel = await readIntelligence();
    let alerts = Array.isArray(intel) ? intel : (intel.alerts || []);
    let accounts = await readAccounts();
    
    // Auth filtering
    if (req.user && req.user.role !== 'admin') {
      const pTag = req.user.partnerTag;
      accounts = accounts.filter(acc => acc.partnerTag === pTag);
      const myAccountIds = accounts.map(acc => acc.id);
      alerts = alerts.filter(a => myAccountIds.includes(a.accountId));
    } else if (req.query.partnerTag && req.query.partnerTag !== 'all') {
      const pTag = req.query.partnerTag;
      accounts = accounts.filter(acc => acc.partnerTag === pTag);
      const myAccountIds = accounts.map(acc => acc.id);
      alerts = alerts.filter(a => myAccountIds.includes(a.accountId));
    }
    
    const criticalAlerts = alerts.filter(a => a.level === 'critical').slice(0, 3);
    const topPerformers = [...accounts].sort((a, b) => b.revPar - a.revPar).slice(0, 2);
    const atRisk = accounts.filter(a => a.occupancyPct < 50);

    const briefing = {
      timestamp: new Date().toISOString(),
      summary: `Portfolio assessment complete. Identified ${criticalAlerts.length} high-risk signals and ${atRisk.length} occupancy warnings.`,
      highlights: [
        ...criticalAlerts.map(a => `High Risk: ${a.source} reports ${a.title} for ${a.accountName || 'Partner'}.`),
        ...atRisk.map(a => `Occupancy Warning: ${a.name} is tracking at ${a.occupancyPct}%. Suggesting dynamic pricing audit.`),
        ...topPerformers.map(a => `ROI Leader: ${a.name} hit an ADR of $${a.adr} this cycle.`)
      ],
      escalations: criticalAlerts.length > 0 ? "Immediate CSM intervention required for critical sentiment drops." : "No immediate escalations required."
    };

    // Still persist to fallback file for legacy crons if needed
    fs.writeFileSync(path.join(__dirname, '../data/recap.json'), JSON.stringify(briefing, null, 2));
    res.json(briefing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET latest recap (Dynamically synthesized to ensure it is always up to date)
router.get('/recap', async (req, res) => {
  try {
    const intel = await readIntelligence();
    let alerts = Array.isArray(intel) ? intel : (intel.alerts || []);
    let accounts = await readAccounts();

    // Auth filtering
    if (req.user && req.user.role !== 'admin') {
      const pTag = req.user.partnerTag;
      accounts = accounts.filter(acc => acc.partnerTag === pTag);
      const myAccountIds = accounts.map(acc => acc.id);
      alerts = alerts.filter(a => myAccountIds.includes(a.accountId));
    } else if (req.query.partnerTag && req.query.partnerTag !== 'all') {
      const pTag = req.query.partnerTag;
      accounts = accounts.filter(acc => acc.partnerTag === pTag);
      const myAccountIds = accounts.map(acc => acc.id);
      alerts = alerts.filter(a => myAccountIds.includes(a.accountId));
    }

    const criticalAlerts = alerts.filter(a => a.level === 'critical').slice(0, 3);
    const topPerformers = [...accounts].sort((a, b) => b.revPar - a.revPar).slice(0, 2);
    const atRisk = accounts.filter(a => a.occupancyPct < 50);

    const briefing = {
      timestamp: new Date().toISOString(),
      summary: `Portfolio assessment complete. Identified ${criticalAlerts.length} high-risk signals and ${atRisk.length} occupancy warnings.`,
      highlights: [
        ...criticalAlerts.map(a => `High Risk: ${a.source} reports ${a.title} for ${a.accountName || 'Partner'}.`),
        ...atRisk.map(a => `Occupancy Warning: ${a.name} is tracking at ${a.occupancyPct}%. Suggesting dynamic pricing audit.`),
        ...topPerformers.map(a => `ROI Leader: ${a.name} hit an ADR of $${a.adr} this cycle.`)
      ],
      escalations: criticalAlerts.length > 0 ? "Immediate CSM intervention required for critical sentiment drops." : "No immediate escalations required."
    };

    res.json(briefing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.runIntelligenceScrub = runIntelligenceScrub;
module.exports = router;
