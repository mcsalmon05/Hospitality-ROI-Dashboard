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
  
  cron.schedule('0 7 * * *', async () => {
    console.log('[Scheduler] Running Automated 7:00 AM Daily Scrub...');
    try {
      const fetch = require('node-fetch');
      // Perform News Scrub (Dual internal call) 
      await fetch('http://localhost:3000/api/news/scrub', { method: 'POST' });
      console.log('[Scheduler] Daily Scrub Complete.');
    } catch (err) {
      console.error('[Scheduler] Daily Scrub Failed:', err.message);
    }
  });

  cron.schedule('30 7 * * *', async () => {
    console.log('[Scheduler] Generating 7:30 AM Daily Intelligence Briefing...');
    try {
      const fetch = require('node-fetch');
      await fetch('http://localhost:3000/api/news/recap', { method: 'POST' });
      console.log('[Scheduler] Daily Briefing Complete.');
    } catch (err) {
      console.error('[Scheduler] Daily Briefing Failed:', err.message);
    }
  });
};

// Routes
app.use('/api/accounts', require('./routes/accounts'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/news', require('./routes/news'));
app.use('/api/health', require('./routes/health'));

// Serve UI
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

startDailyScheduler();

app.listen(PORT, () => {
  console.log(`\n🚀 CSM Intelligence Dashboard running at http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔌 API:       http://localhost:${PORT}/api`);
  console.log(`🕐 Staggered scrub scheduled (7:00 & 7:30 AM)\n`);
});
