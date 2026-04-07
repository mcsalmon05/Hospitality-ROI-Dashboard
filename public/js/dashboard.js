/* ═══════════════════════════════════════════════════════════════
   DASHBOARD.JS — Main Dashboard View
   ═══════════════════════════════════════════════════════════════ */
window.Dashboard = {
  accounts: [],
  triage: [],

  async init() {
    await Promise.all([
      this.loadKPIs(),
      this.loadHealthTable(),
      this.loadTriageSidebar(),
      this.loadIntelPreview(),
      this.loadBriefing()
    ]);
  },

  async loadBriefing() {
    try {
      const res = await fetch(`${API}/news/recap`);
      const data = await res.json();
      
      const summaryEl = document.getElementById('briefing-summary');
      const timeEl = document.getElementById('briefing-time');
      const highlightsEl = document.getElementById('briefing-highlights');
      const escalationEl = document.getElementById('briefing-escalation');

      if (!data.summary) return;

      summaryEl.textContent = data.summary;
      timeEl.textContent = `Last Review: ${new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      escalationEl.textContent = data.escalations;

      highlightsEl.innerHTML = (data.highlights || []).map(h => `
        <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border); padding:10px 12px; border-radius:8px; font-size:0.8rem; line-height:1.4; color:var(--text-secondary);">
          ${h}
        </div>
      `).join('');
    } catch (err) {
      console.error('Briefing Load Failed:', err);
    }
  },

  async loadKPIs() {
    try {
      const data = await fetch(`${API}/accounts/meta/summary`).then(r => r.json());
      // Primary Portfolio KPI
      document.getElementById('kpi-arr').textContent = App.formatCurrency(data.totalMRR);
      document.getElementById('kpi-accounts-count').textContent = `${data.total} properties`;
      
      // Occupancy KPI (reused at-risk slot)
      document.getElementById('kpi-at-risk-arr').textContent = `${data.avgOccupancy}%`;
      document.getElementById('kpi-at-risk-count').textContent = `Avg Portfolio Occupancy`;
      
      // RevPAR KPI (reused renewing slot)
      document.getElementById('kpi-renewing').textContent = `$${data.avgRevPAR}`;
      document.getElementById('kpi-renewing-arr').textContent = `Avg RevPAR Portfolio`;
      
      // Health KPI
      document.getElementById('kpi-avg-health').textContent = `${data.avgHealthScore}/100`;
      document.getElementById('kpi-healthy-count').textContent = `${data.healthyCount} properties healthy`;
      
      // Expansion ROI badge
      const expEl = document.getElementById('kpi-expansion-mrr');
      if (expEl) expEl.textContent = `+${App.formatCurrency(data.expansionMRR || 0)} expansion ROI`;

      // Make KPI cards clickable
      const kpiLinks = {
        'kpi-card-arr':     'accounts',
        'kpi-card-risk':    'accounts',
        'kpi-card-renewal': 'accounts',
        'kpi-card-health':  'accounts'
      };
      Object.entries(kpiLinks).forEach(([id, view]) => {
        const el = document.getElementById(id);
        if (el) el.onclick = () => App.navigate(view);
      });
    } catch(e) { console.warn('[Dashboard] KPI load failed', e); }
  },

  async loadHealthTable(filter = 'all') {
    const tbody = document.getElementById('health-table-body');
    try {
      const accounts = await fetch(`${API}/accounts`).then(r => r.json());
      this.accounts = accounts;
      let filtered = filter === 'all' ? accounts : accounts.filter(a => a.status === filter);

      // Always sort: Critical first → At Risk → Healthy, then by urgency within each group
      const statusOrder = { 'Critical': 0, 'At Risk': 1, 'Healthy': 2 };
      filtered = filtered.sort((a, b) => {
        const statusDiff = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
        if (statusDiff !== 0) return statusDiff;
        // Within same status: lower health score = more urgent = first
        if (a.healthScore !== b.healthScore) return a.healthScore - b.healthScore;
        // Then by days to renewal ascending
        return a.daysToRenewal - b.daysToRenewal;
      });

      if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="table-loading">No accounts found</td></tr>`;
        return;
      }

      tbody.innerHTML = filtered.map(acc => {
        const healthColor = App.getHealthColor(acc.healthScore);
        const statusClass = App.getStatusClass(acc.status).toLowerCase();
        const tagColor = statusClass === 'healthy' ? 'green' : statusClass === 'at-risk' ? 'amber' : 'red';
        return `
          <tr onclick="Accounts.showDetail('${acc.id}')" style="cursor:pointer">
            <td>
              <div class="account-name-cell" style="display:flex;flex-direction:column;">
                <span style="font-weight:600;color:var(--text-primary);">${acc.name}</span>
                <span style="font-size:0.72rem;color:var(--text-muted);">${acc.industry || '—'}</span>
              </div>
            </td>
            <td>
              <div class="health-score" style="display:flex;align-items:center;gap:8px;">
                <div style="flex:1;height:4px;background:var(--bg-elevated);border-radius:99px;max-width:60px;">
                  <div style="width:${acc.healthScore}%;height:100%;background:${healthColor};border-radius:99px;"></div>
                </div>
                <span style="font-size:0.82rem;font-weight:700;color:${healthColor};min-width:24px;">${acc.healthScore}</span>
              </div>
            </td>
            <td>
              <div style="display:flex;flex-direction:column;">
                <span style="font-weight:600;">$${acc.revPar || 0}</span>
                <span style="font-size:0.68rem;color:var(--text-muted);">RevPAR</span>
              </div>
            </td>
            <td>
              <div style="display:flex;flex-direction:column;">
                <span style="font-weight:600;">${acc.occupancyPct || 0}%</span>
                <span style="font-size:0.68rem;color:var(--text-muted);">Occupancy</span>
              </div>
            </td>
            <td>
              ${acc.openTickets > 0 
                ? `<span style="font-weight:600;color:${acc.openTickets > 5 ? 'var(--accent-red)' : 'var(--text-primary)'}">${acc.openTickets}</span><span style="color:var(--text-muted);font-size:0.77rem;"> open</span>`
                : `<span style="color:var(--text-muted)">—</span>`}
            </td>
            <td><span style="color:var(--text-secondary);font-size:0.82rem;">${acc.csm || '—'}</span></td>
            <td>
              <span class="badge badge--${tagColor}">${acc.status}</span>
            </td>
          </tr>`;
      }).join('');
    } catch(e) {
      console.error('[Dashboard] Health table load error:', e);
      tbody.innerHTML = `<tr><td colspan="7" class="table-loading">Failed to load accounts</td></tr>`;
    }
  },

  filterAccounts(filter) {
    this.loadHealthTable(filter);
  },

  async loadTriageSidebar() {
    const el = document.getElementById('triage-list');
    const badge = document.getElementById('triage-count-badge');
    const card = document.querySelector('.card .card-header .card-title');
    try {
      const triage = await fetch(`${API}/health/triage`).then(r => r.json());
      this.triage = triage;
      if (badge) badge.textContent = triage.length;

      // Make the triage card header clickable
      const triageCard = el?.closest('.card');
      if (triageCard) {
        triageCard.querySelector('.card-header').style.cursor = 'pointer';
        triageCard.querySelector('.card-header').onclick = () => App.navigate('triage');
      }

      if (!triage.length) {
        el.innerHTML = `<div class="empty-state-sm">✅ No accounts in triage</div>`;
        return;
      }

      el.innerHTML = triage.slice(0, 5).map(acc => {
        const cls = acc.status === 'Critical' ? 'triage-item--critical' : 'triage-item--at-risk';
        const actions = [];
        if (acc.daysToRenewal <= 30) actions.push({ label: `${acc.daysToRenewal}d to renewal`, amber: false });
        if (acc.escalatedTickets > 0) actions.push({ label: `${acc.escalatedTickets} escalated`, amber: false });
        if (acc.openTickets > 5) actions.push({ label: `${acc.openTickets} open tickets`, amber: true });
        return `
          <div class="triage-item ${cls}" onclick="Accounts.showDetail('${acc.id}')">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span class="triage-item-name">${acc.name}</span>
              <span style="font-family:'JetBrains Mono',monospace;font-size:0.8rem;color:${App.getHealthColor(acc.healthScore)};font-weight:700">${acc.healthScore}</span>
            </div>
            <div class="triage-item-actions">
              ${actions.map(a => `<span class="triage-action-tag${a.amber ? ' triage-action-tag--amber' : ''}">${a.label}</span>`).join('')}
            </div>
          </div>`;
      }).join('');

      // Add "View All" link
      if (triage.length > 5) {
        el.innerHTML += `<div style="text-align:center;padding:8px 0;"><button class="btn-link" onclick="App.navigate('triage')">View all ${triage.length} →</button></div>`;
      }
    } catch(e) {
      el.innerHTML = `<div class="empty-state-sm">Unable to load triage</div>`;
    }
  },

  async loadIntelPreview() {
    const el = document.getElementById('intel-preview-list');
    try {
      const res = await fetch(`${API}/news/alerts?dismissed=false`);
      const data = await res.json();
      
      const alerts = (data.alerts || []).filter(a => a.level === 'critical' || a.level === 'high').slice(0, 4);
      if (!alerts.length) {
        el.innerHTML = `<div class="empty-state-sm">No active alerts — run a scrub to monitor accounts</div>`;
        return;
      }

      el.innerHTML = alerts.map(a => `
        <div class="intel-preview-item" onclick="App.navigate('intelligence')" style="position:relative;">
          <span class="intel-preview-item-icon">${App.getLevelIcon(a.level)}</span>
          <div class="intel-preview-item-body">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span class="intel-preview-account">${a.accountName}</span>
              ${(window.currentPartnerTag === null || window.currentPartnerTag === 'all') ? `
                 <span style="font-size:0.6rem; color:${a.partnerTag === 'testpilot' ? '#3b82f6' : '#8b5cf6'}; font-weight:700;">${a.partnerName}</span>
              ` : ''}
            </div>
            <span>${a.title.substring(0, 80)}${a.title.length > 80 ? '...' : ''}</span>
          </div>
        </div>`).join('');
    } catch(e) {
      el.innerHTML = `<div class="empty-state-sm">No active alerts</div>`;
    }
  }
};

