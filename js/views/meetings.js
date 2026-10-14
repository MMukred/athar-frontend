/**
 * View: Meetings + Events (list + detail + attendance + auto-hours + delete)
 */
(function () {
  "use strict";

  const { App, t, formatDate, ic, showToast, showConfirmModal, hasPermission, navigateTo } = window.AtharCore;

  // =========================================================================
  // Confirm + delete a session (shared by list and detail)
  // =========================================================================
  function confirmDeleteSession(session, onDeleted) {
    const isEvent = (session.kind || "meeting") === "event";
    const label = isEvent
      ? (App.currentLang === 'ar' ? 'الفعالية' : 'event')
      : (App.currentLang === 'ar' ? 'الاجتماع' : 'meeting');
    const title = App.currentLang === 'ar'
      ? `حذف ${label}`
      : `Delete ${label}`;
    const msg = App.currentLang === 'ar'
      ? `سيتم حذف "${session.title_ar || session.title_en}" نهائياً مع كل سجلات الحضور. لا يمكن التراجع.`
      : `Permanently delete "${session.title_en}" and all its attendance records. This cannot be undone.`;

    showConfirmModal({
      title,
      message: msg,
      confirmText: t("delete"),
      isDanger: true,
      onConfirm: async () => {
        try {
          await window.AtharAPI.meetings.delete(session.id);
          await window.AtharStore.refreshMeetings();
          showToast(
            App.currentLang === 'ar' ? 'تم الحذف بنجاح' : 'Deleted successfully',
            'warning'
          );
          if (onDeleted) onDeleted();
        } catch (err) {
          if (err.status === 403) {
            showToast(t("permission_denied"), "error");
          } else if (err.status === 404) {
            showToast(App.currentLang === 'ar' ? 'غير موجود' : 'Not found', "error");
          } else {
            showToast(err.message || "Delete failed", "error");
          }
        }
      },
    });
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

    const label = isEvent
      ? (App.currentLang === 'ar' ? 'الفعاليات' : 'Events')
      : t("nav_meetings");

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <div class="breadcrumb-trail">
            <span class="breadcrumb-item" onclick="window.AtharApp.navigateTo('dashboard')">${t("app_name")}</span>
            <span class="breadcrumb-separator">/</span>
            <span>${label}</span>
          </div>
          <h1 class="view-title">${label}</h1>
          <p class="view-subtitle">
            ${isEvent
        ? (App.currentLang === 'ar' ? 'فعاليات بمدة زمنية وساعات تطوعية تلقائية' : 'Time-bounded events with auto-logged volunteer hours')
        : (App.currentLang === 'ar' ? 'الاجتماعات الدورية وكشوف التحضير' : 'Recurring meetings and attendance rosters')}
          </p>
        </div>
        <div class="view-header-actions">
          ${canCreate ? `<button class="btn btn-primary" id="btn-add-session">
            ${ic("plus", 14)} ${isEvent ? (App.currentLang === 'ar' ? 'فعالية جديدة' : 'New Event') : t("add_meeting")}
          </button>` : ''}
        </div>
      </div>

      ${sessions.length === 0 ? `
        <div class="card" style="text-align:center; padding:48px;">
          <div style="color:var(--neutral-400); margin-bottom:12px;">${ic(isEvent ? "sparkles" : "calendar", 42, { strokeWidth: 1.5 })}</div>
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
                <th>Date</th>
                <th>Title</th>
                <th>Committee</th>
                <th>Time & Location</th>
                <th>Status</th>
                <th>Attendance</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${sessions.map(m => {
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
                    <td><span>${comm ? (App.currentLang === 'ar' ? comm.name_ar : comm.name_en) : '—'}</span></td>
                    <td>
                      <div style="font-size:12px;">${ic("clock", 12)} <span class="num-ltr">${m.start_time} - ${m.end_time || ''}</span></div>
                      <div style="font-size:11px; color:var(--neutral-500);">${m.location || '—'}</div>
                    </td>
                    <td>
                      <span class="badge ${m.status === 'completed' ? 'badge-success' : m.status === 'scheduled' ? 'badge-primary' : 'badge-danger'}">
                        ${t(m.status)}
                      </span>
                    </td>
                    <td>
                      ${m.status === 'completed' && summary ? `
                        <span class="badge badge-success num-ltr">${presentCount} / ${totalAttendees}</span>
                      ` : `<span style="color:var(--neutral-400);">—</span>`}
                    </td>
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

    // Delete buttons
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
  // Session detail — attendance + auto-hours + delete
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
    const backLabel = isEvent
      ? (App.currentLang === 'ar' ? 'الفعاليات' : 'Events')
      : t("nav_meetings");
    const canDelete = hasPermission("meetings", "delete");

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
    // Auto-hours button only needs a valid duration (end_time).
    const showAutoHours = isCompleted && !!meeting.end_time;

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <div class="breadcrumb-trail">
            <span class="breadcrumb-item" onclick="window.AtharApp.navigateTo('${backView}')">${backLabel}</span>
            <span class="breadcrumb-separator">/</span>
            <span>${App.currentLang === 'ar' ? meeting.title_ar : meeting.title_en}</span>
          </div>
          <h1 class="view-title">
            ${ic(isEvent ? "sparkles" : "calendar", 22)}
            ${App.currentLang === 'ar' ? meeting.title_ar : meeting.title_en}
          </h1>
          <p class="view-subtitle">
            ${formatDate(meeting.meeting_date)} &bull; ${meeting.start_time} - ${meeting.end_time || ''} &bull; ${meeting.location || '—'}
            ${isDraft && !isCompleted ? '&bull; <span class="badge badge-warning">DRAFT ROSTER</span>' : ''}
            ${isCompleted ? '&bull; <span class="badge badge-success">COMPLETED</span>' : ''}
          </p>
        </div>
        <div class="view-header-actions">
          <button class="btn btn-secondary btn-sm" id="btn-bulk-present">${ic("check", 14)} ${t("mark_all_present")}</button>
          <button class="btn btn-secondary btn-sm" id="btn-bulk-absent">${ic("x", 14)} ${t("mark_all_absent")}</button>
          <button class="btn btn-success" id="btn-save-attendance">${ic("check_circle", 14)} ${t("save")}</button>
          ${showAutoHours ? `
            <button class="btn btn-secondary" id="btn-auto-hours" title="${App.currentLang === 'ar' ? 'إعادة تسجيل الساعات لغير المسجلين' : 'Re-run auto-log for anyone not yet logged'}">
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
        <div style="padding:10px 14px; background:var(--primary-light); border:1px solid var(--primary-border); border-radius:var(--radius-md); margin-bottom:16px; font-size:12.5px; color:var(--primary); display:flex; align-items:center; gap:8px;">
          ${ic("info", 14)}
          <span>
            ${App.currentLang === 'ar'
          ? 'عند الحفظ، سيتم تسجيل الساعات تلقائياً لكل من حضر أو تأخر، حسب مدة الفعالية.'
          : 'On save, hours will be auto-logged for everyone Present or Late, based on event duration.'}
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
              <th>Volunteer</th>
              <th style="width:180px;">Status</th>
              <th>${t("note")}</th>
              <th style="text-align:right;">Quick Actions</th>
            </tr>
          </thead>
          <tbody>
            ${roster.length === 0 ? `
              <tr><td colspan="4" style="text-align:center; padding:24px;">No eligible volunteers.</td></tr>
            ` : roster.map(rec => {
            const vol = rec.volunteer || {};
            const waNumber = (vol.whatsapp || vol.phone || "").replace(/[^0-9]/g, "");
            const tmpl = state.whatsapp_templates.find(x => x.name && x.name.includes("Invitation") && x.language === App.currentLang)
              || state.whatsapp_templates[0];
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

    // Save attendance + auto-log hours
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
                showToast(
                  App.currentLang === 'ar'
                    ? `تم حفظ الحضور · الساعات مسجلة مسبقاً لـ ${res.skipped}`
                    : `Saved attendance · Hours already logged for ${res.skipped}`,
                  "info"
                );
              } else {
                showToast(
                  App.currentLang === 'ar'
                    ? `تم حفظ ${records.length} سجل حضور`
                    : `Saved ${records.length} attendance records`,
                  "success"
                );
              }
            } catch (autoErr) {
              console.warn("[auto-hours] failed", autoErr);
              if (autoErr.code === "NO_END_TIME") {
                showToast(
                  App.currentLang === 'ar'
                    ? "تم حفظ الحضور · أضف وقت انتهاء لتسجيل الساعات تلقائياً"
                    : "Attendance saved · Add an end time to auto-log hours",
                  "warning"
                );
              } else if (autoErr.status === 403) {
                showToast(
                  App.currentLang === 'ar'
                    ? "تم حفظ الحضور · لا توجد صلاحية لتسجيل الساعات"
                    : "Attendance saved · No permission to log hours",
                  "warning"
                );
              } else {
                showToast(
                  App.currentLang === 'ar'
                    ? `تم حفظ الحضور · فشل تسجيل الساعات: ${autoErr.message || 'خطأ'}`
                    : `Attendance saved · Auto-log failed: ${autoErr.message || 'unknown error'}`,
                  "warning"
                );
              }
            }
          } else {
            showToast(
              App.currentLang === 'ar'
                ? `تم حفظ ${records.length} سجل حضور`
                : `Saved ${records.length} attendance records`,
              "success"
            );
          }

          renderMeetingDetail(container, meetingId);
        } catch (err) {
          showToast(err.message || "Save failed", "error");
          saveBtn.disabled = false;
          saveBtn.innerHTML = orig;
        }
      };
    }

    // Re-log hours (manual fallback)
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
            showToast(
              App.currentLang === 'ar' ? "لا يوجد حاضرون أو متأخرون لتسجيل ساعاتهم" : "No one was marked Present or Late",
              "warning"
            );
          } else if (res.created === 0) {
            showToast(
              App.currentLang === 'ar' ? `تم تخطي ${res.skipped} (مسجل مسبقاً)` : `Skipped ${res.skipped} (already logged)`,
              "info"
            );
          } else {
            let msg = App.currentLang === 'ar'
              ? `تم تسجيل ${res.hours} ساعة لـ ${res.created} متطوع`
              : `Logged ${res.hours}h for ${res.created} volunteer(s)`;
            if (res.skipped) msg += App.currentLang === 'ar' ? ` — تم تخطي ${res.skipped}` : ` — skipped ${res.skipped}`;
            showToast(msg, "success");
          }
        } catch (err) {
          if (err.code === "NO_END_TIME") {
            showToast(
              App.currentLang === 'ar' ? "أضف وقت انتهاء أولاً" : "Set an end time first",
              "error"
            );
          } else {
            showToast(err.message || "Auto-log failed", "error");
          }
        } finally {
          autoBtn.disabled = false;
          autoBtn.innerHTML = orig;
        }
      };
    }

    // Delete this session
    const deleteBtn = document.getElementById("btn-delete-session");
    if (deleteBtn) {
      deleteBtn.onclick = () => {
        confirmDeleteSession(meeting, () => {
          navigateTo(backView);
        });
      };
    }
  }

  // Register all three views
  window.AtharViews.meetings = (c, p) => renderSessionList(c, "meeting");
  window.AtharViews.events = (c, p) => renderSessionList(c, "event");
  window.AtharViews.meetingDetail = (c, p) => renderMeetingDetail(c, p.id);
})();