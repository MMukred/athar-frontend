/**
 * View: Audit Log
 */
(function () {
  "use strict";

  const { App, t, ic, showToast, formatDate } = window.AtharCore;

  async function renderAuditLogs(container) {
    // ---- Loading state ----
    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <div class="breadcrumb-trail">
            <span class="breadcrumb-item" onclick="window.AtharApp.navigateTo('dashboard')">${t("app_name")}</span>
            <span class="breadcrumb-separator">/</span>
            <span>${t("nav_audit_logs")}</span>
          </div>
          <h1 class="view-title">${t("audit_title")}</h1>
          <p class="view-subtitle">${t("loading")}</p>
        </div>
      </div>
      <div class="card" style="padding:24px;">
        <div class="skeleton-row" style="width:40%; margin-bottom:12px;"></div>
        <div class="skeleton-row" style="width:80%; margin-bottom:8px;"></div>
        <div class="skeleton-row" style="width:70%; margin-bottom:8px;"></div>
        <div class="skeleton-row" style="width:75%;"></div>
      </div>
    `;

    // ---- Fetch fresh from API ----
    let logs = [];
    let meta = null;
    let loadError = null;

    try {
      const res = await window.AtharAPI.audit.list({ limit: 100 });
      logs = res.items || [];
      meta = res.meta || null;
      // Sync cache so openDiffModal can use it
      const state = window.AtharStore.getState();
      state.audit_logs = logs;
    } catch (e) {
      loadError = e;
    }

    if (loadError) {
      container.innerHTML = `
        <div class="view-header">
          <div class="view-header-left">
            <div class="breadcrumb-trail">
              <span class="breadcrumb-item" onclick="window.AtharApp.navigateTo('dashboard')">${t("app_name")}</span>
              <span class="breadcrumb-separator">/</span>
              <span>${t("nav_audit_logs")}</span>
            </div>
            <h1 class="view-title">${t("audit_title")}</h1>
          </div>
        </div>
        <div class="card" style="border:2px solid var(--danger); text-align:center; padding:32px;">
          <div style="color:var(--danger); margin-bottom:8px;">${ic("alert", 42, { strokeWidth: 1.5 })}</div>
          <h3 style="color:var(--danger); font-size:16px; margin-bottom:6px;">Failed to load audit log</h3>
          <p style="color:var(--neutral-600); font-size:13px;">${loadError.message || "Unknown error"}</p>
          <button class="btn btn-primary" id="btn-retry-audit" style="margin-top:16px;">Retry</button>
        </div>
      `;
      const retry = document.getElementById("btn-retry-audit");
      if (retry) retry.onclick = () => renderAuditLogs(container);
      return;
    }

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <div class="breadcrumb-trail">
            <span class="breadcrumb-item" onclick="window.AtharApp.navigateTo('dashboard')">${t("app_name")}</span>
            <span class="breadcrumb-separator">/</span>
            <span>${t("nav_audit_logs")}</span>
          </div>
          <h1 class="view-title">${t("audit_title")}</h1>
          <p class="view-subtitle">
            Immutable chronological journal${meta ? ` &bull; ${meta.total} total entries` : ""}
          </p>
        </div>
        <div class="view-header-actions">
          <button class="btn btn-secondary btn-sm" id="btn-refresh-audit">${ic("refresh", 14)} ${t("refresh")}</button>
          <button class="btn btn-secondary btn-sm" id="btn-export-audit">${ic("download", 14)} ${t("export_csv")}</button>
        </div>
      </div>

      ${logs.length === 0 ? `
        <div class="card" style="text-align:center; padding:48px;">
          <div style="color:var(--neutral-400); margin-bottom:12px;">${ic("file_text", 42, { strokeWidth: 1.5 })}</div>
          <div style="font-weight:700; font-size:16px; margin-bottom:4px;">No audit entries yet</div>
          <p style="color:var(--neutral-500); font-size:13px;">Actions will appear here as they happen.</p>
        </div>
      ` : `
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
                    <span class="badge ${l.action === 'create' ? 'badge-success'
        : l.action === 'delete' || l.action === 'revoke' ? 'badge-danger'
          : l.action === 'approve' || l.action === 'issue' ? 'badge-primary'
            : 'badge-neutral'
      }">${l.action}</span>
                  </td>
                  <td><code>${l.entity || '—'}</code></td>
                  <td style="font-size:13px; color:var(--neutral-800); max-width:420px;">
                    ${l.details || '—'}
                  </td>
                  <td>
                    <div class="row-actions-cell">
                      <button class="btn btn-secondary btn-sm" data-log-id="${l.id}">
                        ${ic("eye", 14)} View Diff
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    `;

    // ---- Wire row diff buttons ----
    container.querySelectorAll("[data-log-id]").forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-log-id");
        window.AtharModals.openDiffModal(id);
      };
    });

    // ---- Refresh ----
    const refreshBtn = document.getElementById("btn-refresh-audit");
    if (refreshBtn) refreshBtn.onclick = () => renderAuditLogs(container);

    // ---- Export CSV ----
    const exportBtn = document.getElementById("btn-export-audit");
    if (exportBtn) {
      exportBtn.onclick = () => {
        const headers = ["Timestamp", "User", "Action", "Entity", "Details"];
        const rows = logs.map(l => [
          l.created_at,
          l.user_name,
          l.action,
          l.entity || "",
          l.details || "",
        ]);
        window.ExportUtil.downloadCSV("System_Audit_Trail.csv", headers, rows);
      };
    }
  }

  window.AtharViews.auditLogs = (c, p) => renderAuditLogs(c);
})();