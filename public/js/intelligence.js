/* ═══════════════════════════════════════════════════════════════
   INTELLIGENCE.JS — Account Intelligence / News Scrub View
   ═══════════════════════════════════════════════════════════════ */
window.Intelligence = {
  allAlerts: [],
  levelFilter: 'all',
  accountFilter: 'all',

  async load() {
    this.accountFilter = 'all';
    this.levelFilter = 'all';
    
    // Reset GUI selects to visually match DOM
    const accSel = document.getElementById('intel-account-filter');
    const lvlSel = document.getElementById('intel-level-filter');
    if (accSel) accSel.value = 'all';
    if (lvlSel) lvlSel.value = 'all';

    try {
      const [data, accounts] = await Promise.all([
        fetch(`${API}/news/alerts`).then(r => r.json()),
        fetch(`${API}/accounts`).then(r => r.json())
      ]);

      this.allAlerts = data.alerts || [];
      this.populateAccountFilter(accounts);
      this.renderSummary(data);
      this.renderScrubInfo(data);
      this.render(this.allAlerts);
    } catch(e) {
      document.getElementById('intel-alerts-list').innerHTML = `<div class="empty-state"><h3>Failed to load intelligence data</h3></div>`;
    }
  },

  populateAccountFilter(accounts) {
    const el = document.getElementById('intel-account-filter');
    if (!el) return;
    el.innerHTML = `<option value="all">All Accounts</option>` +
      accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
  },

  renderSummary(data) {
    const el = document.getElementById('intel-summary-row');
    if (!el) return;
    const alerts = data.alerts || [];
    const active = alerts.filter(a => !a.dismissed);
    const critical = active.filter(a => a.level === 'critical').length;
    const high     = active.filter(a => a.level === 'high').length;
    const medium   = active.filter(a => a.level === 'medium').length;
    const positive = active.filter(a => a.level === 'positive').length;

    el.innerHTML = `
      <div class="intel-summary-card">
        <div class="intel-summary-num">${active.length}</div>
        <div class="intel-summary-label">Active Alerts</div>
      </div>
      <div class="intel-summary-card">
        <div class="intel-summary-num" style="color:var(--accent-red)">${critical}</div>
        <div class="intel-summary-label">🔴 Critical</div>
      </div>
      <div class="intel-summary-card">
        <div class="intel-summary-num" style="color:var(--accent-amber)">${high}</div>
        <div class="intel-summary-label">🟠 High</div>
      </div>
      <div class="intel-summary-card">
        <div class="intel-summary-num" style="color:var(--accent-blue)">${medium}</div>
        <div class="intel-summary-label">🟡 Monitor</div>
      </div>
      <div class="intel-summary-card">
        <div class="intel-summary-num" style="color:var(--accent-green)">${positive}</div>
        <div class="intel-summary-label">🟢 Opportunity</div>
      </div>
    `;
  },

  renderScrubInfo(data) {
    const el = document.getElementById('scrub-info');
    if (!el) return;
    if (data.lastScrub) {
      el.innerHTML = `Last scrub: <strong>${App.formatDate(data.lastScrub)}</strong>`;
    } else {
      el.innerHTML = `No scrub has been run yet`;
    }
  },

  filterLevel(level) {
    this.levelFilter = level;
    this.applyFilters();
  },

  filterAccount(accountId) {
    this.accountFilter = accountId;
    this.applyFilters();
  },

  applyFilters() {
    let result = this.allAlerts;
    if (this.levelFilter !== 'all') result = result.filter(a => a.level === this.levelFilter);
    if (this.accountFilter !== 'all') result = result.filter(a => a.accountId === this.accountFilter);
    this.render(result);
  },

  render(alerts) {
    const el = document.getElementById('intel-alerts-list');
    if (!alerts || !alerts.length) {
      el.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🧠</div>
          <h3>No Intelligence Alerts</h3>
          <p>Run an intelligence scrub to monitor your accounts for business-critical news</p>
          <button class="btn btn--primary" onclick="App.triggerScrub()">
            🔍 Run Intelligence Scrub
          </button>
        </div>`;
      return;
    }

    // Sort: critical > high > medium > positive, then by date
    const levelOrder = { critical: 0, high: 1, medium: 2, positive: 3 };
    const sorted = [...alerts].sort((a,b) => {
      if (a.dismissed !== b.dismissed) return a.dismissed ? 1 : -1;
      const lo = (levelOrder[a.level] ?? 9) - (levelOrder[b.level] ?? 9);
      if (lo !== 0) return lo;
      return new Date(b.pubDate) - new Date(a.pubDate);
    });

    el.innerHTML = sorted.map(alert => {
      const levelColor = App.getLevelColor(alert.level);
      const dimClass = alert.dismissed ? 'intel-alert--dismissed' : '';
      return `
        <div class="intel-alert intel-alert--${alert.level} ${dimClass}" id="alert-${alert.id}">
          <div class="intel-alert-icon">${App.getLevelIcon(alert.level)}</div>
          <div class="intel-alert-body">
            <div class="intel-alert-level" style="color:${levelColor}">${alert.levelLabel}</div>
            <div class="intel-alert-title">
              <a href="${alert.link}" target="_blank" rel="noopener">${alert.title}</a>
            </div>
            <div class="intel-alert-meta">
              <strong>${alert.accountName}</strong> · ${alert.source} · ${App.formatDate(alert.pubDate)}
              · keyword: <em style="color:${levelColor}">${alert.keyword}</em>
            </div>
            ${alert.summary ? `<div class="intel-alert-summary">${alert.summary}...</div>` : ''}
          </div>
          <div class="intel-alert-actions" style="position:relative;">
            ${!alert.dismissed ? `
              <button class="btn btn--ghost" style="font-size:0.75rem;padding:5px 10px;" onclick="Intelligence.dismiss('${alert.id}')">Dismiss</button>
            ` : `<span style="font-size:0.72rem;color:var(--text-muted);">Dismissed</span>`}
            <a href="${alert.link}" target="_blank" class="btn btn--secondary" style="font-size:0.75rem;padding:5px 10px;">Open ↗</a>
            
            <!-- Partner Tag (Admin Global View) -->
            ${(window.currentPartnerTag === null || window.currentPartnerTag === 'all') ? `
              <div style="position:absolute; bottom:0; right:0; font-size:0.65rem; padding:2px 6px; background:rgba(255,255,255,0.05); border-radius:4px; color:${alert.partnerTag === 'testpilot' ? '#3b82f6' : '#8b5cf6'}; font-weight:600; text-transform:uppercase; letter-spacing:0.02em;">
                ${alert.partnerName}
              </div>
            ` : ''}
          </div>
        </div>`;
    }).join('');
  },

  async dismiss(id) {
    try {
      await fetch(`${API}/news/alerts/${id}/dismiss`, { method: 'PUT' });
      // Visually update without full reload
      const el = document.getElementById(`alert-${id}`);
      if (el) {
        el.classList.add('intel-alert--dismissed');
        const btn = el.querySelector('.btn--ghost');
        if (btn) btn.replaceWith(Object.assign(document.createElement('span'), {
          style: 'font-size:0.72rem;color:var(--text-muted);', textContent: 'Dismissed'
        }));
      }
      // Update the in-memory array
      const a = this.allAlerts.find(a => a.id === id);
      if (a) a.dismissed = true;
      App.toast('Alert dismissed', 'success');
    } catch(e) {
      App.toast('Failed to dismiss alert', 'error');
    }
  },

  async clearDismissed() {
    try {
      await fetch(`${API}/news/alerts/dismissed`, { method: 'DELETE' });
      App.toast('Cleared dismissed alerts', 'success');
      await this.load();
    } catch(e) {
      App.toast('Failed to clear dismissed alerts', 'error');
    }
  }
};
