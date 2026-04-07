/* ═══════════════════════════════════════════════════════════════
   APP.JS — Core App Shell, Navigation, Toast, Utilities
   ═══════════════════════════════════════════════════════════════ */
const API = '/api';

const originalFetch = window.fetch;
window.fetch = async function() {
  let [resource, config] = arguments;
  if (!config) config = {};
  if (!config.headers) config.headers = {};
  
  const token = localStorage.getItem('csm_token');
  if (token) {
    if (config.headers instanceof Headers) {
      config.headers.set('Authorization', `Bearer ${token}`);
    } else {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  }
  
  const res = await originalFetch(resource, config);
  if (res.status === 401 && (!resource || !resource.toString().includes('/auth/login'))) {
    console.warn('[Auth] 401 Unauthorized. Clearing token and forcing login.');
    localStorage.removeItem('csm_token');
    App.showLogin();
  }
  return res;
};

window.App = {
  currentView: 'dashboard',

  async init() {
    if (!localStorage.getItem('csm_token')) {
      this.showLogin();
    } else {
      this.showApp();
      this.setupNavigation();
      this.setupSearch();
      await this.loadBadges();
      await Dashboard.init();
    }
  },

  showLogin() {
    document.getElementById('app-container').style.opacity = '0';
    document.getElementById('app-container').style.visibility = 'hidden';
    document.getElementById('login-overlay').style.display = 'block';
  },

  showApp() {
    document.getElementById('login-overlay').style.display = 'none';
    const appContainer = document.getElementById('app-container');
    appContainer.style.visibility = 'visible';
    appContainer.style.opacity = '1';
    
    if (localStorage.getItem('csm_role') !== 'admin') {
      document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    } else {
      document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
    }
  },

  async login(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('login-btn');
    const err = document.getElementById('login-error');
    err.style.display = 'none';
    btn.textContent = 'Authenticating...';
    btn.disabled = true;

    try {
      const res = await originalFetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      
      if (res.ok && data.token) {
        localStorage.setItem('csm_token', data.token);
        localStorage.setItem('csm_role', data.role); // Store role for UI state
        this.showApp();
        this.setupNavigation();
        this.setupSearch();
        await this.loadBadges();
        await Dashboard.init();
      } else {
        throw new Error('Invalid credentials');
      }
    } catch(e) {
      err.style.display = 'block';
      err.textContent = 'Invalid credentials or server error';
    } finally {
      btn.textContent = 'Authenticate';
      btn.disabled = false;
    }
  },

  logout() {
    localStorage.removeItem('csm_token');
    window.location.reload();
  },

  setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (!item.dataset.view) return;
        e.preventDefault();
        const view = item.dataset.view;
        this.navigate(view);
      });
    });
  },

  async resetPassword(event) {
    event.preventDefault();
    const newPassword = document.getElementById('settings-new-password').value;
    const btn = event.target.querySelector('button[type="submit"]');
    const og = btn.textContent;
    btn.textContent = 'Updating...';
    btn.disabled = true;

    try {
      const res = await fetch(`${API}/users/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword })
      });
      if (!res.ok) throw new Error('Failed to update password');
      App.toast('Password updated successfully', 'success');
      document.getElementById('form-password-reset').reset();
    } catch (err) {
      App.toast(err.message, 'error');
    } finally {
      btn.textContent = og;
      btn.disabled = false;
    }
  },

  async createUser(event) {
    event.preventDefault();
    const name = document.getElementById('create-user-name').value;
    const email = document.getElementById('create-user-email').value;
    const role = document.getElementById('create-user-role').value;
    const password = document.getElementById('create-user-password').value;
    
    const btn = event.target.querySelector('button[type="submit"]');
    const og = btn.textContent;
    btn.textContent = 'Creating...';
    btn.disabled = true;

    try {
      const res = await fetch(`${API}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, role, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user');
      App.toast(`User ${name} created successfully!`, 'success');
      document.getElementById('form-create-user').reset();
    } catch (err) {
      App.toast(err.message, 'error');
    } finally {
      btn.textContent = og;
      btn.disabled = false;
    }
  },

  navigate(view) {
    // Update nav
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const navEl = document.getElementById(`nav-${view}`);
    if (navEl) navEl.classList.add('active');

    // Update views
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    const viewEl = document.getElementById(`view-${view}`);
    if (viewEl) viewEl.classList.add('active');

    this.currentView = view;

    // Update header
    const titles = {
      dashboard: { title: 'Dashboard', subtitle: 'Portfolio health at a glance' },
      accounts: { title: 'Accounts', subtitle: 'All active client accounts' },
      triage: { title: 'Triage Queue', subtitle: 'Accounts requiring immediate attention' },
      tickets: { title: 'Support Tickets', subtitle: 'Open and escalated issues' },
      renewals: { title: 'Renewal Pipeline', subtitle: 'Upcoming contract renewals' },
      intelligence: { title: 'Account Intelligence', subtitle: 'AI-powered news & signal monitoring' },
      data: { title: 'Data Management Center', subtitle: 'Manage client portfolios and hospitality pipelines' },
      settings: { title: 'Account Settings', subtitle: 'Manage security and access' }
    };
    const meta = titles[view] || { title: view, subtitle: '' };
    document.getElementById('page-title').textContent = meta.title;
    document.getElementById('page-subtitle').textContent = meta.subtitle;

    // Lazy-load view content
    switch(view) {
      case 'accounts':    Accounts.load(); break;
      case 'triage':      Triage.load(); break;
      case 'tickets':     Tickets.load(); break;
      case 'renewals':    Renewals.load(); break;
      case 'intelligence': Intelligence.load(); break;
      case 'data':        this.loadDataHub(); break;
    }
  },

  setupSearch() {
    const input = document.getElementById('global-search');
    if (!input) return;
    input.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (this.currentView === 'accounts') Accounts.search(q);
    });
  },

  async loadBadges() {
    try {
      const [accSummary, ticketSummary, intelSummary, triage] = await Promise.all([
        fetch(`${API}/accounts/meta/summary`).then(r => r.json()),
        fetch(`${API}/tickets/meta/summary`).then(r => r.json()),
        fetch(`${API}/news/summary`).then(r => r.json()),
        fetch(`${API}/health/triage`).then(r => r.json())
      ]);

      const el = id => document.getElementById(id);
      if (el('badge-accounts')) el('badge-accounts').textContent = accSummary.total || 0;
      if (el('badge-triage'))   el('badge-triage').textContent   = triage.length || 0;
      if (el('badge-tickets'))  el('badge-tickets').textContent  = ticketSummary.open || 0;
      if (el('badge-intel'))    el('badge-intel').textContent    = (intelSummary.critical + intelSummary.high) || 0;
    } catch (e) {
      console.warn('[App] Badge load failed:', e.message);
    }
  },

  async refresh() {
    App.toast('Refreshing data...', 'info');
    await this.loadBadges();
    switch(this.currentView) {
      case 'dashboard':    await Dashboard.init(); break;
      case 'accounts':     await Accounts.load(); break;
      case 'triage':       await Triage.load(); break;
      case 'tickets':      await Tickets.load(); break;
      case 'renewals':     await Renewals.load(); break;
      case 'intelligence': await Intelligence.load(); break;
    }
    App.toast('Refreshed', 'success');
  },

  async triggerScrub() {
    const btn = document.getElementById('btn-scrub');
    const btn2 = document.getElementById('btn-manual-scrub');
    const statusEl = document.getElementById('scrub-label');
    const sidebar = document.querySelector('.sidebar-footer');

    App.toast('Intelligence scrub started — checking news and performance data...', 'info', 4000);
    
    try {
      // 1. Sync Performance Data (If URL exists)
      const dataUrl = localStorage.getItem('client_data_source_url');
      if (dataUrl) {
        await fetch(`${API}/accounts/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: dataUrl })
        });
      }

      // 2. Perform News Scrub
      const res = await fetch(`${API}/news/scrub`, { method: 'POST' });
      const data = await res.json();
      App.toast(`Scrub complete! Found ${data.newAlerts} new alert(s)`, 'success', 5000);
      await this.loadBadges();
      if (this.currentView === 'intelligence') await Intelligence.load();
      if (this.currentView === 'dashboard') await Dashboard.loadIntelPreview();
    } catch (err) {
      App.toast('Scrub failed — check server connection', 'error');
    } finally {
      if (btn)  { btn.disabled = false; btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Run Intelligence Scrub'; }
      if (btn2) { btn2.disabled = false; btn2.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Run Scrub Now'; }
      if (statusEl) statusEl.textContent = 'Intelligence Ready';
      if (sidebar) sidebar.classList.remove('scrub-running');
    }
  },

  // ─── Utilities ───────────────────────────────────────────────
  formatCurrency(val) {
    if (val >= 1000000) return `$${(val/1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${(val/1000).toFixed(0)}K`;
    return `$${val}`;
  },

  formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  getHealthColor(score) {
    if (score >= 75) return 'var(--status-healthy)';
    if (score >= 50) return 'var(--status-risk)';
    return 'var(--status-critical)';
  },

  getStatusClass(status) {
    const map = { 'Healthy': 'healthy', 'At Risk': 'at-risk', 'Critical': 'critical' };
    return map[status] || 'healthy';
  },

  getRenewalClass(days) {
    if (days < 0)   return 'renewal-days--critical';
    if (days < 30)  return 'renewal-days--critical';
    if (days < 90)  return 'renewal-days--warning';
    if (days < 180) return 'renewal-days--ok';
    return 'renewal-days--healthy';
  },

  getRenewalLabel(days) {
    if (days < 0)   return `${Math.abs(days)}d overdue`;
    if (days === 0) return 'Today!';
    if (days === 1) return 'Tomorrow';
    return `${days}d`;
  },

  getLevelIcon(level) {
    const icons = { critical: '🔴', high: '🟠', medium: '🟡', positive: '🟢' };
    return icons[level] || '⚪';
  },

  getLevelColor(level) {
    const colors = {
      critical: 'var(--accent-red)',
      high: 'var(--accent-amber)',
      medium: 'var(--accent-blue)',
      positive: 'var(--accent-green)'
    };
    return colors[level] || 'var(--text-muted)';
  },

  // ─── Data Center Logic ───────────────────────────────────────
  loadDataHub() {
    console.log('[App] Data Hub loaded');
    // Initial health checks or stats
  },

  downloadTemplate() {
    const template = [
      {
        "id": "hotel-unique-id",
        "name": "Luxury Palm Resort",
        "industry": "Resort & Spa",
        "totalRooms": 250,
        "contractValue": 15000,
        "contractEnd": "2025-12-31",
        "csm": "Consultant Name",
        "tier": "Platinum",
        "occupancyPct": 85,
        "adr": 420.50,
        "revPar": 357.42,
        "goppar": 185.00,
        "directBookingPct": 42,
        "reviewScore": 4.8,
        "openTickets": 2,
        "paymentStatus": "good",
        "featureAdoptionScore": 88,
        "onboardingCompletePct": 100,
        "lastQBR": "2024-03-01"
      }
    ];
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Hospitality_ROI_Data_Standard.json';
    a.click();
    App.toast('Hospitality Standard Schema downloaded', 'success');
  },

  downloadCSVTemplate() {
    const headers = "id,name,industry,totalRooms,contractValue,contractEnd,csm,tier,occupancyPct,adr,revPar,goppar,directBookingPct,reviewScore,openTickets,paymentStatus,featureAdoptionScore,onboardingCompletePct,lastQBR\n";
    const sample = "hotel-001,Luxury Palm Resort,Resort & Spa,250,15000,2025-12-31,Consultant Name,Platinum,85,420.50,357.42,185.00,42,4.8,2,good,88,100,2024-03-01";
    const blob = new Blob([headers + sample], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Hospitality_ROI_Import_Template.csv';
    a.click();
    App.toast('CSV Template downloaded', 'success');
  },

  async syncDataSource() {
    const url = document.getElementById('client-data-url').value;
    if (!url) return App.toast('Please enter a valid URL', 'warning');
    
    App.toast('Syncing external hospitality data...', 'info');
    try {
      const res = await fetch(`${API}/accounts/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      
      localStorage.setItem('client_data_source_url', url);
      document.getElementById('sync-time').textContent = new Date().toLocaleTimeString();
      App.toast(`Successfully synced ${result.count} properties!`, 'success');
      
      if (this.currentView === 'dashboard') await Dashboard.init();
      await this.loadBadges();
    } catch (err) {
      App.toast(`Sync Failed: Check link format`, 'error');
    }
  },

  async handleDataImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    App.toast(`Reading ${file.name}...`, 'info');
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        const accounts = Array.isArray(data) ? data : [data];
        
        // --- Mapping Validation ---
        const invalidRows = accounts.filter(a => !a.id && !a.name);
        if (invalidRows.length > 0) {
          return App.toast(`Import Aborted: Found ${invalidRows.length} properties missing both ID and Name identifiers.`, 'error', 6000);
        }

        const res = await fetch(`${API}/accounts/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accounts })
        });
        const result = await res.json();
        App.toast(`Successfully imported ${result.imported} properties!`, 'success', 5000);
        await this.loadBadges();
        if (this.currentView === 'dashboard') await Dashboard.init();
      } catch (err) {
        App.toast('Import failed - check file format', 'error');
      }
    };
    reader.readAsText(file);
  },

  // ─── Toast ───────────────────────────────────────────────────
  toast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
    toast.innerHTML = `<span style="font-size:1rem;flex-shrink:0;">${icons[type] || 'ℹ'}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = '0.3s';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
