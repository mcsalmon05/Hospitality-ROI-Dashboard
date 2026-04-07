const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');

const accountsRouter = require('./routes/accounts');
const ticketsRouter = require('./routes/tickets');
const newsRouter = require('./routes/news');
const healthRouter = require('./routes/health');
const settingsRouter = require('./routes/settings');
const { router: usersRouter, authMiddleware } = require('./routes/users');
const { runIntelligenceScrub } = require('./routes/news');
const { isCloud, readAll, writeOne } = require('./services/db');
const { SEED_ACCOUNTS, SEED_USERS } = require('./services/seedData');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin'; // Default fallback

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Automated Morning Scrub Scheduler (7:00 AM) ────────────────
const startDailyScheduler = () => {
  console.log('[Scheduler] Automating 7:00 AM Intelligence & Performance Scrub...');
  
  if (!cron) return console.warn('⚠️ node-cron not available for scheduler.');

  // 7:00 AM: Raw Data Scrub & News Scan
  cron.schedule('0 7 * * *', async () => {
    try {
      // Check if auto-scrub is enabled
      const fetch = require('node-fetch');
      const settings = await fetch(`http://localhost:${PORT}/api/settings`).then(r => r.json());
      if (!settings.autoScrubEnabled) {
        return console.log('[Scheduler] 7:00 AM: Skipping auto-scrub (Toggled OFF in settings).');
      }

      const jwt = require('jsonwebtoken');
      const mockToken = jwt.sign({ id: 'system', role: 'admin' }, process.env.JWT_SECRET || 'secret123');
      await fetch(`http://localhost:${PORT}/api/news/scrub`, { 
        method: 'POST',
        headers: { 'Authorization': `Bearer ${mockToken}` }
      });
      console.log('[Scheduler] 7:00 AM Scrub Complete.');
    } catch (err) {
      console.error('[Scheduler] 7:00 AM Scrub Failed:', err.message);
    }
  });

  // 7:30 AM: Intelligence Recap Synthesis
  cron.schedule('30 7 * * *', async () => {
    try {
      // Check if auto-scrub is enabled
      const fetch = require('node-fetch');
      const settings = await fetch(`http://localhost:${PORT}/api/settings`).then(r => r.json());
      if (!settings.autoScrubEnabled) {
        return console.log('[Scheduler] 7:30 AM: Skipping auto-recap (Toggled OFF in settings).');
      }

      const jwt = require('jsonwebtoken');
      const mockToken = jwt.sign({ id: 'system', role: 'admin' }, process.env.JWT_SECRET || 'secret123');
      await fetch(`http://localhost:${PORT}/api/news/recap`, { 
        method: 'POST',
        headers: { 'Authorization': `Bearer ${mockToken}` }
      });
      console.log('[Scheduler] 7:30 AM Recap Complete.');
    } catch (err) {
      console.error('[Scheduler] 7:30 AM Recap Failed:', err.message);
    }
  });
};

const seedDatabase = async () => {
  try {
    const dataDir = path.join(__dirname, 'data');
    const accPath = path.join(dataDir, 'accounts.json');
    const usersPath = path.join(dataDir, 'users.json');
    const ticketsPath = path.join(dataDir, 'tickets.json');
    const newsPath = path.join(dataDir, 'intelligence.json');
    
    // Ensure data directory exists locally
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    console.log(`[Seed] Checking database state... (Cloud: ${isCloud})`);

    // Check cloud (or local fallback) for existing properties
    const existingAccounts = await readAll('accounts', accPath);
    const existingTickets = await readAll('tickets', ticketsPath);
    
    const hasTestPilot = existingAccounts.some(a => a.partnerTag === 'testpilot');
    const needsSeeding = !hasTestPilot || existingAccounts.length < 5 || existingTickets.length === 0;

    if (needsSeeding) {
      console.log('[Seed] Initializing missing database items with FAIL-SAFE embedded data...');
      
      const { SEED_TICKETS, SEED_ALERTS } = require('./services/seedData');
      
      // 1. Initialize strictly to Local File System 
      if (!fs.existsSync(accPath) || existingAccounts.length < 5) {
        fs.writeFileSync(accPath, JSON.stringify(SEED_ACCOUNTS, null, 2));
      }
      if (!fs.existsSync(usersPath) || (await readAll('users', usersPath)).length < 3) {
        fs.writeFileSync(usersPath, JSON.stringify(SEED_USERS, null, 2));
      }
      if (!fs.existsSync(ticketsPath) || existingTickets.length === 0) {
        fs.writeFileSync(ticketsPath, JSON.stringify(SEED_TICKETS, null, 2));
      }
      if (!fs.existsSync(newsPath)) {
        fs.writeFileSync(newsPath, JSON.stringify({ alerts: SEED_ALERTS }, null, 2));
      }
      
      // 2. Push to Cloud (if active deployment)
      if (isCloud) {
        console.log('[Seed] Mirroring seed data to Google Firestore...');
        // Parallelizing pushes for speed and robustness
        await Promise.all([
          ...SEED_ACCOUNTS.map(a => writeOne('accounts', a.id, a)),
          ...SEED_USERS.map(u => writeOne('users', u.id, u)),
          ...SEED_TICKETS.map(t => writeOne('tickets', t.id, t)),
          writeOne('news', 'daily_alerts', { alerts: SEED_ALERTS })
        ]);
      }
      
      console.log('[Seed] Provisioning complete: Accounts, Users, Tickets, and Alerts live.');
    } else {
      console.log(`[Seed] Database already contains ${existingAccounts.length} accounts and ${existingTickets.length} tickets. Skipping seed.`);
    }
  } catch (err) {
    console.error('[Seed] Persistence error:', err.message);
  }
};

// ─── API Router Gateway ────────────────────
app.use('/api', usersRouter); // Handle /api/users, /api/auth/login, etc inside usersRouter

// Protection for everything else under /api (Catch-all)
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  authMiddleware(req, res, next);
});

// Routes
app.use('/api/accounts', accountsRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/news', newsRouter);
app.use('/api/health', healthRouter);
app.use('/api/settings', settingsRouter);

// Serve UI
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Scheduler & Seed
startDailyScheduler();
seedDatabase();

// Global Error Handler (Prevents "Status 1" Crashes)
process.on('uncaughtException', (err) => {
  console.error('🔥 CRITIAL ERROR (Server Crash Prevented):', err.message);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 CSM Intelligence Dashboard running at http://0.0.0.0:${PORT}`);
  console.log(`🕐 Staggered scrub scheduled (7:00 & 7:30 AM)\n`);
});
