/* ═══════════════════════════════════════════════════════════════
   ACCOUNTS.JS — Account Grid, Detail Modal, Add/Edit
   ═══════════════════════════════════════════════════════════════ */
window.Accounts = {
  allAccounts: [],
  filtered: [],
  statusFilter: 'all',
  csmFilter: 'all',
  searchQuery: '',

  async load() {
    try {
      const accounts = await fetch(`${API}/accounts`).then(r => r.json());
      this.allAccounts = accounts;
      this.filtered = accounts;
      this.populateCSMFilter(accounts);
      this.render();
    } catch(e) {
      document.getElementById('accounts-grid').innerHTML = `<div class="empty-state"><h3>Failed to load accounts</h3></div>`;
    }
  },

  populateCSMFilter(accounts) {
    const el = document.getElementById('csm-filter');
    if (!el) return;
    const csms = [...new Set(accounts.map(a => a.csm).filter(Boolean))];
    const current = el.value;
    el.innerHTML = `<option value="all">All CSMs</option>` + csms.map(c => `<option value="${c}">${c}</option>`).join('');
    el.value = current;
  },

  search(q) {
    this.searchQuery = q.toLowerCase();
    this.applyFilters();
  },

  filterStatus(status) {
    this.statusFilter = status;
    this.applyFilters();
  },

  filterCSM(csm) {
    this.csmFilter = csm;
    this.applyFilters();
  },

  applyFilters() {
    let result = this.allAccounts;
    if (this.statusFilter !== 'all') result = result.filter(a => a.status === this.statusFilter);
    if (this.csmFilter !== 'all') result = result.filter(a => a.csm === this.csmFilter);
    if (this.searchQuery) {
      result = result.filter(a =>
        a.name.toLowerCase().includes(this.searchQuery) ||
        (a.industry || '').toLowerCase().includes(this.searchQuery) ||
        (a.csm || '').toLowerCase().includes(this.searchQuery) ||
        (a.domain || '').toLowerCase().includes(this.searchQuery)
      );
    }
    // Always sort Critical → At Risk → Healthy, then by health score asc within each group
    const statusOrder = { 'Critical': 0, 'At Risk': 1, 'Healthy': 2 };
    result = result.slice().sort((a, b) => {
      const sd = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
      if (sd !== 0) return sd;
      if (a.healthScore !== b.healthScore) return a.healthScore - b.healthScore;
      return a.daysToRenewal - b.daysToRenewal;
    });
    this.filtered = result;
    this.render();
  },

  render() {
    const grid = document.getElementById('accounts-grid');
    if (!this.filtered.length) {
      grid.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><h3>No accounts found</h3><p>Try adjusting your filters</p></div>`;
      return;
    }

    grid.innerHTML = this.filtered.map(acc => {
      const healthColor = App.getHealthColor(acc.healthScore);
      const statusClass = App.getStatusClass(acc.status);
      const tagBadge = acc.status === 'Critical' ? 'badge--red' : acc.status === 'At Risk' ? 'badge--amber' : 'badge--green';
      const gaugeStyle = `border-color: ${healthColor}; color: ${healthColor};`;
      const sentimentColor = acc.reviewScore >= 4.5 ? 'var(--accent-green)' : acc.reviewScore >= 3.5 ? 'var(--accent-amber)' : 'var(--accent-red)';
      const payIcon = { good: '✅', late: '⚠️', 'at-risk': '🚨' }[acc.paymentStatus] || '—';
      
      return `
        <div class="account-card account-card--${statusClass}" onclick="Accounts.showDetail('${acc.id}')">
          <div class="account-card-header">
            <div class="account-card-meta">
              <span class="account-card-name">${acc.name}</span>
              <span class="account-card-sub">${acc.industry || ''} · ${acc.totalRooms || 0} keys</span>
            </div>
            <span class="badge ${tagBadge}">${acc.status}</span>
          </div>

          <div class="account-card-stats">
            <div class="account-stat">
              <span class="account-stat-label">RevPAR</span>
              <span class="account-stat-value" style="color:var(--accent-blue)">$${acc.revPar || 0}</span>
            </div>
            <div class="account-stat">
              <span class="account-stat-label">Occupancy</span>
              <span class="account-stat-value">${acc.occupancyPct || 0}%</span>
            </div>
            <div class="account-stat">
              <span class="account-stat-label">Direct %</span>
              <span class="account-stat-value" style="color:var(--accent-green)">${acc.directBookingPct || 0}%</span>
            </div>
            <div class="account-stat">
              <span class="account-stat-label">GOPPAR</span>
              <span class="account-stat-value">$${acc.goppar || 0}</span>
            </div>
            <div class="account-stat">
              <span class="account-stat-label">Sentiment</span>
              <span class="account-stat-value" style="color:${sentimentColor}">${acc.reviewScore || 0} <span style="font-size:0.6rem">★</span></span>
            </div>
            <div class="account-stat">
              <span class="account-stat-label">Tickets</span>
              <span class="account-stat-value" style="color:${acc.openTickets > 5 ? 'var(--accent-red)' : 'var(--text-primary)'}">${acc.openTickets || 0}</span>
            </div>
          </div>

          <div class="account-card-footer">
            <span class="account-card-csm">👤 ${acc.csm || '—'} &nbsp; ${payIcon}</span>
            <div class="health-gauge">
              <span style="font-size:0.72rem;color:var(--text-muted)">Health</span>
              <div class="gauge-ring" style="${gaugeStyle}">${acc.healthScore}</div>
            </div>
          </div>
        </div>`;
    }).join('');
  },

  async showDetail(id) {
    const overlay = document.getElementById('account-modal-overlay');
    const content = document.getElementById('account-modal-content');
    overlay.classList.add('active');
    content.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted)">Loading...</div>';

    try {
      const [acc, tickets, intelData] = await Promise.all([
        fetch(`${API}/accounts/${id}`).then(r => r.json()),
        fetch(`${API}/tickets?accountId=${id}`).then(r => r.json()),
        fetch(`${API}/news/alerts?accountId=${id}&dismissed=false`).then(r => r.json())
      ]);

      const healthColor = App.getHealthColor(acc.healthScore);
      const tagBadge = acc.status === 'Critical' ? 'badge--red' : acc.status === 'At Risk' ? 'badge--amber' : 'badge--green';
      const alerts = intelData.alerts || [];
      const openTickets = tickets.filter(t => t.status !== 'Resolved');
      const bd = acc.scoreBreakdown || {};
      const paymentBadge = { good: 'badge--green', late: 'badge--amber', 'at-risk': 'badge--red' }[acc.paymentStatus] || 'badge--grey';
      const paymentLabel = { good: '✅ Good Standing', late: '⚠️ Payment Late', 'at-risk': '🚨 At Risk' }[acc.paymentStatus] || '—';

      // Build score breakdown bars
      const breakdownHtml = bd && Object.keys(bd).length ? `
        <div class="modal-section">
          <div class="modal-section-title">Health Score Breakdown</div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${Object.values(bd).map(s => {
              const pct = Math.round((s.score / s.max) * 100);
              const barColor = pct >= 75 ? 'var(--accent-green)' : pct >= 40 ? 'var(--accent-amber)' : 'var(--accent-red)';
              return `
                <div style="display:flex;align-items:center;gap:10px;">
                  <span style="font-size:0.75rem;color:var(--text-muted);min-width:130px;">${s.label}</span>
                  <div style="flex:1;height:6px;background:var(--bg-elevated);border-radius:99px;overflow:hidden;">
                    <div style="width:${pct}%;height:100%;background:${barColor};border-radius:99px;transition:width 0.6s;"></div>
                  </div>
                  <span style="font-family:'JetBrains Mono',monospace;font-size:0.72rem;color:var(--text-secondary);min-width:40px;text-align:right;">${s.score}/${s.max}</span>
                </div>`;
            }).join('')}
          </div>
        </div>` : '';

      content.innerHTML = `
        <div class="modal-header">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px;">
            <div>
              <div class="modal-account-name">${acc.name}</div>
              <div class="modal-account-meta">${acc.domain || ''} · ${acc.industry || ''} · ${acc.tier || ''} tier</div>
            </div>
            <div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:8px;">
              <span class="badge ${tagBadge} badge--lg">${acc.status}</span>
              <div class="health-gauge">
                <div class="gauge-ring" style="border-color:${healthColor};color:${healthColor};width:48px;height:48px;font-size:0.85rem;">${acc.healthScore}/100</div>
              </div>
            </div>
          </div>
        </div>

        ${breakdownHtml}

        <div class="modal-section">
          <div class="modal-section-title">Hospitality ROI & Performance</div>
          <div class="modal-stats-grid">
            <div class="modal-stat">
              <div class="modal-stat-label">RevPAR</div>
              <div class="modal-stat-value" style="color:var(--accent-blue);">$${acc.revPar || 0}</div>
            </div>
            <div class="modal-stat">
              <div class="modal-stat-label">Occupancy %</div>
              <div class="modal-stat-value">${acc.occupancyPct || 0}%</div>
            </div>
            <div class="modal-stat">
              <div class="modal-stat-label">Direct Booking Shift</div>
              <div class="modal-stat-value" style="color:var(--accent-green);">${acc.directBookingPct || 0}%</div>
            </div>
            <div class="modal-stat">
              <div class="modal-stat-label">ADR</div>
              <div class="modal-stat-value">$${acc.adr || 0}</div>
            </div>
            <div class="modal-stat">
              <div class="modal-stat-label">GOPPAR</div>
              <div class="modal-stat-value" style="color:var(--accent-green);">$${acc.goppar || 0}</div>
            </div>
            <div class="modal-stat">
              <div class="modal-stat-label">Guest Sentiment</div>
              <div class="modal-stat-value" style="color:${acc.reviewScore >= 4.0 ? 'var(--accent-green)' : 'var(--accent-amber)'}">${acc.reviewScore || 0} / 5</div>
            </div>
          </div>
        </div>

        <div class="modal-section">
          <div class="modal-section-title">Portfolio & Contract</div>
          <div class="modal-stats-grid">
            <div class="modal-stat">
              <div class="modal-stat-label">Contract MRR</div>
              <div class="modal-stat-value">${App.formatCurrency(acc.contractValue)}</div>
            </div>
            <div class="modal-stat">
              <div class="modal-stat-label">Total Inventory</div>
              <div class="modal-stat-value">${acc.totalRooms || 0} rooms</div>
            </div>
            <div class="modal-stat">
              <div class="modal-stat-label">Renewal In</div>
              <div class="modal-stat-value ${App.getRenewalClass(acc.daysToRenewal)}">${App.getRenewalLabel(acc.daysToRenewal)}</div>
            </div>
            <div class="modal-stat">
              <div class="modal-stat-label">Contract End</div>
              <div class="modal-stat-value" style="font-size:0.9rem;">${App.formatDate(acc.contractEnd)}</div>
            </div>
            <div class="modal-stat">
              <div class="modal-stat-label">Payment Status</div>
              <div class="modal-stat-value"><span class="badge ${paymentBadge}" style="font-size:0.72rem;">${paymentLabel}</span></div>
            </div>
          </div>
        </div>

        <div class="modal-section">
          <div class="modal-section-title">Operational Health</div>
          <div class="modal-stats-grid">
            <div class="modal-stat">
              <div class="modal-stat-label">Feature Adoption</div>
              <div class="modal-stat-value">${acc.featureAdoptionScore || 0}%</div>
            </div>
            <div class="modal-stat">
              <div class="modal-stat-label">Onboarding</div>
              <div class="modal-stat-value">${acc.onboardingCompletePct || 0}%</div>
            </div>
            <div class="modal-stat">
              <div class="modal-stat-label">Open Tickets</div>
              <div class="modal-stat-value">${openTickets.length || 0}</div>
            </div>
            <div class="modal-stat">
              <div class="modal-stat-label">Last Login</div>
              <div class="modal-stat-value" style="font-size:0.85rem;">
                ${acc.lastLoginDays === 0 ? 'Today' : `${acc.lastLoginDays}d ago`}
              </div>
            </div>
          </div>
        </div>

        ${acc.contacts && acc.contacts.length ? `
        <div class="modal-section">
          <div class="modal-section-title">Key Contacts</div>
          <div class="modal-contacts">
            ${acc.contacts.map(c => {
              const initials = c.name.split(' ').map(w=>w[0]).join('').substring(0,2);
              return `
                <div class="modal-contact">
                  <div class="modal-contact-avatar">${initials}</div>
                  <div>
                    <div class="modal-contact-name">${c.name} ${c.isPrimary ? '<span style="font-size:0.7rem;color:var(--accent-blue);">● Primary</span>' : ''}</div>
                    <div class="modal-contact-role">${c.role}</div>
                  </div>
                  <div class="modal-contact-email">${c.email}</div>
                </div>`;
            }).join('')}
          </div>
        </div>` : ''}

        ${openTickets.length ? `
        <div class="modal-section">
          <div class="modal-section-title">Open Tickets (${openTickets.length})</div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${openTickets.map(t => `
              <div style="background:var(--bg-elevated);border-radius:var(--radius-sm);padding:12px;display:flex;align-items:center;gap:10px;">
                <span class="priority-dot priority-dot--${t.priority}"></span>
                <div style="flex:1;">
                  <div style="font-size:0.85rem;font-weight:600;">${t.title}</div>
                  <div style="font-size:0.75rem;color:var(--text-muted);">${t.category} · ${t.daysOpen}d open · ${t.status}</div>
                </div>
              </div>`).join('')}
          </div>
        </div>` : ''}

        ${alerts.length ? `
        <div class="modal-section">
          <div class="modal-section-title">🧠 Intelligence Alerts (${alerts.length})</div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${alerts.slice(0,3).map(a => `
              <div style="background:var(--bg-elevated);border-left:3px solid ${App.getLevelColor(a.level)};border-radius:var(--radius-sm);padding:12px;">
                <div style="font-size:0.72rem;font-weight:700;color:${App.getLevelColor(a.level)};text-transform:uppercase;margin-bottom:4px;">${a.levelLabel}</div>
                <div style="font-size:0.82rem;">${a.title}</div>
                <div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px;">${a.source} · ${App.formatDate(a.pubDate)}</div>
              </div>`).join('')}
          </div>
        </div>` : ''}

        ${acc.notes ? `
        <div class="modal-section">
          <div class="modal-section-title">CSM Notes</div>
          <div class="modal-notes">${acc.notes}</div>
        </div>` : ''}

        ${acc.tags && acc.tags.length ? `
        <div class="modal-section">
          <div class="modal-section-title">Tags</div>
          <div class="modal-tags">
            ${acc.tags.map(t => `<span class="modal-tag">${t}</span>`).join('')}
          </div>
        </div>` : ''}

        <div style="display:flex;gap:10px;margin-top:8px;">
          <button class="btn btn--secondary" onclick="Accounts.closeModal()">Close</button>
          <button class="btn btn--ghost" onclick="App.triggerScrubForAccount('${acc.id}','${acc.name}')">🧠 Scrub News</button>
        </div>
      `;
    } catch(e) {
      content.innerHTML = `<div style="padding:40px;text-align:center;color:var(--accent-red)">Failed to load account</div>`;
    }
  },

  closeModal(event) {
    if (event && event.target !== document.getElementById('account-modal-overlay')) return;
    document.getElementById('account-modal-overlay').classList.remove('active');
  },

  showAddModal() {
    App.toast('Account creation form coming soon!', 'info');
  }
};

// Add scrub for a single account
App.triggerScrubForAccount = async function(id, name) {
  App.toast(`Scrubbing news for ${name}...`, 'info', 3000);
  try {
    const res = await fetch(`${API}/news/scrub/${id}`, { method: 'POST' });
    const data = await res.json();
    App.toast(`Found ${data.newAlerts} new alert(s) for ${name}`, 'success');
  } catch(e) {
    App.toast('Scrub failed', 'error');
  }
};
