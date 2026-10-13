/**
 * View: Audit Log
 */
(function () {
  "use strict";

  const { App, t, ic, showToast } = window.AtharCore;

  function renderAuditLogs(container) {
    const state = window.AtharStore.getState();
    const logs = state.audit_logs;

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <div class="breadcrumb-trail">
            <span class="breadcrumb-item" onclick="window.AtharApp.navigateTo('dashboard')">${t("app_name")}</span>
            <span class="breadcrumb-separator">/</span>
            <span>${t("nav_audit_logs")}</span>
          </div>
          <h1 class="view-title">${t("audit_title")}</h1>
          <p class="view-subtitle">Immutable chronological journal of sensitive administrative operations</p>
        </div>
        <div class="view-header-actions">
          <button class="btn btn-secondary btn-sm" id="btn-export-audit">${ic("download", 14)} ${t("export_csv")}</button>
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>User</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Summary</th>
              <th style="text-align:right;">Diff Viewer</th>
            </tr>
          </thead>
          <tbody>
            ${logs.map(l => `
              <tr>
                <td class="num-ltr" style="font-size:12px; color:var(--neutral-600);">${l.created_at}</td>
                <td style="font-weight:700;">${l.user_name}</td>
                <td>
                  <span class="badge ${l.action === 'create' ? 'badge-success' : l.action === 'delete' || l.action === 'revoke' ? 'badge-danger' : l.action === 'approve' || l.action === 'issue' ? 'badge-primary' : 'badge-neutral'}">${l.action}</span>
                </td>
                <td><code>${l.entity || '—'}</code></td>
                <td style="font-size:13px; color:var(--neutral-800);">${l.details}</td>
                <td>
                  <div class="row-actions-cell">
                    <button class="btn btn-secondary btn-sm" onclick="window.AtharModals.openDiffModal('${l.id}')">${ic("eye", 14)} View Diff</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById("btn-export-audit").onclick = () => {
      const headers = ["Timestamp", "User", "Action", "Entity", "Details"];
      const rows = logs.map(l => [l.created_at, l.user_name, l.action, l.entity, l.details]);
      window.ExportUtil.downloadCSV("System_Audit_Trail.csv", headers, rows);
    };
  }

  window.AtharViews.auditLogs = (c, p) => renderAuditLogs(c);
})();
