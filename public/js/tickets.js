/* ═══════════════════════════════════════════════════════════════
   TICKETS.JS — Support Ticket View
   ═══════════════════════════════════════════════════════════════ */
window.Tickets = {
  allTickets: [],
  priorityFilter: 'all',
  statusFilter: 'all',

  async load() {
    try {
      const [tickets, summary] = await Promise.all([
        fetch(`${API}/tickets`).then(r => r.json()),
        fetch(`${API}/tickets/meta/summary`).then(r => r.json())
      ]);
      this.allTickets = tickets;
      this.renderKPIs(summary);
      this.render(tickets);
    } catch(e) {
      document.getElementById('tickets-table-body').innerHTML = `<tr><td colspan="7" class="table-loading">Failed to load tickets</td></tr>`;
    }
  },

  renderKPIs(s) {
    const row = document.getElementById('tickets-kpi-row');
    if (!row) return;
    row.innerHTML = `
      <div class="ticket-kpi">
        <div class="ticket-kpi-num">${s.total}</div>
        <div class="ticket-kpi-label">Total</div>
      </div>
      <div class="ticket-kpi">
        <div class="ticket-kpi-num" style="color:var(--accent-blue)">${s.open}</div>
        <div class="ticket-kpi-label">Open</div>
      </div>
      <div class="ticket-kpi">
        <div class="ticket-kpi-num" style="color:var(--accent-red)">${s.escalated}</div>
        <div class="ticket-kpi-label">Escalated</div>
      </div>
      <div class="ticket-kpi">
        <div class="ticket-kpi-num" style="color:var(--accent-red)">${s.critical}</div>
        <div class="ticket-kpi-label">Critical P</div>
      </div>
      <div class="ticket-kpi">
        <div class="ticket-kpi-num" style="color:var(--text-secondary)">${s.avgDaysOpen}</div>
        <div class="ticket-kpi-label">Avg Days Open</div>
      </div>
    `;
  },

  filterPriority(priority) {
    this.priorityFilter = priority;
    this.applyFilters();
  },

  filterStatus(status) {
    this.statusFilter = status;
    this.applyFilters();
  },

  applyFilters() {
    let result = this.allTickets;
    if (this.priorityFilter !== 'all') result = result.filter(t => t.priority === this.priorityFilter);
    if (this.statusFilter !== 'all') result = result.filter(t => t.status === this.statusFilter);
    this.render(result);
  },

  render(tickets) {
    const tbody = document.getElementById('tickets-table-body');
    if (!tickets.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="table-loading">No tickets found</td></tr>`;
      return;
    }

    const priorityOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
    const sorted = [...tickets].sort((a,b) =>
      (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99)
    );

    tbody.innerHTML = sorted.map(t => {
      const statusColor = {
        'Open': 'var(--accent-blue)',
        'In Progress': 'var(--accent-amber)',
        'Escalated': 'var(--accent-red)',
        'Resolved': 'var(--accent-green)'
      }[t.status] || 'var(--text-muted)';

      const daysColor = t.daysOpen > 7 ? 'var(--accent-red)' : t.daysOpen > 3 ? 'var(--accent-amber)' : 'var(--text-secondary)';

      return `
        <tr>
          <td>
            <div style="display:flex;align-items:center;">
              <span class="priority-dot priority-dot--${t.priority}"></span>
              <span style="font-size:0.8rem;font-weight:600;">${t.priority}</span>
            </div>
          </td>
          <td>
            <div style="font-weight:600;font-size:0.875rem;">${t.title}</div>
            <div style="font-size:0.73rem;color:var(--text-muted);margin-top:2px;">${t.id}</div>
          </td>
          <td>
            <span style="font-size:0.85rem;cursor:pointer;color:var(--text-primary);" onclick="Accounts.showDetail('${t.accountId}')">${t.accountName}</span>
          </td>
          <td><span class="badge badge--grey">${t.category}</span></td>
          <td><span style="color:${statusColor};font-size:0.82rem;font-weight:600;">${t.status}</span></td>
          <td><span style="font-family:'JetBrains Mono',monospace;font-size:0.82rem;font-weight:600;color:${daysColor}">${t.daysOpen}d</span></td>
          <td><span style="font-size:0.82rem;color:var(--text-secondary);">${t.assignee || '—'}</span></td>
        </tr>`;
    }).join('');
  },

  showAddModal() {
    App.toast('Ticket creation form coming soon!', 'info');
  }
};
