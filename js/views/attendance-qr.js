(function () {
  "use strict";

  const { App, t, ic, escapeHtml, formatDate, showToast } = window.AtharCore;

  // Draw the attendance QR locally (js/vendor/qrcode.js) so the scan link
  // never leaves the browser and the code shows even without internet.
  function localQrSvg(text) {
    try {
      const qr = window.qrcode(0, "M");
      qr.addData(String(text || ""));
      qr.make();
      return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    } catch (e) {
      return '<p style="color:var(--danger,#dc2626); font-size:12px;">QR</p>';
    }
  }
  const L = (ar, en) => (App.currentLang === "ar" ? ar : en);

  async function render(container, params) {
    const meetingId = (params && params.id) || "";
    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <h1 class="view-title">${L("رمز QR للحضور", "Attendance QR")}</h1>
          <p class="view-subtitle">${L("جارٍ التحميل...", "Loading...")}</p>
        </div>
      </div>
      <div class="card" style="padding:24px; max-width:640px; margin:0 auto;">
        <div id="attendance-qr-body"><div class="skeleton skeleton-text" style="width:60%;"></div></div>
      </div>
    `;

    const body = document.getElementById("attendance-qr-body");
    if (!meetingId) {
      body.innerHTML = `<p style="color:var(--danger,#dc2626);">${L("اجتماع غير صالح", "Invalid meeting")}</p>`;
      return;
    }

    let qrRes = null;
    try {
      qrRes = await window.AtharAPI.meetings.getAttendanceQr(meetingId);
    } catch (e) {
      body.innerHTML = `<p style="color:var(--danger,#dc2626);">${escapeHtml((e && e.message) || L("فشل تحميل QR", "Failed to load QR"))}</p>`;
      return;
    }

    const m = qrRes.meeting || {};
    const title = App.currentLang === "ar" ? (m.titleAr || m.titleEn) : (m.titleEn || m.titleAr);
    const dateStr = m.meetingDate ? formatDate(String(m.meetingDate).slice(0, 10)) : "";
    const qrMarkup = localQrSvg(qrRes.scanUrl);

    container.querySelector(".view-subtitle").textContent = title || "";

    body.innerHTML = `
      <div style="text-align:center; margin-bottom:16px;">
        <h2 style="margin:0 0 6px;">${escapeHtml(title || L("الاجتماع", "Meeting"))}</h2>
        <p style="color:var(--neutral-500); margin:0 0 12px;">${escapeHtml(dateStr)} ${m.startTime ? "• " + escapeHtml(m.startTime) : ""} ${m.location ? "• " + escapeHtml(m.location) : ""}</p>
        <div role="img" aria-label="QR" style="display:inline-block; width:220px; height:220px; border-radius:8px; background:#fff; padding:8px;">${qrMarkup}</div>
        <p style="font-size:13px; color:var(--neutral-500); margin:8px 0 4px;">${L("امسح هذا الرمز لتسجيل حضورك", "Scan this code to check in")}</p>
      </div>
      <div style="border-top:1px solid var(--neutral-200,#e5e7eb); padding-top:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <strong style="font-size:14px;">${L("الحاضرون", "Checked-in attendees")}</strong>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-secondary btn-sm" id="qr-refresh">${ic("refresh", 13)} ${L("تحديث", "Refresh")}</button>
            <button class="btn btn-secondary btn-sm" id="qr-manual">${L("الحضور اليدوي", "Manual attendance")}</button>
          </div>
        </div>
        <div id="qr-attendance-list" style="max-height:320px; overflow:auto; border:1px solid var(--neutral-200,#e5e7eb); border-radius:8px; padding:8px;">
          <div style="color:var(--neutral-500); font-size:13px;">${L("جارٍ التحميل...", "Loading...")}</div>
        </div>
      </div>
    `;

    async function loadAttendance() {
      try {
        const roster = await window.AtharAPI.meetings.getRoster(meetingId);
        const list = (roster.roster || []).filter(r => r.saved);
        const el = document.getElementById("qr-attendance-list");
        if (!el) return;
        if (list.length === 0) {
          el.innerHTML = `<div style="color:var(--neutral-500); font-size:13px; padding:8px;">${L("لم يسجل أحد حضوره بعد", "No one has checked in yet")}</div>`;
          return;
        }
        el.innerHTML = list.map(r => {
          const v = r.volunteer || {};
          const name = App.currentLang === "ar" ? (v.fullNameAr || v.fullName) : (v.fullName || v.fullNameAr);
          const comm = v.committee ? (App.currentLang === "ar" ? (v.committee.nameAr || v.committee.nameEn) : (v.committee.nameEn || v.committee.nameAr)) : L("بدون لجنة", "No committee");
          return `<div style="display:flex; justify-content:space-between; align-items:center; padding:6px 4px; border-bottom:1px solid var(--neutral-100,#f3f4f6);">
            <div>
              <div style="font-weight:600; font-size:13px;">${escapeHtml(name || "")}</div>
              <div style="font-size:11px; color:var(--neutral-500);">${escapeHtml(comm)}${r.recordedAt ? " • " + escapeHtml(new Date(r.recordedAt).toLocaleString(App.currentLang === "ar" ? "ar-u-ca-gregory-nu-latn" : "en-US")) : ""}</div>
            </div>
            <span class="badge ${r.status === 'present' ? 'badge-success' : r.status === 'absent' ? 'badge-danger' : 'badge-warning'}" style="font-size:11px;">${escapeHtml(r.status || "")}</span>
          </div>`;
        }).join("");
      } catch (e) {
        const el = document.getElementById("qr-attendance-list");
        if (el) el.innerHTML = `<div style="color:var(--danger,#dc2626); font-size:13px;">${escapeHtml((e && e.message) || L("فشل", "Failed"))}</div>`;
      }
    }

    document.getElementById("qr-refresh").onclick = loadAttendance;
    const qrManual = document.getElementById("qr-manual");
    if (qrManual) qrManual.onclick = () => { window.AtharApp.navigateTo("meeting-detail", { id: meetingId }); };
    loadAttendance();
    const poll = setInterval(() => {
      if (document.getElementById("qr-attendance-list")) loadAttendance();
      else clearInterval(poll);
    }, 5000);
  }

  function showStandalone(meetingId) {
    let screen = document.getElementById("attendance-qr-screen");
    if (!screen) {
      screen = document.createElement("div");
      screen.id = "attendance-qr-screen";
      screen.className = "public-verify-screen";
      document.body.appendChild(screen);
    }

    screen.innerHTML = `
      <header class="pv-topbar">
        <div class="pv-brand">
          <img src="assets/logo.svg" alt="Athar" class="pv-logo">
          <span>${escapeHtml(t("app_name") || "Athar")}</span>
        </div>
      </header>
      <main class="pv-main" style="padding:20px 10px 60px;">
        <div style="width:min(94vw, 380px); background:var(--surface); border:1px solid var(--neutral-300); border-radius:var(--radius-xl); box-shadow:var(--shadow-md); padding:20px;">
          <div id="aqr-body">
            <div class="skeleton skeleton-text" style="width:60%;"></div>
          </div>
        </div>
      </main>
    `;

    const body = document.getElementById("aqr-body");
    if (!meetingId) {
      body.innerHTML = `<p style="color:var(--danger,#dc2626);">${L("اجتماع غير صالح", "Invalid meeting")}</p>`;
      return;
    }

    (async () => {
      let qrRes;
      try {
        qrRes = await window.AtharAPI.meetings.getAttendanceQr(meetingId);
      } catch (e) {
        body.innerHTML = `<p style="color:var(--danger,#dc2626);">${escapeHtml((e && e.message) || L("فشل", "Failed"))}</p>
          <p style="margin-top:12px;"><a href="#" id="aqr-login">${L("تسجيل الدخول", "Sign in")}</a></p>`;
        const link = document.getElementById("aqr-login");
        if (link) link.onclick = (ev) => { ev.preventDefault(); const s = document.getElementById("attendance-qr-screen"); if (s) s.remove(); if (window.AtharAuth) window.AtharAuth.showLoginScreen(); };
        return;
      }
      const m = qrRes.meeting || {};
      const title = App.currentLang === "ar" ? (m.titleAr || m.titleEn) : (m.titleEn || m.titleAr);
      const dateStr = m.meetingDate ? formatDate(String(m.meetingDate).slice(0, 10)) : "";
      const qrMarkup = localQrSvg(qrRes.scanUrl);

      body.innerHTML = `
        <div style="text-align:center; margin-bottom:16px;">
          <h2 style="margin:0 0 6px;">${escapeHtml(title || L("الاجتماع", "Meeting"))}</h2>
          <p style="color:var(--neutral-500); margin:0 0 12px;">${escapeHtml(dateStr)} ${m.startTime ? "• " + escapeHtml(m.startTime) : ""} ${m.location ? "• " + escapeHtml(m.location) : ""}</p>
          <div role="img" aria-label="QR" style="display:inline-block; width:220px; height:220px; border-radius:8px; background:#fff; padding:8px;">${qrMarkup}</div>
          <p style="font-size:13px; color:var(--neutral-500); margin:8px 0 4px;">${L("امسح هذا الرمز لتسجيل حضورك", "Scan this code to check in")}</p>
        </div>
        <div style="border-top:1px solid var(--neutral-200,#e5e7eb); padding-top:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <strong style="font-size:14px;">${L("الحاضرون", "Checked-in attendees")}</strong>
            <button class="btn btn-secondary btn-sm" id="aqr-refresh">${ic("refresh", 13)} ${L("تحديث", "Refresh")}</button>
          </div>
          <div id="aqr-list" style="max-height:260px; overflow:auto; padding:4px 0;">
            <div style="color:var(--neutral-500); font-size:13px;">${L("جارٍ التحميل...", "Loading...")}</div>
          </div>
        </div>
        <div style="text-align:center; margin-top:14px;">
          <button class="btn btn-secondary btn-sm" id="aqr-manual">${L("الحضور اليدوي", "Manual attendance")}</button>
        </div>
      `;

      async function loadAttendance() {
        try {
          const roster = await window.AtharAPI.meetings.getRoster(meetingId);
          const list = (roster.roster || []).filter(r => r.saved);
          const el = document.getElementById("aqr-list");
          if (!el) return;
          if (list.length === 0) {
            el.innerHTML = `<div style="color:var(--neutral-500); font-size:13px; padding:8px;">${L("لم يسجل أحد حضوره بعد", "No one has checked in yet")}</div>`;
            return;
          }
          el.innerHTML = list.map(r => {
            const v = r.volunteer || {};
            const name = App.currentLang === "ar" ? (v.fullNameAr || v.fullName) : (v.fullName || v.fullNameAr);
            const comm = v.committee ? (App.currentLang === "ar" ? (v.committee.nameAr || v.committee.nameEn) : (v.committee.nameEn || v.committee.nameAr)) : L("بدون لجنة", "No committee");
            return `<div style="display:flex; justify-content:space-between; align-items:center; padding:6px 4px; border-bottom:1px solid var(--neutral-100,#f3f4f6);">
              <div>
                <div style="font-weight:600; font-size:13px;">${escapeHtml(name || "")}</div>
                <div style="font-size:11px; color:var(--neutral-500);">${escapeHtml(comm)}${r.recordedAt ? " • " + escapeHtml(new Date(r.recordedAt).toLocaleString(App.currentLang === "ar" ? "ar-u-ca-gregory-nu-latn" : "en-US")) : ""}</div>
              </div>
              <span class="badge ${r.status === 'present' ? 'badge-success' : r.status === 'absent' ? 'badge-danger' : 'badge-warning'}" style="font-size:11px;">${escapeHtml(r.status || "")}</span>
            </div>`;
          }).join("");
        } catch (e) {
          const el = document.getElementById("aqr-list");
          if (el) el.innerHTML = `<div style="color:var(--danger,#dc2626); font-size:13px;">${escapeHtml((e && e.message) || L("فشل", "Failed"))}</div>`;
        }
      }
      document.getElementById("aqr-refresh").onclick = loadAttendance;
      const manualBtn = document.getElementById("aqr-manual");
      if (manualBtn) manualBtn.onclick = () => {
        const s = document.getElementById("attendance-qr-screen");
        if (s) s.remove();
        window.location.href = window.location.origin + window.location.pathname + "#meeting-detail/" + encodeURIComponent(meetingId);
        window.location.reload();
      };
      loadAttendance();
      const poll = setInterval(() => {
        if (document.getElementById("aqr-list")) loadAttendance();
        else clearInterval(poll);
      }, 5000);
    })();
  }

  window.AtharViews = window.AtharViews || {};
  window.AtharViews.attendanceQr = render;
  window.AtharViews.showAttendanceQrStandalone = showStandalone;
})();