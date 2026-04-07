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

  async showAddModal() {
    const overlay = document.getElementById('account-modal-overlay');
    const content = document.getElementById('account-modal-content');
    overlay.classList.add('active');

    // Fetch accounts to populate dropdown
    let accountOptions = '<option value="" disabled selected>Select property...</option>';
    try {
      const accounts = await fetch(`${API}/accounts`).then(r => r.json());
      accountOptions += accounts.map(a => `<option value="${a.id}" data-name="${a.name}">${a.name} (${a.industry || 'Property'})</option>`).join('');
    } catch(e) {
      accountOptions = '<option value="" disabled>Failed to load accounts</option>';
    }

    content.innerHTML = `
      <div class="modal-header" style="margin-bottom: 24px;">
        <div class="modal-account-name" style="font-size:1.5rem;">Create New Support Ticket</div>
        <div class="modal-account-meta">Log a manual desk request or escalated property issue</div>
      </div>
      <form id="add-ticket-form" onsubmit="Tickets.submitAddTicket(event)">
        <div class="modal-section">
          <div class="modal-section-title">Ticket Information</div>
          <div style="margin-bottom:16px;">
            <label style="display:block; font-size:0.8rem; margin-bottom:4px; color:var(--text-secondary);">Associated Property *</label>
            <select name="accountId" class="select-sm" style="width:100%; border:1px solid var(--border); height:38px;" required>
              ${accountOptions}
            </select>
          </div>
          <div style="margin-bottom:16px;">
            <label style="display:block; font-size:0.8rem; margin-bottom:4px; color:var(--text-secondary);">Ticket Title / Issue *</label>
            <input type="text" name="title" class="search-input" style="width:100%; border:1px solid var(--border);" required placeholder="e.g. PMS Sync Error" />
          </div>
        </div>

        <div class="modal-section">
          <div class="modal-section-title">Classification & Assignment</div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px;">
            <div>
              <label style="display:block; font-size:0.8rem; margin-bottom:4px; color:var(--text-secondary);">Priority</label>
              <select name="priority" class="select-sm" style="width:100%; border:1px solid var(--border); height:38px;">
                <option value="Low">Low</option>
                <option value="Medium" selected>Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
            <div>
              <label style="display:block; font-size:0.8rem; margin-bottom:4px; color:var(--text-secondary);">Category</label>
              <select name="category" class="select-sm" style="width:100%; border:1px solid var(--border); height:38px;">
                <option value="Technical">Technical</option>
                <option value="Billing">Billing</option>
                <option value="Data">Data</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label style="display:block; font-size:0.8rem; margin-bottom:4px; color:var(--text-secondary);">Status</label>
              <select name="status" class="select-sm" style="width:100%; border:1px solid var(--border); height:38px;">
                <option value="Open" selected>Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Escalated">Escalated</option>
                <option value="Resolved">Resolved</option>
              </select>
            </div>
            <div>
              <label style="display:block; font-size:0.8rem; margin-bottom:4px; color:var(--text-secondary);">Assignee</label>
              <input type="text" name="assignee" class="search-input" style="width:100%; border:1px solid var(--border);" placeholder="Name of CSM or Dev" />
            </div>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:24px;">
          <button type="button" class="btn btn--ghost" onclick="Accounts.closeModal()">Cancel</button>
          <button type="submit" class="btn btn--primary">Create Ticket</button>
        </div>
      </form>
    `;
  },

  async submitAddTicket(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());
    
    // Get account name from select
    const select = event.target.querySelector('select[name="accountId"]');
    const selectedOption = select.options[select.selectedIndex];
    data.accountName = selectedOption.getAttribute('data-name') || 'Unknown Property';

    const btn = event.target.querySelector('button[type="submit"]');
    btn.innerHTML = 'Logging...';
    btn.disabled = true;

    try {
      const res = await fetch(`${API}/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!res.ok) throw new Error('Failed to create ticket');
      
      App.toast(`Ticket created for ${data.accountName}`, 'success');
      Accounts.closeModal();
      
      // Refresh tickets
      await this.load();
    } catch(e) {
      App.toast(e.message, 'error');
      btn.innerHTML = 'Create Ticket';
      btn.disabled = false;
    }
  }
};
