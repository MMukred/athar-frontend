/**
 * Bulk certificate issuing — window.AtharBulkCerts.open()
 * Picks every volunteer with approved hours in a period and no active
 * certificate, then creates (and, for super admins, approves) one
 * certificate per volunteer, one request at a time with live progress.
 */
(function () {
  "use strict";

  const { App, ic, showToast, escapeHtml } = window.AtharCore;
  const L = (ar, en) => (App.currentLang === "ar" ? ar : en);

  function nameOf(v) {
    return App.currentLang === "ar" ? (v.full_name_ar || v.full_name || "") : (v.full_name || v.full_name_ar || "");
  }
  function commName(c) {
    return App.currentLang === "ar" ? (c.name_ar || c.name_en || "") : (c.name_en || c.name_ar || "");
  }

  function candidates(start, end, commId) {
    const st = window.AtharStore.getState();
    const active = new Set(st.certificates.filter(c => c.status === "draft" || c.status === "issued").map(c => c.volunteer_id));
    return st.volunteers
      .filter(v => v.status !== "archived" && v.status !== "pending")
      .filter(v => !commId || String(v.committee_id) === String(commId))
      .map(v => {
        const hrs = st.volunteer_hours
          .filter(h => h.volunteer_id === v.id && h.status === "approved" && (!h.date || (h.date >= start && h.date <= end)))
          .reduce((s, h) => s + Number(h.hours || 0), 0);
        return { v, hrs, hasCert: active.has(v.id) };
      })
      .filter(x => x.hrs > 0)
      .sort((a, b) => b.hrs - a.hrs);
  }

  function open() {
    const mc = document.getElementById("modal-container");
    if (!mc) return;
    const st = window.AtharStore.getState();
    const isSuper = App.currentUser && App.currentUser.role === "super_admin";
    let start = new Date().getFullYear() + "-01-01";
    const _n = new Date(); let end = `${_n.getFullYear()}-${String(_n.getMonth() + 1).padStart(2, "0")}-${String(_n.getDate()).padStart(2, "0")}`;
    let lang = App.currentLang === "ar" ? "ar" : "en";
    let commId = "";
    let running = false;

    const commOpts = st.committees.filter(c => c.status === "active")
      .map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(commName(c))}</option>`).join("");

    mc.innerHTML = `
      <div class="overlay-backdrop" id="bulk-backdrop">
        <div class="modal-dialog bulk-dialog">
          <div class="modal-header">
            <h3 class="modal-title">${ic("award", 18)} ${L("إصدار شهادات جماعي", "Bulk certificates")}</h3>
            <button class="btn-icon" id="bulk-close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="bulk-controls">
              <label><span>${L("من", "From")}</span><input type="date" class="form-control" id="bulk-start" value="${start}"></label>
              <label><span>${L("إلى", "To")}</span><input type="date" class="form-control" id="bulk-end" value="${end}"></label>
              <label><span>${L("اللجنة", "Committee")}</span><select class="form-control" id="bulk-comm"><option value="">${L("كل اللجان", "All committees")}</option>${commOpts}</select></label>
              <label><span>${L("لغة الشهادة", "Language")}</span><select class="form-control" id="bulk-lang"><option value="ar" ${lang === "ar" ? "selected" : ""}>العربية</option><option value="en" ${lang === "en" ? "selected" : ""}>English</option></select></label>
            </div>
            <div class="bulk-bar">
              <label class="app-check" style="margin:0;"><input type="checkbox" id="bulk-all"> ${L("تحديد الكل", "Select all")}</label>
              <span id="bulk-count" class="bulk-count"></span>
            </div>
            <div class="bulk-list" id="bulk-list"></div>
            ${isSuper ? `<label class="app-check"><input type="checkbox" id="bulk-approve" checked> ${L("اعتماد وإصدار مباشرة (وإلا تُحفظ كمسودات)", "Approve & issue now (otherwise save as drafts)")}</label>` : `<p class="bulk-note">${L("ستُحفظ كمسودات بانتظار اعتماد المشرف العام.", "They will be saved as drafts for the super admin to approve.")}</p>`}
            <div class="bulk-progress" id="bulk-progress" hidden><div class="bulk-progress-bar"><span id="bulk-progress-fill"></span></div><div id="bulk-progress-text"></div></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="bulk-cancel">${L("إغلاق", "Close")}</button>
            <button class="btn btn-primary" id="bulk-go">${ic("award", 14)} <span id="bulk-go-text"></span></button>
          </div>
        </div>
      </div>`;

    const $ = id => document.getElementById(id);
    const close = () => { if (!running) mc.innerHTML = ""; };
    $("bulk-close").onclick = close;
    $("bulk-cancel").onclick = close;
    $("bulk-backdrop").onclick = e => { if (e.target.id === "bulk-backdrop") close(); };

    function selected() {
      return Array.from(document.querySelectorAll("#bulk-list input[type=checkbox]:checked")).map(x => x.value);
    }
    function updateCount() {
      const n = selected().length;
      $("bulk-count").textContent = L(`${n} محدد`, `${n} selected`);
      $("bulk-go-text").textContent = L(`إصدار ${n} شهادة`, `Issue ${n}`);
      $("bulk-go").disabled = n === 0 || running;
    }
    function renderList() {
      const rows = candidates(start, end, commId);
      $("bulk-list").innerHTML = rows.length ? rows.map(({ v, hrs, hasCert }) => `
        <label class="bulk-row ${hasCert ? "is-disabled" : ""}">
          <input type="checkbox" value="${escapeHtml(v.id)}" ${hasCert ? "disabled" : "checked"}>
          <span class="bulk-name">${escapeHtml(nameOf(v))}</span>
          ${hasCert ? `<span class="badge badge-info">${L("لديه شهادة", "Has certificate")}</span>` : ""}
          <span class="bulk-hrs num-ltr">${Math.round(hrs * 10) / 10} ${L("ساعة", "h")}</span>
        </label>`).join("")
        : `<div class="bulk-empty">${L("لا يوجد متطوعون بساعات معتمدة في هذه الفترة.", "No volunteers with approved hours in this period.")}</div>`;
      $("bulk-list").querySelectorAll("input").forEach(i => { i.onchange = updateCount; });
      const all = $("bulk-all"); all.checked = rows.some(r => !r.hasCert);
      updateCount();
    }
    $("bulk-start").onchange = e => { start = e.target.value; renderList(); };
    $("bulk-end").onchange = e => { end = e.target.value; renderList(); };
    $("bulk-comm").onchange = e => { commId = e.target.value; renderList(); };
    $("bulk-lang").onchange = e => { lang = e.target.value; };
    $("bulk-all").onchange = e => {
      document.querySelectorAll("#bulk-list input:not(:disabled)").forEach(i => { i.checked = e.target.checked; });
      updateCount();
    };

    $("bulk-go").onclick = async () => {
      if (start > end) { showToast(L("تاريخ البداية بعد النهاية", "Start date is after end date"), "error"); return; }
      const ids = selected();
      if (!ids.length) return;
      const approve = !!($("bulk-approve") && $("bulk-approve").checked);
      running = true; updateCount();
      document.querySelectorAll("#bulk-list input, .bulk-controls input, .bulk-controls select, #bulk-all").forEach(i => { i.disabled = true; });
      $("bulk-progress").hidden = false;
      let ok = 0; const failed = [];
      for (let i = 0; i < ids.length; i++) {
        const v = st.volunteers.find(x => String(x.id) === ids[i]);
        $("bulk-progress-text").textContent = L(`جارٍ إصدار ${i + 1} من ${ids.length}: `, `Issuing ${i + 1} of ${ids.length}: `) + (v ? nameOf(v) : "");
        $("bulk-progress-fill").style.width = `${Math.round((i / ids.length) * 100)}%`;
        const row = document.querySelector(`#bulk-list input[value="${CSS.escape(ids[i])}"]`);
        const rowEl = row && row.closest(".bulk-row");
        try {
          const c = await window.AtharAPI.certificates.create({ volunteerId: ids[i], periodStart: start, periodEnd: end, language: lang });
          if (approve) await window.AtharAPI.certificates.approve(c.id);
          ok++;
          if (rowEl) rowEl.classList.add("is-done");
        } catch (err) {
          failed.push({ v, msg: err.code === "NO_APPROVED_HOURS" ? L("ساعات غير كافية", "Not enough hours") : (err.message || "Error") });
          if (rowEl) { rowEl.classList.add("is-failed"); rowEl.title = failed[failed.length - 1].msg; }
        }
      }
      $("bulk-progress-fill").style.width = "100%";
      $("bulk-progress-text").textContent = L(`تم: ${ok} • تعذّر: ${failed.length}`, `Done: ${ok} • Failed: ${failed.length}`) +
        (failed.length ? " — " + failed.map(f => `${f.v ? nameOf(f.v) : "?"} (${f.msg})`).join("، ") : "");
      running = false;
      $("bulk-go").disabled = true;
      try { await window.AtharStore.refreshCertificates(); } catch (e) { /* ignore */ }
      if (ok) { window.AtharCore.celebrate(1400); showToast(L(`تم إصدار ${ok} شهادة`, `${ok} certificates created`), "success"); }
      if (window.AtharCore.App.currentView === "certificates") window.AtharCore.renderCurrentView();
    };

    renderList();
  }

  window.AtharBulkCerts = { open };
})();
