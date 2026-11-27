/**
 * In-app attendance scanner for volunteers.
 *
 * Opens the phone camera inside the portal, reads the meeting's attendance QR
 * and records attendance for the signed-in volunteer straight away (no second
 * sign-in). Uses the browser's BarcodeDetector where available and falls back
 * to jsQR (js/vendor/jsqr.min.js, loaded only when needed).
 */
window.AtharScanner = (function () {
  "use strict";

  const L = (ar, en) => ((window.AtharCore && window.AtharCore.App.currentLang === "en") ? en : ar);
  const esc = (s) => (window.AtharCore ? window.AtharCore.escapeHtml(s) : String(s || ""));

  let stream = null;
  let rafId = null;
  let busy = false;

  function tokenFrom(text) {
    const raw = String(text || "").trim();
    const m = raw.match(/#attendance-scan\/([^/?#\s]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function loadJsQR() {
    if (window.jsQR) return Promise.resolve(window.jsQR);
    return new Promise(function (resolve, reject) {
      const s = document.createElement("script");
      s.src = "js/vendor/jsqr.min.js";
      s.onload = function () { resolve(window.jsQR); };
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function stop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if (stream) stream.getTracks().forEach(function (tr) { tr.stop(); });
    stream = null;
  }

  function close() {
    stop();
    const el = document.getElementById("qr-scanner");
    if (el) el.remove();
    document.body.classList.remove("qr-scanner-open");
  }

  function shell() {
    close();
    const el = document.createElement("div");
    el.id = "qr-scanner";
    el.className = "qr-scanner";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-label", L("تسجيل الحضور", "Check in"));
    document.body.appendChild(el);
    document.body.classList.add("qr-scanner-open");
    return el;
  }

  function closeBtn() {
    return '<button type="button" class="qr-close" aria-label="' + L("إغلاق", "Close") + '">' +
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button>';
  }

  function showMessage(el, kind, title, body) {
    stop();
    const icon = kind === "ok"
      ? '<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>'
      : '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>';
    el.innerHTML =
      '<div class="qr-panel qr-result qr-' + kind + '">' + closeBtn() +
      '<span class="qr-result-icon">' + icon + "</span>" +
      '<h2 class="qr-title">' + esc(title) + "</h2>" +
      '<div class="qr-body">' + body + "</div>" +
      '<div class="qr-actions">' +
      (kind === "ok" ? "" : '<button type="button" class="qr-btn qr-btn-ghost" data-act="again">' + L("حاول مرة أخرى", "Try again") + "</button>") +
      '<button type="button" class="qr-btn" data-act="done">' + L("تم", "Done") + "</button></div></div>";
    el.querySelector(".qr-close").onclick = close;
    el.querySelector('[data-act="done"]').onclick = function () {
      close();
      if (kind === "ok" && window.AtharApp && window.AtharApp.navigateTo) window.AtharApp.navigateTo("portal");
    };
    const again = el.querySelector('[data-act="again"]');
    if (again) again.onclick = open;
  }

  async function checkIn(el, token) {
    busy = true;
    el.querySelector(".qr-hint").textContent = L("جارٍ تسجيل حضورك…", "Recording your attendance…");
    try {
      const res = await window.AtharAPI.portal.checkInAttendance(token);
      const m = (res && res.meeting) || {};
      const ar = !(window.AtharCore && window.AtharCore.App.currentLang === "en");
      const title = ar ? (m.titleAr || m.titleEn) : (m.titleEn || m.titleAr);
      const date = m.meetingDate ? window.AtharCore.formatDate(String(m.meetingDate).slice(0, 10)) : "";
      const status = { present: L("حاضر", "Present"), late: L("متأخر", "Late") }[res && res.status] || (res && res.status) || "";
      showMessage(el, "ok",
        (res && res.alreadyRecorded) ? L("حضورك مسجّل من قبل", "Already checked in") : L("تم تسجيل حضورك", "You're checked in"),
        '<p class="qr-meeting">' + esc(title || L("الاجتماع", "Meeting")) + "</p>" +
        '<p class="qr-meta">' + esc([date, m.startTime].filter(Boolean).join(" • ")) + "</p>" +
        (status ? '<span class="qr-chip">' + esc(status) + "</span>" : ""));
    } catch (e) {
      if (!navigator.onLine || (e && e.status === 0)) {
        queuePush(token);
        showMessage(el, "ok", L("حُفظ حضورك على جهازك", "Saved on your device"),
          "<p>" + L("لا يوجد اتصال الآن. سنرسل تسجيل حضورك تلقائياً فور عودة الإنترنت — أبقِ التطبيق مفتوحاً أو افتحه لاحقاً اليوم.",
            "You're offline. Your check-in will be sent automatically when the connection returns — keep the app open or reopen it later today.") + "</p>" +
          '<span class="qr-chip">' + L("بانتظار الإرسال", "Waiting to send") + "</span>");
        return;
      }
      showMessage(el, "err", L("تعذّر تسجيل الحضور", "Could not check in"),
        "<p>" + esc((e && e.message) || L("الرمز غير صالح أو انتهت صلاحيته.", "The code is invalid or has expired.")) + "</p>");
    } finally {
      busy = false;
    }
  }

  async function open() {
    const el = shell();
    el.innerHTML =
      '<div class="qr-panel">' + closeBtn() +
      '<h2 class="qr-title">' + L("امسح رمز الحضور", "Scan the attendance code") + "</h2>" +
      '<p class="qr-hint">' + L("وجّه الكاميرا نحو الرمز المعروض في القاعة", "Point your camera at the code shown in the room") + "</p>" +
      '<div class="qr-frame"><video playsinline muted></video><span class="qr-corner tl"></span><span class="qr-corner tr"></span><span class="qr-corner bl"></span><span class="qr-corner br"></span><span class="qr-line"></span></div>' +
      "</div>";
    el.querySelector(".qr-close").onclick = close;
    const video = el.querySelector("video");

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showMessage(el, "err", L("الكاميرا غير متاحة", "Camera unavailable"),
        "<p>" + L("افتح النظام من متصفح الجوال، أو امسح الرمز بكاميرا الجوال العادية.", "Open the app in your phone browser, or scan the code with your normal camera app.") + "</p>");
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
    } catch (e) {
      showMessage(el, "err", L("لم يُسمح باستخدام الكاميرا", "Camera permission denied"),
        "<p>" + L("اسمح للمتصفح باستخدام الكاميرا من الإعدادات ثم حاول مرة أخرى.", "Allow camera access in your browser settings, then try again.") + "</p>");
      return;
    }
    video.srcObject = stream;
    try { await video.play(); } catch (e) { /* autoplay with muted video is allowed */ }

    let detector = null;
    if ("BarcodeDetector" in window) {
      try { detector = new window.BarcodeDetector({ formats: ["qr_code"] }); } catch (e) { detector = null; }
    }
    let jsQR = null;
    if (!detector) {
      try { jsQR = await loadJsQR(); } catch (e) { jsQR = null; }
    }
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    async function tick() {
      if (!stream || busy) return;
      if (video.readyState >= 2) {
        let text = null;
        try {
          if (detector) {
            const codes = await detector.detect(video);
            if (codes && codes[0]) text = codes[0].rawValue;
          } else if (jsQR) {
            const w = video.videoWidth, h = video.videoHeight;
            if (w && h) {
              const scale = Math.min(1, 640 / Math.max(w, h));
              canvas.width = Math.round(w * scale);
              canvas.height = Math.round(h * scale);
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
              if (code) text = code.data;
            }
          }
        } catch (e) { /* keep scanning */ }
        if (text) {
          const token = tokenFrom(text);
          if (token) { checkIn(el, token); return; }
          el.querySelector(".qr-hint").textContent = L("هذا ليس رمز حضور أثر", "This is not an Athar attendance code");
        }
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && document.getElementById("qr-scanner")) close();
  });

  // ---- Offline check-in queue -------------------------------------------
  // Tokens scanned without a connection are kept locally (max 12h) and sent
  // when the device is back online. The server still validates each token.
  const QKEY = "athar_checkin_queue_v1";
  const QTTL = 12 * 60 * 60 * 1000;
  function queueRead() {
    try { return (JSON.parse(localStorage.getItem(QKEY) || "[]") || []).filter(function (q) { return q && q.token && Date.now() - q.at < QTTL; }); }
    catch (e) { return []; }
  }
  function queueWrite(list) {
    try { if (list.length) localStorage.setItem(QKEY, JSON.stringify(list)); else localStorage.removeItem(QKEY); } catch (e) { /* ignore */ }
  }
  function queuePush(token) {
    const list = queueRead().filter(function (q) { return q.token !== token; });
    list.push({ token: token, at: Date.now() });
    queueWrite(list);
  }
  let flushing = false;
  async function flushQueue() {
    if (flushing || !navigator.onLine) return;
    if (!(window.AtharCore && window.AtharCore.App.currentUser)) return;
    const list = queueRead();
    if (!list.length) return;
    flushing = true;
    const keep = [];
    let sent = 0, failed = 0;
    for (const q of list) {
      try { await window.AtharAPI.portal.checkInAttendance(q.token); sent++; }
      catch (e) { if (e && e.status === 0) keep.push(q); else failed++; }
    }
    queueWrite(keep);
    flushing = false;
    const toast = window.AtharCore && window.AtharCore.showToast;
    if (toast && sent) toast(L("تم إرسال حضورك المحفوظ ✓", "Your saved check-in was sent ✓"), "success");
    if (toast && failed) toast(L("تعذّر إرسال حضور محفوظ — ربما انتهت صلاحية الرمز. راجع مسؤول اللجنة.", "A saved check-in failed — the code may have expired. Contact your committee lead."), "error");
  }
  window.addEventListener("online", flushQueue);
  setInterval(flushQueue, 60 * 1000);
  setTimeout(flushQueue, 4000);

  return { open: open, close: close, tokenFrom: tokenFrom, flushQueue: flushQueue, pending: function () { return queueRead().length; } };
})();
