/**
 * View: Users & Permissions
 */
(function () {
  "use strict";

  const { App, t, ic, showToast, hasPermission, navigateTo, escapeHtml } = window.AtharCore;

  function renderUsersList(container) {
    if (!hasPermission("users", "view")) {
      navigateTo("dashboard");
      return;
    }

    const state = window.AtharStore.getState();
    const isSuper = App.currentUser && App.currentUser.role === "super_admin";
    const vols = (state.volunteers || []).filter(v => v.status !== "archived");
    const withEmail = vols.filter(v => v.email).length;
    const noEmail = vols.filter(v => !v.email).length;
    const portalReady = vols.filter(v => v.user_id).length;
    const missingPortal = Math.max(0, withEmail - portalReady);

    const roleLabel = (u) => {
      if (u.role === "super_admin") return t("super_admin");
      if (u.role === "committee_leader") return App.currentLang === "ar" ? "رئيس لجنة" : "Committee leader";
      if (u.role === "volunteer") return App.currentLang === "ar" ? "متطوع" : "Volunteer";
      return t("trusted_admin");
    };
    const roleBadge = (u) => {
      const cls = u.role === "super_admin" ? "badge-primary"
        : u.role === "committee_leader" ? "badge-success"
          : u.role === "volunteer" ? "badge-purple"
            : "badge-neutral";
      return `<span class="badge ${cls}">${roleLabel(u)}</span>`;
    };

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <div class="breadcrumb-trail">
            <span class="breadcrumb-item" onclick="window.AtharApp.navigateTo('dashboard')">${t("app_name")}</span>
            <span class="breadcrumb-separator">/</span>
            <span>${t("nav_users")}</span>
          </div>
          <h1 class="view-title">${t("users_title")}</h1>
          <p class="view-subtitle">${window.AtharTx("Manage administrative privileges and preset role bundles")}</p>
        </div>
        <div class="view-header-actions">
          <button class="btn btn-primary" id="btn-add-trusted-user">${ic("user_plus", 14)} ${t("add_user")}</button>
        </div>
      </div>

      ${isSuper ? `
        <div class="provision-callout">
          <div class="provision-callout-icon">${ic("user_check", 20)}</div>
          <div class="provision-callout-body">
            <div class="provision-callout-title">${t("provision_accounts_title") || "Volunteer portal accounts"}</div>
            <div class="provision-callout-desc">
              ${(t("provision_accounts_desc") || "Generate self-service accounts for volunteers who have an email. Temporary password: {pw}.")
        .replace("{pw}", `<strong dir="ltr">Athar@123</strong>`)}
              <span class="num-ltr" style="display:inline-flex; gap:10px; margin-inline-start:8px; font-weight:700; color:var(--neutral-700);">
                <span>${portalReady} ${t("provision_ready") || "ready"}</span>
                <span>${missingPortal} ${t("provision_missing") || "missing"}</span>
                <span>${noEmail} ${t("provision_no_email") || "no email"}</span>
              </span>
            </div>
          </div>
          <button type="button" class="btn btn-primary btn-sm" id="btn-provision-volunteers" ${missingPortal ? "" : "disabled"}>
            ${ic("sparkles", 14)} ${missingPortal
        ? (t("provision_generate") || "Generate accounts")
        : (t("provision_done") || "All set")}
          </button>
        </div>` : ""}

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>${window.AtharTx("User Name")}</th>
              <th>${window.AtharTx("Email")}</th>
              <th>${window.AtharTx("Role")}</th>
              <th>${window.AtharTx("Preset Bundle")}</th>
              <th>${window.AtharTx("Status")}</th>
              <th>${window.AtharTx("Last Login")}</th>
              <th style="text-align:right;">${window.AtharTx("Actions")}</th>
            </tr>
          </thead>
          <tbody>
            ${state.users.map(u => `
              <tr>
                <td style="font-weight:700;">
                  ${escapeHtml(u.full_name)}
                  ${u.must_change_password ? `<span class="badge badge-warning" style="font-size:9px; margin-inline-start:6px;">${t("default_password_flag")}</span>` : ''}
                </td>
                <td style="font-family:var(--font-mono);">${escapeHtml(u.email)}</td>
                <td>${roleBadge(u)}</td>
                <td><span style="font-weight:600;">${u.role === 'volunteer' ? '—' : (u.preset ? u.preset.toUpperCase() : 'FULL / SUPER')}</span></td>
                <td><span class="badge ${u.is_active ? 'badge-success' : 'badge-danger'}">${u.is_active ? 'Active' : 'Deactivated'}</span></td>
                <td class="num-ltr">${u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString(App.currentLang === "ar" ? "ar-u-ca-gregory-nu-latn" : "en-US") : '-'}</td>
                <td>
                  <div class="row-actions-cell">
                    ${u.role === 'super_admin' && App.currentUser?.role !== 'super_admin' ? `<span style="font-size:11px; color:var(--neutral-400);">${window.AtharTx("Super Admin (Permanent)")}</span>` : ''}
                    ${u.role !== 'super_admin' ? `
                      <div class="action-menu-wrap">
                        <button type="button" class="btn btn-secondary btn-sm action-menu-trigger" data-action-menu="${u.id}" title="${App.currentLang === 'ar' ? 'المزيد' : 'More'}">${ic("more_vertical", 14)}</button>
                        <div class="action-menu-dropdown" data-action-dropdown="${u.id}" hidden>
                          ${App.currentUser?.role === 'super_admin' ? `<button type="button" class="action-menu-item" onclick="window.AtharModals.openResetPasswordModal('${u.id}')">${ic("lock", 14)} ${t("reset_password")}</button>` : ''}
                          <button type="button" class="action-menu-item action-menu-danger" onclick="window.AtharApp.deleteUser && window.AtharApp.deleteUser('${u.id}')">${ic("trash", 14)} ${App.currentLang === 'ar' ? 'حذف' : 'Delete'}</button>
                          <button type="button" class="action-menu-item" onclick="window.AtharApp.toggleUserActive && window.AtharApp.toggleUserActive('${u.id}')">${ic(u.is_active ? 'x_circle' : 'check_circle', 14)} ${u.is_active ? 'Deactivate' : 'Activate'}</button>
                        </div>
                      </div>
                    ` : ''}
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

    // ---- Kebab action menu toggle ----
    container.querySelectorAll("[data-action-menu]").forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-action-menu");
        const dd = container.querySelector(`[data-action-dropdown="${id}"]`);
        container.querySelectorAll(".action-menu-dropdown").forEach(d => { if (d !== dd) d.hidden = true; });
        if (dd) dd.hidden = !dd.hidden;
      };
    });
    document.addEventListener("click", function (e) {
      if (!e.target.closest || !e.target.closest(".action-menu-wrap")) {
        container.querySelectorAll(".action-menu-dropdown").forEach(d => d.hidden = true);
      }
    });

    const provisionBtn = document.getElementById("btn-provision-volunteers");
    if (provisionBtn) {
      provisionBtn.onclick = async () => {
        const original = provisionBtn.innerHTML;
        provisionBtn.disabled = true;
        provisionBtn.innerHTML = `${ic("refresh", 14)} ${t("provision_working") || "Generating…"}`;
        try {
          const result = await window.AtharAPI.users.provisionVolunteerAccounts();
          const created = Number(result && result.created) || 0;
          const linked = Number(result && result.linked) || 0;
          const skipped = Number(result && result.skipped) || 0;
          const noEmailCount = Number(result && result.noEmail) || 0;
          const leaders = Number(result && result.leaders) || 0;
          const members = Number(result && result.members) || 0;
          showToast(
            (t("provision_result") || "Created: {created} • linked: {linked} • leaders: {leaders} • members: {members} • skipped: {skipped} • no email: {noEmail}")
              .replace("{created}", created)
              .replace("{linked}", linked)
              .replace("{leaders}", leaders)
              .replace("{members}", members)
              .replace("{skipped}", skipped)
              .replace("{noEmail}", noEmailCount),
            "success",
            { duration: 8000 }
          );
          try { await window.AtharStore.loadAll(); } catch (e) { console.warn(e); }
          renderUsersList(container);
        } catch (err) {
          provisionBtn.disabled = false;
          provisionBtn.innerHTML = original;
          showToast((err && err.message) || (t("provision_failed") || "Could not generate accounts"), "error");
        }
      };
    }
  }

  window.AtharViews.users = (c, p) => renderUsersList(c);
})();
