/**
 * Volunteer levels, badges and the shareable "My impact" card.
 * window.AtharImpact = { level(hours), badgesHtml(hours), openCard(info) }
 */
(function () {
  "use strict";

  const { App, ic, escapeHtml, showToast } = window.AtharCore;
  const L = (ar, en) => (App.currentLang === "ar" ? ar : en);

  // Thresholds approved with the team: 30 / 60 / 100 approved hours.
  const LEVELS = [
    { min: 0, key: "seed", ar: "بذرة أثر", en: "Seed", color: "#8A93A6" },
    { min: 30, key: "sprout", ar: "غرسة أثر", en: "Sprout", color: "#B0793A" },
    { min: 60, key: "tree", ar: "شجرة أثر", en: "Tree", color: "#8C9BB0" },
    { min: 100, key: "lasting", ar: "أثر ممتد", en: "Lasting impact", color: "#C29E1A" },
  ];

  function level(hours) {
    const h = Number(hours) || 0;
    let idx = 0;
    LEVELS.forEach((l, i) => { if (h >= l.min) idx = i; });
    const cur = LEVELS[idx];
    const next = LEVELS[idx + 1] || null;
    return { cur, next, idx, toNext: next ? Math.max(0, Math.ceil((next.min - h) * 10) / 10) : 0 };
  }

  const MEDAL = (color, locked) => `
    <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true">
      <path d="M15 3h8l-4 13h-8z" fill="${locked ? "#C9CED8" : "#2D5490"}"/>
      <path d="M33 3h-8l4 13h8z" fill="${locked ? "#B6BCC8" : "#1D2B46"}"/>
      <circle cx="24" cy="30" r="14" fill="${locked ? "#DADDE4" : color}"/>
      <circle cx="24" cy="30" r="10" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.6"/>
      <path d="M24 23.5l2 4.2 4.6.6-3.3 3.2.8 4.6-4.1-2.2-4.1 2.2.8-4.6-3.3-3.2 4.6-.6z" fill="#fff" fill-opacity="${locked ? ".7" : ".95"}"/>
    </svg>`;

  function badgesHtml(hours) {
    const h = Number(hours) || 0;
    const lv = level(h);
    const items = LEVELS.slice(1).map(l => {
      const got = h >= l.min;
      const left = Math.ceil((l.min - h) * 10) / 10;
      return `<div class="impact-badge ${got ? "is-earned" : "is-locked"}" title="${escapeHtml(L(l.ar, l.en))}">
        ${MEDAL(l.color, !got)}
        <strong>${L(l.ar, l.en)}</strong>
        <span class="num-ltr">${got ? L("تم ✓", "Earned ✓") : `${l.min} ${L("ساعة", "h")}`}</span>
        ${got ? "" : `<em>${L("باقي", "")} <span class="num-ltr">${left}</span> ${L("ساعة", "h to go")}</em>`}
      </div>`;
    }).join("");
    return `
      <section class="card impact-card-section">
        <div class="card-header">
          <div class="card-title">${ic("award", 18)} ${L("مستواي وأوسمتي", "My level & badges")}</div>
          <button type="button" class="btn btn-primary btn-sm" id="portal-impact-card">${ic("sparkles", 14)} ${L("بطاقة أثري", "My impact card")}</button>
        </div>
        <div class="impact-level">
          <span class="impact-level-dot" style="background:${lv.cur.color}"></span>
          <span>${L("مستواك الحالي", "Current level")}: <b>${L(lv.cur.ar, lv.cur.en)}</b></span>
          ${lv.next ? `<span class="impact-level-next">${L("المستوى التالي", "Next")}: ${L(lv.next.ar, lv.next.en)} — ${L("باقي", "")} <b class="num-ltr">${lv.toNext}</b> ${L("ساعة", "h to go")}</span>` : `<span class="impact-level-next">${L("وصلت لأعلى مستوى — بارك الله فيك", "Top level reached — thank you!")}</span>`}
        </div>
        <div class="impact-badges">${items}</div>
      </section>`;
  }

  // ---------- Canvas card ----------
  function loadImg(src) {
    return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  }
  function wrapLines(ctx, text, maxW) {
    const words = String(text).split(/\s+/); const lines = []; let line = "";
    words.forEach(w => { const t = line ? line + " " + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; });
    if (line) lines.push(line);
    return lines;
  }

  async function drawCard(info) {
    const W = 1080, H = 1350;
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const ctx = c.getContext("2d");
    const ar = info.lang === "ar";
    const F = (w, s) => `${w} ${s}px Tajawal, "Segoe UI", sans-serif`;
    try { await Promise.all([document.fonts.load(F(800, 40)), document.fonts.load(F(500, 40)), document.fonts.load(F(700, 40))]); } catch (e) { /* ignore */ }

    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#2D5490"); g.addColorStop(0.55, "#1D2B46"); g.addColorStop(1, "#14233F");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    try {
      const pat = await loadImg("assets/brand/pattern-white.png");
      ctx.globalAlpha = 0.04;
      const p = ctx.createPattern(pat, "repeat"); ctx.fillStyle = p; ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    } catch (e) { ctx.globalAlpha = 1; }

    // gold frame
    ctx.strokeStyle = "rgba(194,158,26,.55)"; ctx.lineWidth = 3;
    ctx.strokeRect(40, 40, W - 80, H - 80);

    ctx.direction = ar ? "rtl" : "ltr";
    ctx.textAlign = "center";
    try {
      const logo = await loadImg("assets/brand/logo-vertical-white.svg");
      const lw = 170, lh = lw * (1395.6 / 1248);
      ctx.drawImage(logo, (W - lw) / 2, 110, lw, lh);
    } catch (e) { /* ignore */ }

    ctx.fillStyle = "#E9DDB4"; ctx.font = F(500, 34);
    ctx.fillText(ar ? `أثري مع أكاديمية أثر · ${info.year}` : `My impact with Athar Academy · ${info.year}`, W / 2, 400);

    ctx.fillStyle = "#FFFFFF"; ctx.font = F(800, 64);
    const nameLines = wrapLines(ctx, info.name || "", W - 220).slice(0, 2);
    nameLines.forEach((ln, i) => ctx.fillText(ln, W / 2, 480 + i * 74));
    let y = 480 + nameLines.length * 74 + 10;

    // level pill
    ctx.font = F(700, 30);
    const lvText = info.levelText;
    const pw = ctx.measureText(lvText).width + 70;
    ctx.fillStyle = "rgba(194,158,26,.18)"; ctx.strokeStyle = "#C29E1A"; ctx.lineWidth = 2;
    roundRect(ctx, (W - pw) / 2, y, pw, 58, 29); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#E9DDB4"; ctx.fillText(lvText, W / 2, y + 40);
    y += 120;

    // big hours
    ctx.fillStyle = "#C29E1A"; ctx.font = F(800, 190);
    ctx.direction = "ltr"; ctx.fillText(String(info.hours), W / 2, y + 160); ctx.direction = ar ? "rtl" : "ltr";
    ctx.fillStyle = "#FFFFFF"; ctx.font = F(700, 40);
    ctx.fillText(ar ? "ساعة تطوعية معتمدة" : "approved volunteer hours", W / 2, y + 230);
    y += 300;

    // stats row
    const stats = [
      [String(info.attended), ar ? "حضور" : "attended"],
      [String(info.certs), ar ? "شهادة" : "certificates"],
      [info.committee || "—", ar ? "اللجنة" : "committee"],
    ];
    const colW = (W - 160) / 3;
    stats.forEach((s, i) => {
      const cx = ar ? W - 80 - colW * i - colW / 2 : 80 + colW * i + colW / 2;
      ctx.fillStyle = "rgba(255,255,255,.07)"; roundRect(ctx, cx - colW / 2 + 12, y, colW - 24, 150, 22); ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.font = F(800, i === 2 ? 30 : 56);
      const v = wrapLines(ctx, s[0], colW - 60).slice(0, 2);
      v.forEach((ln, k) => ctx.fillText(ln, cx, y + (i === 2 ? (v.length > 1 ? 58 : 76) : 80) + k * 36));
      ctx.fillStyle = "#E9DDB4"; ctx.font = F(500, 26);
      ctx.fillText(s[1], cx, y + 128);
    });

    ctx.fillStyle = "#FFFFFF"; ctx.font = F(700, 40);
    ctx.fillText("أنتَ أثرٌ طيّبٌ أينما حللت", W / 2, H - 150);
    ctx.fillStyle = "#C29E1A"; ctx.font = F(500, 28);
    ctx.direction = "ltr"; ctx.fillText("athar.my", W / 2, H - 95);
    return c;
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  async function openCard(info) {
    const mc = document.getElementById("modal-container");
    if (!mc) return;
    const lv = level(info.hours);
    info = Object.assign({ lang: App.currentLang === "ar" ? "ar" : "en", year: new Date().getFullYear() }, info);
    info.levelText = (info.lang === "ar" ? "مستوى: " + lv.cur.ar : "Level: " + lv.cur.en);
    mc.innerHTML = `
      <div class="overlay-backdrop" id="impact-backdrop">
        <div class="modal-dialog impact-dialog">
          <div class="modal-header">
            <h3 class="modal-title">${ic("sparkles", 18)} ${L("بطاقة أثري", "My impact card")}</h3>
            <button class="btn-icon" id="impact-close">&times;</button>
          </div>
          <div class="modal-body"><div class="impact-preview" id="impact-preview"><div class="impact-loading">${L("جارٍ التجهيز…", "Preparing…")}</div></div></div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="impact-download">${ic("download", 14)} ${L("تنزيل الصورة", "Download")}</button>
            <button class="btn btn-primary" id="impact-share">${ic("send", 14)} ${L("مشاركة", "Share")}</button>
          </div>
        </div>
      </div>`;
    const close = () => { mc.innerHTML = ""; };
    document.getElementById("impact-close").onclick = close;
    document.getElementById("impact-backdrop").onclick = e => { if (e.target.id === "impact-backdrop") close(); };
    const canvas = await drawCard(info);
    const url = canvas.toDataURL("image/png");
    const prev = document.getElementById("impact-preview");
    if (!prev) return;
    prev.innerHTML = `<img src="${url}" alt="${escapeHtml(L("بطاقة أثري", "Impact card"))}">`;
    const fileName = `athar-impact-${info.year}.png`;
    document.getElementById("impact-download").onclick = () => {
      const a = document.createElement("a"); a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove();
    };
    const shareBtn = document.getElementById("impact-share");
    shareBtn.onclick = async () => {
      try {
        const blob = await new Promise(r => canvas.toBlob(r, "image/png"));
        const file = new File([blob], fileName, { type: "image/png" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text: L("أثري مع أكاديمية أثر 🌿 athar.my", "My impact with Athar Academy 🌿 athar.my") });
        } else {
          document.getElementById("impact-download").click();
          showToast(L("تم تنزيل الصورة — شاركها من معرض الصور", "Image downloaded — share it from your gallery"), "info");
        }
      } catch (e) { if (e && e.name !== "AbortError") showToast(L("تعذّرت المشاركة", "Share failed"), "error"); }
    };
  }

  window.AtharImpact = { level, badgesHtml, openCard, LEVELS };
})();
