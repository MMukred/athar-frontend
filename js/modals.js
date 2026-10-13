/**
 * Athar Modals — every modal & slide-over opener lives here.
 * Depends on: AtharCore, AtharStore, AtharDirty, AtharIcons.
 * Exposes: window.AtharModals
 */

window.AtharModals = (function () {
  "use strict";

  // ---- Import from core ----
  const {
    App,
    t,
    formatDate,
    ic,
    showToast,
    showConfirmModal,
    hasPermission,
    navigateTo,
    escapeHtml
  } = window.AtharCore;

  // =========================================================================
  // WhatsApp editor helpers
  // =========================================================================
  const WA_SAMPLE_VALUES = {
    ar: {
      name: "أحمد علي المنصور",
      committee: "لجنة الإعلام والعلاقات العامة",
      date: "الأحد ٢٠ أكتوبر ٢٠٢٦",
      hours: "12.0",
      certificate_no: "ATHAR-2026-0007",
      verify_url: "https://athar.org/verify/ATHAR-2026-0007"
    },
    en: {
      name: "Ahmed Ali Al-Mansoor",
      committee: "Media & Public Relations Committee",
      date: "Sunday, Oct 20, 2026",
      hours: "12.0",
      certificate_no: "ATHAR-2026-0007",
      verify_url: "https://athar.org/verify/ATHAR-2026-0007"
    }
  };

  function buildSamplePreview(body, lang) {
    const vals = WA_SAMPLE_VALUES[lang === "ar" ? "ar" : "en"];
    return String(body || "")
      .replace(/\{name\}/g, vals.name)
      .replace(/\{committee\}/g, vals.committee)
      .replace(/\{date\}/g, vals.date)
      .replace(/\{hours\}/g, vals.hours)
      .replace(/\{certificate_no\}/g, vals.certificate_no)
      .replace(/\{verify_url\}/g, vals.verify_url);
  }

  const WA_PLACEHOLDERS = [
    { token: "{name}", desc_en: "Volunteer name", desc_ar: "اسم المتطوع" },
    { token: "{committee}", desc_en: "Committee name", desc_ar: "اسم اللجنة" },
    { token: "{date}", desc_en: "Meeting / issue date", desc_ar: "تاريخ الاجتماع / الإصدار" },
    { token: "{hours}", desc_en: "Approved hours", desc_ar: "عدد الساعات المعتمدة" },
    { token: "{certificate_no}", desc_en: "Certificate number", desc_ar: "رقم الشهادة" },
    { token: "{verify_url}", desc_en: "Public verify URL", desc_ar: "رابط التحقق العام" }
  ];

  // =========================================================================
  // 1. Add / Edit Volunteer Slide-over
  // =========================================================================
  function openAddVolunteerSlideover(volunteerId) {
    volunteerId = volunteerId || null;
    const state = window.AtharStore.getState();
    const existing = volunteerId ? state.volunteers.find(v => v.id === volunteerId) : null;
    const isEdit = !!existing;
    let skillsList = existing && existing.skills ? [...existing.skills] : ["FirstAid", "Media"];

    const slideover = document.getElementById("slideover-container");
    slideover.innerHTML = `
      <div class="overlay-backdrop" id="vol-slideover-backdrop">
        <div class="slide-over">
          <div class="drawer-header">
            <h3 class="drawer-title">${ic("user_plus", 18)} ${isEdit ? t("edit") : t("add_volunteer")}</h3>
            <button class="btn-icon" id="vol-drawer-close">&times;</button>
          </div>
          <div class="drawer-body">
            <form id="vol-form" style="display:flex; flex-direction:column; gap:16px;">
              <div class="form-field">
                <label class="field-label">${t("volunteer_name")} (English) <span class="required-asterisk">*</span></label>
                <input type="text" id="vol-name-en" class="form-control" required value="${existing ? existing.full_name : ''}">
              </div>
              <div class="form-field">
                <label class="field-label">${t("volunteer_name")} (Arabic)</label>
                <input type="text" id="vol-name-ar" class="form-control" value="${existing ? (existing.full_name_ar || '') : ''}">
              </div>
              <div class="form-grid">
                <div class="form-field">
                  <label class="field-label">${t("national_id")} <span class="required-asterisk">*</span></label>
                  <input type="text" id="vol-national-id" class="form-control" required value="${existing ? (existing.national_id || '') : ''}">
                </div>
                <div class="form-field">
                  <label class="field-label">${t("dob")}</label>
                  <input type="date" id="vol-dob" class="form-control" value="${existing ? (existing.dob || '') : '1998-05-15'}">
                </div>
              </div>
              <div class="form-grid">
                <div class="form-field">
                  <label class="field-label">${t("phone")}</label>
                  <input type="text" id="vol-phone" class="form-control" placeholder="+96650..." value="${existing ? (existing.phone || '') : ''}">
                </div>
                <div class="form-field">
                  <label class="field-label">${t("whatsapp")}</label>
                  <input type="text" id="vol-whatsapp" class="form-control" placeholder="+96650..." value="${existing ? (existing.whatsapp || '') : ''}">
                </div>
              </div>
              <div class="form-field">
                <label class="field-label">${t("email")}</label>
                <input type="email" id="vol-email" class="form-control" value="${existing ? (existing.email || '') : ''}">
              </div>
              <div class="form-grid">
                <div class="form-field">
                  <label class="field-label">${t("committee")}</label>
                  <select id="vol-comm-select" class="form-control">
                    <option value="">None / Unassigned</option>
                    ${state.committees.map(c => `<option value="${c.id}" ${existing && existing.committee_id === c.id ? 'selected' : ''}>${App.currentLang === 'ar' ? c.name_ar : c.name_en}</option>`).join('')}
                  </select>
                </div>
                <div class="form-field">
                  <label class="field-label">${t("status")}</label>
                  <select id="vol-status-select" class="form-control">
                    <option value="active" ${existing && existing.status === 'active' ? 'selected' : ''}>${t("active")}</option>
                    <option value="suspended" ${existing && existing.status === 'suspended' ? 'selected' : ''}>${t("suspended")}</option>
                    <option value="withdrawn" ${existing && existing.status === 'withdrawn' ? 'selected' : ''}>${t("withdrawn")}</option>
                    <option value="completed" ${existing && existing.status === 'completed' ? 'selected' : ''}>${t("completed")}</option>
                  </select>
                </div>
              </div>
              <div class="form-field">
                <label class="field-label">${t("skills")} <span class="field-hint">(${t("skills_hint")})</span></label>
                <div class="tag-input-container" id="vol-skills-container">
                  <input type="text" id="vol-skill-new-input" class="tag-input-field" placeholder="Add tag...">
                </div>
              </div>
              <div class="form-field">
                <label class="field-label">${t("notes")}</label>
                <textarea id="vol-notes" class="form-control" rows="2">${existing ? (existing.notes || '') : ''}</textarea>
              </div>
              <div class="drawer-footer">
                <button type="button" class="btn btn-secondary" id="vol-drawer-cancel">${t("cancel")}</button>
                <button type="submit" class="btn btn-primary">${t("save")}</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    // Track dirty state (A7)
    const volFormEl = document.getElementById("vol-form");
    if (volFormEl && window.AtharDirty) window.AtharDirty.track(volFormEl);

    const close = () => {
      if (window.AtharDirty) {
        window.AtharDirty.guard(() => {
          slideover.innerHTML = "";
          window.AtharDirty.clear();
        });
      } else {
        slideover.innerHTML = "";
      }
    };

    document.getElementById("vol-drawer-close").onclick = close;
    document.getElementById("vol-drawer-cancel").onclick = close;
    document.getElementById("vol-slideover-backdrop").onclick = (e) => {
      if (e.target.id === "vol-slideover-backdrop") close();
    };

    // Tag chip input
    const skillsContainer = document.getElementById("vol-skills-container");
    const skillInput = document.getElementById("vol-skill-new-input");

    function renderTagChips() {
      skillsContainer.querySelectorAll(".tag-chip").forEach(c => c.remove());
      skillsList.forEach(s => {
        const chip = document.createElement("span");
        chip.className = "tag-chip";
        chip.innerHTML = `#${s} <span class="tag-chip-remove" data-skill="${s}">&times;</span>`;
        skillsContainer.insertBefore(chip, skillInput);
        chip.querySelector(".tag-chip-remove").onclick = () => {
          skillsList = skillsList.filter(x => x !== s);
          renderTagChips();
        };
      });
    }
    renderTagChips();

    skillInput.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        const val = skillInput.value.trim().replace(/^#/, "");
        if (val && !skillsList.includes(val)) {
          skillsList.push(val);
          skillInput.value = "";
          renderTagChips();
        }
      }
    };

    // Submit
    document.getElementById("vol-form").onsubmit = (e) => {
      e.preventDefault();
      if (window.AtharDirty) window.AtharDirty.beginSubmit();

      const nameEn = document.getElementById("vol-name-en").value.trim();
      const nameAr = document.getElementById("vol-name-ar").value.trim();
      const nationalId = document.getElementById("vol-national-id").value.trim();
      const phone = document.getElementById("vol-phone").value.trim();
      const whatsapp = document.getElementById("vol-whatsapp").value.trim();
      const email = document.getElementById("vol-email").value.trim();
      const dob = document.getElementById("vol-dob").value;
      const commId = document.getElementById("vol-comm-select").value || null;
      const status = document.getElementById("vol-status-select").value;
      const notes = document.getElementById("vol-notes").value;

      if (!nameEn) {
        showToast(t("error_required_fields"), "error");
        return;
      }

      const duplicate = state.volunteers.find(v => v.national_id === nationalId && (!existing || v.id !== existing.id));
      if (duplicate) {
        showToast(t("error_duplicate_id"), "error");
        return;
      }

      if (isEdit) {
        const oldVal = { ...existing };
        existing.full_name = nameEn;
        existing.full_name_ar = nameAr;
        existing.national_id = nationalId;
        existing.phone = phone;
        existing.whatsapp = whatsapp;
        existing.email = email;
        existing.dob = dob;
        existing.committee_id = commId;
        existing.status = status;
        existing.skills = skillsList;
        existing.notes = notes;

        window.AtharStore.save();
        window.AtharStore.logAudit(App.currentUser, "update", "volunteer", existing.id, `Updated volunteer: ${nameEn}`, oldVal, existing);
        showToast(t("updated_successfully"), "success");
      } else {
        const newVol = {
          id: "vol-" + String(state.volunteers.length + 1).padStart(2, "0"),
          full_name: nameEn,
          full_name_ar: nameAr,
          national_id: nationalId,
          phone: phone,
          whatsapp: whatsapp,
          email: email,
          dob: dob,
          gender: "male",
          skills: skillsList,
          status: status,
          committee_id: commId,
          join_date: new Date().toISOString().substring(0, 10),
          notes: notes,
          created_at: new Date().toISOString(),
          archived_at: null
        };
        state.volunteers.unshift(newVol);
        window.AtharStore.save();
        window.AtharStore.logAudit(App.currentUser, "create", "volunteer", newVol.id, `Created volunteer: ${nameEn}`, null, newVol);
        showToast(t("saved_successfully"), "success");
      }

      slideover.innerHTML = "";
      if (window.AtharDirty) window.AtharDirty.clear();
      window.AtharCore.renderCurrentView();
    };
  }

  // =========================================================================
  // 2. Transfer Volunteer Modal
  // =========================================================================
  function openTransferModal(volunteerId) {
    const state = window.AtharStore.getState();
    const vol = state.volunteers.find(v => v.id === volunteerId);
    if (!vol) return;

    const modal = document.getElementById("modal-container");
    modal.innerHTML = `
      <div class="overlay-backdrop" id="transfer-modal-backdrop">
        <div class="modal-dialog">
          <div class="modal-header">
            <h3 class="modal-title">${ic("arrow_right", 18)} ${t("transfer_volunteer")}</h3>
            <button class="btn-icon" id="transfer-modal-close">&times;</button>
          </div>
          <form id="transfer-form">
            <div class="modal-body" style="display:flex; flex-direction:column; gap:16px;">
              <div>
                <strong>Volunteer:</strong> ${vol.full_name} (${vol.national_id})
              </div>
              <div class="form-field">
                <label class="field-label">${t("to_committee")} <span class="required-asterisk">*</span></label>
                <select id="transfer-target-comm" class="form-control" required>
                  ${state.committees.filter(c => c.id !== vol.committee_id).map(c => `
                    <option value="${c.id}">${App.currentLang === 'ar' ? c.name_ar : c.name_en}</option>
                  `).join('')}
                </select>
              </div>
              <div class="form-field">
                <label class="field-label">${t("transfer_reason")} <span class="required-asterisk">*</span></label>
                <textarea id="transfer-reason" class="form-control" rows="3" placeholder="Provide justification for transferring volunteer..." required></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" id="transfer-modal-cancel">${t("cancel")}</button>
              <button type="submit" class="btn btn-primary">${t("confirm")}</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const transferFormEl = document.getElementById("transfer-form");
    if (transferFormEl && window.AtharDirty) window.AtharDirty.track(transferFormEl);

    const close = () => {
      if (window.AtharDirty) {
        window.AtharDirty.guard(() => {
          modal.innerHTML = "";
          window.AtharDirty.clear();
        });
      } else {
        modal.innerHTML = "";
      }
    };

    document.getElementById("transfer-modal-close").onclick = close;
    document.getElementById("transfer-modal-cancel").onclick = close;
    document.getElementById("transfer-modal-backdrop").onclick = (e) => {
      if (e.target.id === "transfer-modal-backdrop") close();
    };

    document.getElementById("transfer-form").onsubmit = (e) => {
      e.preventDefault();
      if (window.AtharDirty) window.AtharDirty.beginSubmit();

      const targetCommId = document.getElementById("transfer-target-comm").value;
      const reason = document.getElementById("transfer-reason").value.trim();

      if (!reason) {
        showToast("Transfer reason is strictly required (VL-09)", "error");
        return;
      }

      const prevCommId = vol.committee_id;
      const prevComm = state.committees.find(c => c.id === prevCommId);
      const targetComm = state.committees.find(c => c.id === targetCommId);

      vol.committee_id = targetCommId;

      const transferRow = {
        id: window.AtharStore.generateUUID(),
        volunteer_id: vol.id,
        from_committee_id: prevCommId,
        to_committee_id: targetCommId,
        reason: reason,
        transferred_by: App.currentUser.id,
        transferred_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
      };

      state.committee_transfers.push(transferRow);
      window.AtharStore.save();
      window.AtharStore.logAudit(App.currentUser, "transfer", "volunteer", vol.id, `Transferred ${vol.full_name} from ${prevComm ? prevComm.name_en : 'None'} to ${targetComm ? targetComm.name_en : 'None'}. Reason: ${reason}`, { committee_id: prevCommId }, { committee_id: targetCommId, reason });

      showToast(t("transfer_success"), "success");
      modal.innerHTML = "";
      if (window.AtharDirty) window.AtharDirty.clear();
      window.AtharCore.renderCurrentView();
    };
  }

  // =========================================================================
  // 3. Log Hours Slide-over
  // =========================================================================
  function openLogHoursSlideover(volunteerId) {
    volunteerId = volunteerId || null;
    const state = window.AtharStore.getState();
    const slideover = document.getElementById("slideover-container");
    const activeVols = state.volunteers.filter(v => v.status !== "archived");

    slideover.innerHTML = `
      <div class="overlay-backdrop" id="hours-slideover-backdrop">
        <div class="slide-over">
          <div class="drawer-header">
            <h3 class="drawer-title">${ic("clock", 18)} ${t("log_hours")}</h3>
            <button class="btn-icon" id="hours-drawer-close">&times;</button>
          </div>
          <div class="drawer-body">
            <form id="hours-form" style="display:flex; flex-direction:column; gap:16px;">
              <div class="form-field">
                <label class="field-label">${t("volunteer_name")} <span class="required-asterisk">*</span></label>
                <select id="hours-vol-select" class="form-control" required>
                  ${activeVols.map(v => `<option value="${v.id}" ${volunteerId === v.id ? 'selected' : ''}>${App.currentLang === 'ar' ? (v.full_name_ar || v.full_name) : v.full_name}</option>`).join('')}
                </select>
              </div>
              <div class="form-field">
                <label class="field-label">${t("activity")} <span class="required-asterisk">*</span></label>
                <input type="text" id="hours-activity" class="form-control" placeholder="e.g. Media Coverage, Hall Setup" required>
              </div>
              <div class="form-grid">
                <div class="form-field">
                  <label class="field-label">${t("hours_amount")} <span class="required-asterisk">*</span></label>
                  <input type="number" step="0.5" min="0.5" id="hours-amount" class="form-control" placeholder="e.g. 2.5" required>
                </div>
                <div class="form-field">
                  <label class="field-label">${t("date")} <span class="required-asterisk">*</span></label>
                  <input type="date" id="hours-date" class="form-control" value="${new Date().toISOString().substring(0, 10)}" required>
                </div>
              </div>
              <div class="form-field">
                <label class="field-label">${t("notes")}</label>
                <textarea id="hours-desc" class="form-control" rows="3" placeholder="Summary of duties executed..."></textarea>
              </div>
              <div class="drawer-footer">
                <button type="button" class="btn btn-secondary" id="hours-drawer-cancel">${t("cancel")}</button>
                <button type="submit" class="btn btn-primary">${t("save")}</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    const hoursFormEl = document.getElementById("hours-form");
    if (hoursFormEl && window.AtharDirty) window.AtharDirty.track(hoursFormEl);

    const close = () => {
      if (window.AtharDirty) {
        window.AtharDirty.guard(() => {
          slideover.innerHTML = "";
          window.AtharDirty.clear();
        });
      } else {
        slideover.innerHTML = "";
      }
    };

    document.getElementById("hours-drawer-close").onclick = close;
    document.getElementById("hours-drawer-cancel").onclick = close;
    document.getElementById("hours-slideover-backdrop").onclick = (e) => {
      if (e.target.id === "hours-slideover-backdrop") close();
    };

    document.getElementById("hours-form").onsubmit = (e) => {
      e.preventDefault();
      if (window.AtharDirty) window.AtharDirty.beginSubmit();

      const vId = document.getElementById("hours-vol-select").value;
      const act = document.getElementById("hours-activity").value.trim();
      const amount = Number(document.getElementById("hours-amount").value);
      const date = document.getElementById("hours-date").value;
      const desc = document.getElementById("hours-desc").value;

      if (amount <= 0 || isNaN(amount)) {
        showToast("Hours must be strictly greater than 0 (HR-02)", "error");
        return;
      }

      const vol = state.volunteers.find(v => v.id === vId);
      const canApprove = hasPermission("volunteer_hours", "approve");

      const newHours = {
        id: "hr-" + window.AtharStore.generateUUID().substring(0, 8),
        volunteer_id: vId,
        activity: act,
        description: desc,
        hours: amount,
        date: date,
        committee_id: vol ? vol.committee_id : null,
        status: canApprove ? "approved" : "pending",
        approved_by: canApprove ? App.currentUser.id : null,
        approved_at: canApprove ? new Date().toISOString() : null,
        rejection_reason: null,
        created_by: App.currentUser.id,
        created_at: new Date().toISOString()
      };

      state.volunteer_hours.unshift(newHours);
      window.AtharStore.save();
      window.AtharStore.logAudit(App.currentUser, "create", "volunteer_hours", newHours.id, `Logged ${amount} hours for ${vol ? vol.full_name : vId} (${act})`, null, newHours);

      showToast(t("saved_successfully"), "success");
      slideover.innerHTML = "";
      if (window.AtharDirty) window.AtharDirty.clear();
      window.AtharCore.renderCurrentView();
    };
  }

  // =========================================================================
  // 4. Create Meeting Slide-over
  // =========================================================================
  function openCreateMeetingSlideover(committeeId) {
    committeeId = committeeId || null;
    const state = window.AtharStore.getState();
    const slideover = document.getElementById("slideover-container");

    slideover.innerHTML = `
      <div class="overlay-backdrop" id="mtg-slideover-backdrop">
        <div class="slide-over">
          <div class="drawer-header">
            <h3 class="drawer-title">${ic("calendar", 18)} ${t("add_meeting")}</h3>
            <button class="btn-icon" id="mtg-drawer-close">&times;</button>
          </div>
          <div class="drawer-body">
            <form id="mtg-form" style="display:flex; flex-direction:column; gap:16px;">
              <div class="form-field">
                <label class="field-label">${t("meeting_title_en")} <span class="required-asterisk">*</span></label>
                <input type="text" id="mtg-title-en" class="form-control" required placeholder="e.g. Media Strategy Sync">
              </div>
              <div class="form-field">
                <label class="field-label">${t("meeting_title_ar")} <span class="required-asterisk">*</span></label>
                <input type="text" id="mtg-title-ar" class="form-control" required placeholder="e.g. اجتماع التنسيق الإعلامي">
              </div>
              <div class="form-field">
                <label class="field-label">${t("committee")}</label>
                <select id="mtg-comm-select" class="form-control">
                  <option value="">${t("all_committees")} (All Active Members)</option>
                  ${state.committees.map(c => `<option value="${c.id}" ${committeeId === c.id ? 'selected' : ''}>${App.currentLang === 'ar' ? c.name_ar : c.name_en}</option>`).join('')}
                </select>
              </div>
              <div class="form-field">
                <label class="field-label">${t("meeting_date")} <span class="required-asterisk">*</span></label>
                <input type="date" id="mtg-date" class="form-control" value="${new Date().toISOString().substring(0, 10)}" required>
              </div>
              <div class="form-grid">
                <div class="form-field">
                  <label class="field-label">${t("start_time")} <span class="required-asterisk">*</span></label>
                  <input type="time" id="mtg-start" class="form-control" value="18:00" required>
                </div>
                <div class="form-field">
                  <label class="field-label">${t("end_time")}</label>
                  <input type="time" id="mtg-end" class="form-control" value="19:30">
                </div>
              </div>
              <div class="form-field">
                <label class="field-label">${t("location")}</label>
                <input type="text" id="mtg-loc" class="form-control" value="Room 3 / Zoom Link">
              </div>
              <div class="drawer-footer">
                <button type="button" class="btn btn-secondary" id="mtg-drawer-cancel">${t("cancel")}</button>
                <button type="submit" class="btn btn-primary">${t("save")}</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    const mtgFormEl = document.getElementById("mtg-form");
    if (mtgFormEl && window.AtharDirty) window.AtharDirty.track(mtgFormEl);

    const close = () => {
      if (window.AtharDirty) {
        window.AtharDirty.guard(() => {
          slideover.innerHTML = "";
          window.AtharDirty.clear();
        });
      } else {
        slideover.innerHTML = "";
      }
    };

    document.getElementById("mtg-drawer-close").onclick = close;
    document.getElementById("mtg-drawer-cancel").onclick = close;
    document.getElementById("mtg-slideover-backdrop").onclick = (e) => {
      if (e.target.id === "mtg-slideover-backdrop") close();
    };

    document.getElementById("mtg-form").onsubmit = (e) => {
      e.preventDefault();
      if (window.AtharDirty) window.AtharDirty.beginSubmit();

      const titleEn = document.getElementById("mtg-title-en").value.trim();
      const titleAr = document.getElementById("mtg-title-ar").value.trim();
      const commId = document.getElementById("mtg-comm-select").value || null;
      const date = document.getElementById("mtg-date").value;
      const start = document.getElementById("mtg-start").value;
      const end = document.getElementById("mtg-end").value;
      const loc = document.getElementById("mtg-loc").value;

      const newMtg = {
        id: "mt-" + String(state.meetings.length + 1).padStart(2, '0'),
        title_en: titleEn,
        title_ar: titleAr,
        description: `Scheduled meeting for ${titleEn}`,
        meeting_date: date,
        start_time: start,
        end_time: end,
        location: loc,
        committee_id: commId,
        created_by: App.currentUser.id,
        status: "scheduled",
        created_at: new Date().toISOString()
      };

      state.meetings.unshift(newMtg);
      window.AtharStore.save();
      window.AtharStore.logAudit(App.currentUser, "create", "meeting", newMtg.id, `Created meeting: ${titleEn} for ${date}`, null, newMtg);

      showToast(t("saved_successfully"), "success");
      slideover.innerHTML = "";
      if (window.AtharDirty) window.AtharDirty.clear();
      navigateTo("meeting-detail", { id: newMtg.id });
    };
  }

  // =========================================================================
  // 5. Add / Edit Committee Modal
  // =========================================================================
  function openAddCommitteeModal(committeeId) {
    committeeId = committeeId || null;
    const state = window.AtharStore.getState();
    const existing = committeeId ? state.committees.find(c => c.id === committeeId) : null;
    const isEdit = !!existing;

    const modal = document.getElementById("modal-container");
    modal.innerHTML = `
      <div class="overlay-backdrop" id="comm-modal-backdrop">
        <div class="modal-dialog">
          <div class="modal-header">
            <h3 class="modal-title">${ic("building", 18)} ${isEdit ? t("edit") : t("add_committee")}</h3>
            <button class="btn-icon" id="comm-modal-close">&times;</button>
          </div>
          <form id="comm-form">
            <div class="modal-body" style="display:flex; flex-direction:column; gap:16px;">
              <div class="form-field">
                <label class="field-label">${t("committee_name_en")} <span class="required-asterisk">*</span></label>
                <input type="text" id="comm-name-en" class="form-control" required value="${existing ? existing.name_en : ''}">
              </div>
              <div class="form-field">
                <label class="field-label">${t("committee_name_ar")} <span class="required-asterisk">*</span></label>
                <input type="text" id="comm-name-ar" class="form-control" required value="${existing ? existing.name_ar : ''}">
              </div>
              <div class="form-field">
                <label class="field-label">${t("committee_desc_en")}</label>
                <textarea id="comm-desc-en" class="form-control" rows="2">${existing ? (existing.description_en || '') : ''}</textarea>
              </div>
              <div class="form-field">
                <label class="field-label">${t("committee_desc_ar")}</label>
                <textarea id="comm-desc-ar" class="form-control" rows="2">${existing ? (existing.description_ar || '') : ''}</textarea>
              </div>
              <div class="form-field">
                <label class="field-label">${t("manager")}</label>
                <select id="comm-mgr-select" class="form-control">
                  <option value="">Select Committee Manager...</option>
                  ${state.users.map(u => `<option value="${u.id}" ${existing && existing.manager_id === u.id ? 'selected' : ''}>${u.full_name} (${u.role})</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" id="comm-modal-cancel">${t("cancel")}</button>
              <button type="submit" class="btn btn-primary">${t("save")}</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const commFormEl = document.getElementById("comm-form");
    if (commFormEl && window.AtharDirty) window.AtharDirty.track(commFormEl);

    const close = () => {
      if (window.AtharDirty) {
        window.AtharDirty.guard(() => {
          modal.innerHTML = "";
          window.AtharDirty.clear();
        });
      } else {
        modal.innerHTML = "";
      }
    };

    document.getElementById("comm-modal-close").onclick = close;
    document.getElementById("comm-modal-cancel").onclick = close;
    document.getElementById("comm-modal-backdrop").onclick = (e) => {
      if (e.target.id === "comm-modal-backdrop") close();
    };

    document.getElementById("comm-form").onsubmit = (e) => {
      e.preventDefault();
      if (window.AtharDirty) window.AtharDirty.beginSubmit();

      const nameEn = document.getElementById("comm-name-en").value.trim();
      const nameAr = document.getElementById("comm-name-ar").value.trim();
      const descEn = document.getElementById("comm-desc-en").value;
      const descAr = document.getElementById("comm-desc-ar").value;
      const mgrId = document.getElementById("comm-mgr-select").value || null;
      const mgrUser = state.users.find(u => u.id === mgrId);

      if (!nameEn || !nameAr) {
        showToast("Both English and Arabic committee names are required (CM-02)", "error");
        return;
      }

      if (isEdit) {
        const oldVal = { ...existing };
        existing.name_en = nameEn;
        existing.name_ar = nameAr;
        existing.description_en = descEn;
        existing.description_ar = descAr;
        existing.manager_id = mgrId;
        existing.manager_name = mgrUser ? mgrUser.full_name : null;

        window.AtharStore.save();
        window.AtharStore.logAudit(App.currentUser, "update", "committee", existing.id, `Updated committee: ${nameEn}`, oldVal, existing);
        showToast(t("updated_successfully"), "success");
      } else {
        const newComm = {
          id: "comm-" + String(state.committees.length + 1).padStart(2, '0'),
          name_en: nameEn,
          name_ar: nameAr,
          description_en: descEn,
          description_ar: descAr,
          manager_id: mgrId,
          manager_name: mgrUser ? mgrUser.full_name : null,
          status: "active",
          created_at: new Date().toISOString().substring(0, 10)
        };
        state.committees.push(newComm);
        window.AtharStore.save();
        window.AtharStore.logAudit(App.currentUser, "create", "committee", newComm.id, `Created committee: ${nameEn}`, null, newComm);
        showToast(t("saved_successfully"), "success");
      }

      modal.innerHTML = "";
      if (window.AtharDirty) window.AtharDirty.clear();
      window.AtharCore.renderCurrentView();
    };
  }

  // =========================================================================
  // 6. Permissions Editor Modal
  // =========================================================================
  function openPermissionsEditor(userId) {
    const state = window.AtharStore.getState();
    const user = state.users.find(u => u.id === userId);
    if (!user) return;

    const modules = [
      "dashboard", "volunteers", "committees", "meetings", "attendance",
      "evaluations", "evaluation_criteria", "volunteer_hours", "certificates",
      "reports", "whatsapp_templates", "users", "audit_logs", "settings"
    ];

    const modal = document.getElementById("modal-container");
    modal.innerHTML = `
      <div class="overlay-backdrop" id="perm-modal-backdrop">
        <div class="modal-dialog modal-lg">
          <div class="modal-header">
            <h3 class="modal-title">${ic("shield", 18)} ${t("permissions_matrix")}: ${user.full_name}</h3>
            <button class="btn-icon" id="perm-modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 16px; background:var(--neutral-100); border-radius:var(--radius-md); margin-bottom:16px;">
              <span style="font-weight:600; font-size:13px;">${t("preset_bundles")}:</span>
              <div style="display:flex; gap:8px;">
                <button class="btn btn-secondary btn-sm perm-preset-btn" data-preset="coordinator">${t("preset_coordinator")}</button>
                <button class="btn btn-secondary btn-sm perm-preset-btn" data-preset="attendance">${t("preset_attendance")}</button>
                <button class="btn btn-secondary btn-sm perm-preset-btn" data-preset="hours_approver">${t("preset_hours_approver")}</button>
                <button class="btn btn-secondary btn-sm perm-preset-btn" data-preset="full_trusted">${t("preset_full_trusted")}</button>
              </div>
            </div>
            <div class="table-container">
              <table class="data-table permission-grid-table">
                <thead>
                  <tr>
                    <th>Module</th>
                    <th>View</th>
                    <th>Create</th>
                    <th>Edit</th>
                    <th>Delete</th>
                    <th>Approve</th>
                  </tr>
                </thead>
                <tbody id="perm-matrix-tbody">
                  ${modules.map(mod => {
                    const row = state.permissions.find(p => p.user_id === user.id && p.module === mod) || {};
                    const isUsersMod = mod === "users";
                    const isCriteriaSensitive = mod === "evaluation_criteria";
                    const isCertSensitive = mod === "certificates";
                    const isSettingsSensitive = mod === "settings";
                    return `
                      <tr data-mod="${mod}">
                        <td><code>${mod}</code></td>
                        <td><input type="checkbox" class="perm-checkbox perm-view" ${row.can_view ? 'checked' : ''} ${isUsersMod ? 'disabled' : ''}></td>
                        <td><input type="checkbox" class="perm-checkbox perm-create" ${row.can_create ? 'checked' : ''} ${isUsersMod || isCriteriaSensitive ? 'disabled title="Super Admin Only"' : ''}></td>
                        <td><input type="checkbox" class="perm-checkbox perm-edit" ${row.can_edit ? 'checked' : ''} ${isUsersMod || isCriteriaSensitive || isSettingsSensitive ? 'disabled title="Super Admin Only"' : ''}></td>
                        <td><input type="checkbox" class="perm-checkbox perm-delete" ${row.can_delete ? 'checked' : ''} ${isUsersMod || isCriteriaSensitive ? 'disabled title="Super Admin Only"' : ''}></td>
                        <td><input type="checkbox" class="perm-checkbox perm-approve" ${row.can_approve ? 'checked' : ''} ${isCertSensitive || isUsersMod ? 'disabled title="Super Admin Only"' : ''}></td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="perm-modal-cancel">${t("cancel")}</button>
            <button class="btn btn-primary" id="perm-modal-save">${t("save")}</button>
          </div>
        </div>
      </div>
    `;

    const permBody = document.querySelector("#perm-matrix-tbody");
    if (permBody && window.AtharDirty) window.AtharDirty.track(permBody);

    const close = () => {
      if (window.AtharDirty) {
        window.AtharDirty.guard(() => {
          modal.innerHTML = "";
          window.AtharDirty.clear();
        });
      } else {
        modal.innerHTML = "";
      }
    };

    document.getElementById("perm-modal-close").onclick = close;
    document.getElementById("perm-modal-cancel").onclick = close;
    document.getElementById("perm-modal-backdrop").onclick = (e) => {
      if (e.target.id === "perm-modal-backdrop") close();
    };

    modal.querySelectorAll(".perm-preset-btn").forEach(btn => {
      btn.onclick = () => {
        const preset = btn.getAttribute("data-preset");
        applyPresetToGrid(preset);
        // Flag dirty after programmatic change
        const firstCb = permBody.querySelector(".perm-view");
        if (firstCb) firstCb.dispatchEvent(new Event("change", { bubbles: true }));
        showToast(`Applied preset: ${preset}`);
      };
    });

    function applyPresetToGrid(preset) {
      modal.querySelectorAll("#perm-matrix-tbody tr").forEach(tr => {
        const mod = tr.getAttribute("data-mod");
        const cbView = tr.querySelector(".perm-view");
        const cbCreate = tr.querySelector(".perm-create");
        const cbEdit = tr.querySelector(".perm-edit");
        const cbDelete = tr.querySelector(".perm-delete");
        const cbApprove = tr.querySelector(".perm-approve");

        if (preset === "coordinator") {
          cbView.checked = ["dashboard", "volunteers", "committees", "meetings", "attendance", "evaluations", "volunteer_hours", "certificates", "reports"].includes(mod);
          if (!cbCreate.disabled) cbCreate.checked = ["volunteers", "meetings", "attendance", "evaluations", "volunteer_hours"].includes(mod);
          if (!cbEdit.disabled) cbEdit.checked = ["volunteers", "committees", "meetings", "attendance", "evaluations", "volunteer_hours"].includes(mod);
          if (!cbDelete.disabled) cbDelete.checked = false;
          if (!cbApprove.disabled) cbApprove.checked = false;
        } else if (preset === "attendance") {
          cbView.checked = ["dashboard", "meetings", "attendance"].includes(mod);
          if (!cbCreate.disabled) cbCreate.checked = ["meetings", "attendance"].includes(mod);
          if (!cbEdit.disabled) cbEdit.checked = ["meetings", "attendance"].includes(mod);
          if (!cbDelete.disabled) cbDelete.checked = false;
          if (!cbApprove.disabled) cbApprove.checked = false;
        } else if (preset === "hours_approver") {
          cbView.checked = ["dashboard", "volunteers", "volunteer_hours", "reports"].includes(mod);
          if (!cbCreate.disabled) cbCreate.checked = ["volunteer_hours"].includes(mod);
          if (!cbEdit.disabled) cbEdit.checked = ["volunteer_hours"].includes(mod);
          if (!cbDelete.disabled) cbDelete.checked = false;
          if (!cbApprove.disabled) cbApprove.checked = ["volunteer_hours"].includes(mod);
        } else if (preset === "full_trusted") {
          cbView.checked = mod !== "users";
          if (!cbCreate.disabled) cbCreate.checked = true;
          if (!cbEdit.disabled) cbEdit.checked = true;
          if (!cbDelete.disabled) cbDelete.checked = false;
          if (!cbApprove.disabled) cbApprove.checked = ["volunteer_hours"].includes(mod);
        }
      });
    }

    document.getElementById("perm-modal-save").onclick = () => {
      if (window.AtharDirty) window.AtharDirty.beginSubmit();
      const rows = modal.querySelectorAll("#perm-matrix-tbody tr");
      const newPerms = [];

      rows.forEach(tr => {
        const mod = tr.getAttribute("data-mod");
        newPerms.push({
          id: window.AtharStore.generateUUID(),
          user_id: user.id,
          module: mod,
          can_view: tr.querySelector(".perm-view").checked,
          can_create: !tr.querySelector(".perm-create").disabled && tr.querySelector(".perm-create").checked,
          can_edit: !tr.querySelector(".perm-edit").disabled && tr.querySelector(".perm-edit").checked,
          can_delete: !tr.querySelector(".perm-delete").disabled && tr.querySelector(".perm-delete").checked,
          can_approve: !tr.querySelector(".perm-approve").disabled && tr.querySelector(".perm-approve").checked
        });
      });

      state.permissions = state.permissions.filter(p => p.user_id !== user.id).concat(newPerms);
      window.AtharStore.save();
      window.AtharStore.logAudit(App.currentUser, "permission_change", "user", user.id, `Updated permissions grid for ${user.full_name}`, null, { modules: modules.length });

      showToast(t("saved_successfully"), "success");
      modal.innerHTML = "";
      if (window.AtharDirty) window.AtharDirty.clear();
      window.AtharCore.renderCurrentView();
    };
  }

  // =========================================================================
  // 7. Diff Viewer Modal
  // =========================================================================
  function openDiffModal(logId) {
    const state = window.AtharStore.getState();
    const log = state.audit_logs.find(l => l.id === logId);
    if (!log) return;

    const diffHtml = window.DiffViewer.renderDiff(log.old_value, log.new_value);
    const modal = document.getElementById("modal-container");
    modal.innerHTML = `
      <div class="overlay-backdrop" id="diff-modal-backdrop">
        <div class="modal-dialog modal-lg">
          <div class="modal-header">
            <h3 class="modal-title">${ic("eye", 18)} ${t("audit_diff_modal")}</h3>
            <button class="btn-icon" id="diff-modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <div style="margin-bottom:16px; padding:12px; background:var(--neutral-100); border-radius:var(--radius-md); font-size:13px;">
              <div><strong>Action:</strong> <span class="badge badge-primary">${log.action}</span> &bull; <strong>Entity:</strong> <code>${log.entity}</code></div>
              <div style="margin-top:4px;"><strong>Details:</strong> ${log.details}</div>
              <div style="margin-top:4px; color:var(--neutral-500); font-size:11px;" class="num-ltr">${log.created_at} by ${log.user_name}</div>
            </div>
            ${diffHtml}
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="diff-modal-cancel">${t("close")}</button>
          </div>
        </div>
      </div>
    `;

    const close = () => { modal.innerHTML = ""; };
    document.getElementById("diff-modal-close").onclick = close;
    document.getElementById("diff-modal-cancel").onclick = close;
    document.getElementById("diff-modal-backdrop").onclick = (e) => {
      if (e.target.id === "diff-modal-backdrop") close();
    };
  }

  // =========================================================================
  // 8. Role Simulator Modal
  // =========================================================================
  function openRoleSimulatorModal() {
    const state = window.AtharStore.getState();
    const modal = document.getElementById("modal-container");
    modal.innerHTML = `
      <div class="overlay-backdrop" id="role-modal-backdrop">
        <div class="modal-dialog">
          <div class="modal-header">
            <h3 class="modal-title">${ic("users", 18)} ${t("switch_user")}</h3>
            <button class="btn-icon" id="role-modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <p style="font-size:13px; color:var(--neutral-600); margin-bottom:16px;">
              Instantly test and verify permission gating (RBAC) by switching accounts:
            </p>
            <div style="display:flex; flex-direction:column; gap:10px;">
              ${state.users.map(u => `
                <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 16px; background:${u.id === App.currentUser.id ? 'var(--primary-light)' : 'var(--neutral-50)'}; border:1px solid ${u.id === App.currentUser.id ? 'var(--primary-border)' : 'var(--neutral-300)'}; border-radius:var(--radius-md); cursor:pointer;" onclick="window.AtharApp.switchUser('${u.id}')">
                  <div style="display:flex; align-items:center; gap:12px;">
                    <div class="user-avatar" style="width:36px; height:36px;">${u.full_name.charAt(0)}</div>
                    <div>
                      <div style="font-weight:700; color:var(--neutral-900); font-size:14px;">${u.full_name}</div>
                      <div style="font-size:11px; color:var(--neutral-500);">${u.email} &bull; ${u.preset ? u.preset.toUpperCase() : u.role}</div>
                    </div>
                  </div>
                  <div>
                    ${u.id === App.currentUser.id ? `<span class="badge badge-primary">Active Now</span>` : `<button class="btn btn-secondary btn-sm">Switch ➔</button>`}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    const close = () => { modal.innerHTML = ""; };
    document.getElementById("role-modal-close").onclick = close;
    document.getElementById("role-modal-backdrop").onclick = (e) => {
      if (e.target.id === "role-modal-backdrop") close();
    };
  }

  // =========================================================================
  // 9. Revoke Certificate Modal
  // =========================================================================
  function openRevokeCertModal(certId) {
    const state = window.AtharStore.getState();
    const cert = state.certificates.find(c => c.id === certId);
    if (!cert) return;

    const modal = document.getElementById("modal-container");
    modal.innerHTML = `
      <div class="overlay-backdrop" id="revoke-modal-backdrop">
        <div class="modal-dialog">
          <div class="modal-header">
            <h3 class="modal-title" style="color:var(--danger);">${ic("alert", 18)} ${t("revoke_certificate")}</h3>
            <button class="btn-icon" id="revoke-modal-close">&times;</button>
          </div>
          <form id="revoke-form">
            <div class="modal-body" style="display:flex; flex-direction:column; gap:16px;">
              <div>
                <strong>Certificate:</strong> <code>${cert.certificate_no}</code>
              </div>
              <div class="form-field">
                <label class="field-label">${t("revocation_reason")} <span class="required-asterisk">*</span></label>
                <textarea id="revoke-reason-input" class="form-control" rows="3" placeholder="${t("revoke_prompt")}" required></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" id="revoke-modal-cancel">${t("cancel")}</button>
              <button type="submit" class="btn btn-danger">${t("revoke_certificate")}</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const revokeFormEl = document.getElementById("revoke-form");
    if (revokeFormEl && window.AtharDirty) window.AtharDirty.track(revokeFormEl);

    const close = () => {
      if (window.AtharDirty) {
        window.AtharDirty.guard(() => {
          modal.innerHTML = "";
          window.AtharDirty.clear();
        });
      } else {
        modal.innerHTML = "";
      }
    };

    document.getElementById("revoke-modal-close").onclick = close;
    document.getElementById("revoke-modal-cancel").onclick = close;
    document.getElementById("revoke-modal-backdrop").onclick = (e) => {
      if (e.target.id === "revoke-modal-backdrop") close();
    };

    document.getElementById("revoke-form").onsubmit = (e) => {
      e.preventDefault();
      if (window.AtharDirty) window.AtharDirty.beginSubmit();

      const reason = document.getElementById("revoke-reason-input").value.trim();
      if (!reason) return;

      cert.status = "revoked";
      cert.revoked_reason = reason;
      window.AtharStore.save();
      window.AtharStore.logAudit(App.currentUser, "revoke", "certificate", cert.id, `Revoked certificate ${cert.certificate_no}. Reason: ${reason}`, { status: "issued" }, { status: "revoked", reason });

      showToast(t("cert_revoked_successfully"), "warning");
      modal.innerHTML = "";
      if (window.AtharDirty) window.AtharDirty.clear();
      window.AtharCore.renderCurrentView();
    };
  }

  // =========================================================================
  // 10. User Menu Modal
  // =========================================================================
  function openUserMenuModal() {
    const modal = document.getElementById("modal-container");
    if (!modal) return;
    const isSuper = App.currentUser && App.currentUser.role === "super_admin";

    modal.innerHTML = `
      <div class="overlay-backdrop" id="user-menu-backdrop">
        <div class="modal-dialog" style="max-width: 420px;">
          <div class="modal-header">
            <h3 class="modal-title">${t("profile")}</h3>
            <button class="btn-icon" id="user-menu-close">&times;</button>
          </div>
          <div class="modal-body">
            <div style="display:flex; align-items:center; gap:14px; padding:12px; background:var(--neutral-50); border-radius:var(--radius-md); margin-bottom:16px;">
              <div class="user-avatar" style="width:44px; height:44px; font-size:16px;">${App.currentUser.full_name.charAt(0)}</div>
              <div style="flex:1;">
                <div style="font-weight:700; color:var(--neutral-900);">${App.currentUser.full_name}</div>
                <div style="font-size:12px; color:var(--neutral-500);">${App.currentUser.email}</div>
                <div style="font-size:11px; color:var(--neutral-500); margin-top:2px;">
                  ${isSuper ? t("super_admin") : t("trusted_admin")}
                </div>
              </div>
            </div>
            <div style="margin-bottom:16px; padding:8px 12px; background:var(--success-light); border:1px solid var(--success-border); border-radius:var(--radius-md); font-size:11px; color:var(--success); display:flex; align-items:center; gap:6px;">
              ${ic("lock", 12)}
              <span>Sensitive fields encrypted at rest (AES-256-GCM)</span>
            </div>
            <div style="display:flex; flex-direction:column; gap:8px;">
              <button class="btn btn-secondary" id="user-menu-switch" style="justify-content:flex-start;">
                ${ic("users", 15)} ${t("switch_user")}
              </button>
              <button class="btn btn-danger-outline" id="user-menu-logout" style="justify-content:flex-start;">
                ${ic("logout", 15)} ${t("logout")}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    const close = () => { modal.innerHTML = ""; };
    document.getElementById("user-menu-close").onclick = close;
    document.getElementById("user-menu-backdrop").onclick = (e) => {
      if (e.target.id === "user-menu-backdrop") close();
    };
    document.getElementById("user-menu-switch").onclick = () => {
      close();
      openRoleSimulatorModal();
    };
    document.getElementById("user-menu-logout").onclick = () => {
      close();
      if (window.AtharAuth) window.AtharAuth.logout();
    };
  }

  // =========================================================================
  // 11. WhatsApp Template Editor Modal
  // =========================================================================
  function openEditWhatsAppTemplate(templateId) {
    const state = window.AtharStore.getState();
    const existing = templateId ? state.whatsapp_templates.find(x => x.id === templateId) : null;
    const isEdit = !!existing;
    const isSuper = App.currentUser.role === "super_admin";

    if (!isEdit && !isSuper) {
      showToast(t("permission_denied"), "error");
      return;
    }

    const draft = isEdit
      ? { name: existing.name, language: existing.language, body: existing.body, is_active: existing.is_active }
      : { name: "", language: App.currentLang === "ar" ? "ar" : "en", body: "", is_active: true };

    const modal = document.getElementById("modal-container");
    modal.innerHTML = `
      <div class="overlay-backdrop" id="wa-modal-backdrop">
        <div class="modal-dialog modal-xl">
          <div class="modal-header">
            <h3 class="modal-title">
              ${ic("message_circle", 18)} ${isEdit ? t("edit") : t("add_template")}
              ${isEdit ? `<span class="badge badge-neutral num-ltr" style="margin-inline-start:8px;">${draft.language.toUpperCase()}</span>` : ''}
            </h3>
            <button class="btn-icon" id="wa-modal-close">&times;</button>
          </div>
          <div class="modal-body" style="overflow-y:auto;">
            <div class="wa-editor-grid">
              <div style="display:flex; flex-direction:column; gap:16px;">
                <div class="form-field">
                  <label class="field-label">${t("template_name")} <span class="required-asterisk">*</span></label>
                  <input type="text" id="wa-name-input" class="form-control" value="${escapeHtml(draft.name)}" placeholder="e.g. Meeting Invitation">
                  <span class="field-hint">Use a descriptive name like "Meeting Invitation (AR)".</span>
                </div>
                <div class="form-grid">
                  <div class="form-field">
                    <label class="field-label">${t("template_language")}</label>
                    <select id="wa-lang-select" class="form-control">
                      <option value="ar" ${draft.language === "ar" ? "selected" : ""}>العربية (AR)</option>
                      <option value="en" ${draft.language === "en" ? "selected" : ""}>English (EN)</option>
                    </select>
                  </div>
                  <div class="form-field">
                    <label class="field-label">Status</label>
                    <div style="margin-top:6px;">
                      <label class="wa-active-toggle ${draft.is_active ? 'on' : ''}" id="wa-active-toggle">
                        <span class="wa-dot"></span>
                        <span id="wa-active-label">${draft.is_active ? 'Active' : 'Inactive'}</span>
                        <input type="checkbox" id="wa-active-input" ${draft.is_active ? "checked" : ""} style="display:none;">
                      </label>
                    </div>
                  </div>
                </div>
                <div class="form-field">
                  <label class="field-label">
                    ${t("template_body")} <span class="required-asterisk">*</span>
                    <span class="field-hint" style="font-weight:400;" id="wa-char-counter">0 chars</span>
                  </label>
                  <textarea id="wa-body-input" class="form-control" rows="8" style="font-family:var(--font-ar); font-size:14px; line-height:1.7;" placeholder="${draft.language === 'ar' ? 'مرحباً {name}، ...' : 'Hello {name}, ...'}">${escapeHtml(draft.body)}</textarea>
                  <span class="field-hint">Click a token below to insert it at the cursor position.</span>
                  <div class="wa-placeholder-chips" id="wa-placeholder-chips">
                    ${WA_PLACEHOLDERS.map(p => `
                      <span class="wa-placeholder-chip" data-token="${p.token}" title="${App.currentLang === 'ar' ? p.desc_ar : p.desc_en}">
                        ${p.token}
                      </span>
                    `).join('')}
                  </div>
                </div>
              </div>

              <div style="display:flex; flex-direction:column; gap:12px;">
                <div class="wa-template-label">
                  <span>${t("template_preview") || "Live Preview"}</span>
                </div>
                <div class="wa-bubble-preview" id="wa-preview-container" dir="${draft.language === 'ar' ? 'rtl' : 'ltr'}">
                  <div class="wa-bubble" id="wa-preview-bubble">
                    <span class="wa-bubble-time">
                      10:42 <span class="wa-check">&#10003;&#10003;</span>
                    </span>
                  </div>
                </div>
                <div style="padding:12px; background:var(--neutral-50); border:1px solid var(--neutral-300); border-radius:var(--radius-md); font-size:12px;">
                  <div style="font-weight:700; margin-bottom:6px;">Sample values used in preview:</div>
                  <div style="display:grid; grid-template-columns:auto 1fr; gap:4px 10px; font-family:var(--font-mono); font-size:11px; color:var(--neutral-600);">
                    ${WA_PLACEHOLDERS.map(p => `
                      <span style="color:var(--primary);">${p.token}</span>
                      <span>→ ${(WA_SAMPLE_VALUES[draft.language] || WA_SAMPLE_VALUES.en)[p.token.replace(/[{}]/g, "")] || ""}</span>
                    `).join('')}
                  </div>
                </div>
                ${isEdit ? `
                  <div style="font-size:11px; color:var(--neutral-500); padding:8px 10px; background:var(--neutral-50); border-radius:var(--radius-md);">
                    Created: ${existing.id ? 'seed' : '—'} &bull; ID: <code>${existing.id}</code>
                  </div>
                ` : ""}
              </div>
            </div>
          </div>
          <div class="modal-footer" style="justify-content:space-between;">
            <div>
              ${isEdit && isSuper ? `
                <button class="btn btn-danger-outline" id="wa-delete-btn">${ic("trash", 14)} ${t("delete")}</button>
              ` : ""}
            </div>
            <div style="display:flex; gap:10px;">
              <button class="btn btn-secondary" id="wa-cancel-btn">${t("cancel")}</button>
              <button class="btn btn-primary" id="wa-save-btn">${t("save")}</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Track dirty state
    const waEditorRoot = document.querySelector(".wa-editor-grid");
    if (waEditorRoot && window.AtharDirty) window.AtharDirty.track(waEditorRoot);

    const close = () => {
      if (window.AtharDirty) {
        window.AtharDirty.guard(() => {
          modal.innerHTML = "";
          window.AtharDirty.clear();
        });
      } else {
        modal.innerHTML = "";
      }
    };

    document.getElementById("wa-modal-close").onclick = close;
    document.getElementById("wa-cancel-btn").onclick = close;
    document.getElementById("wa-modal-backdrop").onclick = (e) => {
      if (e.target.id === "wa-modal-backdrop") close();
    };

    const nameInput = document.getElementById("wa-name-input");
    const langSelect = document.getElementById("wa-lang-select");
    const bodyInput = document.getElementById("wa-body-input");
    const activeToggle = document.getElementById("wa-active-toggle");
    const activeInput = document.getElementById("wa-active-input");
    const activeLabel = document.getElementById("wa-active-label");
    const previewBubble = document.getElementById("wa-preview-bubble");
    const previewContainer = document.getElementById("wa-preview-container");
    const charCounter = document.getElementById("wa-char-counter");

    function updatePreview() {
      const body = bodyInput.value || (langSelect.value === "ar"
        ? "اكتب نص القالب هنا لرؤية المعاينة الحية..."
        : "Type the template body here to see the live preview…");
      const lang = langSelect.value;
      const html = escapeHtml(buildSamplePreview(body, lang)).replace(/\n/g, "<br>");
      previewBubble.innerHTML = html + `
        <span class="wa-bubble-time">10:42 <span class="wa-check">&#10003;&#10003;</span></span>
      `;
      previewContainer.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
      previewBubble.style.fontFamily = lang === "ar" ? "var(--font-ar)" : "var(--font-en)";
      charCounter.textContent = `${bodyInput.value.length} chars`;
    }

    nameInput.oninput = () => { draft.name = nameInput.value; };
    bodyInput.oninput = () => { draft.body = bodyInput.value; updatePreview(); };
    langSelect.onchange = () => {
      draft.language = langSelect.value;
      bodyInput.placeholder = draft.language === "ar" ? "مرحباً {name}، ..." : "Hello {name}, ...";
      bodyInput.style.fontFamily = draft.language === "ar" ? "var(--font-ar)" : "var(--font-en)";
      updatePreview();
    };

    activeToggle.onclick = () => {
      activeInput.checked = !activeInput.checked;
      draft.is_active = activeInput.checked;
      activeToggle.classList.toggle("on", draft.is_active);
      activeLabel.textContent = draft.is_active ? "Active" : "Inactive";
    };

    modal.querySelectorAll(".wa-placeholder-chip").forEach(chip => {
      chip.onclick = () => {
        const token = chip.getAttribute("data-token");
        const start = bodyInput.selectionStart || 0;
        const end = bodyInput.selectionEnd || 0;
        const val = bodyInput.value;
        const newVal = val.substring(0, start) + token + val.substring(end);
        bodyInput.value = newVal;
        bodyInput.focus();
        const newPos = start + token.length;
        bodyInput.setSelectionRange(newPos, newPos);
        draft.body = newVal;
        updatePreview();
      };
    });

    document.getElementById("wa-save-btn").onclick = () => {
      if (window.AtharDirty) window.AtharDirty.beginSubmit();
      const name = nameInput.value.trim();
      const lang = langSelect.value;
      const body = bodyInput.value.trim();

      if (!name) { showToast("Template name is required.", "error"); nameInput.focus(); return; }
      if (!body) { showToast("Template body cannot be empty.", "error"); bodyInput.focus(); return; }
      if (body.length > 1000) { showToast("Template body is too long (max 1000 chars).", "error"); return; }

      const clash = state.whatsapp_templates.find(x =>
        x.name.toLowerCase() === name.toLowerCase()
        && x.language === lang
        && (!isEdit || x.id !== existing.id)
      );
      if (clash) {
        showToast(`A template named "${name}" already exists in ${lang.toUpperCase()}.`, "error");
        return;
      }

      if (isEdit) {
        const oldVal = { name: existing.name, language: existing.language, body: existing.body, is_active: existing.is_active };
        existing.name = name;
        existing.language = lang;
        existing.body = body;
        existing.is_active = draft.is_active;
        existing.updated_at = new Date().toISOString();
        window.AtharStore.save();
        window.AtharStore.logAudit(App.currentUser, "update", "whatsapp_template", existing.id,
          `Updated WhatsApp template: ${name} (${lang.toUpperCase()})`, oldVal, { name, language: lang, body, is_active: draft.is_active });
        showToast(t("updated_successfully"), "success");
      } else {
        const newTmpl = {
          id: "wa-tmpl-" + window.AtharStore.generateUUID().substring(0, 8),
          name: name,
          language: lang,
          body: body,
          is_active: draft.is_active,
          updated_by: App.currentUser.id,
          updated_at: new Date().toISOString()
        };
        state.whatsapp_templates.push(newTmpl);
        window.AtharStore.save();
        window.AtharStore.logAudit(App.currentUser, "create", "whatsapp_template", newTmpl.id,
          `Created WhatsApp template: ${name} (${lang.toUpperCase()})`, null, newTmpl);
        showToast(t("saved_successfully"), "success");
      }

      modal.innerHTML = "";
      if (window.AtharDirty) window.AtharDirty.clear();
      window.AtharCore.renderCurrentView();
    };

    const delBtn = document.getElementById("wa-delete-btn");
    if (delBtn) {
      delBtn.onclick = () => {
        showConfirmModal({
          title: t("confirm_destructive"),
          message: `Delete template "${existing.name}" permanently? This cannot be undone.`,
          confirmText: t("delete"),
          onConfirm: () => {
            state.whatsapp_templates = state.whatsapp_templates.filter(x => x.id !== existing.id);
            window.AtharStore.save();
            window.AtharStore.logAudit(App.currentUser, "delete", "whatsapp_template", existing.id,
              `Deleted WhatsApp template: ${existing.name} (${existing.language.toUpperCase()})`, { name: existing.name, language: existing.language, body: existing.body }, null);
            showToast("Template deleted.", "warning");
            modal.innerHTML = "";
            if (window.AtharDirty) window.AtharDirty.clear();
            window.AtharCore.renderCurrentView();
          }
        });
      };
    }

    updatePreview();
    setTimeout(() => nameInput.focus(), 100);
  }

  // =========================================================================
  // 12. Duplicate WhatsApp Template
  // =========================================================================
  function duplicateWhatsAppTemplate(templateId) {
    const state = window.AtharStore.getState();
    const src = state.whatsapp_templates.find(x => x.id === templateId);
    if (!src) return;

    if (App.currentUser.role !== "super_admin" && !hasPermission("whatsapp_templates", "create")) {
      showToast(t("permission_denied"), "error");
      return;
    }

    const newLang = src.language === "ar" ? "en" : "ar";
    const baseName = src.name.replace(/\s*\(?(AR|EN)\)?/i, "").trim();
    let suggestedName = `${baseName} (${newLang.toUpperCase()})`;
    let i = 1;
    while (state.whatsapp_templates.some(x => x.name === suggestedName && x.language === newLang)) {
      suggestedName = `${baseName} (${newLang.toUpperCase()}) ${++i}`;
    }

    const copy = {
      id: "wa-tmpl-" + window.AtharStore.generateUUID().substring(0, 8),
      name: suggestedName,
      language: newLang,
      body: src.body,
      is_active: false,
      updated_by: App.currentUser.id,
      updated_at: new Date().toISOString()
    };

    state.whatsapp_templates.push(copy);
    window.AtharStore.save();
    window.AtharStore.logAudit(App.currentUser, "create", "whatsapp_template", copy.id,
      `Duplicated template "${src.name}" as "${copy.name}"`, null, copy);
    showToast(`Duplicated as "${copy.name}". Opening editor…`, "success");
    window.AtharCore.renderCurrentView();
    setTimeout(() => openEditWhatsAppTemplate(copy.id), 150);
  }

  // =========================================================================
  // 13. Delete WhatsApp Template
  // =========================================================================
  function deleteWhatsAppTemplate(templateId) {
    const state = window.AtharStore.getState();
    const tmpl = state.whatsapp_templates.find(x => x.id === templateId);
    if (!tmpl) return;

    showConfirmModal({
      title: t("confirm_destructive"),
      message: `Delete template "${tmpl.name}" (${tmpl.language.toUpperCase()})? This cannot be undone.`,
      confirmText: t("delete"),
      onConfirm: () => {
        state.whatsapp_templates = state.whatsapp_templates.filter(x => x.id !== templateId);
        window.AtharStore.save();
        window.AtharStore.logAudit(App.currentUser, "delete", "whatsapp_template", templateId,
          `Deleted WhatsApp template: ${tmpl.name} (${tmpl.language.toUpperCase()})`, { name: tmpl.name, language: tmpl.language, body: tmpl.body }, null);
        showToast("Template deleted.", "warning");
        window.AtharCore.renderCurrentView();
      }
    });
  }

  // =========================================================================
  // Public API
  // =========================================================================
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
    WA_SAMPLE_VALUES
  };
})();
