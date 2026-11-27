/**
 * Report overview charts — window.AtharReportCharts.html({hours, meetings})
 * Two single-series charts drawn as inline SVG:
 *   1) approved volunteer hours per month (last 12 months) — bars
 *   2) attendance rate of the last completed meetings — line
 * Each has a hover tooltip and a table view for accessibility.
 */
(function () {
  "use strict";

  const { App, escapeHtml } = window.AtharCore;
  const L = (ar, en) => (App.currentLang === "ar" ? ar : en);
  const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fmt = n => (Math.round(n * 10) / 10).toString();

  function monthlyHours(hours) {
    const now = new Date();
    const buckets = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, m: d.getMonth(), y: d.getFullYear(), v: 0 });
    }
    hours.filter(h => h.status === "approved" && h.date).forEach(h => {
      const b = buckets.find(x => x.key === String(h.date).slice(0, 7));
      if (b) b.v += Number(h.hours || 0);
    });
    return buckets.map(b => ({ label: (App.currentLang === "ar" ? MONTHS_AR : MONTHS_EN)[b.m], full: `${(App.currentLang === "ar" ? MONTHS_AR : MONTHS_EN)[b.m]} ${b.y}`, v: b.v }));
  }

  function attendanceSeries(meetings) {
    return meetings
      .filter(m => m.status === "completed" && m.attendance_summary)
      .sort((a, b) => String(a.meeting_date).localeCompare(String(b.meeting_date)))
      .slice(-10)
      .map(m => {
        const s = m.attendance_summary;
        const total = ["present", "late", "absent", "excused"].reduce((a, k) => a + Number(s[k] || 0), 0);
        const rate = total ? Math.round(((Number(s.present || 0) + Number(s.late || 0)) / total) * 100) : 0;
        const title = App.currentLang === "ar" ? (m.title_ar || m.title_en || "") : (m.title_en || m.title_ar || "");
        const d = String(m.meeting_date || "").slice(0, 10);
        return { label: d.slice(5).replace("-", "/"), full: `${title} — ${d}`, v: rate };
      });
  }

  // Geometry shared by both charts
  const W = 560, H = 230;
  const rtl = () => App.currentLang === "ar";
  // The value axis sits on the reading-start side (right in Arabic).
  const PAD = { t: 18, b: 30, get l() { return rtl() ? 14 : 40; }, get r() { return rtl() ? 40 : 14; } };
  const IW = W - 54, IH = H - PAD.t - PAD.b;

  function niceMax(v) {
    if (v <= 0) return 4;
    const raw = v / 4;
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p * 4;
  }

  function grid(max, unit) {
    let g = "";
    for (let i = 0; i <= 4; i++) {
      const val = (max / 4) * i;
      const y = PAD.t + IH - (IH * i) / 4;
      g += `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${y}" y2="${y}" class="rc-grid"/>`;
      g += rtl()
        ? `<text x="${W - PAD.r + 8}" y="${y + 4}" class="rc-axis" text-anchor="start">${fmt(val)}${unit}</text>`
        : `<text x="${PAD.l - 8}" y="${y + 4}" class="rc-axis" text-anchor="end">${fmt(val)}${unit}</text>`;
    }
    return g;
  }

  // Order points so time reads in the reading direction (right→left in Arabic).
  const xAt = (i, n, band) => {
    const pos = PAD.l + band * i + band / 2;
    return rtl() ? (PAD.l + IW) - (pos - PAD.l) : pos;
  };

  function barChart(data) {
    const max = niceMax(Math.max(...data.map(d => d.v)));
    const band = IW / data.length;
    const bw = Math.min(28, band - 6);
    const peak = data.reduce((a, d, i) => (d.v > data[a].v ? i : a), 0);
    let marks = "", labels = "";
    data.forEach((d, i) => {
      const cx = xAt(i, data.length, band);
      const h = (d.v / max) * IH;
      const y = PAD.t + IH - h;
      if (d.v > 0) {
        const r = Math.min(4, h);
        marks += `<path class="rc-bar" d="M${cx - bw / 2},${PAD.t + IH} V${y + r} Q${cx - bw / 2},${y} ${cx - bw / 2 + r},${y} H${cx + bw / 2 - r} Q${cx + bw / 2},${y} ${cx + bw / 2},${y + r} V${PAD.t + IH} Z"/>`;
      }
      marks += `<rect class="rc-hit" x="${cx - band / 2}" y="${PAD.t}" width="${band}" height="${IH}" data-tip="${escapeHtml(d.full)}: ${fmt(d.v)} ${L("ساعة", "h")}"/>`;
      if (i % 2 === (data.length - 1) % 2) labels += `<text x="${cx}" y="${H - 10}" class="rc-axis" text-anchor="middle">${escapeHtml(d.label)}</text>`;
      if (i === peak && d.v > 0) labels += `<text x="${cx}" y="${y - 6}" class="rc-value" text-anchor="middle">${fmt(d.v)}</text>`;
    });
    return `<svg viewBox="0 0 ${W} ${H}" class="rc-svg" role="img" aria-label="${L("الساعات المعتمدة شهرياً", "Approved hours per month")}">${grid(max, "")}<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${PAD.t + IH}" y2="${PAD.t + IH}" class="rc-base"/>${marks}${labels}</svg>`;
  }

  function lineChart(data) {
    const max = 100; // fixed 0–100% scale
    const band = IW / Math.max(1, data.length);
    const pts = data.map((d, i) => [xAt(i, data.length, band), PAD.t + IH - (d.v / max) * IH]);
    const path = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
    let marks = `<path class="rc-line" d="${path}"/>`, labels = "";
    data.forEach((d, i) => {
      const [x, y] = pts[i];
      marks += `<circle class="rc-dot" cx="${x}" cy="${y}" r="4.5"/>`;
      marks += `<rect class="rc-hit" x="${x - band / 2}" y="${PAD.t}" width="${band}" height="${IH}" data-tip="${escapeHtml(d.full)}: ${d.v}%"/>`;
      if (data.length <= 6 || i % 2 === (data.length - 1) % 2) labels += `<text x="${x}" y="${H - 10}" class="rc-axis" text-anchor="middle">${escapeHtml(d.label)}</text>`;
      if (i === data.length - 1) labels += `<text x="${x}" y="${y - 10}" class="rc-value" text-anchor="middle">${d.v}%</text>`;
    });
    return `<svg viewBox="0 0 ${W} ${H}" class="rc-svg" role="img" aria-label="${L("نسبة الحضور في آخر الاجتماعات", "Attendance rate of recent meetings")}">${grid(max, "%")}${marks}${labels}</svg>`;
  }

  function table(data, unit, head) {
    return `<details class="rc-table"><summary>${L("عرض كجدول", "Show as table")}</summary>
      <table class="data-table"><thead><tr><th>${head}</th><th>${L("القيمة", "Value")}</th></tr></thead>
      <tbody>${data.map(d => `<tr><td>${escapeHtml(d.full)}</td><td class="num-ltr">${fmt(d.v)}${unit}</td></tr>`).join("")}</tbody></table></details>`;
  }

  function html(ctx) {
    const mh = monthlyHours(ctx.hours || []);
    const att = attendanceSeries(ctx.meetings || []);
    const totalYear = mh.reduce((a, d) => a + d.v, 0);
    const avgAtt = att.length ? Math.round(att.reduce((a, d) => a + d.v, 0) / att.length) : null;
    return `
      <div class="rc-grid-wrap">
        <section class="card rc-card">
          <div class="rc-head">
            <h3>${L("الساعات المعتمدة شهرياً", "Approved hours per month")}</h3>
            <span class="rc-kpi"><b class="num-ltr">${fmt(totalYear)}</b> ${L("ساعة خلال 12 شهراً", "h in 12 months")}</span>
          </div>
          <div class="rc-plot">${barChart(mh)}<div class="rc-tip" hidden></div></div>
          ${table(mh, "", L("الشهر", "Month"))}
        </section>
        <section class="card rc-card">
          <div class="rc-head">
            <h3>${L("نسبة الحضور في آخر الاجتماعات", "Attendance rate, recent meetings")}</h3>
            ${avgAtt !== null ? `<span class="rc-kpi">${L("المتوسط", "Average")} <b class="num-ltr">${avgAtt}%</b></span>` : ""}
          </div>
          ${att.length ? `<div class="rc-plot">${lineChart(att)}<div class="rc-tip" hidden></div></div>${table(att, "%", L("الاجتماع", "Meeting"))}`
            : `<div class="rc-empty">${L("لا توجد اجتماعات مكتملة بسجل حضور بعد.", "No completed meetings with attendance yet.")}</div>`}
        </section>
      </div>`;
  }

  function bind(root) {
    (root || document).querySelectorAll(".rc-plot").forEach(plot => {
      const tip = plot.querySelector(".rc-tip");
      plot.querySelectorAll(".rc-hit").forEach(hit => {
        hit.addEventListener("mouseenter", () => {
          tip.textContent = hit.getAttribute("data-tip");
          tip.hidden = false;
          const pr = plot.getBoundingClientRect(), hr = hit.getBoundingClientRect();
          tip.style.left = `${Math.max(4, Math.min(pr.width - tip.offsetWidth - 4, hr.left - pr.left + hr.width / 2 - tip.offsetWidth / 2))}px`;
          tip.style.top = "0px";
          hit.classList.add("is-hover");
        });
        hit.addEventListener("mouseleave", () => { tip.hidden = true; hit.classList.remove("is-hover"); });
      });
    });
  }

  window.AtharReportCharts = { html, bind };
})();
