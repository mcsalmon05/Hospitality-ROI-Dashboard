/* ═══════════════════════════════════════════════════════════════
   IMPORT-DATA.JS — CSV/JSON Import & Template Download
   ═══════════════════════════════════════════════════════════════ */
window.Import = {

  // ─── CSV Import ───────────────────────────────────────────────
  async handleCSV(event) {
    const file = event.target.files[0];
    if (!file) return;
    const text = await file.text();
    const accounts = this.parseCSV(text);
    
    const preview = document.getElementById('csv-preview');
    if (!accounts.length) {
      preview.innerHTML = `<span style="color:var(--accent-red)">No valid rows found in CSV</span>`;
      return;
    }

    preview.innerHTML = `
      <div style="margin-top:12px;padding:12px;background:var(--bg-elevated);border-radius:var(--radius-sm);">
        <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:8px;">
          ✅ Parsed <strong>${accounts.length}</strong> account(s) from CSV
        </div>
        <div style="font-size:0.77rem;color:var(--text-muted);">Fields: ${Object.keys(accounts[0]).join(', ')}</div>
        <button class="btn btn--primary" style="margin-top:10px;" onclick="Import.importAccounts(${JSON.stringify(accounts).replace(/"/g,'&quot;')})">
          Import ${accounts.length} Account(s)
        </button>
      </div>`;
  },

  parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const obj = {};
      headers.forEach((h, i) => {
        const val = values[i] || '';
        // Auto-convert numeric fields
        if (['contractValue','seats','activeUsers','openTickets','npsScore','productUsagePct'].includes(h)) {
          obj[h] = parseFloat(val) || 0;
        } else {
          obj[h] = val;
        }
      });
      return obj;
    }).filter(row => row.name); // Must have a name
  },

  async importAccounts(accounts) {
    try {
      const res = await fetch(`${API}/accounts/import/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accounts })
      });
      const data = await res.json();
      App.toast(`Imported ${data.imported} account(s) successfully!`, 'success');
      document.getElementById('csv-preview').innerHTML = `
        <div style="padding:12px;background:rgba(34,197,94,0.1);border-radius:var(--radius-sm);color:var(--accent-green);font-size:0.85rem;">
          ✅ ${data.imported} accounts imported. Total accounts: ${data.total}
        </div>`;
    } catch(e) {
      App.toast('Import failed. Check server connection.', 'error');
    }
  },

  // ─── JSON Import ──────────────────────────────────────────────
  async handleJSON() {
    const rawText = document.getElementById('json-input').value.trim();
    const type = document.getElementById('json-type').value;
    const resultEl = document.getElementById('json-result');

    if (!rawText) {
      App.toast('Please paste JSON data first', 'warning');
      return;
    }

    let data;
    try {
      data = JSON.parse(rawText);
    } catch(e) {
      resultEl.innerHTML = `<span style="color:var(--accent-red)">❌ Invalid JSON: ${e.message}</span>`;
      return;
    }

    const items = Array.isArray(data) ? data : [data];

    try {
      let res;
      if (type === 'accounts') {
        res = await fetch(`${API}/accounts/import/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accounts: items })
        });
      } else {
        // Import tickets one by one
        let count = 0;
        for (const ticket of items) {
          await fetch(`${API}/tickets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ticket)
          });
          count++;
        }
        resultEl.innerHTML = `<span style="color:var(--accent-green)">✅ Imported ${count} ticket(s)</span>`;
        App.toast(`Imported ${count} ticket(s)`, 'success');
        return;
      }
      const result = await res.json();
      resultEl.innerHTML = `<span style="color:var(--accent-green)">✅ Imported ${result.imported} account(s). Total: ${result.total}</span>`;
      App.toast(`Imported ${result.imported} ${type}`, 'success');
    } catch(e) {
      resultEl.innerHTML = `<span style="color:var(--accent-red)">❌ Import failed: ${e.message}</span>`;
    }
  },

  // ─── Download CSV Template ────────────────────────────────────
  downloadTemplate() {
    const headers = [
      'name','domain','industry','csm','contractValue','contractStart','contractEnd',
      'tier','seats','activeUsers','productUsagePct','npsScore','openTickets',
      'escalatedTickets','notes','tags'
    ];
    const example = [
      'Acme Corp','acme.com','Manufacturing','Sarah Chen','120000',
      '2025-01-01','2026-12-31','Enterprise','150','110','73','45',
      '3','1','Strong relationship, potential upsell','at-risk,upsell-candidate'
    ];

    const csv = [headers.join(','), example.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'csm-accounts-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    App.toast('CSV template downloaded', 'success');
  }
};

// ─── Drag & Drop Setup ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const dropZone = document.getElementById('csv-drop-zone');
  if (!dropZone) return;

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
      const fakeEvent = { target: { files: [file] } };
      Import.handleCSV(fakeEvent);
    } else {
      App.toast('Please drop a .csv file', 'warning');
    }
  });
});
