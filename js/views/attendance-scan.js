(function () {
  "use strict";

  const { App, t, ic, escapeHtml, formatDate } = window.AtharCore;
  const L = (ar, en) => (App.currentLang === "ar" ? ar : en);

  async function render(container, params) {
    const token = (params && params.id) || "";
    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <h1 class="view-title">${L("تسجيل الحضور", "Attendance Check-in")}</h1>
          <p class="view-subtitle">${L("جارٍ التحقق من رمز QR...", "Verifying QR code...")}</p>
        </div>
      </div>
      <div class="card" style="padding:24px; max-width:560px; margin:0 auto;">
        <div id="attendance-scan-body" class="empty-state">
          <div class="skeleton skeleton-text" style="width:60%;"></div>
          <div class="skeleton skeleton-text" style="width:40%;"></div>
        </div>
      </div>
    `;

    const body = document.getElementById("attendance-scan-body");
    if (!token) {
      body.innerHTML = `<p style="color:var(--danger,#dc2626);">${L("رمز QR غير صالح", "Invalid QR code")}</p>`;
      return;
    }

    try {
      const res = await window.AtharAPI.portal.checkInAttendance(token);
      const m = res.meeting || {};
      const title = App.currentLang === "ar" ? (m.titleAr || m.titleEn) : (m.titleEn || m.titleAr);
      const dateStr = m.meetingDate ? formatDate(String(m.meetingDate).slice(0, 10)) : "";
      let statusText = "";
      let statusColor = "var(--success,#16a34a)";
      if (res.status === "present") statusText = L("حاضر", "Present");
      else if (res.status === "absent") statusText = L("غائب", "Absent");
      else if (res.status === "late") statusText = L("متأخر", "Late");
      else if (res.status === "excused") statusText = L("معذور", "Excused");
      else statusText = res.status;

      body.innerHTML = `
        <div style="text-align:center;">
          <div style="font-size:48px; margin-bottom:8px;">${res.created ? "✅" : "ℹ️"}</div>
          <h2 style="margin:0 0 6px;">${escapeHtml(title || L("الاجتماع", "Meeting"))}</h2>
          <p style="color:var(--neutral-500); margin:0 0 16px;">${escapeHtml(dateStr)} ${m.startTime ? "• " + escapeHtml(m.startTime) : ""} ${m.location ? "• " + escapeHtml(m.location) : ""}</p>
          <div style="font-size:18px; font-weight:700; color:${statusColor};">${L("تم تسجيل الحضور:", "Attendance recorded:")} ${statusText}</div>
          <p style="margin-top:12px; color:var(--neutral-500); font-size:13px;">
            ${res.alreadyRecorded
              ? L("كان الحضور مسجلاً مسبقاً (لم يتم تغيير الحالة).", "Attendance was already recorded (status not changed).")
              : L("تم تسجيلك كحاضر بنجاح.", "You have been marked as present.")}
          </p>
          <button class="btn btn-primary" style="margin-top:16px;" onclick="window.AtharCore.navigateTo('portal')">${L("الذهاب إلى بوابتي", "Go to My Portal")}</button>
        </div>
      `;
    } catch (e) {
      const msg = (e && (e.message || e.error)) || L("فشل تسجيل الحضور", "Failed to record attendance");
      body.innerHTML = `
        <div style="text-align:center;">
          <div style="font-size:48px; margin-bottom:8px;">⚠️</div>
          <p style="color:var(--danger,#dc2626); font-weight:600;">${escapeHtml(msg)}</p>
          <button class="btn btn-secondary" style="margin-top:12px;" onclick="window.AtharCore.navigateTo('portal')">${L("الذهاب إلى بوابتي", "Go to My Portal")}</button>
        </div>
      `;
    }
  }

  window.AtharViews = window.AtharViews || {};
  window.AtharViews.attendanceScan = render;
})();