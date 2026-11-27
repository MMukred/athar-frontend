/**
 * View: Volunteer Applications inbox (admins)
 * Lists volunteers whose status is "pending" (created by the public apply
 * form) so an admin can review and accept them into a committee, or set
 * them aside (archive — reversible from the volunteers page).
 */
(function () {
  "use strict";

  const { App, t, formatDate, ic, showToast, showConfirmModal, hasPermission, escapeHtml } = window.AtharCore;

  const L = (ar, en) => (App.currentLang === "ar" ? ar : en);

  function nameOf(v) {
    return App.currentLang === "ar" ? (v.full_name_ar || v.full_name || "") : (v.full_name || v.full_name_ar || "");
  }
  function commName(c) {
    return App.currentLang === "ar" ? (c.name_ar || c.name_en || "") : (c.name_en || c.name_ar || "");
  }
  function ageOf(v) {
    if (!v.dob) return null;
    const d = new Date(v.dob);
    if (isNaN(d)) return null;
    const now = new Date();
    let a = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
    return a > 0 && a < 120 ? a : null;
  }
  function genderLabel(g) {
    if (g === "male") return L("ذكر", "Male");
    if (g === "female") return L("أنثى", "Female");
    return g || "";
  }
  function waDigits(v) {
    return String(v.whatsapp || v.phone || "").replace(/[^0-9]/g, "");
  }
  function welcomeMessage(v, comm) {
    const first = (nameOf(v) || "").split(" ")[0];
    const cn = comm ? commName(comm) : "";
    return App.currentLang === "ar"
      ? `أهلاً ${first} 🌿\nيسعدنا إبلاغك بقبولك متطوعاً في أكاديمية أثر${cn ? ` ضمن لجنة «${cn}»` : ""}.\nسنتواصل معك قريباً بتفاصيل اللقاء الأول.\nأنتَ أثرٌ طيّبٌ أينما حللت.`
      : `Hi ${first} 🌿\nWe're happy to let you know you've been accepted as a volunteer at Athar Academy${cn ? ` in the "${cn}" committee` : ""}.\nWe'll be in touch soon with details of the first meeting.`;
  }

  function renderApplications(container) {
    const state = window.AtharStore.getState();
    const canEdit = hasPermission("volunteers", "edit");
    const q = (App.applicationsSearch || "").trim().toLowerCase();

    const all = state.volunteers
      .filter(v => v.status === "pending")
      .sort((a, b) => String(b.created_at || b.join_date || "").localeCompare(String(a.created_at || a.join_date || "")));
    const list = q
      ? all.filter(v => [v.full_name, v.full_name_ar, v.email, v.phone, v.whatsapp, v.nationality, (v.skills || []).join(" ")]
          .some(x => String(x || "").toLowerCase().includes(q)))
      : all;

    const committees = state.committees.filter(c => c.status === "active");

    const row = (label, value) => value ? `<div class="app-field"><span>${label}</span><b>${value}</b></div>` : "";

    const cards = list.map(v => {
      const age = ageOf(v);
      const skills = (v.skills || []).map(s => `<span class="app-chip">${escapeHtml(s)}</span>`).join("");
      const comm = v.committee_id ? state.committees.find(c => c.id === v.committee_id) : null;
      const applied = v.created_at || v.join_date;
      const digits = waDigits(v);
      return `
        <article class="app-card" data-id="${escapeHtml(v.id)}">
          <header class="app-card-head">
            <div class="app-avatar">${escapeHtml((nameOf(v) || "?").charAt(0))}</div>
            <div class="app-card-title">
              <h3>${escapeHtml(nameOf(v))}</h3>
              <div class="app-card-meta">
                ${applied ? `<span>${L("تاريخ الطلب", "Applied")}: <span class="num-ltr">${formatDate(String(applied).slice(0, 10))}</span></span>` : ""}
                ${comm ? `<span class="badge badge-info">${escapeHtml(commName(comm))}</span>` : ""}
              </div>
            </div>
            <span class="badge badge-warning">${L("بانتظار المراجعة", "Pending review")}</span>
          </header>
          <div class="app-fields">
            ${row(L("العمر", "Age"), age ? `<span class="num-ltr">${age}</span>` : "")}
            ${row(L("الجنس", "Gender"), escapeHtml(genderLabel(v.gender)))}
            ${row(L("الجوال", "Phone"), (v.phone || v.whatsapp) ? `<span class="num-ltr" dir="ltr">${escapeHtml(v.phone || v.whatsapp)}</span>` : "")}
            ${row(L("البريد", "Email"), v.email ? `<span dir="ltr">${escapeHtml(v.email)}</span>` : "")}
            ${row(L("الجنسية", "Nationality"), escapeHtml(v.nationality || ""))}
            ${row(L("المستوى الدراسي", "Study level"), escapeHtml(v.study_level || ""))}
          </div>
          ${skills ? `<div class="app-skills">${skills}</div>` : ""}
          ${v.notes ? `<details class="app-notes"><summary>${L("إجابات وملاحظات الطلب", "Application answers & notes")}</summary><pre>${escapeHtml(v.notes)}</pre></details>` : ""}
          <footer class="app-card-actions">
            ${canEdit ? `<button class="btn btn-primary btn-sm" data-act="accept">${ic("user_check", 15)} ${L("قبول", "Accept")}</button>` : ""}
            <button class="btn btn-secondary btn-sm" data-act="profile">${ic("eye", 15)} ${L("الملف الكامل", "Full profile")}</button>
            ${digits ? `<a class="btn btn-whatsapp btn-sm" href="https://wa.me/${digits}" target="_blank" rel="noopener">${ic("whatsapp", 15)} ${L("تواصل", "Message")}</a>` : ""}
            ${canEdit ? `<button class="btn btn-secondary btn-sm app-reject" data-act="reject">${ic("user_x", 15)} ${L("استبعاد", "Set aside")}</button>` : ""}
          </footer>
        </article>`;
    }).join("");

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <div class="breadcrumb-trail">
            <span class="breadcrumb-item" onclick="window.AtharApp.navigateTo('dashboard')">${t("app_name")}</span>
            <span class="breadcrumb-separator">/</span>
            <span>${L("طلبات التطوع", "Applications")}</span>
          </div>
          <h1 class="view-title">${L("طلبات التطوع", "Volunteer applications")}</h1>
          <p class="view-subtitle"><span class="num-ltr">${all.length}</span> ${L("طلب بانتظار المراجعة", "applications awaiting review")}</p>
        </div>
        <div class="view-header-actions">
          <a class="btn btn-secondary" href="apply.html" target="_blank" rel="noopener">${ic("send", 16)} ${L("رابط نموذج التقديم", "Application form")}</a>
          <button class="btn btn-secondary" id="app-copy-link">${ic("copy", 16)} ${L("نسخ الرابط", "Copy link")}</button>
        </div>
      </div>

      <div class="filter-bar">
        <div class="filter-group" style="flex:1; min-width:220px;">
          <input type="search" class="form-control" id="app-search" placeholder="${L("ابحث بالاسم أو الجوال أو المهارة…", "Search name, phone or skill…")}" value="${escapeHtml(App.applicationsSearch || "")}">
        </div>
      </div>

      ${list.length ? `<div class="app-grid">${cards}</div>` : `
        <div class="card"><div class="empty-state">
          <div class="empty-state-icon">${ic("check_circle", 42, { strokeWidth: 1.5 })}</div>
          <div class="empty-state-title">${q ? L("لا توجد نتائج", "No results") : L("لا توجد طلبات جديدة", "No new applications")}</div>
          <div class="empty-state-desc">${q ? L("جرّب كلمة بحث أخرى.", "Try another search.") : L("عند تقديم أي شخص عبر نموذج «تقدم للتطوع» سيظهر طلبه هنا.", "New submissions from the apply form will appear here.")}</div>
        </div></div>`}
    `;

    const search = document.getElementById("app-search");
    if (search) {
      search.oninput = () => {
        App.applicationsSearch = search.value;
        const pos = search.selectionStart;
        renderApplications(container);
        const s2 = document.getElementById("app-search");
        if (s2) { s2.focus(); try { s2.setSelectionRange(pos, pos); } catch (e) { /* ignore */ } }
      };
    }
    const copyBtn = document.getElementById("app-copy-link");
    if (copyBtn) copyBtn.onclick = async () => {
      const url = new URL("apply.html", window.location.href).href;
      try { await navigator.clipboard.writeText(url); showToast(L("تم نسخ رابط النموذج", "Form link copied"), "success"); }
      catch (e) { showToast(url, "info"); }
    };

    container.querySelectorAll(".app-card").forEach(card => {
      const id = card.getAttribute("data-id");
      const v = state.volunteers.find(x => String(x.id) === id);
      if (!v) return;
      card.querySelectorAll("[data-act]").forEach(btn => {
        const act = btn.getAttribute("data-act");
        btn.onclick = () => {
          if (act === "profile") window.AtharCore.navigateTo("volunteer-profile", { id: v.id });
          else if (act === "accept") openAcceptModal(v, committees, container);
          else if (act === "reject") confirmReject(v, container);
        };
      });
    });
  }

  function openAcceptModal(v, committees, container) {
    const mc = document.getElementById("modal-container");
    if (!mc) return;
    const opts = committees.map(c => `<option value="${escapeHtml(c.id)}" ${c.id === v.committee_id ? "selected" : ""}>${escapeHtml(commName(c))}</option>`).join("");
    mc.innerHTML = `
      <div class="overlay-backdrop" id="app-accept-backdrop">
        <div class="modal-dialog" style="max-width:460px;">
          <div class="modal-header">
            <h3 class="modal-title">${ic("user_check", 18)} ${L("قبول المتطوع", "Accept volunteer")}</h3>
            <button class="btn-icon" id="app-accept-close">&times;</button>
          </div>
          <div class="modal-body">
            <p style="margin:0 0 14px; color:var(--neutral-700);">${L("سيتم تفعيل", "Activating")} <b>${escapeHtml(nameOf(v))}</b> ${L("كمتطوع في النظام.", "as a volunteer.")}</p>
            <div class="form-group" style="display:flex; flex-direction:column; gap:6px;">
              <label class="form-label" for="app-accept-comm">${L("اللجنة", "Committee")}</label>
              <select class="form-control" id="app-accept-comm" style="width:100%;">
                <option value="">${L("— بدون لجنة الآن —", "— No committee yet —")}</option>
                ${opts}
              </select>
            </div>
            ${waDigits(v) ? `<label class="app-check"><input type="checkbox" id="app-accept-wa" checked> ${L("افتح رسالة ترحيب في واتساب بعد القبول", "Open a WhatsApp welcome message after accepting")}</label>` : ""}
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="app-accept-cancel">${t("cancel")}</button>
            <button class="btn btn-primary" id="app-accept-ok">${L("قبول", "Accept")}</button>
          </div>
        </div>
      </div>`;
    const close = () => { mc.innerHTML = ""; };
    document.getElementById("app-accept-close").onclick = close;
    document.getElementById("app-accept-cancel").onclick = close;
    document.getElementById("app-accept-backdrop").onclick = (e) => { if (e.target.id === "app-accept-backdrop") close(); };
    document.getElementById("app-accept-ok").onclick = async (e) => {
      const btn = e.currentTarget;
      const commId = document.getElementById("app-accept-comm").value || null;
      const waBox = document.getElementById("app-accept-wa");
      const sendWa = !!(waBox && waBox.checked);
      // Open the WhatsApp tab synchronously so popup blockers allow it.
      const waWin = sendWa ? window.open("about:blank", "_blank") : null;
      btn.disabled = true;
      try {
        const payload = { status: "active" };
        if (commId) payload.committeeId = commId;
        await window.AtharAPI.volunteers.update(v.id, payload);
        await window.AtharStore.refreshVolunteers();
        close();
        window.AtharCore.celebrate(1200);
        showToast(L("تم قبول المتطوع", "Volunteer accepted"), "success");
        if (waWin) {
          const comm = commId ? window.AtharStore.getState().committees.find(c => String(c.id) === String(commId)) : null;
          waWin.location.href = `https://wa.me/${waDigits(v)}?text=${encodeURIComponent(welcomeMessage(v, comm))}`;
        }
        window.AtharCore.renderSidebar && window.AtharCore.renderSidebar();
        renderApplications(container);
      } catch (err) {
        if (waWin) waWin.close();
        btn.disabled = false;
        showToast(err.message || L("تعذّر القبول", "Accept failed"), "error");
      }
    };
  }

  function confirmReject(v, container) {
    showConfirmModal({
      title: L("استبعاد الطلب", "Set application aside"),
      message: L(
        `سيُنقل طلب «${escapeHtml(nameOf(v))}» إلى الأرشيف ولن يظهر هنا. يمكن استعادته لاحقاً من صفحة المتطوعين.`,
        `"${escapeHtml(nameOf(v))}" will be archived and removed from this list. You can restore it later from the volunteers page.`),
      confirmText: L("استبعاد", "Set aside"),
      onConfirm: async () => {
        try {
          await window.AtharAPI.volunteers.archive(v.id);
          await window.AtharStore.refreshVolunteers();
          showToast(L("تم استبعاد الطلب", "Application set aside"), "warning");
          window.AtharCore.renderSidebar && window.AtharCore.renderSidebar();
          renderApplications(container);
        } catch (err) {
          showToast(err.message || L("تعذّر الاستبعاد", "Failed"), "error");
        }
      },
    });
  }

  window.AtharViews.applications = renderApplications;
})();
