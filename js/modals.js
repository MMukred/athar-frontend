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
                </div>
                <div class="form-field">
                  <label class="field-label">${t("email")}</label>
                  <input type="email" id="vol-email" class="form-control" maxlength="150" value="${existing ? (existing.email || '') : ''}">
                  <span class="field-hint" id="vol-email-err" style="color:var(--danger); display:none;"></span>
                </div>
              </div>

              <div style="padding:10px 12px; background:var(--primary-light); border:1px solid var(--primary-border); border-radius:var(--radius-md); font-size:12px; color:var(--primary);">
                ${App.currentLang === 'ar'
        ? 'يجب توفير رقم واتساب أو بريد إلكتروني واحد على الأقل.'
        : 'At least one of WhatsApp number or email is required.'}
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

    const close = () => { slideover.innerHTML = ""; };
    document.getElementById("vol-close").onclick = close;
    document.getElementById("vol-cancel").onclick = close;
    document.getElementById("vol-backdrop").onclick = (e) => {
      if (e.target.id === "vol-backdrop") close();
    };

    // Clear errors on input
    const clearErr = (id) => {
      const el = document.getElementById(id + "-err");
      if (el) { el.textContent = ""; el.style.display = "none"; }
    };
    ["vol-name-en", "vol-wa", "vol-email"].forEach((id) => {
      const input = document.getElementById(id);
      if (input) input.addEventListener("input", () => clearErr(id));
    });

    const setErr = (id, msg) => {
      const el = document.getElementById(id + "-err");
      if (el) { el.textContent = msg; el.style.display = "block"; }
    };

    document.getElementById("vol-form").onsubmit = async (e) => {
      e.preventDefault();

      // Reset errors
      ["vol-name-en", "vol-wa", "vol-email"].forEach(clearErr);

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

      // Validation
      let hasError = false;

      if (nameEn.length < 2) {
        setErr("vol-name-en", "Name must be at least 2 characters.");
        hasError = true;
      }

      if (!wa && !email) {
        setErr("vol-wa", "Provide a WhatsApp number or an email.");
        setErr("vol-email", "Provide a WhatsApp number or an email.");
        hasError = true;
      }

      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setErr("vol-email", "Invalid email format.");
        hasError = true;
      }

      if (hasError) {
        showToast("Please fix the highlighted fields.", "error");
        return;
      }

      const payload = {
        fullName: nameEn,
        fullNameAr: nameAr || undefined,
        whatsapp: wa || undefined,
        email: email || undefined,
        gender: gender || undefined,
        nationality: nationality || undefined,
        studyLevel: studyLevel || undefined,
        dob: dob || undefined,
        committeeId: commId,
        status,
        notes: notes || undefined,
      };

      const submitBtn = document.getElementById("vol-submit");
      submitBtn.disabled = true;
      const origText = submitBtn.textContent;
      submitBtn.textContent = "Saving…";

      try {
        if (isEdit) {
          await window.AtharAPI.volunteers.update(existing.id, payload);
          showToast(t("updated_successfully"), "success");
        } else {
          await window.AtharAPI.volunteers.create(payload);
          showToast(t("saved_successfully"), "success");
        }
        await window.AtharStore.refreshVolunteers();
        close();
        window.AtharCore.renderCurrentView();
      } catch (err) {
        if (err.code === "DUPLICATE_NATIONAL_ID" || err.code === "DUPLICATE_RECORD") {
          showToast(t("error_duplicate_id"), "error");
        } else if (err.code === "MISSING_CONTACT" || (err.status === 422 && err.details)) {
          if (err.details?.whatsapp) setErr("vol-wa", Array.isArray(err.details.whatsapp) ? err.details.whatsapp[0] : err.details.whatsapp);
          if (err.details?.email) setErr("vol-email", Array.isArray(err.details.email) ? err.details.email[0] : err.details.email);
          showToast("Please fix the highlighted fields.", "error");
        } else {
          showToast(err.message || "Save failed", "error");
        }
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
      } catch (err) {
        showToast(err.message || "Transfer failed", "error");
      }
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
                  <input type="number" step="0.5" min="0.5" id="hr-amount" class="form-control" required>
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

    const close = () => { slideover.innerHTML = ""; };
    document.getElementById("hr-close").onclick = close;
    document.getElementById("hr-cancel").onclick = close;
    document.getElementById("hr-backdrop").onclick = (e) => { if (e.target.id === "hr-backdrop") close(); };

    document.getElementById("hr-form").onsubmit = async (e) => {
      e.preventDefault();
      const vId = document.getElementById("hr-vol").value;
      const activity = document.getElementById("hr-activity").value.trim();
      const amount = Number(document.getElementById("hr-amount").value);
      const date = document.getElementById("hr-date").value;
      const notes = document.getElementById("hr-notes").value;

      if (amount <= 0) { showToast("Hours must be > 0", "error"); return; }

      try {
        await window.AtharAPI.hours.create({
          volunteerId: vId,
          activity,
          hours: amount,
          date,
          description: notes || undefined,
        });
        await window.AtharStore.refreshHours();
        showToast(t("saved_successfully"), "success");
        close();
        window.AtharCore.renderCurrentView();
      } catch (err) {
        showToast(err.message || "Failed to log hours", "error");
      }
    };
  }

  // =========================================================
  // 4. Create Meeting
  // =========================================================
  function openCreateMeetingSlideover(committeeId) {
    committeeId = committeeId || null;
    const state = window.AtharStore.getState();
    const slideover = document.getElementById("slideover-container");

    slideover.innerHTML = `
      <div class="overlay-backdrop" id="mt-backdrop">
        <div class="slide-over">
          <div class="drawer-header">
            <h3 class="drawer-title">${ic("calendar", 18)} ${t("add_meeting")}</h3>
            <button class="btn-icon" id="mt-close">&times;</button>
          </div>
          <div class="drawer-body">
            <form id="mt-form" style="display:flex; flex-direction:column; gap:16px;">
              <div class="form-field">
                <label class="field-label">${t("meeting_title_en")} <span class="required-asterisk">*</span></label>
                <input type="text" id="mt-title-en" class="form-control" required>
              </div>
              <div class="form-field">
                <label class="field-label">${t("meeting_title_ar")} <span class="required-asterisk">*</span></label>
                <input type="text" id="mt-title-ar" class="form-control" required>
              </div>
              <div class="form-field">
                <label class="field-label">${t("committee")}</label>
                <select id="mt-comm" class="form-control">
                  <option value="">${t("all_committees")}</option>
                  ${state.committees.map(c => `<option value="${c.id}" ${committeeId === c.id ? 'selected' : ''}>${App.currentLang === 'ar' ? c.name_ar : c.name_en}</option>`).join('')}
                </select>
              </div>
              <div class="form-field">
                <label class="field-label">${t("meeting_date")} <span class="required-asterisk">*</span></label>
                <input type="date" id="mt-date" class="form-control" value="${new Date().toISOString().slice(0, 10)}" required>
              </div>
              <div class="form-grid">
                <div class="form-field">
                  <label class="field-label">${t("start_time")} <span class="required-asterisk">*</span></label>
                  <input type="time" id="mt-start" class="form-control" value="18:00" required>
                </div>
                <div class="form-field">
                  <label class="field-label">${t("end_time")}</label>
                  <input type="time" id="mt-end" class="form-control" value="19:30">
                </div>
              </div>
              <div class="form-field">
                <label class="field-label">${t("location")}</label>
                <input type="text" id="mt-loc" class="form-control" value="Room 3">
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

    const close = () => { slideover.innerHTML = ""; };
    document.getElementById("mt-close").onclick = close;
    document.getElementById("mt-cancel").onclick = close;
    document.getElementById("mt-backdrop").onclick = (e) => { if (e.target.id === "mt-backdrop") close(); };

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
        const created = await window.AtharAPI.meetings.create({
          titleEn,
          titleAr,
          meetingDate: date,
          startTime: start,
          endTime: end || undefined,
          location: loc || undefined,
          committeeId: commId,
        });
        await window.AtharStore.refreshMeetings();
        showToast(t("saved_successfully"), "success");
        close();
        navigateTo("meeting-detail", { id: created.id });
      } catch (err) {
        showToast(err.message || "Failed to create meeting", "error");
      }
    };
  }

  // =========================================================
  // 5. Add / Edit Committee
  // =========================================================
  function openAddCommitteeModal(committeeId) {
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
                <input type="text" id="cm-name-en" class="form-control" required value="${existing ? existing.name_en : ''}">
              </div>
              <div class="form-field">
                <label class="field-label">${t("committee_name_ar")} <span class="required-asterisk">*</span></label>
                <input type="text" id="cm-name-ar" class="form-control" required value="${existing ? existing.name_ar : ''}">
              </div>
              <div class="form-field">
                <label class="field-label">${t("committee_desc_en")}</label>
                <textarea id="cm-desc-en" class="form-control" rows="2">${existing ? (existing.description_en || '') : ''}</textarea>
              </div>
              <div class="form-field">
                <label class="field-label">${t("committee_desc_ar")}</label>
                <textarea id="cm-desc-ar" class="form-control" rows="2">${existing ? (existing.description_ar || '') : ''}</textarea>
              </div>
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
            nameEn, nameAr, descriptionEn: descEn || undefined, descriptionAr: descAr || undefined,
          });
          showToast(t("updated_successfully"), "success");
        } else {
          await window.AtharAPI.committees.create({
            nameEn, nameAr, descriptionEn: descEn || undefined, descriptionAr: descAr || undefined,
          });
          showToast(t("saved_successfully"), "success");
        }
        await window.AtharStore.refreshCommittees();
        close();
        window.AtharCore.renderCurrentView();
      } catch (err) {
        showToast(err.message || "Save failed", "error");
      }
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
  // 7. Diff Viewer  (fetches from API on cache miss)
  // =========================================================
  async function openDiffModal(logId) {
    // Try cache first
    const state = window.AtharStore.getState();
    let log = state.audit_logs.find(l => l.id === logId);

    // If not cached (or cache is stale), fetch fresh
    if (!log) {
      try {
        const apiLog = await window.AtharAPI.audit.get(logId);
        // Adapt API shape → frontend shape
        let createdAt = apiLog.createdAt;
        if (typeof createdAt === "string") {
          createdAt = createdAt.replace("T", " ").slice(0, 19);
        } else if (createdAt) {
          try {
            createdAt = new Date(createdAt).toISOString().replace("T", " ").slice(0, 19);
          } catch { createdAt = ""; }
        }

        log = {
          id: apiLog.id,
          user_id: apiLog.userId,
          user_name: apiLog.userName || "System",
          action: apiLog.action,
          entity: apiLog.entity,
          entity_id: apiLog.entityId,
          details: apiLog.details,
          old_value: apiLog.oldValue,
          new_value: apiLog.newValue,
          created_at: createdAt,
        };
      } catch (err) {
        showToast("Could not load audit entry", "error");
        return;
      }
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
              <div>
                <strong>Action:</strong>
                <span class="badge badge-primary">${log.action}</span>
                &bull;
                <strong>Entity:</strong> <code>${log.entity || '—'}</code>
              </div>
              ${log.details ? `<div style="margin-top:4px;"><strong>Details:</strong> ${log.details}</div>` : ''}
              <div style="margin-top:4px; color:var(--neutral-500); font-size:11px;" class="num-ltr">
                ${log.created_at} by ${log.user_name}
              </div>
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
    document.getElementById("df-backdrop").onclick = (e) => {
      if (e.target.id === "df-backdrop") close();
    };
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
      } catch (err) {
        showToast(err.message || "Revoke failed", "error");
      }
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
              <div class="user-avatar" style="width:44px; height:44px; font-size:16px;">${App.currentUser.full_name.charAt(0)}</div>
              <div style="flex:1;">
                <div style="font-weight:700;">${App.currentUser.full_name}</div>
                <div style="font-size:12px; color:var(--neutral-500);">${App.currentUser.email}</div>
                <div style="font-size:11px; color:var(--neutral-500); margin-top:2px;">${isSuper ? t("super_admin") : t("trusted_admin")}</div>
              </div>
            </div>
            <button class="btn btn-danger-outline" id="um-logout" style="width:100%; justify-content:flex-start;">
              ${ic("logout", 15)} ${t("logout")}
            </button>
          </div>
        </div>
      </div>
    `;
    const close = () => { modal.innerHTML = ""; };
    document.getElementById("um-close").onclick = close;
    document.getElementById("um-backdrop").onclick = (e) => { if (e.target.id === "um-backdrop") close(); };
    document.getElementById("um-logout").onclick = () => {
      close();
      if (window.AtharAuth) window.AtharAuth.logout();
    };
  }

  // =========================================================
  // 11-13. WhatsApp Templates (local only — no API)
  // =========================================================
  function openEditWhatsAppTemplate() { showToast("WhatsApp templates are local-only for now", "info"); }
  function duplicateWhatsAppTemplate() { showToast("Not available yet", "info"); }
  function deleteWhatsAppTemplate() { showToast("Not available yet", "info"); }

  return {
    openAddVolunteerSlideover,
    openTransferModal,
    openLogHoursSlideover,
    openCreateMeetingSlideover,
    openAddCommitteeModal,
    openPermissionsEditor,
    openDiffModal,
    openRoleSimulatorModal,
    openRevokeCertModal,
    openUserMenuModal,
    openEditWhatsAppTemplate,
    duplicateWhatsAppTemplate,
    deleteWhatsAppTemplate,
    buildSamplePreview,
    WA_PLACEHOLDERS,
    WA_SAMPLE_VALUES,
  };
})();