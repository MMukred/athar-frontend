/**
 * Athar Modals — API-backed
 * All mutations go through window.AtharAPI, then refresh the cache.
 */
window.AtharModals = (function () {
  "use strict";

  const { App, t, ic, showToast, showConfirmModal, hasPermission, navigateTo, escapeHtml } = window.AtharCore;

  // =========================================================
  // WhatsApp editor helpers (local only — no API yet)
  // =========================================================
  const WA_SAMPLE_VALUES = {
    ar: { name: "أحمد علي المنصور", committee: "لجنة الإعلام", date: "٢٠ أكتوبر ٢٠٢٦", hours: "12.0", certificate_no: "ATHAR-2026-0007", verify_url: "https://athar.org/verify/ATHAR-2026-0007" },
    en: { name: "Ahmed Ali Al-Mansoor", committee: "Media Committee", date: "Oct 20, 2026", hours: "12.0", certificate_no: "ATHAR-2026-0007", verify_url: "https://athar.org/verify/ATHAR-2026-0007" }
  };

  function buildSamplePreview(body, lang) {
    const v = WA_SAMPLE_VALUES[lang === "ar" ? "ar" : "en"];
    return String(body || "")
      .replace(/\{name\}/g, v.name).replace(/\{committee\}/g, v.committee)
      .replace(/\{date\}/g, v.date).replace(/\{hours\}/g, v.hours)
      .replace(/\{certificate_no\}/g, v.certificate_no).replace(/\{verify_url\}/g, v.verify_url);
  }

  const WA_PLACEHOLDERS = [
    { token: "{name}", desc_en: "Volunteer name", desc_ar: "اسم المتطوع" },
    { token: "{committee}", desc_en: "Committee name", desc_ar: "اسم اللجنة" },
    { token: "{date}", desc_en: "Meeting / issue date", desc_ar: "تاريخ" },
    { token: "{hours}", desc_en: "Approved hours", desc_ar: "الساعات" },
    { token: "{certificate_no}", desc_en: "Certificate number", desc_ar: "رقم الشهادة" },
    { token: "{verify_url}", desc_en: "Verify URL", desc_ar: "رابط التحقق" }
  ];

  // ---- Round 7: duplicate detection helpers (slideover + import) ----
  function normPhoneKey(raw) {
    const d = String(raw || "").replace(/\D/g, "").replace(/^0+/, "");
    return d.length >= 9 ? d.slice(-9) : d;
  }
  function normEmailKey(raw) { return String(raw || "").trim().toLowerCase(); }

  // =========================================================
  // 1. Add / Edit Volunteer
  // =========================================================
  function openAddVolunteerSlideover(volunteerId) {
    volunteerId = volunteerId || null;
    const state = window.AtharStore.getState();
    const existing = volunteerId ? state.volunteers.find(v => v.id === volunteerId) : null;
    const isEdit = !!existing;

    const STUDY_LEVELS = [
      { value: "primary", en: "Primary", ar: "ابتدائي" },
      { value: "secondary", en: "Secondary", ar: "متوسط" },
      { value: "diploma", en: "Diploma", ar: "دبلوم" },
      { value: "bachelor", en: "Bachelor's", ar: "بكالوريوس" },
      { value: "master", en: "Master's", ar: "ماجستير" },
      { value: "phd", en: "PhD", ar: "دكتوراه" },
      { value: "other", en: "Other", ar: "أخرى" },
    ];

    const slideover = document.getElementById("slideover-container");
    slideover.innerHTML = `
      <div class="overlay-backdrop" id="vol-backdrop">
        <div class="slide-over">
          <div class="drawer-header">
            <h3 class="drawer-title">${ic("user_plus", 18)} ${isEdit ? t("edit") : t("add_volunteer")}</h3>
            <button class="btn-icon" id="vol-close">&times;</button>
          </div>
          <div class="drawer-body">
            <form id="vol-form" style="display:flex; flex-direction:column; gap:16px;" novalidate>

              <div class="form-field">
                <label class="field-label">${t("volunteer_name")} (EN) <span class="required-asterisk">*</span></label>
                <input type="text" id="vol-name-en" class="form-control" maxlength="150" value="${existing ? existing.full_name : ''}">
                <span class="field-hint" id="vol-name-en-err" style="color:var(--danger); display:none;"></span>
              </div>

              <div class="form-field">
                <label class="field-label">${t("volunteer_name")} (AR)</label>
                <input type="text" id="vol-name-ar" class="form-control" maxlength="150" value="${existing ? (existing.full_name_ar || '') : ''}">
              </div>

              <div class="form-grid">
                <div class="form-field">
                  <label class="field-label">${t("whatsapp")}</label>
                  <input type="tel" id="vol-wa" class="form-control" placeholder="+96650..." maxlength="30" value="${existing ? (existing.whatsapp || '') : ''}">
                  <span class="field-hint" id="vol-wa-err" style="color:var(--danger); display:none;"></span>
                  <div class="dup-warning" id="vol-wa-dup"></div>
                </div>
                <div class="form-field">
                  <label class="field-label">${t("email")}</label>
                  <input type="email" id="vol-email" class="form-control" maxlength="150" value="${existing ? (existing.email || '') : ''}">
                  <span class="field-hint" id="vol-email-err" style="color:var(--danger); display:none;"></span>
                  <div class="dup-warning" id="vol-email-dup"></div>
                </div>
              </div>

              <div style="padding:10px 12px; background:var(--primary-light); border:1px solid var(--primary-border); border-radius:var(--radius-md); font-size:12px; color:var(--primary);">
                ${App.currentLang === 'ar' ? 'يجب توفير رقم واتساب أو بريد إلكتروني واحد على الأقل.' : 'At least one of WhatsApp number or email is required.'}
              </div>

              <div class="form-field">
                <label class="field-label">${t("national_id")} <span style="color:var(--neutral-400); font-weight:500;">(${App.currentLang === 'ar' ? 'اختياري' : 'optional'})</span></label>
                <input type="text" id="vol-national-id" class="form-control num-ltr" maxlength="50" placeholder="${App.currentLang === 'ar' ? 'مثال: 1234567890' : 'e.g. 1234567890'}" value="${existing ? (existing.national_id || '') : ''}">
                <span class="field-hint" id="vol-national-id-err" style="color:var(--danger); display:none;"></span>
                <div class="dup-warning" id="vol-national-id-dup"></div>
              </div>

              <div class="form-grid">
                <div class="form-field">
                  <label class="field-label">${t("gender")}</label>
                  <select id="vol-gender" class="form-control">
                    <option value="">—</option>
                    <option value="male" ${existing && existing.gender === 'male' ? 'selected' : ''}>${t("male")}</option>
                    <option value="female" ${existing && existing.gender === 'female' ? 'selected' : ''}>${t("female")}</option>
                  </select>
                </div>
                <div class="form-field">
                  <label class="field-label">${App.currentLang === 'ar' ? 'الجنسية' : 'Nationality'}</label>
                  <input type="text" id="vol-nationality" class="form-control" maxlength="100" value="${existing ? (existing.nationality || '') : ''}" placeholder="${App.currentLang === 'ar' ? 'سعودي' : 'Saudi'}">
                </div>
              </div>

              <div class="form-grid">
                <div class="form-field">
                  <label class="field-label">${App.currentLang === 'ar' ? 'المستوى الدراسي' : 'Study Level'}</label>
                  <select id="vol-study-level" class="form-control">
                    <option value="">—</option>
                    ${STUDY_LEVELS.map(s => `<option value="${s.value}" ${existing && existing.study_level === s.value ? 'selected' : ''}>${App.currentLang === 'ar' ? s.ar : s.en}</option>`).join('')}
                  </select>
                </div>
                <div class="form-field">
                  <label class="field-label">${t("dob")}</label>
                  <input type="date" id="vol-dob" class="form-control" value="${existing ? (existing.dob || '') : ''}">
                </div>
              </div>

              <div class="form-grid">
                <div class="form-field">
                  <label class="field-label">${t("committee")}</label>
                  <select id="vol-comm" class="form-control">
                    <option value="">—</option>
                    ${state.committees.filter(c => c.status !== 'archived').map(c => `<option value="${c.id}" ${existing && existing.committee_id === c.id ? 'selected' : ''}>${App.currentLang === 'ar' ? c.name_ar : c.name_en}</option>`).join('')}
                  </select>
                </div>
                <div class="form-field">
                  <label class="field-label">${t("status")}</label>
                  <select id="vol-status" class="form-control">
                    <option value="active" ${!existing || existing.status === 'active' ? 'selected' : ''}>${t("active")}</option>
                    <option value="suspended" ${existing && existing.status === 'suspended' ? 'selected' : ''}>${t("suspended")}</option>
                    <option value="withdrawn" ${existing && existing.status === 'withdrawn' ? 'selected' : ''}>${t("withdrawn")}</option>
                    <option value="completed" ${existing && existing.status === 'completed' ? 'selected' : ''}>${t("completed")}</option>
                  </select>
                </div>
              </div>

              <div class="form-field">
                <label class="field-label">${t("notes")}</label>
                <textarea id="vol-notes" class="form-control" rows="3">${existing ? (existing.notes || '') : ''}</textarea>
              </div>

              <div class="drawer-footer">
                <button type="button" class="btn btn-secondary" id="vol-cancel">${t("cancel")}</button>
                <button type="submit" class="btn btn-primary" id="vol-submit">${t("save")}</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    const unbindDirty = window.AtharDirty.bind(document.getElementById("vol-form"), "volunteer-form");
    const close = () => { unbindDirty(); window.AtharDirty.clear(); slideover.innerHTML = ""; };
    const requestClose = () => { window.AtharDirty.guard(close); };
    document.getElementById("vol-close").onclick = requestClose;
    document.getElementById("vol-cancel").onclick = requestClose;
    document.getElementById("vol-backdrop").onclick = (e) => { if (e.target.id === "vol-backdrop") requestClose(); };

    const clearErr = (id) => { const el = document.getElementById(id + "-err"); if (el) { el.textContent = ""; el.style.display = "none"; } };
    ["vol-name-en", "vol-wa", "vol-email", "vol-national-id"].forEach((id) => {
      const input = document.getElementById(id);
      if (input) input.addEventListener("input", () => clearErr(id));
    });
    const setErr = (id, msg) => { const el = document.getElementById(id + "-err"); if (el) { el.textContent = msg; el.style.display = "block"; } };

    // ---- Round 7: live duplicate warnings (WhatsApp / email / national ID) ----
    const findDupMatches = (kind, value) => {
      const all = window.AtharStore.getState().volunteers || [];
      const others = all.filter(v => !existing || v.id !== existing.id);
      if (kind === "id") {
        const k = String(value || "").trim();
        if (!k) return [];
        return others.filter(v => v.national_id && String(v.national_id).trim() === k);
      }
      if (kind === "email") {
        const k = normEmailKey(value);
        if (!k) return [];
        return others.filter(v => normEmailKey(v.email) === k);
      }
      const k = normPhoneKey(value);
      if (!k) return [];
      return others.filter(v => normPhoneKey(v.whatsapp) === k || normPhoneKey(v.phone) === k);
    };
    const renderDupWarn = (warnId, matches) => {
      const el = document.getElementById(warnId);
      if (!el) return;
      if (!matches.length) { el.style.display = "none"; el.innerHTML = ""; return; }
      const names = matches.slice(0, 3).map(v => {
        const nm = App.currentLang === "ar" ? (v.full_name_ar || v.full_name) : (v.full_name || v.full_name_ar);
        return `<button type="button" class="dup-link" data-dup-id="${v.id}">${escapeHtml(nm)}</button>${v.status === "archived" ? ` <span style="opacity:.75;">(${t("archived")})</span>` : ""}`;
      }).join(App.currentLang === "ar" ? "، " : ", ");
      el.innerHTML = `${ic("alert", 12)} <span>${t("dup_registered_under")}</span> <span>${names}${matches.length > 3 ? ` +${matches.length - 3}` : ""}</span>`;
      el.style.display = "flex";
    };
    const refreshDupWarns = () => {
      renderDupWarn("vol-wa-dup", findDupMatches("phone", (document.getElementById("vol-wa") || {}).value));
      renderDupWarn("vol-email-dup", findDupMatches("email", (document.getElementById("vol-email") || {}).value));
      renderDupWarn("vol-national-id-dup", findDupMatches("id", (document.getElementById("vol-national-id") || {}).value));
    };
    ["vol-wa", "vol-email", "vol-national-id"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("input", refreshDupWarns);
    });
    refreshDupWarns();

    document.getElementById("vol-form").addEventListener("click", (e) => {
      const btn = e.target.closest && e.target.closest("[data-dup-id]");
      if (!btn) return;
      e.preventDefault();
      const vid = btn.getAttribute("data-dup-id");
      unbindDirty();
      window.AtharDirty.clear();
      slideover.innerHTML = "";
      navigateTo("volunteer-profile", { id: vid });
    });

    document.getElementById("vol-form").onsubmit = async (e) => {
      e.preventDefault();
      ["vol-name-en", "vol-wa", "vol-email", "vol-national-id"].forEach(clearErr);

      const nameEn = document.getElementById("vol-name-en").value.trim();
      const nameAr = document.getElementById("vol-name-ar").value.trim();
      const wa = document.getElementById("vol-wa").value.trim();
      const email = document.getElementById("vol-email").value.trim();
      const gender = document.getElementById("vol-gender").value || null;
      const nationality = document.getElementById("vol-nationality").value.trim();
      const studyLevel = document.getElementById("vol-study-level").value || null;
      const dob = document.getElementById("vol-dob").value;
      const commId = document.getElementById("vol-comm").value || null;
      const status = document.getElementById("vol-status").value;
      const notes = document.getElementById("vol-notes").value;
      const nationalId = document.getElementById("vol-national-id").value.trim();

      let hasError = false;
      if (nameEn.length < 2) { setErr("vol-name-en", "Name must be at least 2 characters."); hasError = true; }
      if (!wa && !email) { setErr("vol-wa", "Provide a WhatsApp number or an email."); setErr("vol-email", "Provide a WhatsApp number or an email."); hasError = true; }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr("vol-email", "Invalid email format."); hasError = true; }
      if (nationalId && findDupMatches("id", nationalId).length) { setErr("vol-national-id", t("error_duplicate_id")); hasError = true; }
      if (hasError) { showToast("Please fix the highlighted fields.", "error"); return; }

      const payload = { fullName: nameEn, fullNameAr: nameAr || undefined, nationalId: nationalId || undefined, whatsapp: wa || undefined, email: email || undefined, gender: gender || undefined, nationality: nationality || undefined, studyLevel: studyLevel || undefined, dob: dob || undefined, committeeId: commId, status, notes: notes || undefined };

      const submitBtn = document.getElementById("vol-submit");
      submitBtn.disabled = true;
      const origText = submitBtn.textContent;
      submitBtn.textContent = "Saving…";

      try {
        if (isEdit) { await window.AtharAPI.volunteers.update(existing.id, payload); showToast(t("updated_successfully"), "success"); }
        else { await window.AtharAPI.volunteers.create(payload); showToast(t("saved_successfully"), "success"); }
        await window.AtharStore.refreshVolunteers();
        close();
        window.AtharCore.renderCurrentView();
      } catch (err) {
        if (err.code === "DUPLICATE_NATIONAL_ID" || err.code === "DUPLICATE_RECORD") { setErr("vol-national-id", t("error_duplicate_id")); showToast(t("error_duplicate_id"), "error"); }
        else if (err.code === "MISSING_CONTACT" || (err.status === 422 && err.details)) {
          if (err.details?.whatsapp) setErr("vol-wa", Array.isArray(err.details.whatsapp) ? err.details.whatsapp[0] : err.details.whatsapp);
          if (err.details?.email) setErr("vol-email", Array.isArray(err.details.email) ? err.details.email[0] : err.details.email);
          showToast("Please fix the highlighted fields.", "error");
        } else { showToast(err.message || "Save failed", "error"); }
        submitBtn.disabled = false;
        submitBtn.textContent = origText;
      }
    };

    setTimeout(() => document.getElementById("vol-name-en").focus(), 100);
  }

  // =========================================================
  // 2. Transfer Volunteer
  // =========================================================
  function openTransferModal(volunteerId) {
    const state = window.AtharStore.getState();
    const vol = state.volunteers.find(v => v.id === volunteerId);
    if (!vol) return;

    // Warn when the volunteer holds a leadership role in their current committee.
    const currentComm = state.committees.find(c => c.id === vol.committee_id);
    const isLeaderHere = currentComm && currentComm.leader && currentComm.leader.id === vol.id;
    const isCoLeaderHere = currentComm && (currentComm.co_leaders || []).some(x => x.id === vol.id);

    const modal = document.getElementById("modal-container");
    modal.innerHTML = `
      <div class="overlay-backdrop" id="tr-backdrop">
        <div class="modal-dialog">
          <div class="modal-header">
            <h3 class="modal-title">${ic("arrow_right", 18)} ${t("transfer_volunteer")}</h3>
            <button class="btn-icon" id="tr-close">&times;</button>
          </div>
          <form id="tr-form">
            <div class="modal-body" style="display:flex; flex-direction:column; gap:16px;">
              <div><strong>Volunteer:</strong> ${vol.full_name}</div>
              ${(isLeaderHere || isCoLeaderHere) ? `
                <div class="alert-soft alert-warning-soft">
                  ⚠️ ${isLeaderHere ? t("leader_badge") : t("coleader_badge")} — ${t("leadership_transfer_warning")}
                </div>
              ` : ''}
              <div class="form-field">
                <label class="field-label">${t("to_committee")} <span class="required-asterisk">*</span></label>
                <select id="tr-comm" class="form-control" required>
                  ${state.committees.filter(c => c.id !== vol.committee_id).map(c => `<option value="${c.id}">${App.currentLang === 'ar' ? c.name_ar : c.name_en}</option>`).join('')}
                </select>
              </div>
              <div class="form-field">
                <label class="field-label">${t("transfer_reason")} <span class="required-asterisk">*</span></label>
                <textarea id="tr-reason" class="form-control" rows="3" required></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" id="tr-cancel">${t("cancel")}</button>
              <button type="submit" class="btn btn-primary">${t("confirm")}</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const close = () => { modal.innerHTML = ""; };
    document.getElementById("tr-close").onclick = close;
    document.getElementById("tr-cancel").onclick = close;
    document.getElementById("tr-backdrop").onclick = (e) => { if (e.target.id === "tr-backdrop") close(); };

    document.getElementById("tr-form").onsubmit = async (e) => {
      e.preventDefault();
      const target = document.getElementById("tr-comm").value;
      const reason = document.getElementById("tr-reason").value.trim();
      if (!reason) { showToast("Reason required", "error"); return; }
      try {
        await window.AtharAPI.volunteers.transfer(vol.id, target, reason);
        await window.AtharStore.refreshVolunteers();
        showToast(t("transfer_success"), "success");
        close();
        window.AtharCore.renderCurrentView();
      } catch (err) { showToast(err.message || "Transfer failed", "error"); }
    };
  }

  // =========================================================
  // 3. Log Hours
  // =========================================================
  function openLogHoursSlideover(volunteerId) {
    volunteerId = volunteerId || null;
    const state = window.AtharStore.getState();
    const slideover = document.getElementById("slideover-container");
    const active = state.volunteers.filter(v => v.status !== "archived");

    slideover.innerHTML = `
      <div class="overlay-backdrop" id="hr-backdrop">
        <div class="slide-over">
          <div class="drawer-header">
            <h3 class="drawer-title">${ic("clock", 18)} ${t("log_hours")}</h3>
            <button class="btn-icon" id="hr-close">&times;</button>
          </div>
          <div class="drawer-body">
            <form id="hr-form" style="display:flex; flex-direction:column; gap:16px;">
              <div class="form-field">
                <label class="field-label">${t("volunteer_name")} <span class="required-asterisk">*</span></label>
                <select id="hr-vol" class="form-control" required>
                  ${active.map(v => `<option value="${v.id}" ${volunteerId === v.id ? 'selected' : ''}>${App.currentLang === 'ar' ? (v.full_name_ar || v.full_name) : v.full_name}</option>`).join('')}
                </select>
              </div>
              <div class="form-field">
                <label class="field-label">${t("activity")} <span class="required-asterisk">*</span></label>
                <input type="text" id="hr-activity" class="form-control" required>
              </div>
              <div class="form-grid">
                <div class="form-field">
                  <label class="field-label">${t("hours_amount")} <span class="required-asterisk">*</span></label>
                  <input type="number" inputmode="decimal" step="0.5" min="0.5" id="hr-amount" class="form-control" required>
                </div>
                <div class="form-field">
                  <label class="field-label">${t("date")} <span class="required-asterisk">*</span></label>
                  <input type="date" id="hr-date" class="form-control" value="${new Date().toISOString().slice(0, 10)}" required>
                </div>
              </div>
              <div class="form-field">
                <label class="field-label">${t("notes")}</label>
                <textarea id="hr-notes" class="form-control" rows="3"></textarea>
              </div>
              <div class="drawer-footer">
                <button type="button" class="btn btn-secondary" id="hr-cancel">${t("cancel")}</button>
                <button type="submit" class="btn btn-primary">${t("save")}</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    const unbindDirty = window.AtharDirty.bind(document.getElementById("hr-form"), "log-hours-form");
    const close = () => { unbindDirty(); window.AtharDirty.clear(); slideover.innerHTML = ""; };
    const requestClose = () => { window.AtharDirty.guard(close); };
    document.getElementById("hr-close").onclick = requestClose;
    document.getElementById("hr-cancel").onclick = requestClose;
    document.getElementById("hr-backdrop").onclick = (e) => { if (e.target.id === "hr-backdrop") requestClose(); };

    document.getElementById("hr-form").onsubmit = async (e) => {
      e.preventDefault();
      const vId = document.getElementById("hr-vol").value;
      const activity = document.getElementById("hr-activity").value.trim();
      const amount = Number(document.getElementById("hr-amount").value);
      const date = document.getElementById("hr-date").value;
      const notes = document.getElementById("hr-notes").value;
      if (amount <= 0) { showToast("Hours must be > 0", "error"); return; }
      try {
        await window.AtharAPI.hours.create({ volunteerId: vId, activity, hours: amount, date, description: notes || undefined });
        await window.AtharStore.refreshHours();
        showToast(t("saved_successfully"), "success");
        close();
        window.AtharCore.renderCurrentView();
      } catch (err) { showToast(err.message || "Failed to log hours", "error"); }
    };
  }

  // =========================================================
  // 4. Create Meeting / Event
  // =========================================================
  function openCreateMeetingSlideover(committeeId, kind, prefill) {
    committeeId = committeeId || null;
    kind = kind === "event" ? "event" : "meeting";
    const isEvent = kind === "event";
    const state = window.AtharStore.getState();
    const slideover = document.getElementById("slideover-container");

    // Optional pre-fill (used by "Duplicate" on the session detail page).
    prefill = prefill || null;
    const pf = prefill || {};
    const pfTitleEn = pf.title_en || "";
    const pfTitleAr = pf.title_ar || "";
    const pfCommittee = pf.committee_id || committeeId;
    const pfStart = pf.start_time || "18:00";
    const pfEnd = pf.end_time || "19:30";
    const pfLoc = pf.location || "Room 3";

    slideover.innerHTML = `
      <div class="overlay-backdrop" id="mt-backdrop">
        <div class="slide-over">
          <div class="drawer-header">
            <h3 class="drawer-title">
              ${ic(isEvent ? "sparkles" : "calendar", 18)}
              ${isEvent ? (App.currentLang === 'ar' ? 'فعالية جديدة' : 'New Event') : t("add_meeting")}
            </h3>
            <button class="btn-icon" id="mt-close">&times;</button>
          </div>
          <div class="drawer-body">
            <form id="mt-form" style="display:flex; flex-direction:column; gap:16px;">
              ${prefill ? `
                <div style="padding:10px 12px; background:var(--primary-light); border:1px solid var(--primary-border); border-radius:var(--radius-md); font-size:12px; color:var(--primary); display:flex; gap:8px; align-items:center;">
                  ${ic("info", 14)} <span>${t("duplicate_prefilled_note")}</span>
                </div>
              ` : ''}
              <div class="form-field">
                <label class="field-label">${t("meeting_title_en")} <span class="required-asterisk">*</span></label>
                <input type="text" id="mt-title-en" class="form-control" value="${escapeHtml(pfTitleEn)}" required>
              </div>
              <div class="form-field">
                <label class="field-label">${t("meeting_title_ar")} <span class="required-asterisk">*</span></label>
                <input type="text" id="mt-title-ar" class="form-control" value="${escapeHtml(pfTitleAr)}" required>
              </div>
              <div class="form-field">
                <label class="field-label">${t("committee")}</label>
                <select id="mt-comm" class="form-control">
                  <option value="">${t("all_committees")}</option>
                  ${state.committees.map(c => `<option value="${c.id}" ${pfCommittee === c.id ? 'selected' : ''}>${App.currentLang === 'ar' ? c.name_ar : c.name_en}</option>`).join('')}
                </select>
              </div>
              <div class="form-field">
                <label class="field-label">${t("meeting_date")} <span class="required-asterisk">*</span></label>
                <input type="date" id="mt-date" class="form-control" value="${new Date().toISOString().slice(0, 10)}" required>
              </div>
              <div class="form-grid">
                <div class="form-field">
                  <label class="field-label">${t("start_time")} <span class="required-asterisk">*</span></label>
                  <input type="time" id="mt-start" class="form-control" value="${pfStart}" required>
                </div>
                <div class="form-field">
                  <label class="field-label">${t("end_time")} ${isEvent ? '<span class="required-asterisk">*</span>' : ''}</label>
                  <input type="time" id="mt-end" class="form-control" value="${pfEnd}" ${isEvent ? 'required' : ''}>
                </div>
              </div>
              ${isEvent ? `
                <div style="padding:10px 12px; background:var(--primary-light); border:1px solid var(--primary-border); border-radius:var(--radius-md); font-size:12px; color:var(--primary);">
                  ${App.currentLang === 'ar' ? 'لاحقاً يمكنك تسجيل ساعات تلقائياً لكل من حضر، حسب مدة الفعالية.' : 'After saving attendance, you can auto-log hours for everyone present, based on event duration.'}
                </div>
              ` : ''}
              <div class="form-field">
                <label class="field-label">${t("location")}</label>
                <input type="text" id="mt-loc" class="form-control" value="${escapeHtml(pfLoc)}">
              </div>
              <div class="drawer-footer">
                <button type="button" class="btn btn-secondary" id="mt-cancel">${t("cancel")}</button>
                <button type="submit" class="btn btn-primary">${t("save")}</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    const unbindDirty = window.AtharDirty.bind(document.getElementById("mt-form"), "meeting-form");
    const close = () => { unbindDirty(); window.AtharDirty.clear(); slideover.innerHTML = ""; };
    const requestClose = () => { window.AtharDirty.guard(close); };
    document.getElementById("mt-close").onclick = requestClose;
    document.getElementById("mt-cancel").onclick = requestClose;
    document.getElementById("mt-backdrop").onclick = (e) => { if (e.target.id === "mt-backdrop") requestClose(); };

    document.getElementById("mt-form").onsubmit = async (e) => {
      e.preventDefault();
      const titleEn = document.getElementById("mt-title-en").value.trim();
      const titleAr = document.getElementById("mt-title-ar").value.trim();
      const commId = document.getElementById("mt-comm").value || null;
      const date = document.getElementById("mt-date").value;
      const start = document.getElementById("mt-start").value;
      const end = document.getElementById("mt-end").value;
      const loc = document.getElementById("mt-loc").value;
      try {
        const created = await window.AtharAPI.meetings.create({ kind, titleEn, titleAr, meetingDate: date, startTime: start, endTime: end || undefined, location: loc || undefined, committeeId: commId });
        await window.AtharStore.refreshMeetings();
        showToast(t("saved_successfully"), "success");
        close();
        navigateTo("meeting-detail", { id: created.id });
      } catch (err) { showToast(err.message || "Failed to create", "error"); }
    };
  }

  function openCreateEventSlideover(committeeId) {
    return openCreateMeetingSlideover(committeeId, "event");
  }

  // =========================================================
  // 5. Add / Edit Committee
  // =========================================================
  async function openAddCommitteeModal(committeeId) {
    committeeId = committeeId || null;
    const state = window.AtharStore.getState();
    const existing = committeeId ? state.committees.find(c => c.id === committeeId) : null;
    const isEdit = !!existing;
    const modal = document.getElementById("modal-container");

    modal.innerHTML = `
      <div class="overlay-backdrop" id="cm-backdrop">
        <div class="modal-dialog">
          <div class="modal-header">
            <h3 class="modal-title">${ic("building", 18)} ${isEdit ? t("edit") : t("add_committee")}</h3>
            <button class="btn-icon" id="cm-close">&times;</button>
          </div>
          <form id="cm-form">
            <div class="modal-body" style="display:flex; flex-direction:column; gap:16px;">
              <div class="form-field">
                <label class="field-label">${t("committee_name_en")} <span class="required-asterisk">*</span></label>
                <input type="text" id="cm-name-en" class="form-control" required value="${existing ? escapeHtml(existing.name_en) : ''}">
              </div>
              <div class="form-field">
                <label class="field-label">${t("committee_name_ar")} <span class="required-asterisk">*</span></label>
                <input type="text" id="cm-name-ar" class="form-control" required value="${existing ? escapeHtml(existing.name_ar) : ''}">
              </div>
              <div class="form-field">
                <label class="field-label">${t("committee_desc_en")}</label>
                <textarea id="cm-desc-en" class="form-control" rows="2">${existing ? escapeHtml(existing.description_en || '') : ''}</textarea>
              </div>
              <div class="form-field">
                <label class="field-label">${t("committee_desc_ar")}</label>
                <textarea id="cm-desc-ar" class="form-control" rows="2">${existing ? escapeHtml(existing.description_ar || '') : ''}</textarea>
              </div>
              ${isEdit ? `
              <div style="font-size:12px; color:var(--neutral-500); display:flex; align-items:flex-start; gap:6px; background:var(--neutral-50); border:1px solid var(--neutral-200); border-radius:var(--radius-md); padding:10px;">
                ${ic("shield", 14)}<span>${t("leadership_edit_hint")}</span>
              </div>` : ''}
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" id="cm-cancel">${t("cancel")}</button>
              <button type="submit" class="btn btn-primary">${t("save")}</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const close = () => { modal.innerHTML = ""; };
    document.getElementById("cm-close").onclick = close;
    document.getElementById("cm-cancel").onclick = close;
    document.getElementById("cm-backdrop").onclick = (e) => { if (e.target.id === "cm-backdrop") close(); };

    document.getElementById("cm-form").onsubmit = async (e) => {
      e.preventDefault();
      const nameEn = document.getElementById("cm-name-en").value.trim();
      const nameAr = document.getElementById("cm-name-ar").value.trim();
      const descEn = document.getElementById("cm-desc-en").value;
      const descAr = document.getElementById("cm-desc-ar").value;
      if (!nameEn || !nameAr) { showToast("Both names required", "error"); return; }
      try {
        if (isEdit) {
          await window.AtharAPI.committees.update(existing.id, {
            nameEn, nameAr,
            descriptionEn: descEn || undefined,
            descriptionAr: descAr || undefined,
          });
          showToast(t("updated_successfully"), "success");
        } else {
          await window.AtharAPI.committees.create({
            nameEn, nameAr,
            descriptionEn: descEn || undefined,
            descriptionAr: descAr || undefined,
          });
          showToast(t("saved_successfully"), "success");
        }
        await window.AtharStore.refreshCommittees();
        close();
        window.AtharCore.renderCurrentView();
      } catch (err) { showToast(err.message || "Save failed", "error"); }
    };
  }

  // =========================================================
  // 6. Permissions Editor (Super Admin)
  // =========================================================
  function openPermissionsEditor(userId) {
    const state = window.AtharStore.getState();
    const user = state.users.find(u => u.id === userId);
    if (!user) return;
    showToast("Permissions editing is available in the backend admin (coming soon)", "info");
  }

  // =========================================================
  // 7. Diff Viewer
  // =========================================================
  async function openDiffModal(logId) {
    const state = window.AtharStore.getState();
    let log = state.audit_logs.find(l => l.id === logId);

    if (!log) {
      try {
        const apiLog = await window.AtharAPI.audit.get(logId);
        let createdAt = apiLog.createdAt;
        if (typeof createdAt === "string") createdAt = createdAt.replace("T", " ").slice(0, 19);
        else if (createdAt) { try { createdAt = new Date(createdAt).toISOString().replace("T", " ").slice(0, 19); } catch { createdAt = ""; } }
        log = { id: apiLog.id, user_id: apiLog.userId, user_name: apiLog.userName || "System", action: apiLog.action, entity: apiLog.entity, entity_id: apiLog.entityId, details: apiLog.details, old_value: apiLog.oldValue, new_value: apiLog.newValue, created_at: createdAt };
      } catch (err) { showToast("Could not load audit entry", "error"); return; }
    }

    if (!log) return;
    const diffHtml = window.DiffViewer.renderDiff(log.old_value, log.new_value);
    const modal = document.getElementById("modal-container");
    modal.innerHTML = `
      <div class="overlay-backdrop" id="df-backdrop">
        <div class="modal-dialog modal-lg">
          <div class="modal-header">
            <h3 class="modal-title">${ic("eye", 18)} ${t("audit_diff_modal")}</h3>
            <button class="btn-icon" id="df-close">&times;</button>
          </div>
          <div class="modal-body">
            <div style="margin-bottom:16px; padding:12px; background:var(--neutral-100); border-radius:var(--radius-md); font-size:13px;">
              <div><strong>Action:</strong> <span class="badge badge-primary">${log.action}</span> &bull; <strong>Entity:</strong> <code>${log.entity || '—'}</code></div>
              ${log.details ? `<div style="margin-top:4px;"><strong>Details:</strong> ${log.details}</div>` : ''}
              <div style="margin-top:4px; color:var(--neutral-500); font-size:11px;" class="num-ltr">${log.created_at} by ${log.user_name}</div>
            </div>
            ${diffHtml}
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="df-cancel">${t("close")}</button>
          </div>
        </div>
      </div>
    `;
    const close = () => { modal.innerHTML = ""; };
    document.getElementById("df-close").onclick = close;
    document.getElementById("df-cancel").onclick = close;
    document.getElementById("df-backdrop").onclick = (e) => { if (e.target.id === "df-backdrop") close(); };
  }

  // =========================================================
  // 8. Role Simulator
  // =========================================================
  function openRoleSimulatorModal() {
    const state = window.AtharStore.getState();
    const modal = document.getElementById("modal-container");
    modal.innerHTML = `
      <div class="overlay-backdrop" id="rl-backdrop">
        <div class="modal-dialog">
          <div class="modal-header">
            <h3 class="modal-title">${ic("users", 18)} ${t("switch_user")}</h3>
            <button class="btn-icon" id="rl-close">&times;</button>
          </div>
          <div class="modal-body">
            <div style="display:flex; flex-direction:column; gap:10px;">
              ${state.users.map(u => `
                <div style="display:flex; align-items:center; justify-content:space-between; padding:12px; background:${u.id === App.currentUser?.id ? 'var(--primary-light)' : 'var(--neutral-50)'}; border-radius:8px;">
                  <div><strong>${u.full_name}</strong> <span style="font-size:11px; color:var(--neutral-500);">${u.email}</span></div>
                  ${u.id === App.currentUser?.id ? '<span class="badge badge-primary">Active</span>' : ''}
                </div>
              `).join('')}
            </div>
            <p style="font-size:12px; color:var(--neutral-500); margin-top:16px;">To switch users, log out and log in as another user.</p>
          </div>
        </div>
      </div>
    `;
    const close = () => { modal.innerHTML = ""; };
    document.getElementById("rl-close").onclick = close;
    document.getElementById("rl-backdrop").onclick = (e) => { if (e.target.id === "rl-backdrop") close(); };
  }

  // =========================================================
  // 9. Revoke Certificate
  // =========================================================
  function openRevokeCertModal(certId) {
    const state = window.AtharStore.getState();
    const cert = state.certificates.find(c => c.id === certId);
    if (!cert) return;
    const modal = document.getElementById("modal-container");
    modal.innerHTML = `
      <div class="overlay-backdrop" id="rv-backdrop">
        <div class="modal-dialog">
          <div class="modal-header">
            <h3 class="modal-title" style="color:var(--danger);">${ic("alert", 18)} ${t("revoke_certificate")}</h3>
            <button class="btn-icon" id="rv-close">&times;</button>
          </div>
          <form id="rv-form">
            <div class="modal-body">
              <div style="margin-bottom:16px;"><strong>Certificate:</strong> <code>${cert.certificate_no}</code></div>
              <div class="form-field">
                <label class="field-label">${t("revocation_reason")} <span class="required-asterisk">*</span></label>
                <textarea id="rv-reason" class="form-control" rows="3" required></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" id="rv-cancel">${t("cancel")}</button>
              <button type="submit" class="btn btn-danger">${t("revoke_certificate")}</button>
            </div>
          </form>
        </div>
      </div>
    `;
    const close = () => { modal.innerHTML = ""; };
    document.getElementById("rv-close").onclick = close;
    document.getElementById("rv-cancel").onclick = close;
    document.getElementById("rv-backdrop").onclick = (e) => { if (e.target.id === "rv-backdrop") close(); };

    document.getElementById("rv-form").onsubmit = async (e) => {
      e.preventDefault();
      const reason = document.getElementById("rv-reason").value.trim();
      if (!reason) return;
      try {
        await window.AtharAPI.certificates.revoke(cert.id, reason);
        await window.AtharStore.refreshCertificates();
        showToast(t("cert_revoked_successfully"), "warning");
        close();
        window.AtharCore.renderCurrentView();
      } catch (err) { showToast(err.message || "Revoke failed", "error"); }
    };
  }

  // =========================================================
  // 10. User Menu
  // =========================================================
  function openUserMenuModal() {
    const modal = document.getElementById("modal-container");
    const isSuper = App.currentUser?.role === "super_admin";
    modal.innerHTML = `
      <div class="overlay-backdrop" id="um-backdrop">
        <div class="modal-dialog" style="max-width:420px;">
          <div class="modal-header">
            <h3 class="modal-title">${t("profile")}</h3>
            <button class="btn-icon" id="um-close">&times;</button>
          </div>
          <div class="modal-body">
            <div style="display:flex; align-items:center; gap:14px; padding:12px; background:var(--neutral-50); border-radius:8px; margin-bottom:16px;">
              <div class="user-avatar" style="width:44px; height:44px; font-size:16px;">${((App.currentUser && (App.currentUser.full_name || App.currentUser.fullName)) || "?").charAt(0)}</div>
              <div style="flex:1;">
                <div style="font-weight:700;">${(App.currentUser && (App.currentUser.full_name || App.currentUser.fullName)) || ""}</div>
                <div style="font-size:12px; color:var(--neutral-500);">${App.currentUser.email}</div>
                <div style="font-size:11px; color:var(--neutral-500); margin-top:2px;">${isSuper ? t("super_admin") : t("trusted_admin")}</div>
              </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:8px;">
              <button class="btn btn-secondary${App.currentUser?.must_change_password ? ' btn-must-change' : ''}" id="um-change-password" style="width:100%; justify-content:flex-start;">
                ${ic("lock", 15)} ${t("change_password")}${App.currentUser?.must_change_password ? ` • ${t("default_password_flag")}` : ''}
              </button>
              <button class="btn btn-danger-outline" id="um-logout" style="width:100%; justify-content:flex-start;">
                ${ic("logout", 15)} ${t("logout")}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    const close = () => { modal.innerHTML = ""; };
    document.getElementById("um-close").onclick = close;
    document.getElementById("um-backdrop").onclick = (e) => { if (e.target.id === "um-backdrop") close(); };
    document.getElementById("um-change-password").onclick = () => { close(); openChangePasswordModal(false); };
    document.getElementById("um-logout").onclick = () => { close(); if (window.AtharAuth) window.AtharAuth.logout(); };
  }

  // =========================================================
  // 11-13. WhatsApp Templates (local only — no API)
  // =========================================================
  function openEditWhatsAppTemplate() { showToast("WhatsApp templates are local-only for now", "info"); }
  function duplicateWhatsAppTemplate() { showToast("Not available yet", "info"); }
  function deleteWhatsAppTemplate(templateId) {
    const state = window.AtharStore.getState();
    const tmpl = state.whatsapp_templates.find(x => x.id === templateId);
    if (!tmpl) return;
    showConfirmModal({
      title: t("confirm_destructive"),
      message: `${App.currentLang === 'ar' ? 'حذف القالب' : 'Delete template'} "${tmpl.name}" (${tmpl.language.toUpperCase()})?`,
      confirmText: t("delete"),
      isDanger: true,
      onConfirm: () => {
        state.whatsapp_templates = state.whatsapp_templates.filter(x => x.id !== templateId);
        showToast(App.currentLang === 'ar' ? 'تم حذف القالب محلياً' : 'Template removed locally', "warning");
        window.AtharCore.renderCurrentView();
      },
    });
  }

  // =========================================================
  // 14. Bulk Log Hours
  // =========================================================
  function openBulkLogHoursSlideover(volunteerIds) {
    volunteerIds = volunteerIds || Array.from(App.selectedVolunteerIds || []);
    if (!volunteerIds.length) { showToast("No volunteers selected", "error"); return; }
    const state = window.AtharStore.getState();
    const vols = state.volunteers.filter(v => volunteerIds.includes(v.id));
    if (!vols.length) { showToast("No matching volunteers", "error"); return; }

    const slideover = document.getElementById("slideover-container");
    slideover.innerHTML = `
      <div class="overlay-backdrop" id="bhr-backdrop">
        <div class="slide-over">
          <div class="drawer-header">
            <h3 class="drawer-title">${ic("clock", 18)} ${App.currentLang === 'ar' ? 'تسجيل ساعات جماعي' : 'Bulk Log Hours'} (${vols.length})</h3>
            <button class="btn-icon" id="bhr-close">&times;</button>
          </div>
          <div class="drawer-body">
            <form id="bhr-form" style="display:flex; flex-direction:column; gap:16px;">
              <div style="padding:12px; background:var(--primary-light); border:1px solid var(--primary-border); border-radius:var(--radius-md);">
                <div style="font-size:12px; font-weight:700; color:var(--primary); margin-bottom:6px;">${vols.length} ${App.currentLang === 'ar' ? 'متطوع سيحصل على نفس القيد' : 'volunteer(s) will get the same entry'}</div>
                <div style="display:flex; flex-wrap:wrap; gap:6px; max-height:110px; overflow-y:auto;">
                  ${vols.map(v => `<span class="tag-chip" style="font-size:11px;">${v.full_name}</span>`).join('')}
                </div>
              </div>
              <div class="form-field">
                <label class="field-label">${t("activity")} <span class="required-asterisk">*</span></label>
                <input type="text" id="bhr-activity" class="form-control" required>
              </div>
              <div class="form-grid">
                <div class="form-field">
                  <label class="field-label">${t("hours_amount")} <span class="required-asterisk">*</span></label>
                  <input type="number" inputmode="decimal" step="0.5" min="0.5" id="bhr-hours" class="form-control" required value="2">
                </div>
                <div class="form-field">
                  <label class="field-label">${t("date")} <span class="required-asterisk">*</span></label>
                  <input type="date" id="bhr-date" class="form-control" value="${new Date().toISOString().slice(0, 10)}" required>
                </div>
              </div>
              <div class="form-field">
                <label class="field-label">${t("notes")}</label>
                <textarea id="bhr-notes" class="form-control" rows="2"></textarea>
              </div>
              <div id="bhr-progress" style="display:none; padding:12px; background:var(--neutral-100); border-radius:var(--radius-md); font-size:13px; font-weight:600;">
                ${App.currentLang === 'ar' ? 'جارٍ الحفظ…' : 'Saving…'} <span id="bhr-progress-text">0 / ${vols.length}</span>
              </div>
              <div class="drawer-footer">
                <button type="button" class="btn btn-secondary" id="bhr-cancel">${t("cancel")}</button>
                <button type="submit" class="btn btn-primary" id="bhr-submit">${t("save")} × ${vols.length}</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    const close = () => { slideover.innerHTML = ""; };
    document.getElementById("bhr-close").onclick = close;
    document.getElementById("bhr-cancel").onclick = close;
    document.getElementById("bhr-backdrop").onclick = (e) => { if (e.target.id === "bhr-backdrop") close(); };

    document.getElementById("bhr-form").onsubmit = async (e) => {
      e.preventDefault();
      const activity = document.getElementById("bhr-activity").value.trim();
      const hours = Number(document.getElementById("bhr-hours").value);
      const date = document.getElementById("bhr-date").value;
      const notes = document.getElementById("bhr-notes").value.trim();
      if (!activity) { showToast("Activity required", "error"); return; }
      if (!hours || hours <= 0) { showToast("Hours must be > 0", "error"); return; }
      const submitBtn = document.getElementById("bhr-submit");
      submitBtn.disabled = true;
      document.getElementById("bhr-progress").style.display = "block";
      let ok = 0, fail = 0;
      for (let i = 0; i < vols.length; i++) {
        const v = vols[i];
        document.getElementById("bhr-progress-text").textContent = `${i + 1} / ${vols.length}`;
        try {
          await window.AtharAPI.hours.create({ volunteerId: v.id, activity, hours, date, description: notes || undefined });
          ok++;
        } catch (err) { fail++; }
      }
      await window.AtharStore.refreshHours();
      if (fail === 0) showToast(`Logged ${hours}h for ${ok} volunteer(s)`, "success");
      else if (ok === 0) showToast(`All ${fail} entries failed`, "error");
      else showToast(`Logged ${ok}, failed ${fail}`, "warning");
      if (App.selectedVolunteerIds) App.selectedVolunteerIds.clear();
      close();
      window.AtharCore.renderCurrentView();
    };
  }

  // =========================================================
  // 15. Bulk Rating
  // =========================================================
  function openBulkRatingModal(volunteerIds) {
    volunteerIds = volunteerIds || Array.from(App.selectedVolunteerIds || []);
    if (!volunteerIds.length) { showToast("No volunteers selected", "error"); return; }
    const state = window.AtharStore.getState();
    const vols = state.volunteers.filter(v => volunteerIds.includes(v.id));
    const criteria = state.criteria.filter(c => c.is_active);
    if (!vols.length) { showToast("No matching volunteers", "error"); return; }
    if (!criteria.length) { showToast("No active criteria — add them in Evaluation Criteria", "error"); return; }

    // Draft key is stable for the same set of volunteers, so an unfinished
    // rating session can be restored after a refresh / crash.
    const draftKey = "bulk_eval_" + volunteerIds.slice().sort().join("_");
    const draft = window.AtharDirty.loadDraft(draftKey);

    const modal = document.getElementById("modal-container");
    modal.innerHTML = `
      <div class="overlay-backdrop" id="brt-backdrop">
        <div class="modal-dialog modal-lg">
          <div class="modal-header">
            <h3 class="modal-title">${ic("star", 18)} ${App.currentLang === 'ar' ? 'تقييم جماعي' : 'Bulk Rating'} (${vols.length})</h3>
            <button class="btn-icon" id="brt-close">&times;</button>
          </div>
          <form id="brt-form">
            <div class="modal-body" style="display:flex; flex-direction:column; gap:16px; max-height:70vh; overflow-y:auto;">
              <div style="padding:12px; background:var(--warning-light); border:1px solid var(--warning-border); border-radius:var(--radius-md); font-size:12px; color:var(--warning);">
                ⚠ ${App.currentLang === 'ar' ? `جميع الـ ${vols.length} متطوع سيحصلون على نفس التقييم.` : `All ${vols.length} volunteer(s) get the same rating.`}
              </div>
              ${draft ? `
                <div id="brt-draft-banner" style="padding:10px 12px; background:var(--info-light); border:1px solid var(--primary-border); border-radius:var(--radius-md); font-size:12.5px; color:var(--info); display:flex; align-items:center; justify-content:space-between; gap:10px; font-weight:600;">
                  <span style="display:flex; align-items:center; gap:8px;">${ic("info", 14)} ${t("draft_restored")}</span>
                  <button type="button" class="btn btn-secondary btn-sm" id="brt-draft-discard">${t("discard_draft")}</button>
                </div>
              ` : ''}
              <div style="display:flex; flex-wrap:wrap; gap:6px; max-height:90px; overflow-y:auto;">
                ${vols.map(v => `<span class="tag-chip" style="font-size:11px;">${v.full_name}</span>`).join('')}
              </div>
              <div class="form-grid">
                <div class="form-field">
                  <label class="field-label">${t("period")} <span class="required-asterisk">*</span></label>
                  <input type="text" id="brt-period" class="form-control" required value="" placeholder="${App.currentLang === 'ar' ? 'مثال: فعالية اليوم المفتوح ٢٠٢٦' : 'e.g. Open Day Event 2026'}">
                  <span class="field-hint">${App.currentLang === 'ar' ? 'نص حر' : 'Free text'}</span>
                </div>
                <div class="form-field">
                  <label class="field-label">${t("notes")}</label>
                  <input type="text" id="brt-notes" class="form-control" maxlength="200">
                </div>
              </div>
              <div class="form-grid">
                <div class="form-field">
                  <label class="field-label">${App.currentLang === 'ar' ? 'بداية الفترة' : 'Period Start'}</label>
                  <input type="date" id="brt-start" class="form-control">
                </div>
                <div class="form-field">
                  <label class="field-label">${App.currentLang === 'ar' ? 'نهاية الفترة' : 'Period End'}</label>
                  <input type="date" id="brt-end" class="form-control">
                </div>
              </div>
              <h3 style="font-size:15px; border-bottom:1px solid var(--neutral-300); padding-bottom:8px;">${t("criteria")}</h3>
              <div style="display:flex; flex-direction:column; gap:14px;">
                ${criteria.map(c => `
                  <div class="brt-criterion-row" data-crit-id="${c.id}" style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:var(--neutral-50); border:1px solid var(--neutral-300); border-radius:var(--radius-md);">
                    <div>
                      <div style="font-weight:700;">${App.currentLang === 'ar' ? c.name_ar : c.name_en}</div>
                      <div style="font-size:11px; color:var(--neutral-500);">Weight: ${c.weight}x</div>
                    </div>
                    <div class="star-rating" data-crit-id="${c.id}">
                      <span class="star" data-score="1">★</span>
                      <span class="star" data-score="2">★</span>
                      <span class="star" data-score="3">★</span>
                      <span class="star" data-score="4">★</span>
                      <span class="star" data-score="5">★</span>
                    </div>
                  </div>
                `).join('')}
              </div>
              <div id="brt-progress" style="display:none; padding:12px; background:var(--neutral-100); border-radius:var(--radius-md); font-size:13px; font-weight:600;">
                ${App.currentLang === 'ar' ? 'جارٍ الحفظ…' : 'Saving…'} <span id="brt-progress-text">0 / ${vols.length}</span>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" id="brt-cancel">${t("cancel")}</button>
              <button type="submit" class="btn btn-primary" id="brt-submit">${App.currentLang === 'ar' ? `تقييم ${vols.length} وحفظ` : `Rate ${vols.length} & Save`}</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const brtDiscardDraft = () => window.AtharDirty.clearDraft(draftKey);
    const unbindDirty = window.AtharDirty.bind(document.getElementById("brt-form"), "bulk-rating", brtDiscardDraft);
    const close = () => { unbindDirty(); window.AtharDirty.clear(); modal.innerHTML = ""; };

    // Inline unsaved-changes guard: the global confirm modal renders into
    // #modal-container — the same container as this modal — so it would wipe
    // the form. Ask inside the footer instead.
    let confirmState = false;
    const brtFooter = document.querySelector("#brt-form .modal-footer");
    const originalFooterHtml = brtFooter.innerHTML;
    const requestClose = () => {
      if (!window.AtharDirty.isDirty()) { close(); return; }
      if (confirmState) return; // already asking
      confirmState = true;
      brtFooter.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px; width:100%; justify-content:space-between; flex-wrap:wrap;">
          <span style="font-size:12.5px; color:var(--warning); font-weight:600;">${t("unsaved_message")}</span>
          <span style="display:flex; gap:8px; flex-shrink:0;">
            <button type="button" class="btn btn-secondary btn-sm" id="brt-unsaved-keep">${t("unsaved_keep_editing")}</button>
            <button type="button" class="btn btn-danger btn-sm" id="brt-unsaved-discard">${t("unsaved_discard")}</button>
          </span>
        </div>`;
      document.getElementById("brt-unsaved-keep").onclick = () => {
        confirmState = false;
        brtFooter.innerHTML = originalFooterHtml;
        document.getElementById("brt-cancel").onclick = requestClose;
      };
      document.getElementById("brt-unsaved-discard").onclick = () => {
        window.AtharDirty.clearDraft(draftKey);
        window.AtharDirty.clear();
        close();
      };
    };
    document.getElementById("brt-close").onclick = requestClose;
    document.getElementById("brt-cancel").onclick = requestClose;
    document.getElementById("brt-backdrop").onclick = (e) => { if (e.target.id === "brt-backdrop") requestClose(); };

    const criterionScores = {};
    const saveDraftNow = () => window.AtharDirty.saveDraft(draftKey, {
      scores: criterionScores,
      period: document.getElementById("brt-period").value,
      notes: document.getElementById("brt-notes").value,
      start: document.getElementById("brt-start").value,
      end: document.getElementById("brt-end").value,
    });
    const applyStarFill = (stars, score) => {
      stars.forEach(s => {
        const sc = Number(s.getAttribute("data-score"));
        if (sc <= score) s.classList.add("filled");
        else s.classList.remove("filled");
      });
    };

    modal.querySelectorAll(".star-rating").forEach(ratingEl => {
      const critId = ratingEl.getAttribute("data-crit-id");
      const stars = ratingEl.querySelectorAll(".star");
      stars.forEach(star => {
        star.onclick = () => {
          const score = Number(star.getAttribute("data-score"));
          criterionScores[critId] = score;
          applyStarFill(stars, score);
          window.AtharDirty.mark("bulk-rating", brtDiscardDraft);
          saveDraftNow();
        };
      });
    });

    // Restore an unfinished draft (crash / refresh recovery).
    if (draft) {
      ["period", "notes", "start", "end"].forEach(k => {
        if (draft[k]) {
          const el = document.getElementById("brt-" + k);
          if (el) el.value = draft[k];
        }
      });
      Object.keys(draft.scores || {}).forEach(critId => {
        const val = draft.scores[critId];
        if (typeof val !== "number") return;
        criterionScores[critId] = val;
        const ratingEl = modal.querySelector('.star-rating[data-crit-id="' + critId + '"]');
        if (ratingEl) applyStarFill(ratingEl.querySelectorAll(".star"), val);
      });
      const discardDraftBtn = document.getElementById("brt-draft-discard");
      if (discardDraftBtn) discardDraftBtn.onclick = () => {
        window.AtharDirty.clearDraft(draftKey);
        Object.keys(criterionScores).forEach(k => delete criterionScores[k]);
        modal.querySelectorAll(".star-rating").forEach(r => applyStarFill(r.querySelectorAll(".star"), 0));
        ["period", "notes", "start", "end"].forEach(k => {
          const el = document.getElementById("brt-" + k);
          if (el) el.value = "";
        });
        const banner = document.getElementById("brt-draft-banner");
        if (banner) banner.remove();
        window.AtharDirty.clear();
      };
    }

    document.getElementById("brt-form").addEventListener("input", saveDraftNow);

    document.getElementById("brt-form").onsubmit = async (e) => {
      e.preventDefault();
      const period = document.getElementById("brt-period").value.trim();
      const notes = document.getElementById("brt-notes").value.trim();
      const start = document.getElementById("brt-start").value;
      const end = document.getElementById("brt-end").value;
      if (!period) { showToast("Period required", "error"); return; }
      const missing = criteria.filter(c => criterionScores[c.id] === undefined);
      if (missing.length > 0) { showToast(`Rate: ${missing.map(c => App.currentLang === 'ar' ? c.name_ar : c.name_en).join(', ')}`, "error"); return; }
      const scores = criteria.map(c => ({ criteriaId: c.id, score: criterionScores[c.id] }));
      const submitBtn = document.getElementById("brt-submit");
      submitBtn.disabled = true;
      document.getElementById("brt-progress").style.display = "block";
      let ok = 0, skipped = 0, fail = 0;
      for (let i = 0; i < vols.length; i++) {
        const v = vols[i];
        document.getElementById("brt-progress-text").textContent = `${i + 1} / ${vols.length}`;
        try {
          await window.AtharAPI.evaluations.create({ volunteerId: v.id, periodLabel: period, periodStart: start || undefined, periodEnd: end || undefined, notes: notes || undefined, scores });
          ok++;
        } catch (err) {
          if (err.code === "EVALUATION_EXISTS") skipped++;
          else fail++;
        }
      }
      await window.AtharStore.refreshEvaluations();
      let msg = `Rated ${ok}`;
      if (skipped) msg += `, skipped ${skipped} (already rated)`;
      if (fail) msg += `, ${fail} failed`;
      showToast(msg, fail ? "warning" : "success");
      if (App.selectedVolunteerIds) App.selectedVolunteerIds.clear();
      window.AtharDirty.clearDraft(draftKey);
      window.AtharDirty.clear();
      close();
      window.AtharCore.renderCurrentView();
    };
  }

  // =========================================================
  // 16. Reject Hours Modal
  // =========================================================
  function openRejectHoursModal(hoursId) {
    const state = window.AtharStore.getState();
    const entry = state.volunteer_hours.find(h => h.id === hoursId);
    if (!entry) return;
    const vol = state.volunteers.find(v => v.id === entry.volunteer_id);

    const modal = document.getElementById("modal-container");
    modal.innerHTML = `
      <div class="overlay-backdrop" id="rej-backdrop">
        <div class="modal-dialog" style="max-width:480px;">
          <div class="modal-header">
            <h3 class="modal-title" style="color:var(--danger);">${ic("x_circle", 18)} ${t("reject")}</h3>
            <button class="btn-icon" id="rej-close">&times;</button>
          </div>
          <form id="rej-form">
            <div class="modal-body" style="display:flex; flex-direction:column; gap:14px;">
              <div style="padding:12px; background:var(--neutral-50); border:1px solid var(--neutral-300); border-radius:var(--radius-md); font-size:13px;">
                <div><strong>${App.currentLang === 'ar' ? 'المتطوع' : 'Volunteer'}:</strong> ${vol ? (App.currentLang === 'ar' ? (vol.full_name_ar || vol.full_name) : vol.full_name) : '—'}</div>
                <div style="margin-top:4px;"><strong>${t("activity")}:</strong> ${entry.activity}</div>
                <div style="margin-top:4px;"><strong>${t("hours")}:</strong> <span class="num-ltr">${entry.hours}</span> h</div>
                <div style="margin-top:4px;"><strong>${t("date")}:</strong> <span class="num-ltr">${entry.date}</span></div>
              </div>
              <div class="form-field">
                <label class="field-label">${t("reject_reason")} <span class="required-asterisk">*</span></label>
                <textarea id="rej-reason" class="form-control" rows="3" maxlength="500" required placeholder="${t("rejection_prompt")}"></textarea>
                <span class="field-hint" id="rej-reason-err" style="color:var(--danger); display:none;">${App.currentLang === 'ar' ? 'السبب مطلوب (٥ أحرف على الأقل).' : 'Reason is required (at least 5 characters).'}</span>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" id="rej-cancel">${t("cancel")}</button>
              <button type="submit" class="btn btn-danger" id="rej-submit">${t("reject")}</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const close = () => { modal.innerHTML = ""; };
    document.getElementById("rej-close").onclick = close;
    document.getElementById("rej-cancel").onclick = close;
    document.getElementById("rej-backdrop").onclick = (e) => { if (e.target.id === "rej-backdrop") close(); };

    document.getElementById("rej-form").onsubmit = async (e) => {
      e.preventDefault();
      const reason = document.getElementById("rej-reason").value.trim();
      const errEl = document.getElementById("rej-reason-err");
      if (reason.length < 5) { errEl.style.display = "block"; return; }
      errEl.style.display = "none";
      const btn = document.getElementById("rej-submit");
      btn.disabled = true;
      try {
        await window.AtharAPI.hours.reject(hoursId, reason);
        await window.AtharStore.refreshHours();
        showToast(t("rejected_successfully"), "warning");
        close();
        window.AtharCore.renderCurrentView();
      } catch (err) {
        showToast(err.message || "Rejection failed", "error");
        btn.disabled = false;
      }
    };

    setTimeout(() => document.getElementById("rej-reason").focus(), 100);
  }

  // =========================================================
  // 17. Edit Hours Modal
  // =========================================================
  function openEditHoursModal(hoursId) {
    const state = window.AtharStore.getState();
    const entry = state.volunteer_hours.find(h => h.id === hoursId);
    if (!entry) return;
    const vol = state.volunteers.find(v => v.id === entry.volunteer_id);

    const modal = document.getElementById("modal-container");
    modal.innerHTML = `
      <div class="overlay-backdrop" id="eh-backdrop">
        <div class="modal-dialog" style="max-width:500px;">
          <div class="modal-header">
            <h3 class="modal-title">${ic("clock", 18)} ${App.currentLang === 'ar' ? 'تعديل الساعات' : 'Adjust Hours'}</h3>
            <button class="btn-icon" id="eh-close">&times;</button>
          </div>
          <form id="eh-form">
            <div class="modal-body" style="display:flex; flex-direction:column; gap:14px;">
              <div style="padding:12px; background:var(--neutral-50); border:1px solid var(--neutral-300); border-radius:var(--radius-md); font-size:13px;">
                <div><strong>${App.currentLang === 'ar' ? 'المتطوع' : 'Volunteer'}:</strong> ${vol ? (App.currentLang === 'ar' ? (vol.full_name_ar || vol.full_name) : vol.full_name) : '—'}</div>
                <div style="margin-top:4px;"><strong>${t("activity")}:</strong> ${entry.activity}</div>
                <div style="margin-top:4px;"><strong>${t("date")}:</strong> <span class="num-ltr">${entry.date}</span></div>
                <div style="margin-top:4px;"><strong>${App.currentLang === 'ar' ? 'الحالي' : 'Current'}:</strong> <span class="num-ltr" style="color:var(--primary); font-weight:700;">${entry.hours} h</span></div>
              </div>
              <div class="form-field">
                <label class="field-label">${App.currentLang === 'ar' ? 'القيمة الجديدة (ساعات)' : 'New hours value'}</label>
                <input type="number" inputmode="decimal" step="0.25" min="0" id="eh-hours" class="form-control num-ltr" value="${entry.hours}" required>
                <span class="field-hint">${App.currentLang === 'ar' ? 'اضبط القيمة، أو اكتب 0 لإلغاء الساعات.' : 'Set to a new value, or 0 to zero them out.'}</span>
              </div>
              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <button type="button" class="btn btn-secondary btn-sm" data-quick="0">Set to 0</button>
                <button type="button" class="btn btn-secondary btn-sm" data-quick="-0.5">− 0.5h</button>
                <button type="button" class="btn btn-secondary btn-sm" data-quick="-1">− 1h</button>
                <button type="button" class="btn btn-secondary btn-sm" data-quick="-2">− 2h</button>
              </div>
            </div>
            <div class="modal-footer" style="justify-content:space-between;">
              <button type="button" class="btn btn-danger-outline" id="eh-delete">${ic("trash", 14)} ${t("delete")}</button>
              <div style="display:flex; gap:8px;">
                <button type="button" class="btn btn-secondary" id="eh-cancel">${t("cancel")}</button>
                <button type="submit" class="btn btn-primary" id="eh-submit">${t("save")}</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;

    const hoursInput = document.getElementById("eh-hours");
    modal.querySelectorAll("[data-quick]").forEach(btn => {
      btn.onclick = () => {
        const q = btn.getAttribute("data-quick");
        if (q === "0") hoursInput.value = 0;
        else {
          const delta = Number(q);
          const cur = Number(hoursInput.value) || 0;
          hoursInput.value = Math.max(0, +(cur + delta).toFixed(2));
        }
      };
    });

    const close = () => { modal.innerHTML = ""; };
    document.getElementById("eh-close").onclick = close;
    document.getElementById("eh-cancel").onclick = close;
    document.getElementById("eh-backdrop").onclick = (e) => { if (e.target.id === "eh-backdrop") close(); };

    document.getElementById("eh-delete").onclick = () => {
      showConfirmModal({
        title: t("confirm_destructive"),
        message: App.currentLang === 'ar' ? 'سيتم حذف هذا السجل نهائياً.' : 'This hours entry will be permanently deleted.',
        confirmText: t("delete"),
        isDanger: true,
        onConfirm: async () => {
          try {
            await window.AtharAPI.hours.delete(hoursId);
            await window.AtharStore.refreshHours();
            showToast(App.currentLang === 'ar' ? 'تم حذف السجل' : 'Entry deleted', "warning");
            close();
            window.AtharCore.renderCurrentView();
          } catch (err) { showToast(err.message || "Delete failed", "error"); }
        },
      });
    };

    document.getElementById("eh-form").onsubmit = async (e) => {
      e.preventDefault();
      const newHours = Number(hoursInput.value);
      if (isNaN(newHours) || newHours < 0) { showToast(App.currentLang === 'ar' ? 'قيمة غير صحيحة' : 'Invalid value', "error"); return; }
      if (newHours === 0) { document.getElementById("eh-delete").click(); return; }
      const btn = document.getElementById("eh-submit");
      btn.disabled = true;
      try {
        await window.AtharAPI.hours.update(hoursId, { hours: newHours });
        await window.AtharStore.refreshHours();
        showToast(t("updated_successfully"), "success");
        close();
        window.AtharCore.renderCurrentView();
      } catch (err) {
        if (err.code === "HOURS_LOCKED") showToast(App.currentLang === 'ar' ? 'لا يمكن تعديل الساعات المعتمدة إلا من قبل المعتمد.' : 'Approved/rejected hours can only be edited by an approver.', "error");
        else showToast(err.message || "Update failed", "error");
        btn.disabled = false;
      }
    };

    setTimeout(() => hoursInput.focus(), 100);
  }

  // =========================================================
  // 18. Bulk Edit Hours
  // =========================================================
  function openBulkEditHoursModal(hoursIds) {
    hoursIds = hoursIds || [];
    if (!hoursIds.length) { showToast("No entries selected", "error"); return; }
    const state = window.AtharStore.getState();
    const entries = state.volunteer_hours.filter(h => hoursIds.includes(h.id));
    if (!entries.length) { showToast("No matching entries", "error"); return; }

    const totalCurrent = entries.reduce((s, h) => s + Number(h.hours), 0);
    const modal = document.getElementById("modal-container");
    modal.innerHTML = `
      <div class="overlay-backdrop" id="beh-backdrop">
        <div class="modal-dialog" style="max-width:520px;">
          <div class="modal-header">
            <h3 class="modal-title">${ic("pencil", 18)} ${App.currentLang === 'ar' ? 'تعديل جماعي للساعات' : 'Bulk Edit Hours'} (${entries.length})</h3>
            <button class="btn-icon" id="beh-close">&times;</button>
          </div>
          <form id="beh-form">
            <div class="modal-body" style="display:flex; flex-direction:column; gap:14px;">
              <div style="padding:12px; background:var(--warning-light); border:1px solid var(--warning-border); border-radius:var(--radius-md); font-size:12.5px; color:var(--warning);">
                ⚠ ${App.currentLang === 'ar' ? `سيتم تطبيق نفس القيمة على ${entries.length} سجل.` : `The same value will be applied to all ${entries.length} entries.`}
              </div>
              <div style="padding:12px; background:var(--neutral-50); border:1px solid var(--neutral-300); border-radius:var(--radius-md); font-size:13px;">
                <div><strong>${App.currentLang === 'ar' ? 'عدد السجلات' : 'Entries'}:</strong> ${entries.length}</div>
                <div style="margin-top:4px;"><strong>${App.currentLang === 'ar' ? 'مجموع الساعات الحالي' : 'Current total'}:</strong> <span class="num-ltr">${totalCurrent.toFixed(2)} h</span></div>
              </div>
              <div class="form-field">
                <label class="field-label">${App.currentLang === 'ar' ? 'القيمة الجديدة لكل سجل' : 'New value per entry'}</label>
                <input type="number" inputmode="decimal" step="0.25" min="0.25" id="beh-hours" class="form-control num-ltr" value="2" required>
                <span class="field-hint">${App.currentLang === 'ar' ? 'سيتم تطبيق هذا الرقم على كل سجل محدد.' : 'This number will be applied to every selected entry.'}</span>
              </div>
              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <button type="button" class="btn btn-secondary btn-sm" data-quick="0.5">0.5h</button>
                <button type="button" class="btn btn-secondary btn-sm" data-quick="1">1h</button>
                <button type="button" class="btn btn-secondary btn-sm" data-quick="1.5">1.5h</button>
                <button type="button" class="btn btn-secondary btn-sm" data-quick="2">2h</button>
                <button type="button" class="btn btn-secondary btn-sm" data-quick="3">3h</button>
                <button type="button" class="btn btn-secondary btn-sm" data-quick="4">4h</button>
              </div>
            </div>
            <div class="modal-footer" style="justify-content:space-between;">
              <button type="button" class="btn btn-danger-outline" id="beh-delete">${ic("trash", 14)} ${App.currentLang === 'ar' ? 'حذف المحدد' : 'Delete selected'}</button>
              <div style="display:flex; gap:8px;">
                <button type="button" class="btn btn-secondary" id="beh-cancel">${t("cancel")}</button>
                <button type="submit" class="btn btn-primary" id="beh-submit">${App.currentLang === 'ar' ? `تطبيق على ${entries.length}` : `Apply to ${entries.length}`}</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;

    const hoursInput = document.getElementById("beh-hours");
    modal.querySelectorAll("[data-quick]").forEach(btn => {
      btn.onclick = () => { hoursInput.value = btn.getAttribute("data-quick"); };
    });

    const close = () => { modal.innerHTML = ""; };
    document.getElementById("beh-close").onclick = close;
    document.getElementById("beh-cancel").onclick = close;
    document.getElementById("beh-backdrop").onclick = (e) => { if (e.target.id === "beh-backdrop") close(); };

    document.getElementById("beh-delete").onclick = () => {
      close();
      showConfirmModal({
        title: t("confirm_destructive"),
        message: App.currentLang === 'ar' ? `سيتم حذف ${entries.length} سجل نهائياً. لا يمكن التراجع.` : `Permanently delete ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}? This cannot be undone.`,
        confirmText: t("delete"),
        isDanger: true,
        onConfirm: async () => {
          const results = await Promise.allSettled(entries.map(e => window.AtharAPI.hours.delete(e.id)));
          const ok = results.filter(r => r.status === "fulfilled").length;
          const fail = results.length - ok;
          await window.AtharStore.refreshHours();
          if (fail === 0) showToast(`Deleted ${ok}`, "warning");
          else showToast(`Deleted ${ok}, failed ${fail}`, "warning");
          window.AtharCore.renderCurrentView();
        },
      });
    };

    document.getElementById("beh-form").onsubmit = async (e) => {
      e.preventDefault();
      const newHours = Number(hoursInput.value);
      if (isNaN(newHours) || newHours <= 0) { showToast(App.currentLang === 'ar' ? 'قيمة غير صحيحة' : 'Invalid value', "error"); return; }
      const btn = document.getElementById("beh-submit");
      btn.disabled = true;
      let ok = 0, fail = 0, locked = 0;
      for (const entry of entries) {
        try {
          await window.AtharAPI.hours.update(entry.id, { hours: newHours });
          ok++;
        } catch (err) {
          if (err.code === "HOURS_LOCKED") locked++;
          else fail++;
        }
      }
      await window.AtharStore.refreshHours();
      let msg = App.currentLang === 'ar' ? `تم تحديث ${ok}` : `Updated ${ok}`;
      if (locked) msg += App.currentLang === 'ar' ? `، ${locked} مقفل` : `, ${locked} locked`;
      if (fail) msg += App.currentLang === 'ar' ? `، فشل ${fail}` : `, ${fail} failed`;
      showToast(msg, fail || locked ? "warning" : "success");
      close();
      window.AtharCore.renderCurrentView();
    };

    setTimeout(() => hoursInput.focus(), 100);
  }

  // =========================================================
  // 19. Attendance Viewer Modal
  // =========================================================
  async function openAttendanceModal(meetingId) {
    const state = window.AtharStore.getState();
    const meeting = state.meetings.find(m => m.id === meetingId);
    if (!meeting) return;
    const isEvent = (meeting.kind || "meeting") === "event";

    let roster = [];
    try {
      const res = await window.AtharAPI.meetings.getRoster(meetingId);
      roster = res.roster || [];
    } catch (err) { showToast(err.message || "Failed to load roster", "error"); return; }

    const groups = {
      present: roster.filter(r => r.status === "present"),
      late: roster.filter(r => r.status === "late"),
      absent: roster.filter(r => r.status === "absent"),
      excused: roster.filter(r => r.status === "excused"),
    };

    const labelFor = (rec) => {
      const v = rec.volunteer || {};
      return App.currentLang === 'ar'
        ? (v.fullNameAr || v.full_name_ar || v.fullName || v.full_name || "—")
        : (v.fullName || v.full_name || "—");
    };

    const section = (title, list, color) => `
      <div style="margin-bottom:18px;">
        <div style="font-size:13px; font-weight:700; color:${color}; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
          <span style="width:8px; height:8px; border-radius:50%; background:${color};"></span>
          ${title} (${list.length})
        </div>
        ${list.length === 0 ? '<p style="font-size:12px; color:var(--neutral-500); margin:0;">—</p>' : `<div style="display:flex; flex-wrap:wrap; gap:6px;">${list.map(r => `<span class="tag-chip" style="font-size:12px;">${labelFor(r)}</span>`).join('')}</div>`}
      </div>
    `;

    const modal = document.getElementById("modal-container");
    modal.innerHTML = `
      <div class="overlay-backdrop" id="att-backdrop">
        <div class="modal-dialog modal-lg" style="max-width:720px;">
          <div class="modal-header">
            <h3 class="modal-title">
              ${ic(isEvent ? "sparkles" : "calendar", 18)}
              ${App.currentLang === 'ar' ? meeting.title_ar : meeting.title_en}
            </h3>
            <button class="btn-icon" id="att-close">&times;</button>
          </div>
          <div class="modal-body" style="max-height:70vh; overflow-y:auto;">
            <div style="padding:10px 14px; background:var(--neutral-50); border:1px solid var(--neutral-300); border-radius:var(--radius-md); margin-bottom:16px; font-size:12.5px;">
              <div><strong>${t("date")}:</strong> ${meeting.meeting_date} &bull; <strong>${App.currentLang === 'ar' ? 'الوقت' : 'Time'}:</strong> <span class="num-ltr">${meeting.start_time}${meeting.end_time ? ' - ' + meeting.end_time : ''}</span></div>
              <div style="margin-top:4px;"><strong>${App.currentLang === 'ar' ? 'الموقع' : 'Location'}:</strong> ${meeting.location || '—'}</div>
            </div>
            ${section(App.currentLang === 'ar' ? 'حاضر' : 'Present', groups.present, "var(--success)")}
            ${section(App.currentLang === 'ar' ? 'متأخر' : 'Late', groups.late, "var(--warning)")}
            ${section(App.currentLang === 'ar' ? 'غائب' : 'Absent', groups.absent, "var(--danger)")}
            ${section(App.currentLang === 'ar' ? 'معذور' : 'Excused', groups.excused, "var(--info)")}
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="att-cancel">${t("close")}</button>
          </div>
        </div>
      </div>
    `;

    const close = () => { modal.innerHTML = ""; };
    document.getElementById("att-close").onclick = close;
    document.getElementById("att-cancel").onclick = close;
    document.getElementById("att-backdrop").onclick = (e) => { if (e.target.id === "att-backdrop") close(); };
  }

  // =========================================================
  // 20. Evaluate Attendees of an Event
  // =========================================================
  async function openEvaluateAttendeesModal(meetingId) {
    const state = window.AtharStore.getState();
    const meeting = state.meetings.find(m => m.id === meetingId);
    if (!meeting) return;

    let roster = [];
    try {
      const res = await window.AtharAPI.meetings.getRoster(meetingId);
      roster = res.roster || [];
    } catch (err) { showToast(err.message || "Failed to load roster", "error"); return; }

    const attended = roster.filter(r => r.status === "present" || r.status === "late");
    if (!attended.length) { showToast(App.currentLang === 'ar' ? 'لا يوجد حاضرون لتقييمهم' : 'No attendees to evaluate', 'warning'); return; }

    const endOfDay = new Date(meeting.meeting_date + "T23:59:59.999").getTime();
    const needing = attended.filter(r => {
      const volId = r.volunteerId || (r.volunteer && r.volunteer.id);
      const evals = state.evaluations.filter(e => e.volunteer_id === volId);
      return !evals.some(e => {
        const raw = e.evaluated_at || e.evaluatedAt;
        if (!raw) return false;
        return new Date(raw).getTime() > endOfDay;
      });
    }).map(r => r.volunteerId || (r.volunteer && r.volunteer.id));

    if (!needing.length) { showToast(App.currentLang === 'ar' ? 'كل الحاضرين تم تقييمهم ✓' : 'All attendees already evaluated ✓', 'success'); return; }

    openBulkRatingModal(needing);
  }

  // =========================================================
  // 15. Change Password (self-service)
  // =========================================================
  function openChangePasswordModal(forced) {
    const modal = document.getElementById("modal-container");
    modal.innerHTML = `
      <div class="overlay-backdrop" id="cp-backdrop">
        <div class="modal-dialog" style="max-width:440px;">
          <div class="modal-header">
            <h3 class="modal-title">${ic("lock", 18)} ${t("change_password")}</h3>
            ${forced ? "" : `<button class="btn-icon" id="cp-close">&times;</button>`}
          </div>
          <form id="cp-form">
            <div class="modal-body" style="display:flex; flex-direction:column; gap:14px;">
              ${forced ? `<div class="alert-soft alert-warning-soft">${t("password_change_banner")}</div>` : ""}
              <div class="form-field">
                <label class="field-label">${t("current_password")} <span class="required-asterisk">*</span></label>
                <input type="password" id="cp-current" class="form-control" required autocomplete="current-password" dir="ltr">
              </div>
              <div class="form-field">
                <label class="field-label">${t("new_password")} <span class="required-asterisk">*</span></label>
                <input type="password" id="cp-new" class="form-control" required minlength="8" autocomplete="new-password" dir="ltr">
                <div style="font-size:11px; color:var(--neutral-500); margin-top:4px;">${t("password_min_length")}</div>
              </div>
              <div class="form-field">
                <label class="field-label">${t("confirm_password")} <span class="required-asterisk">*</span></label>
                <input type="password" id="cp-confirm" class="form-control" required autocomplete="new-password" dir="ltr">
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" id="cp-cancel">${forced ? t("later") : t("cancel")}</button>
              <button type="submit" class="btn btn-primary" id="cp-submit">${t("save")}</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const close = () => { modal.innerHTML = ""; };
    const closeBtn = document.getElementById("cp-close");
    if (closeBtn) closeBtn.onclick = close;
    const cancelBtn = document.getElementById("cp-cancel");
    if (cancelBtn) cancelBtn.onclick = close;
    document.getElementById("cp-backdrop").onclick = (e) => {
      if (!forced && e.target.id === "cp-backdrop") close();
    };

    document.getElementById("cp-form").onsubmit = async (e) => {
      e.preventDefault();
      const current = document.getElementById("cp-current").value;
      const next = document.getElementById("cp-new").value;
      const confirm = document.getElementById("cp-confirm").value;

      if (next.length < 8) { showToast(t("password_min_length"), "error"); return; }
      if (next !== confirm) { showToast(t("passwords_mismatch"), "error"); return; }

      const submitBtn = document.getElementById("cp-submit");
      submitBtn.disabled = true;
      try {
        await window.AtharAPI.auth.changePassword(current, next);
        if (window.AtharAuth && window.AtharAuth.markPasswordChanged) window.AtharAuth.markPasswordChanged();
        if (App.currentUser) App.currentUser.must_change_password = false;
        const banner = document.getElementById("pw-warning-banner");
        if (banner) banner.remove();
        showToast(t("password_changed"), "success");
        close();
        // All sessions were revoked server-side — sign in again with the new password.
        setTimeout(() => { if (window.AtharAuth) window.AtharAuth.logout(); }, 1400);
      } catch (err) {
        if (err.code === "INVALID_PASSWORD") showToast(t("current_password_wrong"), "error");
        else showToast(err.message || (App.currentLang === "ar" ? "تعذّر تغيير كلمة المرور" : "Failed to change password"), "error");
        submitBtn.disabled = false;
      }
    };
  }

  // =========================================================
  // 16. Reset Password (super admin, from the Users screen)
  // =========================================================
  function openResetPasswordModal(userId) {
    const state = window.AtharStore.getState();
    const target = state.users.find((u) => u.id === userId);
    if (!target) return;

    const modal = document.getElementById("modal-container");
    modal.innerHTML = `
      <div class="overlay-backdrop" id="rp-backdrop">
        <div class="modal-dialog" style="max-width:440px;">
          <div class="modal-header">
            <h3 class="modal-title">${ic("lock", 18)} ${t("reset_password")}</h3>
            <button class="btn-icon" id="rp-close">&times;</button>
          </div>
          <form id="rp-form">
            <div class="modal-body" style="display:flex; flex-direction:column; gap:14px;">
              <div style="padding:10px 12px; background:var(--neutral-50); border-radius:8px;">
                <div style="font-weight:700;">${escapeHtml(target.full_name)}</div>
                <div style="font-size:12px; color:var(--neutral-500);" dir="ltr">${escapeHtml(target.email)}</div>
              </div>
              <div class="form-field">
                <label class="field-label">${t("new_password")} <span class="required-asterisk">*</span></label>
                <input type="password" id="rp-new" class="form-control" required minlength="8" autocomplete="new-password" dir="ltr">
                <div style="font-size:11px; color:var(--neutral-500); margin-top:4px;">${t("password_min_length")} — ${t("password_reset_must_change")}</div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" id="rp-cancel">${t("cancel")}</button>
              <button type="submit" class="btn btn-primary" id="rp-submit">${t("reset_password")}</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const close = () => { modal.innerHTML = ""; };
    document.getElementById("rp-close").onclick = close;
    document.getElementById("rp-cancel").onclick = close;
    document.getElementById("rp-backdrop").onclick = (e) => { if (e.target.id === "rp-backdrop") close(); };

    document.getElementById("rp-form").onsubmit = async (e) => {
      e.preventDefault();
      const newPass = document.getElementById("rp-new").value;
      if (newPass.length < 8) { showToast(t("password_min_length"), "error"); return; }

      const submitBtn = document.getElementById("rp-submit");
      submitBtn.disabled = true;
      try {
        await window.AtharAPI.users.resetPassword(target.id, newPass);
        const entry = state.users.find((u) => u.id === target.id);
        if (entry) entry.must_change_password = true;
        showToast(t("password_reset_done"), "success");
        close();
        window.AtharCore.renderCurrentView();
      } catch (err) {
        showToast(err.message || (App.currentLang === "ar" ? "تعذّر إعادة تعيين كلمة المرور" : "Reset failed"), "error");
        submitBtn.disabled = false;
      }
    };
  }

  // =========================================================
  // 17. Bulk Transfer
  // =========================================================
  function openBulkTransferModal(volunteerIds) {
    volunteerIds = volunteerIds || Array.from(App.selectedVolunteerIds || []);
    if (!volunteerIds.length) {
      showToast(App.currentLang === "ar" ? "اختر متطوعين أولاً" : "Select volunteers first", "warning");
      return;
    }
    const state = window.AtharStore.getState();
    const vols = state.volunteers.filter((v) => volunteerIds.includes(v.id));
    const activeCommittees = state.committees.filter((c) => c.status === "active");

    // Anyone among the selection who currently leads a committee will lose that role.
    const leaderNames = [];
    state.committees.forEach((c) => {
      if (c.leader && volunteerIds.includes(c.leader.id)) {
        leaderNames.push(App.currentLang === "ar" ? (c.leader.full_name_ar || c.leader.full_name) : c.leader.full_name);
      }
      (c.co_leaders || []).forEach((x) => {
        if (volunteerIds.includes(x.id)) {
          leaderNames.push(App.currentLang === "ar" ? (x.full_name_ar || x.full_name) : x.full_name);
        }
      });
    });

    const modal = document.getElementById("modal-container");
    modal.innerHTML = `
      <div class="overlay-backdrop" id="bt-backdrop">
        <div class="modal-dialog">
          <div class="modal-header">
            <h3 class="modal-title">${ic("arrow_right", 18)} ${t("bulk_transfer_title")}</h3>
            <button class="btn-icon" id="bt-close">&times;</button>
          </div>
          <form id="bt-form">
            <div class="modal-body" style="display:flex; flex-direction:column; gap:16px;">
              <div style="padding:10px 12px; background:var(--neutral-50); border-radius:8px; font-size:13px;">
                <strong>${vols.length}</strong> ${App.currentLang === "ar" ? "متطوع محدد" : "volunteers selected"}
              </div>
              ${leaderNames.length ? `
                <div class="alert-soft alert-warning-soft">
                  ⚠️ ${t("leadership_transfer_warning")}<br>${escapeHtml(leaderNames.join("، "))}
                </div>
              ` : ""}
              <div class="form-field">
                <label class="field-label">${t("to_committee")} <span class="required-asterisk">*</span></label>
                <select id="bt-comm" class="form-control" required>
                  ${activeCommittees.map((c) => `<option value="${c.id}">${escapeHtml(App.currentLang === "ar" ? c.name_ar : c.name_en)}</option>`).join("")}
                </select>
              </div>
              <div class="form-field">
                <label class="field-label">${t("transfer_reason")} <span class="required-asterisk">*</span></label>
                <textarea id="bt-reason" class="form-control" rows="3" required minlength="5"></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" id="bt-cancel">${t("cancel")}</button>
              <button type="submit" class="btn btn-primary" id="bt-submit">${t("confirm")}</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const close = () => { modal.innerHTML = ""; };
    document.getElementById("bt-close").onclick = close;
    document.getElementById("bt-cancel").onclick = close;
    document.getElementById("bt-backdrop").onclick = (e) => { if (e.target.id === "bt-backdrop") close(); };

    document.getElementById("bt-form").onsubmit = async (e) => {
      e.preventDefault();
      const toCommitteeId = document.getElementById("bt-comm").value;
      const reason = document.getElementById("bt-reason").value.trim();
      if (reason.length < 5) { showToast(t("transfer_reason"), "error"); return; }

      const submitBtn = document.getElementById("bt-submit");
      submitBtn.disabled = true;
      try {
        const res = await window.AtharAPI.volunteers.bulkTransfer(volunteerIds, toCommitteeId, reason);
        await window.AtharStore.refreshVolunteers();
        await window.AtharStore.refreshCommittees();
        App.selectedVolunteerIds.clear();
        const msg = App.currentLang === "ar"
          ? `تم نقل ${res.transferred} متطوع${res.failed ? ` — تعذّر نقل ${res.failed}` : ""}`
          : `Transferred ${res.transferred} volunteer(s)${res.failed ? ` — ${res.failed} skipped` : ""}`;
        showToast(msg, res.failed ? "warning" : "success");
        close();
        window.AtharCore.renderCurrentView();
      } catch (err) {
        showToast(err.message || "Transfer failed", "error");
        submitBtn.disabled = false;
      }
    };
  }

  // =========================================================
  // 18. WhatsApp Reminders (bulk, one-click per recipient)
  // =========================================================
  function waReminderTemplates() {
    return [
      {
        id: "general",
        name_en: "General message",
        name_ar: "رسالة عامة",
        body_en: "Hello {name} 👋\nThank you for your efforts in the {committee} committee.\n— {org}",
        body_ar: "مرحباً {name} 👋\nنشكر لك جهودك في {committee}.\n— {org}",
      },
      {
        id: "meeting",
        name_en: "Meeting reminder",
        name_ar: "تذكير باجتماع",
        body_en: "Hello {name} 👋\nReminder: an upcoming {committee} committee meeting is scheduled. Please confirm your attendance.\n— {org}",
        body_ar: "مرحباً {name} 👋\nتذكير باجتماع {committee} القادم. نرجو تأكيد الحضور في الوقت المحدد.\n— {org}",
      },
      {
        id: "hours",
        name_en: "Hours reminder",
        name_ar: "تذكير بالساعات",
        body_en: "Hello {name} 👋\nYou have pending hours in the {committee} committee. Please review your hours log.\n— {org}",
        body_ar: "مرحباً {name} 👋\nلديك ساعات غير معتمدة في {committee}. يرجى مراجعة سجل الساعات.\n— {org}",
      },
      {
        id: "missing",
        name_en: "Attendance follow-up",
        name_ar: "متابعة غياب",
        body_en: "Hello {name} 👋\nWe missed you at the last {committee} committee activity. Let us know if you need any support.\n— {org}",
        body_ar: "مرحباً {name} 👋\nافتقدناك في آخر أنشطة {committee}. تواصل معنا إن احتجت أي دعم.\n— {org}",
      },
    ];
  }

  function openWhatsAppReminderModal(volunteerIds) {
    volunteerIds = volunteerIds || Array.from(App.selectedVolunteerIds || []);
    const state = window.AtharStore.getState();
    const vols = state.volunteers.filter((v) => volunteerIds.includes(v.id) && v.whatsapp && String(v.whatsapp).trim());
    if (!vols.length) {
      showToast(App.currentLang === "ar" ? "لا يوجد أرقام واتساب ضمن التحديد" : "No WhatsApp numbers in the selection", "warning");
      return;
    }

    const lang = App.currentLang === "ar" ? "ar" : "en";
    const templates = waReminderTemplates();
    const orgName = App.currentLang === "ar"
      ? (state.settings.org_name_ar || state.settings.org_name_en || "أثر")
      : (state.settings.org_name_en || "Athar");

    const committeeName = (v) => {
      const c = state.committees.find((x) => x.id === v.committee_id);
      if (!c) return App.currentLang === "ar" ? "اللجنة" : "the committee";
      return App.currentLang === "ar" ? c.name_ar : c.name_en;
    };
    const volName = (v) => App.currentLang === "ar" ? (v.full_name_ar || v.full_name) : v.full_name;

    const buildMessage = (v, body) => String(body || "")
      .replace(/\{name\}/g, volName(v))
      .replace(/\{committee\}/g, committeeName(v))
      .replace(/\{org\}/g, orgName);

    const templateBody = (tpl) => (lang === "ar" ? tpl.body_ar : tpl.body_en) || tpl.body_en;

    const modal = document.getElementById("modal-container");
    modal.innerHTML = `
      <div class="overlay-backdrop" id="wr-backdrop">
        <div class="modal-dialog" style="max-width:640px;">
          <div class="modal-header">
            <h3 class="modal-title">${ic("whatsapp", 18)} ${t("reminder_title")} (${vols.length})</h3>
            <button class="btn-icon" id="wr-close">&times;</button>
          </div>
          <div class="modal-body" style="display:flex; flex-direction:column; gap:14px;">
            ${volunteerIds.length > vols.length ? `
              <div style="font-size:12px; color:var(--neutral-500);">
                ${App.currentLang === "ar"
        ? `${volunteerIds.length - vols.length} من المحددين بدون رقم واتساب وسيتم تجاهلهم`
        : `${volunteerIds.length - vols.length} selected volunteer(s) have no WhatsApp number and were skipped`}
              </div>` : ""}
            <div class="form-field">
              <label class="field-label">${t("reminder_template")}</label>
              <select id="wr-template" class="form-control">
                ${templates.map((tpl) => `<option value="${tpl.id}">${App.currentLang === "ar" ? tpl.name_ar : tpl.name_en}</option>`).join("")}
              </select>
            </div>
            <div class="form-field">
              <label class="field-label">${t("reminder_message")}</label>
              <textarea id="wr-body" class="form-control" rows="5" style="line-height:1.8;">${templateBody(templates[0])}</textarea>
              <div style="font-size:11px; color:var(--neutral-500); margin-top:4px;">{name} • {committee} • {org}</div>
            </div>
            <div style="max-height:260px; overflow-y:auto; border:1px solid var(--neutral-200); border-radius:8px;">
              ${vols.map((v) => `
                <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; padding:8px 12px; border-bottom:1px solid var(--neutral-100);">
                  <div style="min-width:0;">
                    <div style="font-weight:700; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(volName(v))}</div>
                    <div class="num-ltr" style="font-size:11px; color:var(--neutral-500);">${escapeHtml(String(v.whatsapp))}</div>
                  </div>
                  <div style="display:flex; gap:6px; flex-shrink:0;">
                    <button type="button" class="btn btn-whatsapp btn-sm" data-wr-send="${v.id}">${ic("whatsapp", 12)} ${t("send")}</button>
                    <button type="button" class="btn btn-secondary btn-sm" data-wr-copy="${v.id}">${t("copy")}</button>
                  </div>
                </div>
              `).join("")}
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="wr-close2">${t("close") || "Close"}</button>
          </div>
        </div>
      </div>
    `;

    const close = () => { modal.innerHTML = ""; };
    document.getElementById("wr-close").onclick = close;
    document.getElementById("wr-close2").onclick = close;
    document.getElementById("wr-backdrop").onclick = (e) => { if (e.target.id === "wr-backdrop") close(); };

    const bodyEl = document.getElementById("wr-body");
    const tplEl = document.getElementById("wr-template");
    tplEl.onchange = () => {
      const tpl = templates.find((x) => x.id === tplEl.value);
      if (tpl) bodyEl.value = templateBody(tpl);
    };

    modal.querySelectorAll("[data-wr-send]").forEach((btn) => {
      btn.onclick = () => {
        const v = vols.find((x) => x.id === btn.getAttribute("data-wr-send"));
        if (!v) return;
        const message = buildMessage(v, bodyEl.value);
        const digits = String(v.whatsapp).replace(/[^0-9]/g, "");
        if (!digits) { showToast("Invalid number", "error"); return; }
        window.open(`https://wa.me/${digits}?text=${encodeURIComponent(message)}`, "_blank");
        btn.innerHTML = `${ic("check", 12)} ${t("send")}`;
        btn.classList.add("is-sent");
      };
    });

    modal.querySelectorAll("[data-wr-copy]").forEach((btn) => {
      btn.onclick = async () => {
        const v = vols.find((x) => x.id === btn.getAttribute("data-wr-copy"));
        if (!v) return;
        const message = buildMessage(v, bodyEl.value);
        const copiedMsg = App.currentLang === "ar" ? "تم نسخ الرسالة" : "Message copied";
        const failMsg = App.currentLang === "ar" ? "تعذّر النسخ" : "Copy failed";

        const legacyCopy = () => {
          const ta = document.createElement("textarea");
          ta.value = message;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        };

        try {
          if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(message);
          } else {
            legacyCopy();
          }
          showToast(copiedMsg, "success");
        } catch {
          try {
            legacyCopy();
            showToast(copiedMsg, "success");
          } catch {
            showToast(failMsg, "error");
          }
        }
      };
    });
  }

  // =========================================================
  // 19. Import Volunteers from CSV
  // =========================================================
  const CSV_FIELD_ALIASES = {
    name: "fullName", full_name: "fullName", fullname: "fullName", "الاسم": "fullName", "الاسم الكامل": "fullName",
    name_ar: "fullNameAr", full_name_ar: "fullNameAr", "الاسم بالعربية": "fullNameAr",
    national_id: "nationalId", nationalid: "nationalId", "رقم الهوية": "nationalId", "الهوية": "nationalId",
    phone: "phone", "الهاتف": "phone", "الجوال": "phone",
    whatsapp: "whatsapp", "واتساب": "whatsapp",
    email: "email", "البريد": "email", "البريد الإلكتروني": "email",
    gender: "gender", "الجنس": "gender",
    nationality: "nationality", "الجنسية": "nationality",
    study_level: "studyLevel", studylevel: "studyLevel", "المستوى الدراسي": "studyLevel",
    skills: "skills", "المهارات": "skills",
    committee: "committeeName", committee_name: "committeeName", "اللجنة": "committeeName",
    join_date: "joinDate", joindate: "joinDate", "تاريخ الانضمام": "joinDate",
    notes: "notes", "ملاحظات": "notes",
  };

  function parseCsvText(text) {
    const clean = String(text || "").replace(/^\uFEFF/, "");
    const firstLine = clean.split(/\r?\n/)[0] || "";
    const commas = (firstLine.match(/,/g) || []).length;
    const semis = (firstLine.match(/;/g) || []).length;
    const delim = semis > commas ? ";" : ",";

    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;
    for (let i = 0; i < clean.length; i++) {
      const ch = clean[i];
      if (inQuotes) {
        if (ch === '"') {
          if (clean[i + 1] === '"') { cell += '"'; i++; }
          else inQuotes = false;
        } else cell += ch;
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === delim) {
        row.push(cell); cell = "";
      } else if (ch === "\n") {
        row.push(cell); rows.push(row); row = []; cell = "";
      } else if (ch !== "\r") {
        cell += ch;
      }
    }
    if (cell.length || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
  }

  function mapCsvRows(rows) {
    if (!rows.length) return { records: [], invalid: 0 };
    const headers = rows[0].map((h) => String(h).trim().toLowerCase());
    const fields = headers.map((h) => CSV_FIELD_ALIASES[h] || null);

    const records = [];
    let invalid = 0;
    for (let r = 1; r < rows.length; r++) {
      const cells = rows[r];
      const rec = {};
      fields.forEach((field, i) => {
        if (!field) return;
        const raw = String(cells[i] ?? "").trim();
        if (raw === "") return;
        if (field === "gender") {
          const g = raw.toLowerCase();
          if (g === "male" || g === "m" || raw === "ذكر") rec.gender = "male";
          else if (g === "female" || g === "f" || raw === "أنثى") rec.gender = "female";
        } else if (field === "skills") {
          rec.skills = raw.split(/[|;،]/).map((s) => s.trim()).filter(Boolean).slice(0, 20);
        } else if (field === "joinDate") {
          if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) rec.joinDate = raw;
        } else {
          rec[field] = raw;
        }
      });
      if (!rec.fullName || rec.fullName.length < 2) { invalid++; continue; }
      if (!rec.whatsapp && !rec.email) invalid++;
      records.push(rec);
    }
    return { records, invalid };
  }

  function openImportVolunteersModal() {
    let parsedRecords = [];
    let invalidCount = 0;
    let rowIssues = [];

    const modal = document.getElementById("modal-container");
    modal.innerHTML = `
      <div class="overlay-backdrop" id="im-backdrop">
        <div class="modal-dialog" style="max-width:720px;">
          <div class="modal-header">
            <h3 class="modal-title">${ic("upload", 18)} ${t("import_title")}</h3>
            <button class="btn-icon" id="im-close">&times;</button>
          </div>
          <div class="modal-body" style="display:flex; flex-direction:column; gap:14px;">
            <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
              <input type="file" id="im-file" accept=".csv,text/csv" class="form-control" style="flex:1; min-width:220px;">
              <button type="button" class="btn btn-secondary btn-sm" id="im-template">${ic("download", 14)} ${t("download_template")}</button>
            </div>
            <div style="font-size:12px; color:var(--neutral-500); line-height:1.8;">
              ${App.currentLang === "ar"
        ? "الأعمدة المدعومة: الاسم (إلزامي)، الاسم بالعربية، رقم الهوية، الهاتف، واتساب، البريد الإلكتروني، الجنس، الجنسية، المستوى الدراسي، المهارات (مفصولة بـ |)، اللجنة، تاريخ الانضمام (YYYY-MM-DD)، ملاحظات. يجب توفير واتساب أو بريد إلكتروني لكل صف."
        : "Supported columns: Name (required), Name_AR, National_ID, Phone, WhatsApp, Email, Gender, Nationality, Study_Level, Skills (| separated), Committee, Join_Date (YYYY-MM-DD), Notes. Each row needs a WhatsApp number or email."}
            </div>
            <div id="im-preview"></div>
            <div id="im-result"></div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="im-cancel">${t("cancel")}</button>
            <button type="button" class="btn btn-primary" id="im-submit" disabled>${ic("upload", 14)} ${t("import_csv")}</button>
          </div>
        </div>
      </div>
    `;

    const close = () => { modal.innerHTML = ""; };
    document.getElementById("im-close").onclick = close;
    document.getElementById("im-cancel").onclick = close;
    document.getElementById("im-backdrop").onclick = (e) => { if (e.target.id === "im-backdrop") close(); };

    document.getElementById("im-template").onclick = () => {
      window.ExportUtil.downloadCSV(
        "athar_volunteers_template.csv",
        ["Name", "Name_AR", "National_ID", "Phone", "WhatsApp", "Email", "Gender", "Nationality", "Study_Level", "Skills", "Committee", "Join_Date", "Notes"],
        [["Ahmed Ali", "أحمد علي", "1234567890", "+966500000000", "+966500000000", "ahmed@example.com", "male", "Saudi", "bachelor", "first_aid|media", "Media Committee", "2026-01-15", ""]],
      );
    };

    const fileEl = document.getElementById("im-file");
    const submitBtn = document.getElementById("im-submit");
    const previewEl = document.getElementById("im-preview");

    // ---- Round 7: pre-import duplicate validation ----
    const issueLabel = (iss) => {
      switch (iss.code) {
        case "id_existing": return t("imp_dup_id_existing");
        case "id_in_file": return t("imp_dup_id_file");
        case "phone_in_file": return t("imp_dup_phone_file");
        case "email_in_file": return t("imp_dup_email_file");
        case "phone_existing": return t("imp_soft_phone");
        case "email_existing": return t("imp_soft_email");
      }
      return "";
    };
    const issueName = (v) => v ? (App.currentLang === "ar" ? (v.full_name_ar || v.full_name) : (v.full_name || v.full_name_ar)) : "";
    const validateRows = (records) => {
      const all = window.AtharStore.getState().volunteers || [];
      const byId = {}, byPhone = {}, byEmail = {};
      all.forEach(v => {
        if (v.national_id) { const k = String(v.national_id).trim(); (byId[k] = byId[k] || []).push(v); }
        const pk = normPhoneKey(v.whatsapp) || normPhoneKey(v.phone);
        if (pk) (byPhone[pk] = byPhone[pk] || []).push(v);
        const ek = normEmailKey(v.email);
        if (ek) (byEmail[ek] = byEmail[ek] || []).push(v);
      });
      const seenId = {}, seenPhone = {}, seenEmail = {};
      return records.map(rec => {
        const hard = [], soft = [];
        const nid = rec.nationalId ? String(rec.nationalId).trim() : "";
        if (nid) {
          if (byId[nid]) hard.push({ code: "id_existing", who: byId[nid][0] });
          else if (seenId[nid]) hard.push({ code: "id_in_file" });
          seenId[nid] = true;
        }
        const pk = normPhoneKey(rec.whatsapp) || normPhoneKey(rec.phone);
        if (pk) {
          if (byPhone[pk]) soft.push({ code: "phone_existing", who: byPhone[pk][0] });
          if (seenPhone[pk]) hard.push({ code: "phone_in_file" });
          seenPhone[pk] = true;
        }
        const ek = normEmailKey(rec.email);
        if (ek) {
          if (byEmail[ek]) soft.push({ code: "email_existing", who: byEmail[ek][0] });
          if (seenEmail[ek]) hard.push({ code: "email_in_file" });
          seenEmail[ek] = true;
        }
        return { hard, soft };
      });
    };

    fileEl.onchange = () => {
      const file = fileEl.files && fileEl.files[0];
      document.getElementById("im-result").innerHTML = "";
      submitBtn.style.display = "";
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const rows = parseCsvText(reader.result);
          const mapped = mapCsvRows(rows);
          parsedRecords = mapped.records;
          invalidCount = mapped.invalid;
          rowIssues = [];
          if (!parsedRecords.length) {
            previewEl.innerHTML = `<div style="color:var(--danger); font-size:13px;">${App.currentLang === "ar" ? "لم يتم العثور على صفوف صالحة — تأكد من وجود عمود الاسم." : "No valid rows found — make sure a Name column exists."}</div>`;
            submitBtn.disabled = true;
            return;
          }
          rowIssues = validateRows(parsedRecords);
          const hardCount = rowIssues.filter(it => it.hard.length).length;
          const softCount = rowIssues.filter(it => it.soft.length).length;
          const badgeHtml = (it) => {
            const allI = [...it.hard, ...it.soft];
            if (!allI.length) return `<span class="dup-badge ok">${t("imp_ready")}</span>`;
            const badges = allI.slice(0, 2).map(x => {
              const cls = it.hard.includes(x) ? "hard" : "soft";
              const tip = issueLabel(x) + (x.who ? " — " + issueName(x.who) : "");
              return `<span class="dup-badge ${cls}" title="${escapeHtml(tip)}">${issueLabel(x)}</span>`;
            }).join(" ");
            return badges + (allI.length > 2 ? ` <span class="dup-badge soft">+${allI.length - 2}</span>` : "");
          };
          const dupLines = rowIssues.map((it, i) => ({ it, i }))
            .filter(x => x.it.hard.length)
            .slice(0, 8)
            .map(x => {
              const iss = x.it.hard[0];
              const line = `#${x.i + 1} ${parsedRecords[x.i].fullName} — ${issueLabel(iss)}${iss.who ? " — " + issueName(iss.who) : ""}`;
              return `<div class="im-dup-line">${escapeHtml(line)}</div>`;
            }).join("");
          const preview = parsedRecords.slice(0, 6);
          previewEl.innerHTML = `
            <div style="font-size:12px; font-weight:700; margin-bottom:6px; color:var(--neutral-700);">
              ${t("import_preview")}: ${parsedRecords.length - invalidCount} ${App.currentLang === "ar" ? "جاهز للإرسال" : "ready to submit"}${invalidCount ? ` — ${invalidCount} ${App.currentLang === "ar" ? "غير مكتمل (سيُرفض)" : "incomplete (will be rejected)"}` : ""}${hardCount ? ` — <span style="color:var(--danger);">${hardCount} ${App.currentLang === "ar" ? "صف مكرر" : "duplicate row(s)"}</span>` : ""}${softCount ? ` — <span style="color:var(--warning-strong);">${softCount} ${App.currentLang === "ar" ? "تشابه جهة اتصال" : "contact match(es)"}</span>` : ""}
            </div>
            <div class="table-container" style="max-height:200px; overflow:auto;">
              <table class="data-table">
                <thead><tr><th>${t("volunteer_name")}</th><th>WhatsApp</th><th>${t("email")}</th><th>${t("committee")}</th><th>${t("imp_check")}</th></tr></thead>
                <tbody>
                  ${preview.map((r, i) => `
                    <tr>
                      <td style="font-weight:600;">${escapeHtml(r.fullName)}</td>
                      <td class="num-ltr">${escapeHtml(r.whatsapp || "—")}</td>
                      <td style="font-size:12px;">${escapeHtml(r.email || "—")}</td>
                      <td style="font-size:12px;">${escapeHtml(r.committeeName || "—")}</td>
                      <td>${badgeHtml(rowIssues[i] || { hard: [], soft: [] })}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
            ${hardCount ? `<label class="im-skip"><input type="checkbox" id="im-skip-dup" checked> ${t("imp_skip_dupes")} (${hardCount})</label>` : ""}
            ${dupLines ? `<div style="margin-top:8px; display:flex; flex-direction:column; gap:2px; max-height:120px; overflow:auto;">${dupLines}${hardCount > 8 ? `<div class="im-dup-line">${App.currentLang === "ar" ? `+ ${hardCount - 8} أخرى` : `+ ${hardCount - 8} more`}</div>` : ""}</div>` : ""}
          `;
          submitBtn.disabled = false;
        } catch {
          previewEl.innerHTML = `<div style="color:var(--danger); font-size:13px;">${App.currentLang === "ar" ? "تعذّر قراءة الملف" : "Could not read the file"}</div>`;
          submitBtn.disabled = true;
        }
      };
      reader.readAsText(file, "utf-8");
    };

    submitBtn.onclick = async () => {
      if (!parsedRecords.length) return;
      let toSend = parsedRecords;
      let skipped = 0;
      const skipEl = document.getElementById("im-skip-dup");
      if (skipEl && skipEl.checked) {
        toSend = parsedRecords.filter((_, i) => !(rowIssues[i] && rowIssues[i].hard.length));
        skipped = parsedRecords.length - toSend.length;
        if (!toSend.length) { showToast(t("imp_all_dupes"), "error"); return; }
      }
      submitBtn.disabled = true;
      try {
        const res = await window.AtharAPI.volunteers.importRows(toSend);
        await window.AtharStore.refreshVolunteers();
        const errorsHtml = (res.errors || []).slice(0, 10).map((er) => `
          <div style="font-size:12px; color:var(--danger);">#${er.row} ${escapeHtml(er.name || "")} — ${escapeHtml(er.error)}</div>
        `).join("");
        document.getElementById("im-result").innerHTML = `
          <div class="alert-soft ${res.failed ? "alert-warning-soft" : "alert-success-soft"}" style="padding:12px; font-weight:700;">
            ${t("imported")}: ${res.imported} • ${t("failed")}: ${res.failed}${skipped ? ` • ${t("imp_skipped")}: ${skipped}` : ""}
          </div>
          ${errorsHtml}
        `;
        previewEl.innerHTML = "";
        showToast(`${t("imported")}: ${res.imported}`, res.failed ? "warning" : "success");
        submitBtn.style.display = "none";
        window.AtharCore.renderCurrentView();
      } catch (err) {
        showToast(err.message || "Import failed", "error");
        submitBtn.disabled = false;
      }
    };
  }

  return {
    openAddVolunteerSlideover,
    openTransferModal,
    openLogHoursSlideover,
    openCreateMeetingSlideover,
    openCreateEventSlideover,
    openAddCommitteeModal,
    openPermissionsEditor,
    openDiffModal,
    openRoleSimulatorModal,
    openRevokeCertModal,
    openUserMenuModal,
    openEditWhatsAppTemplate,
    duplicateWhatsAppTemplate,
    deleteWhatsAppTemplate,
    openBulkLogHoursSlideover,
    openBulkRatingModal,
    openRejectHoursModal,
    openEditHoursModal,
    openBulkEditHoursModal,
    openAttendanceModal,
    openEvaluateAttendeesModal,
    openChangePasswordModal,
    openResetPasswordModal,
    openBulkTransferModal,
    openWhatsAppReminderModal,
    openImportVolunteersModal,
    buildSamplePreview,
    WA_PLACEHOLDERS,
    WA_SAMPLE_VALUES,
  };
})();