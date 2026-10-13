/**
 * View: Settings
 */
(function () {
  "use strict";

  const { App, t, ic, showToast, navigateTo } = window.AtharCore;

  async function renderSettings(container) {
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
          <p class="view-subtitle">Organization branding and system preferences</p>
        </div>
      </div>

      <div style="max-width: 640px;">
        <div class="card">
          <h3 style="font-size:16px; margin-bottom:16px; border-bottom:1px solid var(--neutral-300); padding-bottom:8px;">Branding & Organization</h3>
          <form id="settings-branding-form">
            <div class="form-field" style="margin-bottom:12px;">
              <label class="field-label">${t("org_name_en")}</label>
              <input type="text" id="set-org-name-en" class="form-control" value="${state.settings.org_name_en || ''}" ${!isSuper ? 'disabled' : ''}>
            </div>
            <div class="form-field" style="margin-bottom:12px;">
              <label class="field-label">${t("org_name_ar")}</label>
              <input type="text" id="set-org-name-ar" class="form-control" value="${state.settings.org_name_ar || ''}" ${!isSuper ? 'disabled' : ''}>
            </div>
            <div class="form-field" style="margin-bottom:12px;">
              <label class="field-label">${t("cert_prefix")}</label>
              <input type="text" id="set-cert-prefix" class="form-control" value="${state.settings.cert_prefix || ''}" ${!isSuper ? 'disabled' : ''}>
            </div>
            <div class="form-field" style="margin-bottom:16px;">
              <label class="field-label">${t("session_timeout")}</label>
              <input type="number" id="set-timeout" class="form-control" value="${state.settings.session_timeout_minutes || 15}" ${!isSuper ? 'disabled' : ''}>
            </div>
            ${isSuper
        ? `<button type="submit" class="btn btn-primary">${t("save")}</button>`
        : '<p style="color:var(--neutral-500); font-size:12px;">Settings are view-only for Trusted Admins.</p>'
      }
          </form>
        </div>
      </div>
    `;

    const brandingForm = document.getElementById("settings-branding-form");
    if (brandingForm && isSuper) {
      brandingForm.onsubmit = async (e) => {
        e.preventDefault();
        const payload = {
          org_name_en: document.getElementById("set-org-name-en").value,
          org_name_ar: document.getElementById("set-org-name-ar").value,
          cert_prefix: document.getElementById("set-cert-prefix").value,
          session_timeout_minutes: Number(document.getElementById("set-timeout").value),
        };
        try {
          await window.AtharAPI.settings.bulkUpdate(payload);
          await window.AtharStore.refreshSettings?.();
          showToast(t("saved_successfully"), "success");
        } catch (err) {
          showToast(err.message || "Failed to save settings", "error");
        }
      };
    }
  }

  window.AtharViews.settings = (c, p) => renderSettings(c);
})();