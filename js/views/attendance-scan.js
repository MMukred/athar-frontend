(function () {
  "use strict";

  const { App, t, ic, escapeHtml, formatDate } = window.AtharCore;
  const L = (ar, en) => (App.currentLang === "ar" ? ar : en);

  async function render(container, params) {
    const token = (params && params.id) || "";
    const prefillEmail = (App.currentUser && App.currentUser.email) ? App.currentUser.email : "";

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <h1 class="view-title">${L("تسجيل الحضور", "Attendance Check-in")}</h1>
          <p class="view-subtitle">${L("يرجى تسجيل الدخول لتأكيد حضورك", "Please sign in to confirm your attendance")}</p>
        </div>
      </div>
      <div class="card" style="padding:24px; max-width:420px; margin:0 auto;">
        <div id="attendance-scan-body">
          <div class="form-group">
            <label class="form-label">${L("البريد الإلكتروني", "Email")}</label>
            <input class="form-control" id="scan-email" type="email" value="${escapeHtml(prefillEmail)}" />
          </div>
          <div class="form-group">
            <label class="form-label">${L("كلمة المرور", "Password")}</label>
            <input class="form-control" id="scan-password" type="password" />
          </div>
          <button class="btn btn-primary" id="scan-login-btn" style="width:100%;">${L("تسجيل الدخول وتسجيل الحضور", "Sign in & check in")}</button>
          <div id="scan-result" style="margin-top:12px;"></div>
        </div>
      </div>
    `;

    const resultEl = document.getElementById("scan-result");
    const btn = document.getElementById("scan-login-btn");
    btn.onclick = async () => {
      const email = (document.getElementById("scan-email").value || "").trim();
      const password = document.getElementById("scan-password").value || "";
      if (!email || !password) {
        resultEl.innerHTML = `<p style="color:var(--danger,#dc2626);">${L("أدخل البريد وكلمة المرور", "Enter email and password")}</p>`;
        return;
      }
      btn.disabled = true;
      try {
        const loginResult = await window.AtharAuth.login(email, password, false);
        if (!loginResult || !loginResult.success) {
          throw new Error((loginResult && loginResult.error) || L("فشل تسجيل الدخول", "Login failed"));
        }
        App.currentUser = loginResult.user;

        const res = await window.AtharAPI.portal.checkInAttendance(token);
        const m = res.meeting || {};
        const title = App.currentLang === "ar" ? (m.titleAr || m.titleEn) : (m.titleEn || m.titleAr);
        const dateStr = m.meetingDate ? formatDate(String(m.meetingDate).slice(0, 10)) : "";
        resultEl.innerHTML = `
          <div style="text-align:center;">
            <div style="font-size:40px; margin-bottom:8px;">${res.created ? "✅" : "ℹ️"}</div>
            <h3 style="margin:0 0 6px;">${escapeHtml(title || L("الاجتماع", "Meeting"))}</h3>
            <p style="color:var(--neutral-500); margin:0 0 8px;">${escapeHtml(dateStr)} ${m.startTime ? "• " + escapeHtml(m.startTime) : ""}</p>
            <div style="font-weight:700; color:var(--success,#16a34a);">${L("تم تسجيل الحضور:", "Attendance recorded:")} ${escapeHtml(res.status || "")}</div>
            <p style="margin-top:8px; color:var(--neutral-500); font-size:13px;">
              ${res.alreadyRecorded
                ? L("كان الحضور مسجلاً مسبقاً (لم يتم تغيير الحالة).", "Attendance was already recorded (status not changed).")
                : L("تم تسجيلك كحاضر بنجاح.", "You have been marked as present.")}
            </p>
          </div>
        `;
      } catch (e) {
        resultEl.innerHTML = `<p style="color:var(--danger,#dc2626);">${escapeHtml((e && e.message) || L("فشل", "Failed"))}</p>`;
      } finally {
        btn.disabled = false;
      }
    };
  }

  // Standalone shell for anonymous visitors arriving from a QR scan link.
  function showAttendanceScanStandalone(meetingId) {
    let screen = document.getElementById("attendance-scan-screen");
    if (!screen) {
      screen = document.createElement("div");
      screen.id = "attendance-scan-screen";
      screen.className = "attendance-scan-screen";
      document.body.appendChild(screen);
    }
    render(screen, { id: meetingId || "" });
  }

  window.AtharViews.attendanceScan = render;
  window.AtharViews.showAttendanceScanStandalone = showAttendanceScanStandalone;
})();