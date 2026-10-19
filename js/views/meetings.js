/**
 * View: Meetings + Events (separated, with evaluation tracking)
 */
(function () {
  "use strict";

  const { App, t, formatDate, ic, showToast, showConfirmModal, hasPermission, navigateTo } = window.AtharCore;

  // =========================================================================
  // Has this volunteer received an evaluation AFTER the given meeting day?
  // Compares against end-of-day so same-day evals after the meeting count.
  // =========================================================================
  function hasRecentEval(volunteerId, meetingDate) {
    const state = window.AtharStore.getState();
    const evals = state.evaluations.filter(e => e.volunteer_id === volunteerId);
    if (!evals.length) return false;
    // End of the meeting day (23:59:59.999 local time)
    const endOfDay = new Date(meetingDate + "T23:59:59.999").getTime();
    return evals.some(e => {
      const raw = e.evaluated_at || e.evaluatedAt;
      if (!raw) return false;
      const evalTs = new Date(raw).getTime();
      return evalTs > endOfDay;
    });
  }

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
  // Session list — completely separate for meetings vs events
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
            <span style="color:${kindColor}; display:inline-flex; align-items:center; vertical-align:middle; margin-inline-end:8px;">
              ${ic(kindIcon, 26)}
            </span>
            ${label}
          </h1>
          <p class="view-subtitle">
            ${isEvent
        ? (App.currentLang === 'ar' ? 'فعاليات بمدة زمنية · تحتاج تقييم الحاضرين' : 'Time-bounded events · attendees require evaluation')
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
          ${canCreate ? `<button class="btn btn-primary" id="btn-add-session" style="${isEvent ? 'background:#8A3FFC;border-color:#8A3FFC;' : ''}">
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
                <th style="width:52px;">${App.currentLang === 'ar' ? 'النوع' : 'Kind'}</th>
                <th>${t("date")}</th>
                <th>${App.currentLang === 'ar' ? 'العنوان' : 'Title'}</th>
                <th>${t("committee")}</th>
                <th>${App.currentLang === 'ar' ? 'الوقت' : 'Time'}</th>
                <th>${t("status")}</th>
                <th>${App.currentLang === 'ar' ? 'الحضور' : 'Attendance'}</th>
                ${isEvent ? `<th>${App.currentLang === 'ar' ? 'التقييم' : 'Evaluation'}</th>` : ''}
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
                      ${completed && summary && totalAttendees > 0 ? `
                        <button class="btn btn-secondary btn-sm" data-attendance-meeting="${m.id}" title="${App.currentLang === 'ar' ? 'عرض الحضور' : 'View attendees'}" style="padding:3px 8px;">
                          ${ic("users", 12)} <span class="num-ltr" style="font-weight:700;">${presentCount}/${totalAttendees}</span>
                        </button>
                      ` : `<span style="color:var(--neutral-400);">—</span>`}
                    </td>
                    ${isEvent ? `
                      <td>
                        ${!completed
                ? `<span style="color:var(--neutral-400); font-size:11px;">—</span>`
                : (presentCount === 0
                  ? `<span style="color:var(--neutral-400); font-size:11px;">${App.currentLang === 'ar' ? 'لا حاضرون' : 'no attendees'}</span>`
                  : `<button class="btn btn-sm" data-eval-meeting="${m.id}" style="background:${kindColor}; color:#fff; border:none; padding:4px 10px; border-radius:6px; font-size:11px; font-weight:700; display:inline-flex; align-items:center; gap:4px; cursor:pointer;">
                              ${ic("star", 12)} ${App.currentLang === 'ar' ? 'تقييم الحاضرين' : 'Evaluate Attendees'}
                            </button>`)}
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

    const cross = document.getElementById("btn-crosslink");
    if (cross) cross.onclick = () => navigateTo(isEvent ? "meetings" : "events");

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

    container.querySelectorAll("[data-attendance-meeting]").forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-attendance-meeting");
        window.AtharModals.openAttendanceModal(id);
      };
    });

    container.querySelectorAll("[data-eval-meeting]").forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-eval-meeting");
        window.AtharModals.openEvaluateAttendeesModal(id);
      };
    });

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
    const canCreate = hasPermission("meetings", "create");
    const kindColor = isEvent ? "#8A3FFC" : "var(--primary)";

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

    // Per-attendee evaluation check (events only, completed)
    const eventTs = meeting.meeting_date;
    const attended = roster.filter(r => r.status === "present" || r.status === "late");
    const pendingEvalIds = isEvent && isCompleted
      ? attended.filter(r => !hasRecentEval(r.volunteerId || (r.volunteer && r.volunteer.id), eventTs)).map(r => r.volunteerId || (r.volunteer && r.volunteer.id))
      : [];
    const pendingEvalCount = pendingEvalIds.length;
    const evalComplete = isEvent && isCompleted && attended.length > 0 && pendingEvalCount === 0;

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <div class="breadcrumb-trail">
            <span class="breadcrumb-item" onclick="window.AtharApp.navigateTo('${backView}')">${backLabel}</span>
            <span class="breadcrumb-separator">/</span>
            <span>${App.currentLang === 'ar' ? meeting.title_ar : meeting.title_en}</span>
          </div>
          <h1 class="view-title">
            <span style="color:${kindColor}; display:inline-flex; align-items:center; vertical-align:middle; margin-inline-end:8px;">
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
            <button class="btn" id="btn-evaluate-attendees" style="background:${kindColor}; color:#fff; border:none; display:inline-flex; align-items:center; gap:6px;">
              ${ic("star", 14)} ${App.currentLang === 'ar' ? `تقييم ${pendingEvalCount} حاضر` : `Evaluate ${pendingEvalCount} Attendee${pendingEvalCount > 1 ? 's' : ''}`}
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
          <button class="btn btn-secondary btn-sm" id="btn-print-attendance">${ic("printer", 14)} ${t("print_attendance_sheet")}</button>
          <button class="btn btn-secondary btn-sm" id="btn-ics-session">${ic("download", 14)} ${t("add_to_calendar")}</button>
          ${canCreate ? `
            <button class="btn btn-secondary btn-sm" id="btn-duplicate-session">${ic("copy", 14)} ${t("duplicate")}</button>
          ` : ''}
          ${canDelete ? `
            <button class="btn btn-danger-outline" id="btn-delete-session" title="${t("delete")}">
              ${ic("trash", 14)} ${t("delete")}
            </button>
          ` : ''}
        </div>
      </div>

      ${isEvent && isCompleted && attended.length > 0 ? `
        <div style="padding:12px 16px; background:${evalComplete ? 'var(--success-light)' : 'var(--warning-light)'}; border:1px solid ${evalComplete ? 'var(--success-border)' : 'var(--warning-border)'}; border-radius:var(--radius-md); margin-bottom:16px; font-size:13px; color:${evalComplete ? 'var(--success)' : 'var(--warning)'}; display:flex; align-items:center; gap:10px; font-weight:600;">
          ${ic(evalComplete ? "check_circle" : "alert", 18)}
          <span>
            ${evalComplete
        ? (App.currentLang === 'ar'
          ? `تم تقييم جميع الحاضرين (${attended.length}) ✓`
          : `All attendees have been evaluated (${attended.length}) ✓`)
        : (App.currentLang === 'ar'
          ? `${pendingEvalCount} من ${attended.length} حاضر بحاجة إلى تقييم بعد هذه الفعالية.`
          : `${pendingEvalCount} of ${attended.length} attendees need evaluation after this event.`)}
          </span>
        </div>
      ` : ''}

      ${isEvent && !isCompleted ? `
        <div style="padding:10px 14px; background:var(--primary-light); border:1px solid var(--primary-border); border-radius:var(--radius-md); margin-bottom:16px; font-size:12.5px; color:var(--primary); display:flex; align-items:center; gap:8px;">
          ${ic("info", 14)}
          <span>
            ${App.currentLang === 'ar'
        ? 'بعد الحفظ، سيتم تسجيل الساعات تلقائياً للحاضرين، وستظهر لك إمكانية تقييمهم.'
        : 'After saving, hours will be auto-logged and attendees will need evaluation.'}
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

      <div class="filter-bar" style="margin-bottom:12px;">
        <div class="filter-group">
          <input type="search" id="att-search" class="form-control" placeholder="${t("att_search")}" style="min-width:180px;">
          <select id="att-filter-comm" class="form-control">
            <option value="all">${t("all_committees")}</option>
            ${Array.from(new Set(roster.map(r => (r.volunteer || {}).committee_id || (r.volunteer || {}).committeeId).filter(Boolean))).map(cid => {
              const c = state.committees.find(x => x.id === cid);
              const name = c ? (App.currentLang === 'ar' ? c.name_ar : c.name_en) : cid;
              return `<option value="${cid}">${name}</option>`;
            }).join('')}
          </select>
        </div>
      </div>

      <div class="table-container">
        <table class="data-table" id="attendance-roster-table">
          <thead>
            <tr>
              <th>${App.currentLang === 'ar' ? 'المتطوع' : 'Volunteer'}</th>
              <th style="width:180px;">${t("status")}</th>
              <th>${t("note")}</th>
              ${isEvent && isCompleted ? `<th style="width:130px;">${App.currentLang === 'ar' ? 'التقييم' : 'Evaluation'}</th>` : ''}
              <th style="text-align:right;">${t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            ${roster.length === 0 ? `
              <tr><td colspan="${isEvent && isCompleted ? 5 : 4}" style="text-align:center; padding:24px;">${App.currentLang === 'ar' ? 'لا يوجد متطوعون مؤهلون.' : 'No eligible volunteers.'}</td></tr>
            ` : roster.map(rec => {
        const vol = rec.volunteer || {};
        const volId = rec.volunteerId || vol.id;
        const attendedHere = rec.status === "present" || rec.status === "late";
        const needsEval = isEvent && isCompleted && attendedHere && !hasRecentEval(volId, eventTs);

        const waNumber = (vol.whatsapp || vol.phone || "").replace(/[^0-9]/g, "");
        const tmpl = state.whatsapp_templates.find(x => x.name && x.name.includes("Invitation") && x.language === App.currentLang) || state.whatsapp_templates[0];
        let waMessage = tmpl ? tmpl.body : "Meeting invite";
        waMessage = waMessage
          .replace("{name}", vol.fullName || vol.full_name || "")
          .replace("{committee}", comm ? (App.currentLang === 'ar' ? comm.name_ar : comm.name_en) : "Athar")
          .replace("{date}", meeting.meeting_date || "");
        const waUrl = waNumber ? `https://wa.me/${waNumber}?text=${encodeURIComponent(waMessage)}` : '#';

        return `
                <tr data-vol-id="${volId}" data-att-search="${String((vol.fullName || vol.full_name || '') + ' ' + (vol.fullNameAr || vol.full_name_ar || '') + ' ' + (vol.phone || '')).toLowerCase().replace(/"/g, '&quot;')}" data-att-comm="${vol.committee_id || vol.committeeId || ''}">
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
                  ${isEvent && isCompleted ? `
                    <td>
                      ${!attendedHere
            ? `<span style="color:var(--neutral-400); font-size:11px;">—</span>`
            : needsEval
              ? `<button class="btn btn-sm" data-eval-one="${volId}" style="background:#F59E0B; color:#fff; border:none; padding:4px 10px; border-radius:6px; font-size:11px; font-weight:700; display:inline-flex; align-items:center; gap:4px; cursor:pointer;">
                              ${ic("alert", 12)} ${App.currentLang === 'ar' ? 'يحتاج تقييم' : 'Needs Eval'}
                            </button>`
              : `<span class="badge badge-success" style="font-size:11px; display:inline-flex; align-items:center; gap:4px;">
                              ${ic("check", 11)} ${App.currentLang === 'ar' ? 'تم' : 'Done'}
                            </span>`}
                    </td>
                  ` : ''}
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

    // Roster search + committee filter
    function applyAttFilter() {
      const q = (document.getElementById("att-search")?.value || "").trim().toLowerCase();
      const comm = document.getElementById("att-filter-comm")?.value || "all";
      container.querySelectorAll("#attendance-roster-table tbody tr").forEach(tr => {
        const hay = (tr.getAttribute("data-att-search") || "").toLowerCase();
        const c = tr.getAttribute("data-att-comm") || "";
        const matchQ = !q || hay.includes(q);
        const matchC = comm === "all" || c === comm;
        tr.style.display = (matchQ && matchC) ? "" : "none";
      });
    }
    const attSearchEl = document.getElementById("att-search");
    if (attSearchEl) attSearchEl.oninput = applyAttFilter;
    const attCommEl = document.getElementById("att-filter-comm");
    if (attCommEl) attCommEl.onchange = applyAttFilter;

    // Warn if the user navigates away with un-saved attendance marks.
    const attTable = container.querySelector("#attendance-roster-table");
    if (attTable) window.AtharDirty.bind(attTable, "attendance-roster");

    const bulkPresent = document.getElementById("btn-bulk-present");
    if (bulkPresent) bulkPresent.onclick = () => {
      container.querySelectorAll(".att-status-select").forEach(s => s.value = "present");
      recalcCounts();
      window.AtharDirty.mark("attendance-roster");
    };

    const bulkAbsent = document.getElementById("btn-bulk-absent");
    if (bulkAbsent) bulkAbsent.onclick = () => {
      container.querySelectorAll(".att-status-select").forEach(s => s.value = "absent");
      recalcCounts();
      window.AtharDirty.mark("attendance-roster");
    };

    // Batch evaluate
    const evalBtn = document.getElementById("btn-evaluate-attendees");
    if (evalBtn) {
      evalBtn.onclick = () => {
        if (!pendingEvalIds.length) return;
        window.AtharModals.openBulkRatingModal(pendingEvalIds);
      };
    }

    // Per-row evaluate — single volunteer
    container.querySelectorAll("[data-eval-one]").forEach(btn => {
      btn.onclick = () => {
        const volId = btn.getAttribute("data-eval-one");
        window.AtharModals.openBulkRatingModal([volId]);
      };
    });

    // Save attendance
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
                showToast(App.currentLang === 'ar'
                  ? `تم حفظ الحضور · تم تسجيل ${res.hours} ساعة لـ ${res.created} متطوع`
                  : `Saved · Logged ${res.hours}h for ${res.created}`, "success");
              } else {
                showToast(App.currentLang === 'ar' ? `تم حفظ ${records.length} سجل` : `Saved ${records.length} records`, "success");
              }
            } catch (autoErr) {
              showToast(App.currentLang === 'ar' ? "تم حفظ الحضور · فشل تسجيل الساعات" : "Attendance saved · Auto-log failed", "warning");
            }
          } else {
            showToast(App.currentLang === 'ar' ? `تم حفظ ${records.length} سجل` : `Saved ${records.length} records`, "success");
          }

          window.AtharDirty.clear();
          renderMeetingDetail(container, meetingId);
        } catch (err) {
          showToast(err.message || "Save failed", "error");
          saveBtn.disabled = false;
          saveBtn.innerHTML = orig;
        }
      };
    }

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
          } else {
            showToast(App.currentLang === 'ar' ? `تم تسجيل ${res.hours} ساعة لـ ${res.created}` : `Logged ${res.hours}h for ${res.created}`, "success");
          }
        } catch (err) {
          showToast(err.message || "Auto-log failed", "error");
        } finally {
          autoBtn.disabled = false;
          autoBtn.innerHTML = orig;
        }
      };
    }

    const deleteBtn = document.getElementById("btn-delete-session");
    if (deleteBtn) {
      deleteBtn.onclick = () => confirmDeleteSession(meeting, () => navigateTo(backView));
    }

    // ---- Time-savers: duplicate / print sheet / add to calendar ----
    const dupBtn = document.getElementById("btn-duplicate-session");
    if (dupBtn) {
      dupBtn.onclick = () => {
        window.AtharModals.openCreateMeetingSlideover(meeting.committee_id, meeting.kind || "meeting", meeting);
      };
    }

    const printSheetBtn = document.getElementById("btn-print-attendance");
    if (printSheetBtn) {
      printSheetBtn.onclick = () => {
        const sheetTitle = (App.currentLang === "ar" ? "كشف الحضور — " : "Attendance Sheet — ") +
          (App.currentLang === "ar" ? (meeting.title_ar || meeting.title_en) : (meeting.title_en || meeting.title_ar));
        let el = document.getElementById("printable-attendance-sheet");
        if (!el) {
          el = document.createElement("div");
          el.id = "printable-attendance-sheet";
          document.body.appendChild(el);
        }
        el.innerHTML = buildAttendanceSheetHtml(meeting, container, comm);
        window.ExportUtil.printElement("printable-attendance-sheet", sheetTitle);
        setTimeout(() => {
          const stale = document.getElementById("printable-attendance-sheet");
          if (stale) stale.remove();
        }, 2500);
      };
    }

    const icsBtn = document.getElementById("btn-ics-session");
    if (icsBtn) {
      icsBtn.onclick = () => {
        const datePart = (meeting.meeting_date || "").replace(/-/g, "");
        const filename = "Athar-" + (isEvent ? "Event-" : "Meeting-") + (datePart || "session") + ".ics";
        window.ExportUtil.downloadFile(filename, buildICS(meeting, comm), "text/calendar;charset=utf-8");
      };
    }
  }

  // =========================================================================
  // Time-savers — ICS calendar invite + printable attendance sheet
  // =========================================================================
  function escHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function pad2(n) { return String(n).padStart(2, "0"); }

  function buildICS(meeting, committee) {
    const title = App.currentLang === "ar"
      ? (meeting.title_ar || meeting.title_en)
      : (meeting.title_en || meeting.title_ar);
    const dateCompact = (meeting.meeting_date || "").replace(/-/g, "");
    const startHHMM = (meeting.start_time || "09:00").slice(0, 5);
    let endHHMM = meeting.end_time ? meeting.end_time.slice(0, 5) : null;
    if (!endHHMM) {
      const parts = startHHMM.split(":").map(Number);
      const total = parts[0] * 60 + parts[1] + 90; // default 90-minute slot
      endHHMM = pad2(Math.floor(total / 60) % 24) + ":" + pad2(total % 60);
    }
    const esc = (s) => String(s == null ? "" : s)
      .replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,")
      .replace(/\r?\n/g, "\\n");
    const now = new Date();
    const stamp = now.getUTCFullYear() + pad2(now.getUTCMonth() + 1) + pad2(now.getUTCDate()) +
      "T" + pad2(now.getUTCHours()) + pad2(now.getUTCMinutes()) + pad2(now.getUTCSeconds()) + "Z";
    const descParts = [];
    if (meeting.description) descParts.push(meeting.description);
    if (committee) descParts.push(App.currentLang === "ar" ? committee.name_ar : committee.name_en);
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Athar Volunteer Management//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      "UID:" + (meeting.id || "athar-session") + "@athar",
      "DTSTAMP:" + stamp,
      "DTSTART;VALUE=DATE-TIME:" + dateCompact + "T" + startHHMM.replace(":", "") + "00",
      "DTEND;VALUE=DATE-TIME:" + dateCompact + "T" + endHHMM.replace(":", "") + "00",
      "SUMMARY:" + esc(title || "Athar"),
      "LOCATION:" + esc(meeting.location || ""),
      "DESCRIPTION:" + esc(descParts.join(" — ")),
      "END:VEVENT",
      "END:VCALENDAR",
      ""
    ];
    return lines.join("\r\n");
  }

  /**
   * Build a print-friendly attendance sheet that mirrors what is currently
   * marked on screen (name / phone are read from the rendered roster table).
   */
  function buildAttendanceSheetHtml(meeting, container, committee) {
    const isEvent = (meeting.kind || "meeting") === "event";
    const settings = window.AtharStore.getState().settings;
    const titleAr = meeting.title_ar || meeting.title_en || "";
    const titleEn = meeting.title_en || meeting.title_ar || "";

    const box = '<span style="display:inline-block; width:13px; height:13px; border:1.4px solid #444; border-radius:3px; vertical-align:middle;"></span>';
    const cell = 'border:1px solid #bbb; padding:6px 8px;';
    const th = 'border:1px solid #bbb; padding:7px 8px; background:#f1f3f5; font-size:12px;';

    let body = "";
    let count = 0;
    const rows = container.querySelectorAll("#attendance-roster-table tbody tr");
    rows.forEach(row => {
      const firstTd = row.querySelector("td");
      if (!firstTd) return;
      const divs = firstTd.querySelectorAll("div");
      const name = divs[0] ? divs[0].textContent.trim() : "";
      let phone = divs[1] ? divs[1].textContent.trim() : "";
      if (!name || name === "—") return;
      if (phone === "—") phone = "";
      count++;
      body += "<tr>" +
        '<td style="' + cell + ' text-align:center;">' + count + "</td>" +
        '<td style="' + cell + ' font-weight:600;">' + escHtml(name) + "</td>" +
        '<td style="' + cell + ' direction:ltr; text-align:left;">' + escHtml(phone) + "</td>" +
        '<td style="' + cell + ' text-align:center; height:30px;">' + box + "</td>" +
        '<td style="' + cell + ' height:30px;"></td>' +
        "</tr>";
    });

    const metaRows = [
      ["التاريخ / Date", formatDate(meeting.meeting_date)],
      ["الوقت / Time", (meeting.start_time || "—") + (meeting.end_time ? " - " + meeting.end_time : "")],
      ["المكان / Location", meeting.location || "—"],
      ["اللجنة / Committee", committee ? (App.currentLang === "ar" ? committee.name_ar : committee.name_en) : "—"],
    ].map(([k, v]) =>
      '<div style="font-size:12.5px; margin:2px 0;"><strong>' + escHtml(k) + ":</strong> " + escHtml(v) + "</div>"
    ).join("");

    return `
      <div style="font-family: 'Segoe UI', Tahoma, Arial, sans-serif; color:#111;" dir="rtl">
        <div style="text-align:center; margin-bottom:14px;">
          <div style="font-size:17px; font-weight:800;">${escHtml(settings.org_name_ar || "مؤسسة أثر")}</div>
          <div style="font-size:12px; color:#555;">${escHtml(settings.org_name_en || "")}</div>
          <div style="font-size:15px; font-weight:700; margin-top:10px;">كشف الحضور — ${isEvent ? "فعالية" : "اجتماع"} / Attendance Sheet</div>
          <div style="font-size:13px; margin-top:4px;">${escHtml(titleAr)}${titleEn && titleEn !== titleAr ? " — " + escHtml(titleEn) : ""}</div>
        </div>
        <div style="border:1px solid #bbb; border-radius:6px; padding:10px 12px; margin-bottom:14px; display:flex; flex-wrap:wrap; gap:4px 26px;">${metaRows}</div>
        <table style="width:100%; border-collapse:collapse; font-size:12.5px;">
          <thead>
            <tr>
              <th style="${th} width:34px;">#</th>
              <th style="${th}">الاسم / Name</th>
              <th style="${th} width:120px;">الجوال / Phone</th>
              <th style="${th} width:110px;">الحضور / Present</th>
              <th style="${th} width:150px;">التوقيع / Signature</th>
            </tr>
          </thead>
          <tbody>${body || '<tr><td colspan="5" style="' + cell + ' text-align:center; padding:10px;">—</td></tr>'}</tbody>
        </table>
        <div style="margin-top:16px; font-size:11.5px; color:#555;">
          الإجمالي / Total: ${count} &nbsp;&bull;&nbsp; أمين اللجنة / Committee Secretary: ____________________
        </div>
      </div>
    `;
  }

  // Exposed for tests / other views
  window.AtharMeetingsUtil = {
    buildICS: buildICS,
    buildAttendanceSheet: buildAttendanceSheetHtml,
  };

  window.AtharViews.meetings = (c, p) => renderSessionList(c, "meeting");
  window.AtharViews.events = (c, p) => renderSessionList(c, "event");
  window.AtharViews.meetingDetail = (c, p) => renderMeetingDetail(c, p.id);
})();