/**
 * View: Settings
 */
(function () {
  "use strict";

  const { App, t, ic, showToast, showConfirmModal, navigateTo } = window.AtharCore;

  function renderSettings(container) {
    const state = window.AtharStore.getState();
    const isSuper = App.currentUser.role === "super_admin";

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <div class="breadcrumb-trail">
            <span class="breadcrumb-item" onclick="window.AtharApp.navigateTo('dashboard')">${t("app_name")}</span>
            <span class="breadcrumb-separator">/</span>
            <span>${t("nav_settings")}</span>
          </div>
          <h1 class="view-title">${t("settings_title")}</h1>
          <p class="view-subtitle">Institution branding, certificate sequences, and database test resets</p>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
        <div class="card">
          <h3 style="font-size:16px; margin-bottom:16px; border-bottom:1px solid var(--neutral-300); padding-bottom:8px;">Branding & Organization</h3>
          <form id="settings-branding-form">
            <div class="form-field" style="margin-bottom:12px;">
              <label class="field-label">${t("org_name_en")}</label>
              <input type="text" id="set-org-name-en" class="form-control" value="${state.settings.org_name_en}" ${!isSuper ? 'disabled' : ''}>
            </div>
            <div class="form-field" style="margin-bottom:12px;">
              <label class="field-label">${t("org_name_ar")}</label>
              <input type="text" id="set-org-name-ar" class="form-control" value="${state.settings.org_name_ar}" ${!isSuper ? 'disabled' : ''}>
            </div>
            <div class="form-field" style="margin-bottom:12px;">
              <label class="field-label">${t("cert_prefix")}</label>
              <input type="text" id="set-cert-prefix" class="form-control" value="${state.settings.cert_prefix}" ${!isSuper ? 'disabled' : ''}>
            </div>
            <div class="form-field" style="margin-bottom:16px;">
              <label class="field-label">${t("session_timeout")}</label>
              <input type="number" id="set-timeout" class="form-control" value="${state.settings.session_timeout_minutes}" ${!isSuper ? 'disabled' : ''}>
            </div>
            ${isSuper ? `<button type="submit" class="btn btn-primary">${t("save")}</button>` : '<p style="color:var(--neutral-500); font-size:12px;">Settings are view-only for Trusted Admins.</p>'}
          </form>
        </div>

        <div class="card">
          <h3 style="font-size:16px; margin-bottom:16px; border-bottom:1px solid var(--neutral-300); padding-bottom:8px;">Demo Data Maintenance</h3>
          <p style="font-size:13px; color:var(--neutral-600); line-height:1.6; margin-bottom:16px;">
            Reset the entire system state back to initial test suite specification: 3 Committees, 30 Volunteers, 10 Meetings, 50 Hours entries, 20 Evaluations, and 5 Certificates.
          </p>
          <button class="btn btn-danger-outline" id="btn-reseed-data">${ic("alert", 14)} ${t("reset_data")}</button>
        </div>
      </div>
    `;

    const brandingForm = document.getElementById("settings-branding-form");
    if (brandingForm && isSuper) {
      brandingForm.onsubmit = (e) => {
        e.preventDefault();
        const oldVal = { ...state.settings };
        state.settings.org_name_en = document.getElementById("set-org-name-en").value;
        state.settings.org_name_ar = document.getElementById("set-org-name-ar").value;
        state.settings.cert_prefix = document.getElementById("set-cert-prefix").value;
        state.settings.session_timeout_minutes = Number(document.getElementById("set-timeout").value);
        window.AtharStore.save();
        window.AtharStore.logAudit(App.currentUser, "update", "settings", null, "Updated organization settings", oldVal, state.settings);
        showToast(t("saved_successfully"), "success");
      };
    }

    document.getElementById("btn-reseed-data").onclick = () => {
      showConfirmModal({
        title: "Reset System Demo Data",
        message: t("data_reset_confirm"),
        confirmText: "Reset to Test Dataset",
        onConfirm: () => {
          window.AtharStore.resetToSeed();
          showToast("Data restored to clean specification seeds!");
          navigateTo("dashboard");
        }
      });
    };
  }

  window.AtharViews.settings = (c, p) => renderSettings(c);
})();
