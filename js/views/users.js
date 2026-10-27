/**
 * View: Users & Permissions
 */
(function () {
  "use strict";

  const { App, t, ic, showToast, hasPermission, navigateTo } = window.AtharCore;

  function renderUsersList(container) {
    if (!hasPermission("users", "view")) {
      navigateTo("dashboard");
      return;
    }

    const state = window.AtharStore.getState();

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <div class="breadcrumb-trail">
            <span class="breadcrumb-item" onclick="window.AtharApp.navigateTo('dashboard')">${t("app_name")}</span>
            <span class="breadcrumb-separator">/</span>
            <span>${t("nav_users")}</span>
          </div>
          <h1 class="view-title">${t("users_title")}</h1>
          <p class="view-subtitle">Manage administrative privileges and preset role bundles</p>
        </div>
        <div class="view-header-actions">
          <button class="btn btn-primary" id="btn-add-trusted-user">${ic("user_plus", 14)} ${t("add_user")}</button>
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>User Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Preset Bundle</th>
              <th>Status</th>
              <th>Last Login</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${state.users.map(u => `
              <tr>
                <td style="font-weight:700;">
                  ${u.full_name}
                  ${u.must_change_password ? `<span class="badge badge-warning" style="font-size:9px; margin-inline-start:6px;">${t("default_password_flag")}</span>` : ''}
                </td>
                <td style="font-family:var(--font-mono);">${u.email}</td>
                <td><span class="badge ${u.role === 'super_admin' ? 'badge-primary' : u.role === 'committee_leader' ? 'badge-success' : 'badge-neutral'}">${u.role === 'super_admin' ? t("super_admin") : u.role === 'committee_leader' ? (App.currentLang === 'ar' ? 'رئيس لجنة' : 'Committee leader') : t("trusted_admin")}</span></td>
                <td><span style="font-weight:600;">${u.preset ? u.preset.toUpperCase() : 'FULL / SUPER'}</span></td>
                <td><span class="badge ${u.is_active ? 'badge-success' : 'badge-danger'}">${u.is_active ? 'Active' : 'Deactivated'}</span></td>
                <td class="num-ltr">${u.last_login_at ? String(u.last_login_at).replace("T", " ").slice(0, 16) : '—'}</td>
                <td>
                  <div class="row-actions-cell">
                    ${App.currentUser?.role === 'super_admin' ? `
                      <button class="btn btn-secondary btn-sm" onclick="window.AtharModals.openResetPasswordModal('${u.id}')">${ic("lock", 14)} ${t("reset_password")}</button>
                    ` : ''}
                    ${u.role !== 'super_admin' ? `
                      <button class="btn btn-secondary btn-sm" onclick="window.AtharModals.openPermissionsEditor('${u.id}')">${ic("sliders", 14)} Permissions</button>
                      <button class="btn btn-danger-outline btn-sm" onclick="window.AtharApp.toggleUserActive && window.AtharApp.toggleUserActive('${u.id}')">${u.is_active ? 'Deactivate' : 'Activate'}</button>
                    ` : (App.currentUser?.role !== 'super_admin' ? `<span style="font-size:11px; color:var(--neutral-400);">Super Admin (Permanent)</span>` : '')}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById("btn-add-trusted-user").onclick = () => {
      if (window.AtharModals.openAddUserModal) window.AtharModals.openAddUserModal();
      else showToast("User creation form not yet implemented", "info");
    };
  }

  window.AtharViews.users = (c, p) => renderUsersList(c);
})();
