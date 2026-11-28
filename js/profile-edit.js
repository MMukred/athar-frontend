/**
 * "تعديل الملف الشخصي" — opened from the account menu (avatar), not from the
 * portal page. Works for anyone whose account is linked to a volunteer record
 * (volunteers and committee leads who are also members), through the existing
 * GET/PATCH /api/portal/me endpoints.
 * window.AtharProfile = { open(), canEdit(), precheck() }
 */
window.AtharProfile = (function () {
  "use strict";

  const core = () => window.AtharCore;
  const L = (ar, en) => (core().App.currentLang === "ar" ? ar : en);
  const esc = (s) => core().escapeHtml(s);

  let editable = null;   // null unknown | true | false
  let checkedFor = null;

  async function precheck() {
    const u = core().App.currentUser;
    if (!u) return false;
    if (checkedFor === u.id && editable !== null) return editable;
    checkedFor = u.id;
    if (u.role === "volunteer") { editable = true; return true; }
    try {
      const d = await window.AtharAPI.portal.me();
      editable = !!(d && d.linked !== false && d.volunteer);
    } catch (e) { editable = false; }
    return editable;
  }
  const canEdit = () => editable === true;

  function field(id, label, value, attrs) {
    return `<div class="form-group pf-field">
      <label class="form-label" for="${id}">${label}</label>
      <input class="form-control" id="${id}" value="${esc(value || "")}" ${attrs || ""}>
    </div>`;
  }

  async function open() {
    const mc = document.getElementById("modal-container");
    if (!mc) return;
    mc.innerHTML = `
      <div class="overlay-backdrop" id="pf-backdrop">
        <div class="modal-dialog" style="max-width:480px;">
          <div class="modal-header">
            <h3 class="modal-title">${core().ic("user", 18)} ${L("تعديل الملف الشخصي", "Edit profile")}</h3>
            <button class="btn-icon" id="pf-close">&times;</button>
          </div>
          <div class="modal-body" id="pf-body"><div class="idea-loading">${L("جارٍ التحميل…", "Loading…")}</div></div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="pf-cancel">${L("إلغاء", "Cancel")}</button>
            <button class="btn btn-primary" id="pf-save" disabled>${L("حفظ", "Save")}</button>
          </div>
        </div>
      </div>`;
    const close = () => { mc.innerHTML = ""; };
    document.getElementById("pf-close").onclick = close;
    document.getElementById("pf-cancel").onclick = close;
    document.getElementById("pf-backdrop").onclick = (e) => { if (e.target.id === "pf-backdrop") close(); };

    let v;
    try {
      const d = await window.AtharAPI.portal.me();
      v = d && d.volunteer;
      if (!v) throw new Error(L("حسابك غير مرتبط بملف متطوع.", "Your account isn't linked to a volunteer record."));
    } catch (e) {
      const body = document.getElementById("pf-body");
      if (body) body.innerHTML = `<p style="margin:0;color:var(--neutral-600);">${esc((e && e.message) || L("تعذّر التحميل", "Failed to load"))}</p>`;
      return;
    }
    const body = document.getElementById("pf-body");
    if (!body) return;
    body.innerHTML = `
      ${v.volunteerCode ? `<div class="pf-code">${L("رقم المتطوع", "Volunteer ID")}: <b class="num-ltr">${esc(v.volunteerCode)}</b></div>` : ""}
      <div class="pf-grid">
        ${field("pf-fullNameAr", L("الاسم الكامل (بالعربية)", "Full name (Arabic)"), v.fullNameAr)}
        ${field("pf-fullName", L("الاسم الكامل (بالإنجليزية)", "Full name (English)"), v.fullName, 'dir="ltr"')}
        ${field("pf-email", L("البريد الإلكتروني", "Email"), v.email, 'type="email" dir="ltr" inputmode="email"')}
        ${field("pf-phone", L("الجوال", "Phone"), v.phone, 'type="tel" dir="ltr" inputmode="tel"')}
        ${field("pf-whatsapp", L("واتساب", "WhatsApp"), v.whatsapp, 'type="tel" dir="ltr" inputmode="tel"')}
        ${field("pf-skills", L("المهارات (افصل بينها بفاصلة)", "Skills (comma separated)"), (v.skills || []).join("، "))}
      </div>`;
    const save = document.getElementById("pf-save");
    save.disabled = false;
    save.onclick = async () => {
      const val = (id) => document.getElementById(id).value.trim();
      if (!val("pf-fullName") && !val("pf-fullNameAr")) { core().showToast(L("اكتب اسمك", "Please enter your name"), "error"); return; }
      save.disabled = true;
      try {
        await window.AtharAPI.portal.updateMe({
          fullName: val("pf-fullName") || val("pf-fullNameAr"),
          fullNameAr: val("pf-fullNameAr") || null,
          email: val("pf-email") || null,
          phone: val("pf-phone") || null,
          whatsapp: val("pf-whatsapp") || null,
          skills: val("pf-skills").split(/[,،]/).map(s => s.trim()).filter(Boolean),
        });
        close();
        core().showToast(L("تم حفظ ملفك الشخصي", "Profile saved"), "success");
        if (core().App.currentView === "portal" && window.AtharViews.portal) {
          window.AtharViews.portal(document.getElementById("main-content"), {}, true);
        }
      } catch (e) {
        save.disabled = false;
        core().showToast((e && e.message) || L("فشل الحفظ", "Save failed"), "error");
      }
    };
  }

  return { open, canEdit, precheck };
})();