// Stub for Renewals (used in renewals view)
window.Renewals = {
  async load() {
    const el = document.getElementById('renewals-pipeline');
    try {
      const renewals = await fetch(`${API}/health/renewals`).then(r => r.json());
      if (!renewals.length) {
        el.innerHTML = `<div class="empty-state"><div class="empty-icon">📅</div><h3>No renewals found</h3></div>`;
        return;
      }

      el.innerHTML = renewals.map(r => {
        const days = r.daysToRenewal;
        let tierClass = 'ok';
        if (days < 30) tierClass = 'critical';
        else if (days < 90) tierClass = 'warning';
        const healthColor = App.getHealthColor(r.healthScore);
        return `
          <div class="renewal-item renewal-item--${tierClass}" onclick="Accounts.showDetail('${r.id}')">
            <div>
              <div class="renewal-name">${r.name}</div>
              <div class="renewal-csm">CSM: ${r.csm} · ${r.tier}</div>
            </div>
            <div class="renewal-value">${App.formatCurrency(r.contractValue)}</div>
            <div class="renewal-date">${App.formatDate(r.contractEnd)}</div>
            <div>
              <div class="health-score">
                <div class="health-bar-track">
                  <div class="health-bar-fill" style="width:${r.healthScore}%;background:${healthColor}"></div>
                </div>
                <span class="health-score-num" style="color:${healthColor}">${r.healthScore}</span>
              </div>
            </div>
            <div class="renewal-countdown ${App.getRenewalClass(days)}">${App.getRenewalLabel(days)}</div>
          </div>`;
      }).join('');
    } catch(e) {
      el.innerHTML = `<div class="empty-state"><h3>Failed to load renewals</h3></div>`;
    }
  }
};

