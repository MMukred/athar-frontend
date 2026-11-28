/**
 * Ideas & suggestions box
 *  - Volunteers and committee leads send ideas / notes / problems.
 *  - Super & trusted admins get a saved inbox: filter by status, update the
 *    status and write a reply that the sender sees under "My submissions".
 *
 * Backend contract (all authenticated):
 *   POST  /api/suggestions          { type, title?, body, anonymous? } → { suggestion }
 *   GET   /api/suggestions/mine     → { items: [suggestion] }
 *   GET   /api/suggestions?status=  → { items, total }            (admins)
 *   PATCH /api/suggestions/:id      { status?, adminReply? } → { suggestion } (admins)
 * suggestion = { id, type: idea|note|problem, title, body, anonymous,
 *   status: new|reviewing|done|archived, adminReply, createdAt, updatedAt,
 *   author: { id, fullName, fullNameAr, role }, committee: { nameAr, nameEn } }
 *
 * window.AtharIdeas = { check(), isOn(), newCount(), isAdmin() }
 * The feature turns itself on only once the endpoint answers; until then the
 * menu entries stay hidden so nobody meets a broken form.
 */
(function () {
  "use strict";

  const { App, ic, showToast, escapeHtml, formatDate } = window.AtharCore;
  const L = (ar, en) => (App.currentLang === "ar" ? ar : en);

  let state = "unknown";      // unknown | on | off
  let newCount = 0;
  let checking = null;

  const isAdmin = () => !!App.currentUser && (App.currentUser.role === "super_admin" || App.currentUser.role === "trusted_admin");

  const TYPES = {
    idea: { ar: "فكرة", en: "Idea", icon: "sparkles" },
    note: { ar: "ملاحظة", en: "Note", icon: "note" },
    problem: { ar: "مشكلة", en: "Problem", icon: "alert" },
  };
  const STATUSES = {
    new: { ar: "جديدة", en: "New", cls: "badge-warning" },
    reviewing: { ar: "قيد الدراسة", en: "Reviewing", cls: "badge-info" },
    done: { ar: "تم التنفيذ", en: "Done", cls: "badge-success" },
    archived: { ar: "مؤرشفة", en: "Archived", cls: "badge-neutral" },
  };
  const statusBadge = (s) => {
    const st = STATUSES[s] || STATUSES.new;
    return `<span class="badge ${st.cls}">${L(st.ar, st.en)}</span>`;
  };
  const d10 = (s) => (s ? String(s).slice(0, 10) : "");
  const authorName = (a) => (a ? (App.currentLang === "ar" ? (a.fullNameAr || a.fullName) : (a.fullName || a.fullNameAr)) : "") || "";
  const commName = (c) => (c ? (App.currentLang === "ar" ? (c.nameAr || c.nameEn) : (c.nameEn || c.nameAr)) : "") || "";

  async function check(force) {
    if (!App.currentUser) return state;
    if (checking) return checking;
    if (state !== "unknown" && !force) return state;
    checking = (async () => {
      try {
        if (isAdmin()) {
          const r = await window.AtharAPI.suggestions.list({ status: "new", limit: 100 });
          newCount = Number((r && (r.total ?? (r.items || []).length)) || 0);
        } else {
          await window.AtharAPI.suggestions.mine();
        }
        state = "on";
      } catch (e) {
        // 404 = endpoint not deployed yet; anything else (offline, cold start) = try later
        state = (e && (e.status === 404 || e.code === "NOT_FOUND")) ? "off" : "unknown";
      }
      checking = null;
      if (window.AtharCore.renderSidebar) window.AtharCore.renderSidebar();
      return state;
    })();
    return checking;
  }

  // ------------------------------------------------------------------ views
  function header(title, sub) {
    return `
      <div class="view-header">
        <div class="view-header-left">
          <h1 class="view-title">${title}</h1>
          <p class="view-subtitle">${sub}</p>
        </div>
      </div>`;
  }

  function offHtml() {
    return `${header(L("صندوق الأفكار", "Ideas box"), L("شاركنا أفكارك وملاحظاتك", "Share your ideas and notes"))}
      <div class="card"><div class="empty-state">
        <div class="empty-state-icon">${ic("sparkles", 42, { strokeWidth: 1.5 })}</div>
        <div class="empty-state-title">${L("صندوق الأفكار قيد التفعيل", "The ideas box is being set up")}</div>
        <div class="empty-state-desc">${L("سيتاح قريباً بعد تحديث الخادم.", "It will be available after the next server update.")}</div>
      </div></div>`;
  }

  function itemCard(s, admin) {
    const t = TYPES[s.type] || TYPES.idea;
    const who = s.anonymous && !admin ? "" : (s.anonymous ? L("مجهول الهوية", "Anonymous") : authorName(s.author));
    const role = s.author && s.author.role === "committee_leader" ? L("رئيس لجنة", "Committee lead") : (s.author ? L("متطوع", "Volunteer") : "");
    return `
      <article class="idea-card" data-id="${escapeHtml(s.id)}">
        <header class="idea-head">
          <span class="idea-type idea-type-${escapeHtml(s.type || "idea")}">${ic(t.icon, 13)} ${L(t.ar, t.en)}</span>
          ${statusBadge(s.status)}
          <span class="idea-date num-ltr">${escapeHtml(formatDate(d10(s.createdAt)))}</span>
        </header>
        ${s.title ? `<h3 class="idea-title">${escapeHtml(s.title)}</h3>` : ""}
        <p class="idea-body">${escapeHtml(s.body || "")}</p>
        ${admin ? `<div class="idea-meta">${who ? `<b>${escapeHtml(who)}</b>` : ""}${!s.anonymous && role ? ` · ${role}` : ""}${commName(s.committee) && !s.anonymous ? ` · ${escapeHtml(commName(s.committee))}` : ""}</div>` : ""}
        ${s.adminReply && !admin ? `<div class="idea-reply"><span>${ic("message_circle", 13)} ${L("رد الإدارة", "Reply from the team")}</span><p>${escapeHtml(s.adminReply)}</p></div>` : ""}
        ${admin ? `
          <div class="idea-admin">
            <select class="form-control idea-status">${Object.keys(STATUSES).map(k => `<option value="${k}" ${s.status === k ? "selected" : ""}>${L(STATUSES[k].ar, STATUSES[k].en)}</option>`).join("")}</select>
            <textarea class="form-control idea-reply-input" rows="2" placeholder="${L("رد يظهر لصاحب الاقتراح (اختياري)", "Reply shown to the sender (optional)")}">${escapeHtml(s.adminReply || "")}</textarea>
            <button type="button" class="btn btn-primary btn-sm idea-save">${L("حفظ", "Save")}</button>
          </div>` : ""}
      </article>`;
  }

  // ---- Sender view (volunteer / committee lead)
  async function renderSender(container) {
    let type = "idea";
    container.innerHTML = `${header(L("صندوق الأفكار", "Ideas box"), L("عندك فكرة أو ملاحظة؟ تصل مباشرة لإدارة أكاديمية أثر.", "Have an idea or a note? It goes straight to the Athar team."))}
      <section class="card idea-form-card">
        <div class="idea-types" role="radiogroup">
          ${Object.keys(TYPES).map(k => `<button type="button" class="idea-pill ${k === type ? "is-on" : ""}" data-type="${k}" role="radio" aria-checked="${k === type}">${ic(TYPES[k].icon, 14)} ${L(TYPES[k].ar, TYPES[k].en)}</button>`).join("")}
        </div>
        <input class="form-control" id="idea-title" maxlength="120" placeholder="${L("عنوان مختصر (اختياري)", "Short title (optional)")}">
        <textarea class="form-control" id="idea-body" rows="5" maxlength="2000" placeholder="${L("اكتب فكرتك أو ملاحظتك هنا…", "Write your idea or note here…")}"></textarea>
        <div class="idea-form-foot">
          <label class="app-check" style="margin:0;"><input type="checkbox" id="idea-anon"> ${L("إرسال بدون اسمي", "Send anonymously")}</label>
          <button type="button" class="btn btn-primary" id="idea-send">${ic("send", 15)} ${L("إرسال", "Send")}</button>
        </div>
      </section>
      <section class="idea-mine">
        <h2 class="idea-section-title">${L("اقتراحاتي", "My submissions")}</h2>
        <div id="idea-mine-list"><div class="idea-loading">${L("جارٍ التحميل…", "Loading…")}</div></div>
      </section>`;

    container.querySelectorAll(".idea-pill").forEach(b => {
      b.onclick = () => {
        type = b.getAttribute("data-type");
        container.querySelectorAll(".idea-pill").forEach(x => { const on = x === b; x.classList.toggle("is-on", on); x.setAttribute("aria-checked", on); });
      };
    });

    async function loadMine() {
      const box = document.getElementById("idea-mine-list");
      if (!box) return;
      try {
        const r = await window.AtharAPI.suggestions.mine();
        const items = (r && r.items) || [];
        box.innerHTML = items.length ? `<div class="idea-list">${items.map(s => itemCard(s, false)).join("")}</div>`
          : `<div class="idea-empty">${L("لم ترسل أي اقتراح بعد.", "You haven't sent anything yet.")}</div>`;
      } catch (e) {
        box.innerHTML = `<div class="idea-empty">${escapeHtml((e && e.message) || L("تعذّر التحميل", "Failed to load"))}</div>`;
      }
    }

    document.getElementById("idea-send").onclick = async (ev) => {
      const btn = ev.currentTarget;
      const body = document.getElementById("idea-body").value.trim();
      const title = document.getElementById("idea-title").value.trim();
      if (body.length < 5) { showToast(L("اكتب فكرتك أولاً", "Please write your idea first"), "error"); return; }
      btn.disabled = true;
      try {
        await window.AtharAPI.suggestions.create({ type, title: title || undefined, body, anonymous: document.getElementById("idea-anon").checked });
        document.getElementById("idea-body").value = "";
        document.getElementById("idea-title").value = "";
        window.AtharCore.celebrate && window.AtharCore.celebrate(900);
        showToast(L("وصلت فكرتك للإدارة — شكراً لك 🌿", "Sent to the team — thank you 🌿"), "success");
        loadMine();
      } catch (e) {
        showToast((e && e.message) || L("تعذّر الإرسال", "Send failed"), "error");
      }
      btn.disabled = false;
    };
    loadMine();
  }

  // ---- Admin inbox
  async function renderAdmin(container) {
    const filter = App.ideasFilter || "new";
    const tabs = ["new", "reviewing", "done", "archived", "all"];
    container.innerHTML = `${header(L("الأفكار والاقتراحات", "Ideas & suggestions"), L("ما يرسله المتطوعون ورؤساء اللجان عبر صندوق الأفكار", "What volunteers and committee leads send through the ideas box"))}
      <div class="idea-tabs" role="tablist">
        ${tabs.map(k => `<button type="button" role="tab" class="idea-tab ${k === filter ? "is-on" : ""}" data-f="${k}">${k === "all" ? L("الكل", "All") : L(STATUSES[k].ar, STATUSES[k].en)}</button>`).join("")}
      </div>
      <div id="idea-admin-list"><div class="idea-loading">${L("جارٍ التحميل…", "Loading…")}</div></div>`;
    container.querySelectorAll(".idea-tab").forEach(b => {
      b.onclick = () => { App.ideasFilter = b.getAttribute("data-f"); renderAdmin(container); };
    });
    const box = document.getElementById("idea-admin-list");
    try {
      const r = await window.AtharAPI.suggestions.list(filter === "all" ? { limit: 200 } : { status: filter, limit: 200 });
      const items = (r && r.items) || [];
      if (filter === "new") { newCount = Number(r.total ?? items.length); window.AtharCore.renderSidebar(); }
      box.innerHTML = items.length ? `<div class="idea-list idea-list-admin">${items.map(s => itemCard(s, true)).join("")}</div>`
        : `<div class="card"><div class="empty-state"><div class="empty-state-icon">${ic("check_circle", 42, { strokeWidth: 1.5 })}</div><div class="empty-state-title">${L("لا يوجد شيء هنا", "Nothing here")}</div></div></div>`;
      box.querySelectorAll(".idea-card").forEach(card => {
        const id = card.getAttribute("data-id");
        card.querySelector(".idea-save").onclick = async (ev) => {
          const btn = ev.currentTarget; btn.disabled = true;
          try {
            await window.AtharAPI.suggestions.update(id, {
              status: card.querySelector(".idea-status").value,
              adminReply: card.querySelector(".idea-reply-input").value.trim() || null,
            });
            showToast(L("تم الحفظ", "Saved"), "success");
            renderAdmin(container);
          } catch (e) { showToast((e && e.message) || L("تعذّر الحفظ", "Save failed"), "error"); btn.disabled = false; }
        };
      });
    } catch (e) {
      box.innerHTML = `<div class="card"><p style="margin:0;">${escapeHtml((e && e.message) || L("تعذّر التحميل", "Failed to load"))}</p></div>`;
    }
  }

  async function renderIdeas(container) {
    if (state === "unknown") {
      container.innerHTML = `<div class="idea-loading" style="padding:40px;text-align:center;">${L("جارٍ التحميل…", "Loading…")}</div>`;
      await check();
      if (App.currentView !== "ideas") return;
    }
    if (state !== "on") { container.innerHTML = offHtml(); return; }
    if (isAdmin()) renderAdmin(container); else renderSender(container);
  }

  let ensuredFor = null;
  function ensure() {
    const uid = App.currentUser && App.currentUser.id;
    if (!uid || ensuredFor === uid) return;
    ensuredFor = uid;
    state = "unknown"; newCount = 0;
    setTimeout(() => check(true), 0);
  }

  window.AtharViews.ideas = renderIdeas;
  window.AtharIdeas = {
    check,
    isOn: () => state === "on",
    newCount: () => newCount,
    isAdmin,
    ensure,
    reset: () => { state = "unknown"; newCount = 0; },
  };
})();
