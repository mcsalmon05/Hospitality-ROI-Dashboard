const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');

const accountsRouter = require('./routes/accounts');
const ticketsRouter = require('./routes/tickets');
const newsRouter = require('./routes/news');
const healthRouter = require('./routes/health');
const { router: usersRouter, authMiddleware } = require('./routes/users');
const { runIntelligenceScrub } = require('./routes/news');
const { isCloud, readAll, writeOne } = require('./services/db');
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
      const fetch = require('node-fetch');
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
      const fetch = require('node-fetch');
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

// ─── Auto-Seed Cloud Data ──────────────────────────────────
const seedDatabase = async () => {
  if (!isCloud) return;
  try {
    const existing = await readAll('accounts', path.join(__dirname, 'data/accounts.json'));
    if (existing.length < 5) {
      console.log('[Cloud Seed] Initializing Firestore with local seed data...');
      const localAcc = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/accounts.json'), 'utf8'));
      for (const a of localAcc) await writeOne('accounts', a.id, a);
      
      const localUsers = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/users.json'), 'utf8'));
      for (const u of localUsers) await writeOne('users', u.id, u);
      
      console.log('[Cloud Seed] Success: 11 properties and partners provisioned.');
    }
  } catch (err) {
    console.error('[Cloud Seed] Failed:', err.message);
  }
};

// ─── API Router Gateway ────────────────────
app.use('/api', usersRouter); // Handle /api/users, /api/auth/login, etc inside usersRouter

// Protection for everything else under /api (Catch-all)
app.use('/api', (req, res, next) => {
  authMiddleware(req, res, next);
});

// Routes
app.use('/api/accounts', accountsRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/news', newsRouter);
app.use('/api/health', healthRouter);

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