// Stub for Triage full view
window.Triage = {
  async load() {
    const el = document.getElementById('triage-full-list');
    try {
      const triage = await fetch(`${API}/health/overview`).then(r => r.json());
      const prioritized = triage.filter(a => a.requiredActions.length > 0 || a.upsellSignals.length > 0);

      if (!prioritized.length) {
        el.innerHTML = `<div class="empty-state"><div class="empty-icon">✅</div><h3>All clear!</h3><p>No accounts require immediate action.</p></div>`;
        return;
      }

      el.innerHTML = prioritized.map(acc => {
        const statusClass = App.getStatusClass(acc.status);
        const urgencyColor = acc.status === 'Critical' ? 'var(--accent-red)' : acc.status === 'At Risk' ? 'var(--accent-amber)' : 'var(--accent-green)';
        return `
          <div class="triage-full-item triage-full-item--${statusClass}" onclick="Accounts.showDetail('${acc.id}')">
            <div>
              <div class="triage-item-header">
                <span class="badge badge--${statusClass === 'healthy' ? 'green' : statusClass === 'at-risk' ? 'amber' : 'red'}">${acc.status}</span>
                <div>
                  <div class="triage-item-title">${acc.name}</div>
                  <div class="triage-item-meta">${App.formatCurrency(acc.contractValue)} ARR · ${acc.tier} · CSM: ${acc.csm}</div>
                </div>
              </div>
              ${acc.requiredActions.length ? `
                <div class="triage-actions-list">
                  ${acc.requiredActions.map(a => `<div class="triage-action-row">${a.message}</div>`).join('')}
                </div>` : ''}
              ${acc.upsellSignals.length ? `
                <div class="triage-upsell-list">
                  ${acc.upsellSignals.map(s => `<div class="triage-upsell-row">${s}</div>`).join('')}
                </div>` : ''}
            </div>
            <div class="urgency-score">
              <span class="urgency-num" style="color:${urgencyColor}">${acc.healthScore}</span>
              <span class="urgency-label">Health Score</span>
              <span style="font-size:0.77rem;color:var(--text-muted);margin-top:4px;">${App.getRenewalLabel(acc.daysToRenewal)} to renewal</span>
            </div>
          </div>`;
      }).join('');
    } catch(e) {
      el.innerHTML = `<div class="empty-state"><h3>Failed to load triage data</h3></div>`;
    }
  }
};
