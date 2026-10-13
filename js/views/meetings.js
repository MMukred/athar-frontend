/**
 * View: Meetings (list + detail + attendance)
 */
(function () {
  "use strict";

  const { App, t, formatDate, ic, showToast, hasPermission, navigateTo } = window.AtharCore;

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
              const mtgAttendance = state.attendance.filter(a => a.meeting_id === m.id);
              const presentCount = mtgAttendance.filter(a => a.status === "present" || a.status === "late").length;
              const totalAttendees = mtgAttendance.length;
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
                    ${m.status === 'completed' ? `
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

  function renderMeetingDetail(container, meetingId) {
    const state = window.AtharStore.getState();
    const meeting = state.meetings.find(m => m.id === meetingId);
    if (!meeting) {
      container.innerHTML = `<div class="empty-state"><p>Meeting not found</p></div>`;
      return;
    }

    const comm = state.committees.find(c => c.id === meeting.committee_id);
    let eligibleVols = state.volunteers.filter(v => v.status !== "archived" && (!meeting.committee_id || v.committee_id === meeting.committee_id));
    let mtgAttendance = state.attendance.filter(a => a.meeting_id === meeting.id);

    if (mtgAttendance.length === 0) {
      eligibleVols.forEach(v => {
        mtgAttendance.push({
          id: window.AtharStore.generateUUID(),
          meeting_id: meeting.id,
          volunteer_id: v.id,
          status: "present",
          note: "",
          recorded_by: App.currentUser.id,
          recorded_at: null
        });
      });
    }

    const presentCount = mtgAttendance.filter(a => a.status === "present").length;
    const lateCount = mtgAttendance.filter(a => a.status === "late").length;
    const absentCount = mtgAttendance.filter(a => a.status === "absent").length;
    const excusedCount = mtgAttendance.filter(a => a.status === "excused").length;

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <div class="breadcrumb-trail">
            <span class="breadcrumb-item" onclick="window.AtharApp.navigateTo('meetings')">${t("back_to_meetings")}</span>
            <span class="breadcrumb-separator">/</span>
            <span>${App.currentLang === 'ar' ? meeting.title_ar : meeting.title_en}</span>
          </div>
          <h1 class="view-title">${App.currentLang === 'ar' ? meeting.title_ar : meeting.title_en}</h1>
          <p class="view-subtitle">${formatDate(meeting.meeting_date)} &bull; ${meeting.start_time} - ${meeting.end_time} &bull; ${meeting.location}</p>
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
          <span class="stat-box-value num-ltr" style="color:var(--success);">${presentCount}</span>
        </div>
        <div class="stat-box" style="border-inline-start:4px solid var(--warning);">
          <span class="stat-box-label">${t("late")}</span>
          <span class="stat-box-value num-ltr" style="color:var(--warning);">${lateCount}</span>
        </div>
        <div class="stat-box" style="border-inline-start:4px solid var(--danger);">
          <span class="stat-box-label">${t("absent")}</span>
          <span class="stat-box-value num-ltr" style="color:var(--danger);">${absentCount}</span>
        </div>
        <div class="stat-box" style="border-inline-start:4px solid var(--info);">
          <span class="stat-box-label">${t("excused")}</span>
          <span class="stat-box-value num-ltr" style="color:var(--info);">${excusedCount}</span>
        </div>
      </div>

      <div class="table-container">
        <table class="data-table" id="attendance-roster-table">
          <thead>
            <tr><th>Volunteer</th><th>Status</th><th>${t("note")}</th><th style="text-align:right;">Quick Actions</th></tr>
          </thead>
          <tbody>
            ${mtgAttendance.map(rec => {
              const vol = state.volunteers.find(v => v.id === rec.volunteer_id);
              if (!vol) return '';
              const tmpl = state.whatsapp_templates.find(t => t.name.includes("Invitation") && t.language === App.currentLang) || state.whatsapp_templates[0];
              let waMessage = tmpl ? tmpl.body : "Meeting invite";
              waMessage = waMessage.replace("{name}", vol.full_name)
                                   .replace("{committee}", comm ? comm.name_ar : "أثر")
                                   .replace("{date}", meeting.meeting_date);
              const waUrl = vol.whatsapp ? `https://wa.me/${vol.whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(waMessage)}` : '#';
              return `
                <tr data-att-id="${rec.id}" data-vol-id="${vol.id}">
                  <td>
                    <div style="font-weight:700; color:var(--neutral-900);">${App.currentLang === 'ar' ? (vol.full_name_ar || vol.full_name) : vol.full_name}</div>
                    <div style="font-size:11px; color:var(--neutral-500);">${vol.phone || 'No phone'}</div>
                  </td>
                  <td style="width:180px;">
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
                      ${vol.whatsapp ? `
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

    document.getElementById("btn-bulk-present").onclick = () => {
      container.querySelectorAll(".att-status-select").forEach(sel => sel.value = "present");
      showToast("All marked as Present");
    };

    document.getElementById("btn-bulk-absent").onclick = () => {
      container.querySelectorAll(".att-status-select").forEach(sel => sel.value = "absent");
      showToast("All marked as Absent");
    };

    document.getElementById("btn-save-attendance").onclick = () => {
      const rows = container.querySelectorAll("#attendance-roster-table tbody tr");
      rows.forEach(r => {
        const volId = r.getAttribute("data-vol-id");
        const status = r.querySelector(".att-status-select").value;
        const note = r.querySelector(".att-note-input").value;
        let existing = state.attendance.find(a => a.meeting_id === meeting.id && a.volunteer_id === volId);
        if (!existing) {
          existing = {
            id: window.AtharStore.generateUUID(),
            meeting_id: meeting.id,
            volunteer_id: volId,
            status: status,
            note: note,
            recorded_by: App.currentUser.id,
            recorded_at: new Date().toISOString()
          };
          state.attendance.push(existing);
        } else {
          existing.status = status;
          existing.note = note;
          existing.recorded_by = App.currentUser.id;
        }
      });

      meeting.status = "completed";
      window.AtharStore.save();
      window.AtharStore.logAudit(App.currentUser, "approve", "meeting", meeting.id, `Recorded attendance for meeting: ${meeting.title_en} (${rows.length} records)`, null, null);

      showToast(t("saved_successfully"), "success");
      renderMeetingDetail(container, meetingId);
    };
  }

  window.AtharViews.meetings = (c, p) => renderMeetingsList(c);
  window.AtharViews.meetingDetail = (c, p) => renderMeetingDetail(c, p.id);
})();
