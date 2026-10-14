/**
 * View: Meetings (list + detail + attendance)
 */
(function () {
  "use strict";

  const { App, t, formatDate, ic, showToast, hasPermission, navigateTo } = window.AtharCore;

  // =========================================================================
  // Meetings List
  // =========================================================================
  function renderMeetingsList(container) {
    const state = window.AtharStore.getState();
    const canCreate = hasPermission("meetings", "create");

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <div class="breadcrumb-trail">
            <span class="breadcrumb-item" onclick="window.AtharApp.navigateTo('dashboard')">${t("app_name")}</span>
            <span class="breadcrumb-separator">/</span>
            <span>${t("nav_meetings")}</span>
          </div>
          <h1 class="view-title">${t("meetings_title")}</h1>
          <p class="view-subtitle">Track agendas, schedules, and official attendee rosters</p>
        </div>
        <div class="view-header-actions">
          ${canCreate ? `<button class="btn btn-primary" id="btn-add-meeting">${ic("plus", 14)} ${t("add_meeting")}</button>` : ''}
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Meeting Title</th>
              <th>Committee</th>
              <th>Time & Location</th>
              <th>Status</th>
              <th>Attendance</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${state.meetings.map(m => {
      const comm = state.committees.find(c => c.id === m.committee_id);
      const summary = m.attendance_summary;
      const presentCount = summary ? (summary.present + summary.late) : 0;
      const totalAttendees = summary ? summary.total : 0;
      return `
                <tr>
                  <td><span style="font-weight:700;">${formatDate(m.meeting_date)}</span></td>
                  <td>
                    <div style="font-weight:700; color:var(--neutral-900);">${App.currentLang === 'ar' ? m.title_ar : m.title_en}</div>
                    <div style="font-size:11px; color:var(--neutral-500);">${m.title_en}</div>
                  </td>
                  <td><span>${comm ? (App.currentLang === 'ar' ? comm.name_ar : comm.name_en) : 'All Committees'}</span></td>
                  <td>
                    <div style="font-size:12px;">${ic("clock", 12)} <span class="num-ltr">${m.start_time} - ${m.end_time || ''}</span></div>
                    <div style="font-size:11px; color:var(--neutral-500);">${m.location || 'Online'}</div>
                  </td>
                  <td>
                    <span class="badge ${m.status === 'completed' ? 'badge-success' : m.status === 'scheduled' ? 'badge-primary' : 'badge-danger'}">
                      ${t(m.status)}
                    </span>
                  </td>
                  <td>
                    ${m.status === 'completed' && summary ? `
                      <span class="badge badge-success num-ltr">${presentCount} / ${totalAttendees}</span>
                    ` : `
                      <span style="color:var(--neutral-400);">Pending session</span>
                    `}
                  </td>
                  <td>
                    <div class="row-actions-cell">
                      <button class="btn btn-primary btn-sm" onclick="window.AtharApp.navigateTo('meeting-detail', {id:'${m.id}'})">
                        ${m.status === 'completed' ? t("view") : 'Take Attendance'}
                      </button>
                    </div>
                  </td>
                </tr>
              `;
    }).join('')}
          </tbody>
        </table>
      </div>
    `;

    const addBtn = document.getElementById("btn-add-meeting");
    if (addBtn) addBtn.onclick = () => window.AtharModals.openCreateMeetingSlideover();
  }

  // =========================================================================
  // Meeting Detail / Attendance Sheet
  // (async — fetches roster from the API before rendering)
  // =========================================================================
  async function renderMeetingDetail(container, meetingId) {
    const state = window.AtharStore.getState();
    const meeting = state.meetings.find(m => m.id === meetingId);
    if (!meeting) {
      container.innerHTML = `<div class="empty-state"><p>Meeting not found</p></div>`;
      return;
    }

    const comm = state.committees.find(c => c.id === meeting.committee_id);

    // ---- Show loading state while we fetch the roster ----
    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <div class="breadcrumb-trail">
            <span class="breadcrumb-item" onclick="window.AtharApp.navigateTo('meetings')">${t("back_to_meetings")}</span>
            <span class="breadcrumb-separator">/</span>
            <span>${App.currentLang === 'ar' ? meeting.title_ar : meeting.title_en}</span>
          </div>
          <h1 class="view-title">${App.currentLang === 'ar' ? meeting.title_ar : meeting.title_en}</h1>
          <p class="view-subtitle">${t("loading")}</p>
        </div>
      </div>
      <div class="card" style="text-align:center; padding:40px;">
        <div class="skeleton-row" style="width:60%; margin:0 auto 12px;"></div>
        <div class="skeleton-row" style="width:80%; margin:0 auto;"></div>
      </div>
    `;

    // ---- Fetch roster from API ----
    let roster = [];
    let isDraft = false;
    try {
      const res = await window.AtharAPI.meetings.getRoster(meetingId);
      roster = res.roster || [];
      isDraft = !!res.isDraft;
    } catch (err) {
      if (err.status === 403) {
        container.innerHTML = `<div class="empty-state"><p>You do not have permission to view this roster.</p></div>`;
      } else {
        showToast(err.message || "Failed to load roster", "error");
        container.innerHTML = `<div class="empty-state"><p>Failed to load roster. <a href="#meetings">Back</a></p></div>`;
      }
      return;
    }

    // ---- Compute counts from the fetched roster ----
    const presentCount = roster.filter(r => r.status === "present").length;
    const lateCount = roster.filter(r => r.status === "late").length;
    const absentCount = roster.filter(r => r.status === "absent").length;
    const excusedCount = roster.filter(r => r.status === "excused").length;

    const isCompleted = meeting.status === "completed";

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <div class="breadcrumb-trail">
            <span class="breadcrumb-item" onclick="window.AtharApp.navigateTo('meetings')">${t("back_to_meetings")}</span>
            <span class="breadcrumb-separator">/</span>
            <span>${App.currentLang === 'ar' ? meeting.title_ar : meeting.title_en}</span>
          </div>
          <h1 class="view-title">${App.currentLang === 'ar' ? meeting.title_ar : meeting.title_en}</h1>
          <p class="view-subtitle">
            ${formatDate(meeting.meeting_date)} &bull; ${meeting.start_time} - ${meeting.end_time || ''} &bull; ${meeting.location || 'Online'}
            ${isDraft && !isCompleted ? '&bull; <span class="badge badge-warning">DRAFT ROSTER</span>' : ''}
            ${isCompleted ? '&bull; <span class="badge badge-success">COMPLETED</span>' : ''}
          </p>
        </div>
        <div class="view-header-actions">
          <button class="btn btn-secondary btn-sm" id="btn-bulk-present">${ic("check", 14)} ${t("mark_all_present")}</button>
          <button class="btn btn-secondary btn-sm" id="btn-bulk-absent">${ic("x", 14)} ${t("mark_all_absent")}</button>
          <button class="btn btn-success" id="btn-save-attendance">${ic("check_circle", 14)} ${t("save")}</button>
        </div>
      </div>

      <div class="profile-stats-grid" style="grid-template-columns: repeat(4, 1fr); margin-bottom: 20px;">
        <div class="stat-box" style="border-inline-start:4px solid var(--success);">
          <span class="stat-box-label">${t("present")}</span>
          <span class="stat-box-value num-ltr" style="color:var(--success);" id="stat-present">${presentCount}</span>
        </div>
        <div class="stat-box" style="border-inline-start:4px solid var(--warning);">
          <span class="stat-box-label">${t("late")}</span>
          <span class="stat-box-value num-ltr" style="color:var(--warning);" id="stat-late">${lateCount}</span>
        </div>
        <div class="stat-box" style="border-inline-start:4px solid var(--danger);">
          <span class="stat-box-label">${t("absent")}</span>
          <span class="stat-box-value num-ltr" style="color:var(--danger);" id="stat-absent">${absentCount}</span>
        </div>
        <div class="stat-box" style="border-inline-start:4px solid var(--info);">
          <span class="stat-box-label">${t("excused")}</span>
          <span class="stat-box-value num-ltr" style="color:var(--info);" id="stat-excused">${excusedCount}</span>
        </div>
      </div>

      <div class="table-container">
        <table class="data-table" id="attendance-roster-table">
          <thead>
            <tr>
              <th>Volunteer</th>
              <th style="width:180px;">Status</th>
              <th>${t("note")}</th>
              <th style="text-align:right;">Quick Actions</th>
            </tr>
          </thead>
          <tbody>
            ${roster.length === 0 ? `
              <tr><td colspan="4" style="text-align:center; padding:24px;">No eligible volunteers for this meeting.</td></tr>
            ` : roster.map(rec => {
      const vol = rec.volunteer || {};
      const tmpl = state.whatsapp_templates.find(x => x.name && x.name.includes("Invitation") && x.language === App.currentLang)
        || state.whatsapp_templates[0];
      let waMessage = tmpl ? tmpl.body : "Meeting invite";
      waMessage = waMessage
        .replace("{name}", vol.fullName || vol.full_name || "")
        .replace("{committee}", comm ? (App.currentLang === 'ar' ? comm.name_ar : comm.name_en) : "Athar")
        .replace("{date}", meeting.meeting_date || "");
      const waNumber = (vol.whatsapp || vol.phone || "").replace(/[^0-9]/g, "");
      const waUrl = waNumber ? `https://wa.me/${waNumber}?text=${encodeURIComponent(waMessage)}` : '#';

      return `
                <tr data-vol-id="${vol.id || rec.volunteerId}">
                  <td>
                    <div style="font-weight:700; color:var(--neutral-900);">
                      ${App.currentLang === 'ar' ? (vol.fullNameAr || vol.full_name_ar || vol.fullName || vol.full_name) : (vol.fullName || vol.full_name)}
                    </div>
                    <div style="font-size:11px; color:var(--neutral-500);">${vol.phone || 'No phone'}</div>
                  </td>
                  <td>
                    <select class="form-control att-status-select" style="font-weight:600;">
                      <option value="present" ${rec.status === 'present' ? 'selected' : ''}>${t("present")}</option>
                      <option value="late" ${rec.status === 'late' ? 'selected' : ''}>${t("late")}</option>
                      <option value="absent" ${rec.status === 'absent' ? 'selected' : ''}>${t("absent")}</option>
                      <option value="excused" ${rec.status === 'excused' ? 'selected' : ''}>${t("excused")}</option>
                    </select>
                  </td>
                  <td><input type="text" class="form-control att-note-input" placeholder="e.g. Traffic / Exam" value="${rec.note || ''}"></td>
                  <td>
                    <div class="row-actions-cell">
                      ${waNumber ? `
                        <a href="${waUrl}" target="_blank" class="btn btn-whatsapp btn-sm" title="${t("whatsapp_tooltip")}">
                          ${ic("whatsapp", 12)} WhatsApp
                        </a>
                      ` : '<span style="color:var(--neutral-400); font-size:11px;">No WhatsApp</span>'}
                    </div>
                  </td>
                </tr>
              `;
    }).join('')}
          </tbody>
        </table>
      </div>
    `;

    // ---- Live count updates when a status changes ----
    function recalcCounts() {
      const rows = container.querySelectorAll("#attendance-roster-table tbody tr");
      let p = 0, l = 0, a = 0, e = 0;
      rows.forEach(r => {
        const sel = r.querySelector(".att-status-select");
        if (!sel) return;
        const v = sel.value;
        if (v === "present") p++;
        else if (v === "late") l++;
        else if (v === "absent") a++;
        else if (v === "excused") e++;
      });
      const setTxt = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
      };
      setTxt("stat-present", p);
      setTxt("stat-late", l);
      setTxt("stat-absent", a);
      setTxt("stat-excused", e);
    }

    container.querySelectorAll(".att-status-select").forEach(sel => {
      sel.addEventListener("change", recalcCounts);
    });

    // ---- Bulk actions ----
    const bulkPresent = document.getElementById("btn-bulk-present");
    if (bulkPresent) bulkPresent.onclick = () => {
      container.querySelectorAll(".att-status-select").forEach(sel => { sel.value = "present"; });
      recalcCounts();
    };

    const bulkAbsent = document.getElementById("btn-bulk-absent");
    if (bulkAbsent) bulkAbsent.onclick = () => {
      container.querySelectorAll(".att-status-select").forEach(sel => { sel.value = "absent"; });
      recalcCounts();
    };

    // =========================================================
    // Save attendance → API
    // =========================================================
    const saveBtn = document.getElementById("btn-save-attendance");
    if (saveBtn) {
      saveBtn.onclick = async () => {
        const rows = container.querySelectorAll("#attendance-roster-table tbody tr");
        const records = [];
        rows.forEach(r => {
          const volId = r.getAttribute("data-vol-id");
          const status = r.querySelector(".att-status-select")?.value;
          const note = r.querySelector(".att-note-input")?.value?.trim();
          if (volId && status) {
            records.push({
              volunteerId: volId,
              status,
              note: note || undefined,
            });
          }
        });

        if (records.length === 0) {
          showToast("No records to save", "warning");
          return;
        }

        saveBtn.disabled = true;
        const originalHtml = saveBtn.innerHTML;
        saveBtn.innerHTML = "Saving…";

        try {
          const res = await window.AtharAPI.meetings.saveRoster(meetingId, records, true);
          await window.AtharStore.refreshMeetings();

          showToast(
            `Saved ${res?.recordCount ?? records.length} attendance records`,
            "success",
          );

          // Re-render to reflect the now-completed state
          renderMeetingDetail(container, meetingId);
        } catch (err) {
          if (err.status === 403) {
            showToast("You don't have permission to record attendance.", "error");
          } else if (err.code === "DUPLICATE_RECORDS") {
            showToast("Duplicate volunteer IDs detected — refresh and try again.", "error");
          } else {
            showToast(err.message || "Failed to save attendance", "error");
          }
          saveBtn.disabled = false;
          saveBtn.innerHTML = originalHtml;
        }
      };
    }
  }

  window.AtharViews.meetings = (c, p) => renderMeetingsList(c);
  window.AtharViews.meetingDetail = (c, p) => renderMeetingDetail(c, p.id);
})();