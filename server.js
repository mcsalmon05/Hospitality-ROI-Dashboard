const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');

const accountsRouter = require('./routes/accounts');
const ticketsRouter = require('./routes/tickets');
const newsRouter = require('./routes/news');
const healthRouter = require('./routes/health');
const { runIntelligenceScrub } = require('./routes/news');

const app = express();
const PORT = process.env.PORT || 3000;

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
      await fetch('http://localhost:3000/api/news/scrub', { method: 'POST' });
      console.log('[Scheduler] 7:00 AM Scrub Complete.');
    } catch (err) {
      console.error('[Scheduler] 7:00 AM Scrub Failed:', err.message);
    }
  });

  // 7:30 AM: Intelligence Recap Synthesis
  cron.schedule('30 7 * * *', async () => {
    try {
      const fetch = require('node-fetch');
      await fetch('http://localhost:3000/api/news/recap', { method: 'POST' });
      console.log('[Scheduler] 7:30 AM Recap Complete.');
    } catch (err) {
      console.error('[Scheduler] 7:30 AM Recap Failed:', err.message);
    }
  });
};

// Routes
app.use('/api/accounts', accountsRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/news', newsRouter);
app.use('/api/health', healthRouter);

// Serve UI
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Scheduler
startDailyScheduler();

// Global Error Handler (Prevents "Status 1" Crashes)
process.on('uncaughtException', (err) => {
  console.error('🔥 CRITIAL ERROR (Server Crash Prevented):', err.message);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 CSM Intelligence Dashboard running at http://0.0.0.0:${PORT}`);
  console.log(`🕐 Staggered scrub scheduled (7:00 & 7:30 AM)\n`);
});
