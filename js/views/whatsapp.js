/**
 * View: WhatsApp Templates list
 * (Editor modal lives in modals.js)
 */
(function () {
  "use strict";

  const { App, t, ic, showToast, hasPermission } = window.AtharCore;

  function renderWhatsAppTemplates(container) {
    const state = window.AtharStore.getState();
    const canCreate = hasPermission("whatsapp_templates", "create");
    const canEdit = hasPermission("whatsapp_templates", "edit");
    const canDelete = hasPermission("whatsapp_templates", "delete");

    const sorted = [...state.whatsapp_templates].sort((a, b) => {
      if (a.language !== b.language) return a.language === "ar" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    const activeCount = sorted.filter(t => t.is_active).length;

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <div class="breadcrumb-trail">
            <span class="breadcrumb-item" onclick="window.AtharApp.navigateTo('dashboard')">${t("app_name")}</span>
            <span class="breadcrumb-separator">/</span>
            <span>${t("nav_whatsapp_templates")}</span>
          </div>
          <h1 class="view-title">${t("whatsapp_title")}</h1>
          <p class="view-subtitle">${sorted.length} templates &bull; ${activeCount} active</p>
        </div>
        <div class="view-header-actions">
          ${canCreate ? `<button class="btn btn-primary" id="btn-add-wa-template">${ic("plus", 14)} ${t("add_template")}</button>` : ''}
        </div>
      </div>

      ${sorted.length === 0 ? `
        <div class="card" style="text-align:center; padding:40px;">
          <div style="color:var(--neutral-400); margin-bottom:8px;">${ic("message_circle", 42, { strokeWidth: 1.5 })}</div>
          <div style="font-weight:700; font-size:16px; margin-bottom:4px;">No message templates yet</div>
          <p style="color:var(--neutral-500); font-size:13px;">Create your first template to start sending WhatsApp invites.</p>
        </div>
      ` : `
        <div style="display:flex; flex-direction:column; gap:16px;">
          ${sorted.map(tmpl => {
            const sample = window.AtharModals.buildSamplePreview(tmpl.body, tmpl.language);
            return `
              <div class="card wa-template-card ${tmpl.is_active ? '' : 'inactive'}" data-tmpl-id="${tmpl.id}">
                <div class="card-header">
                  <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-weight:700; font-size:16px;">${tmpl.name}</span>
                    <span class="badge badge-neutral num-ltr">${tmpl.language.toUpperCase()}</span>
                    <span class="wa-active-toggle ${tmpl.is_active ? 'on' : ''}">
                      <span class="wa-dot"></span>
                      ${tmpl.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div style="display:flex; gap:8px;">
                    ${canEdit ? `
                      <button class="btn btn-secondary btn-sm" onclick="window.AtharModals.openEditWhatsAppTemplate('${tmpl.id}')">${ic("pencil", 14)} ${t("edit")}</button>
                      <button class="btn btn-secondary btn-sm" onclick="window.AtharModals.duplicateWhatsAppTemplate('${tmpl.id}')">${ic("copy", 14)} Duplicate</button>
                    ` : ''}
                    ${canDelete ? `<button class="btn btn-danger-outline btn-sm" onclick="window.AtharModals.deleteWhatsAppTemplate('${tmpl.id}')">${ic("trash", 14)} Delete</button>` : ''}
                  </div>
                </div>
                <div class="wa-bubble-preview" dir="${tmpl.language === 'ar' ? 'rtl' : 'ltr'}">
                  <div class="wa-bubble">
                    ${window.AtharCore.escapeHtml(sample)}
                    <span class="wa-bubble-time">10:42 <span class="wa-check">&#10003;&#10003;</span></span>
                  </div>
                </div>
                <div style="margin-top:12px; font-size:11px; color:var(--neutral-500);">
                  Tokens: <code>{name}</code>, <code>{committee}</code>, <code>{date}</code>, <code>{hours}</code>, <code>{certificate_no}</code>, <code>{verify_url}</code>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    `;

    const addBtn = document.getElementById("btn-add-wa-template");
    if (addBtn) addBtn.onclick = () => window.AtharModals.openEditWhatsAppTemplate(null);
  }

  window.AtharViews.whatsappTemplates = (c, p) => renderWhatsAppTemplates(c);
})();
