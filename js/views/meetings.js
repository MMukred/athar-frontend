/**
 * View: Meetings + Events
 * - Visual differentiation (meetings = blue/calendar, events = purple/sparkles)
 * - Cross-link tabs at top
 * - Attendance viewer (click count → modal with names)
 * - "Needs evaluation" indicator on completed events
 * - "Evaluate Attendees" button on completed event detail
 */
(function () {
  "use strict";

  const { App, t, formatDate, ic, showToast, showConfirmModal, hasPermission, navigateTo } = window.AtharCore;

  function confirmDeleteSession(session, onDeleted) {
    const isEvent = (session.kind || "meeting") === "event";
    const label = isEvent ? (App.currentLang === 'ar' ? 'الفعالية' : 'event') : (App.currentLang === 'ar' ? 'الاجتماع' : 'meeting');
    const title = App.currentLang === 'ar' ? `حذف ${label}` : `Delete ${label}`;
    const msg = App.currentLang === 'ar'
      ? `سيتم حذف "${session.title_ar || session.title_en}" نهائياً مع كل سجلات الحضور والساعات المرتبطة. لا يمكن التراجع.`
      : `Permanently delete "${session.title_en}" and all its attendance + auto-logged hours. This cannot be undone.`;

    showConfirmModal({
      title,
      message: msg,
      confirmText: t("delete"),
      isDanger: true,
      onConfirm: async () => {
        try {
          await window.AtharAPI.meetings.delete(session.id);
          await window.AtharStore.refreshMeetings();
          showToast(App.currentLang === 'ar' ? 'تم الحذف بنجاح' : 'Deleted successfully', 'warning');
          if (onDeleted) onDeleted();
        } catch (err) {
          showToast(err.message || "Delete failed", "error");
        }
      },
    });
  }

  // =========================================================================
  // Helper: does this event still need evaluations?
  // =========================================================================
  function attendeesNeedingEval(meetingId) {
    const state = window.AtharStore.getState();
    const now = new Date();
    const period = `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`;

    const attendance = state.attendance.filter(a =>
      a.meeting_id === meetingId && (a.status === "present" || a.status === "late")
    );
    const attendeeIds = new Set(attendance.map(a => a.volunteer_id));

    const evaluated = new Set(
      state.evaluations
        .filter(e => e.period_label === period)
        .map(e => e.volunteer_id)
    );

    return {
      period,
      total: attendeeIds.size,
      pending: Array.from(attendeeIds).filter(id => !evaluated.has(id)),
    };
  }

  // =========================================================================
  // Session list — shared between Meetings and Events
  // =========================================================================
  function renderSessionList(container, kind) {
    const isEvent = kind === "event";
    const state = window.AtharStore.getState();
    const canCreate = hasPermission("meetings", "create");
    const canDelete = hasPermission("meetings", "delete");
    const sessions = state.meetings.filter(m => (m.kind || "meeting") === kind);

    const meetingCount = state.meetings.filter(m => (m.kind || "meeting") === "meeting").length;
    const eventCount = state.meetings.filter(m => m.kind === "event").length;

    const label = isEvent
      ? (App.currentLang === 'ar' ? 'الفعاليات' : 'Events')
      : t("nav_meetings");

    const kindColor = isEvent ? "#8A3FFC" : "var(--primary)";
    const kindBg = isEvent ? "#F1E8FF" : "var(--primary-light)";
    const kindIcon = isEvent ? "sparkles" : "calendar";

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <div class="breadcrumb-trail">
            <span class="breadcrumb-item" onclick="window.AtharApp.navigateTo('dashboard')">${t("app_name")}</span>
            <span class="breadcrumb-separator">/</span>
            <span>${label}</span>
          </div>
          <h1 class="view-title">
            <span style="color:${kindColor}; display:inline-flex; align-items:center; vertical-align:middle; margin-inline-end:6px;">
              ${ic(kindIcon, 24)}
            </span>
            ${label}
          </h1>
          <p class="view-subtitle">
            ${isEvent
        ? (App.currentLang === 'ar' ? 'فعاليات بمدة زمنية وساعات تطوعية تلقائية' : 'Time-bounded events with auto-logged volunteer hours')
        : (App.currentLang === 'ar' ? 'الاجتماعات الدورية وكشوف التحضير' : 'Recurring meetings and attendance rosters')}
          </p>
        </div>
        <div class="view-header-actions">
          <button class="btn btn-secondary btn-sm" id="btn-crosslink">
            ${ic(isEvent ? "calendar" : "sparkles", 14)}
            ${isEvent
        ? (App.currentLang === 'ar' ? `الاجتماعات (${meetingCount})` : `Meetings (${meetingCount})`)
        : (App.currentLang === 'ar' ? `الفعاليات (${eventCount})` : `Events (${eventCount})`)}
          </button>
          ${canCreate ? `<button class="btn btn-primary" id="btn-add-session">
            ${ic("plus", 14)} ${isEvent ? (App.currentLang === 'ar' ? 'فعالية جديدة' : 'New Event') : t("add_meeting")}
          </button>` : ''}
        </div>
      </div>

      ${sessions.length === 0 ? `
        <div class="card" style="text-align:center; padding:48px;">
          <div style="color:${kindColor}; margin-bottom:12px;">${ic(kindIcon, 42, { strokeWidth: 1.5 })}</div>
          <div style="font-weight:700; font-size:16px; margin-bottom:4px;">
            ${isEvent
          ? (App.currentLang === 'ar' ? 'لا توجد فعاليات بعد' : 'No events yet')
          : (App.currentLang === 'ar' ? 'لا توجد اجتماعات' : 'No meetings yet')}
          </div>
        </div>
      ` : `
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width:60px;">${App.currentLang === 'ar' ? 'النوع' : 'Kind'}</th>
                <th>${t("date")}</th>
                <th>${App.currentLang === 'ar' ? 'العنوان' : 'Title'}</th>
                <th>${t("committee")}</th>
                <th>${App.currentLang === 'ar' ? 'الوقت' : 'Time'}</th>
                <th>${t("status")}</th>
                <th>${App.currentLang === 'ar' ? 'الحضور' : 'Attendance'}</th>
                ${isEvent ? `<th>${App.currentLang === 'ar' ? 'التقييم' : 'Eval'}</th>` : ''}
                <th style="text-align:right;">${t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              ${sessions.map(m => {
            const comm = state.committees.find(c => c.id === m.committee_id);
            const summary = m.attendance_summary;
            const presentCount = summary ? (summary.present + summary.late) : 0;
            const totalAttendees = summary ? summary.total : 0;
            const completed = m.status === "completed";

            const evalInfo = isEvent && completed ? attendeesNeedingEval(m.id) : null;
            const pendingEvalCount = evalInfo ? evalInfo.pending.length : 0;

            return `
                  <tr>
                    <td>
                      <span style="display:inline-flex; align-items:center; justify-content:center; width:32px; height:32px; border-radius:8px; background:${kindBg}; color:${kindColor};">
                        ${ic(kindIcon, 16, { strokeWidth: 2.2 })}
                      </span>
                    </td>
                    <td><span style="font-weight:700;">${formatDate(m.meeting_date)}</span></td>
                    <td>
                      <div style="font-weight:700; color:var(--neutral-900);">${App.currentLang === 'ar' ? m.title_ar : m.title_en}</div>
                      <div style="font-size:11px; color:var(--neutral-500);">${m.title_en}</div>
                    </td>
                    <td><span>${comm ? (App.currentLang === 'ar' ? comm.name_ar : comm.name_en) : '—'}</span></td>
                    <td>
                      <div style="font-size:12px;">${ic("clock", 12)} <span class="num-ltr">${m.start_time}${m.end_time ? ' - ' + m.end_time : ''}</span></div>
                      <div style="font-size:11px; color:var(--neutral-500);">${m.location || '—'}</div>
                    </td>
                    <td>
                      <span class="badge ${m.status === 'completed' ? 'badge-success' : m.status === 'scheduled' ? 'badge-primary' : 'badge-danger'}">
                        ${t(m.status)}
                      </span>
                    </td>
                    <td>
                      ${completed && summary ? `
                        <button class="btn btn-secondary btn-sm" data-attendance-meeting="${m.id}" title="${App.currentLang === 'ar' ? 'عرض كشف الحضور' : 'View attendance roster'}" style="padding:3px 8px;">
                          ${ic("users", 12)} <span class="num-ltr" style="font-weight:700;">${presentCount}/${totalAttendees}</span>
                        </button>
                      ` : `<span style="color:var(--neutral-400);">—</span>`}
                    </td>
                    ${isEvent ? `
                      <td>
                        ${!completed
                ? `<span style="color:var(--neutral-400); font-size:11px;">—</span>`
                : pendingEvalCount > 0
                  ? `<button class="btn btn-warning-outline btn-sm" data-eval-meeting="${m.id}" style="padding:3px 8px; background:var(--warning-light); color:var(--warning); border:1px solid var(--warning-border); border-radius:6px; font-size:11px; font-weight:700; display:inline-flex; align-items:center; gap:4px;">
                              ${ic("alert", 12)} ${pendingEvalCount} ${App.currentLang === 'ar' ? 'بانتظار التقييم' : 'pending'}
                            </button>`
                  : `<span class="badge badge-success" style="font-size:10px;">
                              ${ic("check", 10)} ${App.currentLang === 'ar' ? 'مكتمل' : 'Complete'}
                            </span>`}
                      </td>
                    ` : ''}
                    <td>
                      <div class="row-actions-cell">
                        <button class="btn btn-primary btn-sm" onclick="window.AtharApp.navigateTo('meeting-detail', {id:'${m.id}'})">
                          ${m.status === 'completed' ? t("view") : (App.currentLang === 'ar' ? 'التحضير' : 'Take Attendance')}
                        </button>
                        ${canDelete ? `
                          <button class="btn btn-danger-outline btn-sm" data-delete-session="${m.id}" title="${t("delete")}">
                            ${ic("trash", 13)}
                          </button>
                        ` : ''}
                      </div>
                    </td>
                  </tr>
                `;
          }).join('')}
            </tbody>
          </table>
        </div>
      `}
    `;

    // Cross-link
    const cross = document.getElementById("btn-crosslink");
    if (cross) {
      cross.onclick = () => navigateTo(isEvent ? "meetings" : "events");
    }

    const addBtn = document.getElementById("btn-add-session");
    if (addBtn) {
      addBtn.onclick = () => {
        if (isEvent && typeof window.AtharModals.openCreateEventSlideover === "function") {
          window.AtharModals.openCreateEventSlideover();
        } else {
          window.AtharModals.openCreateMeetingSlideover();
        }
      };
    }

    // Attendance viewer
    container.querySelectorAll("[data-attendance-meeting]").forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-attendance-meeting");
        window.AtharModals.openAttendanceModal(id);
      };
    });

    // Evaluate attendees (only on events)
    container.querySelectorAll("[data-eval-meeting]").forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-eval-meeting");
        window.AtharModals.openEvaluateAttendeesModal(id);
      };
    });

    // Delete
    container.querySelectorAll("[data-delete-session]").forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-delete-session");
        const session = sessions.find(x => x.id === id);
        if (!session) return;
        confirmDeleteSession(session, () => renderSessionList(container, kind));
      };
    });
  }

  // =========================================================================
  // Session detail
  // =========================================================================
  async function renderMeetingDetail(container, meetingId) {
    const state = window.AtharStore.getState();
    const meeting = state.meetings.find(m => m.id === meetingId);
    if (!meeting) {
      container.innerHTML = `<div class="empty-state"><p>Session not found</p></div>`;
      return;
    }

    const isEvent = (meeting.kind || "meeting") === "event";
    const comm = state.committees.find(c => c.id === meeting.committee_id);
    const backView = isEvent ? "events" : "meetings";
    const backLabel = isEvent ? (App.currentLang === 'ar' ? 'الفعاليات' : 'Events') : t("nav_meetings");
    const canDelete = hasPermission("meetings", "delete");

    const kindColor = isEvent ? "#8A3FFC" : "var(--primary)";

    // Loading state
    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <div class="breadcrumb-trail">
            <span class="breadcrumb-item" onclick="window.AtharApp.navigateTo('${backView}')">${backLabel}</span>
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
        container.innerHTML = `<div class="empty-state"><p>Failed to load roster.</p></div>`;
      }
      return;
    }

    const presentCount = roster.filter(r => r.status === "present").length;
    const lateCount = roster.filter(r => r.status === "late").length;
    const absentCount = roster.filter(r => r.status === "absent").length;
    const excusedCount = roster.filter(r => r.status === "excused").length;
    const isCompleted = meeting.status === "completed";
    const showAutoHours = isCompleted && !!meeting.end_time;

    const evalInfo = isEvent && isCompleted ? attendeesNeedingEval(meetingId) : null;
    const pendingEvalCount = evalInfo ? evalInfo.pending.length : 0;

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <div class="breadcrumb-trail">
            <span class="breadcrumb-item" onclick="window.AtharApp.navigateTo('${backView}')">${backLabel}</span>
            <span class="breadcrumb-separator">/</span>
            <span>${App.currentLang === 'ar' ? meeting.title_ar : meeting.title_en}</span>
          </div>
          <h1 class="view-title">
            <span style="color:${kindColor}; display:inline-flex; align-items:center; vertical-align:middle; margin-inline-end:6px;">
              ${ic(isEvent ? "sparkles" : "calendar", 22)}
            </span>
            ${App.currentLang === 'ar' ? meeting.title_ar : meeting.title_en}
          </h1>
          <p class="view-subtitle">
            ${formatDate(meeting.meeting_date)} &bull; ${meeting.start_time}${meeting.end_time ? ' - ' + meeting.end_time : ''} &bull; ${meeting.location || '—'}
            ${isDraft && !isCompleted ? '&bull; <span class="badge badge-warning">DRAFT ROSTER</span>' : ''}
            ${isCompleted ? '&bull; <span class="badge badge-success">COMPLETED</span>' : ''}
          </p>
        </div>
        <div class="view-header-actions">
          ${pendingEvalCount > 0 ? `
            <button class="btn btn-primary" id="btn-evaluate-attendees" style="background:#8A3FFC; border-color:#8A3FFC;">
              ${ic("star", 14)} ${App.currentLang === 'ar' ? `تقييم الحاضرين (${pendingEvalCount})` : `Evaluate Attendees (${pendingEvalCount})`}
            </button>
          ` : ''}
          <button class="btn btn-secondary btn-sm" id="btn-bulk-present">${ic("check", 14)} ${t("mark_all_present")}</button>
          <button class="btn btn-secondary btn-sm" id="btn-bulk-absent">${ic("x", 14)} ${t("mark_all_absent")}</button>
          <button class="btn btn-success" id="btn-save-attendance">${ic("check_circle", 14)} ${t("save")}</button>
          ${showAutoHours ? `
            <button class="btn btn-secondary" id="btn-auto-hours" title="${App.currentLang === 'ar' ? 'إعادة تسجيل الساعات لغير المسجلين' : 'Re-run auto-log'}">
              ${ic("refresh", 14)} ${App.currentLang === 'ar' ? 'تسجيل الساعات المتبقية' : 'Re-log Hours'}
            </button>
          ` : ''}
          ${canDelete ? `
            <button class="btn btn-danger-outline" id="btn-delete-session" title="${t("delete")}">
              ${ic("trash", 14)} ${t("delete")}
            </button>
          ` : ''}
        </div>
      </div>

      ${isEvent ? `
        <div style="padding:10px 14px; background:${pendingEvalCount > 0 ? 'var(--warning-light)' : 'var(--primary-light)'}; border:1px solid ${pendingEvalCount > 0 ? 'var(--warning-border)' : 'var(--primary-border)'}; border-radius:var(--radius-md); margin-bottom:16px; font-size:12.5px; color:${pendingEvalCount > 0 ? 'var(--warning)' : 'var(--primary)'}; display:flex; align-items:center; gap:8px;">
          ${ic(pendingEvalCount > 0 ? "alert" : "info", 14)}
          <span>
            ${pendingEvalCount > 0
        ? (App.currentLang === 'ar'
          ? `${pendingEvalCount} حاضر بانتظار التقييم لهذه الفعالية (${evalInfo.period}).`
          : `${pendingEvalCount} attendee(s) still need evaluation for this event (${evalInfo.period}).`)
        : (App.currentLang === 'ar'
          ? 'عند الحفظ، سيتم تسجيل الساعات تلقائياً لكل من حضر أو تأخر، حسب مدة الفعالية.'
          : 'On save, hours will be auto-logged for everyone Present or Late.')}
          </span>
        </div>
      ` : ''}

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
              <th>${App.currentLang === 'ar' ? 'المتطوع' : 'Volunteer'}</th>
              <th style="width:180px;">${t("status")}</th>
              <th>${t("note")}</th>
              <th style="text-align:right;">${t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            ${roster.length === 0 ? `
              <tr><td colspan="4" style="text-align:center; padding:24px;">${App.currentLang === 'ar' ? 'لا يوجد متطوعون مؤهلون.' : 'No eligible volunteers.'}</td></tr>
            ` : roster.map(rec => {
        const vol = rec.volunteer || {};
        const waNumber = (vol.whatsapp || vol.phone || "").replace(/[^0-9]/g, "");
        const tmpl = state.whatsapp_templates.find(x => x.name && x.name.includes("Invitation") && x.language === App.currentLang) || state.whatsapp_templates[0];
        let waMessage = tmpl ? tmpl.body : "Meeting invite";
        waMessage = waMessage
          .replace("{name}", vol.fullName || vol.full_name || "")
          .replace("{committee}", comm ? (App.currentLang === 'ar' ? comm.name_ar : comm.name_en) : "Athar")
          .replace("{date}", meeting.meeting_date || "");
        const waUrl = waNumber ? `https://wa.me/${waNumber}?text=${encodeURIComponent(waMessage)}` : '#';

        return `
                <tr data-vol-id="${vol.id || rec.volunteerId}">
                  <td>
                    <div style="font-weight:700;">${App.currentLang === 'ar' ? (vol.fullNameAr || vol.full_name_ar || vol.fullName || vol.full_name) : (vol.fullName || vol.full_name)}</div>
                    <div style="font-size:11px; color:var(--neutral-500);">${vol.phone || '—'}</div>
                  </td>
                  <td>
                    <select class="form-control att-status-select" style="font-weight:600;">
                      <option value="present" ${rec.status === 'present' ? 'selected' : ''}>${t("present")}</option>
                      <option value="late" ${rec.status === 'late' ? 'selected' : ''}>${t("late")}</option>
                      <option value="absent" ${rec.status === 'absent' ? 'selected' : ''}>${t("absent")}</option>
                      <option value="excused" ${rec.status === 'excused' ? 'selected' : ''}>${t("excused")}</option>
                    </select>
                  </td>
                  <td><input type="text" class="form-control att-note-input" placeholder="—" value="${rec.note || ''}"></td>
                  <td>
                    <div class="row-actions-cell">
                      ${waNumber ? `<a href="${waUrl}" target="_blank" class="btn btn-whatsapp btn-sm">${ic("whatsapp", 12)} WhatsApp</a>` : '<span style="color:var(--neutral-400); font-size:11px;">—</span>'}
                    </div>
                  </td>
                </tr>
              `;
      }).join('')}
          </tbody>
        </table>
      </div>
    `;

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
      const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      setTxt("stat-present", p);
      setTxt("stat-late", l);
      setTxt("stat-absent", a);
      setTxt("stat-excused", e);
    }

    container.querySelectorAll(".att-status-select").forEach(sel => sel.addEventListener("change", recalcCounts));

    const bulkPresent = document.getElementById("btn-bulk-present");
    if (bulkPresent) bulkPresent.onclick = () => {
      container.querySelectorAll(".att-status-select").forEach(s => s.value = "present");
      recalcCounts();
    };

    const bulkAbsent = document.getElementById("btn-bulk-absent");
    if (bulkAbsent) bulkAbsent.onclick = () => {
      container.querySelectorAll(".att-status-select").forEach(s => s.value = "absent");
      recalcCounts();
    };

    // Evaluate attendees button
    const evalBtn = document.getElementById("btn-evaluate-attendees");
    if (evalBtn) {
      evalBtn.onclick = () => window.AtharModals.openEvaluateAttendeesModal(meetingId);
    }

    // Save
    const saveBtn = document.getElementById("btn-save-attendance");
    if (saveBtn) {
      saveBtn.onclick = async () => {
        const rows = container.querySelectorAll("#attendance-roster-table tbody tr");
        const records = [];
        rows.forEach(r => {
          const volId = r.getAttribute("data-vol-id");
          const status = r.querySelector(".att-status-select")?.value;
          const note = r.querySelector(".att-note-input")?.value?.trim();
          if (volId && status) records.push({ volunteerId: volId, status, note: note || undefined });
        });
        if (records.length === 0) { showToast("No records", "warning"); return; }

        const presentLateCount = records.filter(r => r.status === "present" || r.status === "late").length;

        saveBtn.disabled = true;
        const orig = saveBtn.innerHTML;
        saveBtn.innerHTML = "Saving…";

        try {
          await window.AtharAPI.meetings.saveRoster(meetingId, records, true);
          await window.AtharStore.refreshMeetings();

          if (presentLateCount > 0) {
            saveBtn.innerHTML = "Logging hours…";
            try {
              const res = await window.AtharAPI.meetings.autoHours(meetingId, false);
              await window.AtharStore.refreshHours();

              if (res.created > 0) {
                const base = App.currentLang === 'ar'
                  ? `تم حفظ ${records.length} سجل حضور · تم تسجيل ${res.hours} ساعة لـ ${res.created} متطوع`
                  : `Saved ${records.length} attendance · Logged ${res.hours}h for ${res.created} volunteer(s)`;
                const suffix = res.skipped
                  ? (App.currentLang === 'ar' ? ` (تم تخطي ${res.skipped} مسجل مسبقاً)` : ` (${res.skipped} already logged)`)
                  : '';
                showToast(base + suffix, "success");
              } else if (res.skipped > 0) {
                showToast(App.currentLang === 'ar'
                  ? `تم حفظ الحضور · الساعات مسجلة مسبقاً لـ ${res.skipped}`
                  : `Saved attendance · Hours already logged for ${res.skipped}`, "info");
              } else {
                showToast(App.currentLang === 'ar'
                  ? `تم حفظ ${records.length} سجل حضور`
                  : `Saved ${records.length} attendance records`, "success");
              }
            } catch (autoErr) {
              if (autoErr.code === "NO_END_TIME") {
                showToast(App.currentLang === 'ar'
                  ? "تم حفظ الحضور · أضف وقت انتهاء لتسجيل الساعات تلقائياً"
                  : "Attendance saved · Add an end time to auto-log hours", "warning");
              } else {
                showToast(App.currentLang === 'ar'
                  ? `تم حفظ الحضور · فشل تسجيل الساعات`
                  : `Attendance saved · Auto-log failed`, "warning");
              }
            }
          } else {
            showToast(App.currentLang === 'ar'
              ? `تم حفظ ${records.length} سجل حضور`
              : `Saved ${records.length} attendance records`, "success");
          }

          renderMeetingDetail(container, meetingId);
        } catch (err) {
          showToast(err.message || "Save failed", "error");
          saveBtn.disabled = false;
          saveBtn.innerHTML = orig;
        }
      };
    }

    // Re-log hours
    const autoBtn = document.getElementById("btn-auto-hours");
    if (autoBtn) {
      autoBtn.onclick = async () => {
        autoBtn.disabled = true;
        const orig = autoBtn.innerHTML;
        autoBtn.innerHTML = "Logging…";
        try {
          const res = await window.AtharAPI.meetings.autoHours(meetingId, false);
          await window.AtharStore.refreshHours();
          if (res.created === 0 && res.skipped === 0) {
            showToast(App.currentLang === 'ar' ? "لا يوجد حاضرون لتسجيل ساعاتهم" : "No one was marked Present or Late", "warning");
          } else if (res.created === 0) {
            showToast(App.currentLang === 'ar' ? `تم تخطي ${res.skipped}` : `Skipped ${res.skipped}`, "info");
          } else {
            let msg = App.currentLang === 'ar' ? `تم تسجيل ${res.hours} ساعة لـ ${res.created}` : `Logged ${res.hours}h for ${res.created}`;
            if (res.skipped) msg += App.currentLang === 'ar' ? ` — تم تخطي ${res.skipped}` : ` — skipped ${res.skipped}`;
            showToast(msg, "success");
          }
        } catch (err) {
          showToast(err.message || "Auto-log failed", "error");
        } finally {
          autoBtn.disabled = false;
          autoBtn.innerHTML = orig;
        }
      };
    }

    // Delete
    const deleteBtn = document.getElementById("btn-delete-session");
    if (deleteBtn) {
      deleteBtn.onclick = () => {
        confirmDeleteSession(meeting, () => navigateTo(backView));
      };
    }
  }

  window.AtharViews.meetings = (c, p) => renderSessionList(c, "meeting");
  window.AtharViews.events = (c, p) => renderSessionList(c, "event");
  window.AtharViews.meetingDetail = (c, p) => renderMeetingDetail(c, p.id);
})();