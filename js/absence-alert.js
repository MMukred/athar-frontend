/**
 * Absence alert on the dashboard (admins & committee leads).
 * Flags volunteers marked "absent" (not excused) in each of the last three
 * completed meetings of their committee, with a quick WhatsApp check-in link.
 * Rosters are fetched once and cached for 15 minutes per session.
 */
window.AtharAbsence = (function () {
  "use strict";

  const TTL = 15 * 60 * 1000;
  const MAX_COMMITTEES = 15;
  let result = null;      // { at, uid, items: [{ vol, comm, meetings }] }
  let loading = null;

  const core = () => window.AtharCore;
  const L = (ar, en) => (core().App.currentLang === "ar" ? ar : en);
  const esc = (s) => core().escapeHtml(s);

  function uid() { const u = core().App.currentUser; return u ? String(u.id) : ""; }
  function allowed() {
    const u = core().App.currentUser;
    return !!u && u.role !== "volunteer" && core().hasPermission("attendance", "view");
  }

  async function compute() {
    const st = window.AtharStore.getState();
    const u = core().App.currentUser;
    const leaderCid = u.role === "committee_leader" ? (u.committee_id || (u.committee && u.committee.id) || null) : null;
    const comms = st.committees
      .filter(c => c.status === "active" && (!leaderCid || String(c.id) === String(leaderCid)))
      .slice(0, MAX_COMMITTEES);
    const items = [];
    for (const c of comms) {
      const last3 = st.meetings
        .filter(m => String(m.committee_id) === String(c.id) && m.status === "completed" && (m.kind || "meeting") === "meeting")
        .sort((a, b) => String(b.meeting_date).localeCompare(String(a.meeting_date)))
        .slice(0, 3);
      if (last3.length < 3) continue;
      const rosters = await Promise.all(last3.map(m => window.AtharAPI.meetings.getRoster(m.id).catch(() => null)));
      if (rosters.some(r => !r || !Array.isArray(r.roster))) continue;
      const absentSets = rosters.map(r => new Set(r.roster.filter(x => x.status === "absent").map(x => String(x.volunteerId || x.volunteer_id))));
      absentSets[0].forEach(vid => {
        if (absentSets.every(s => s.has(vid))) {
          const vol = st.volunteers.find(v => String(v.id) === vid && v.status === "active");
          if (vol) items.push({ vol, comm: c, meetings: last3 });
        }
      });
    }
    return { at: Date.now(), uid: uid(), items };
  }

  function html(r) {
    if (!r || !r.items.length) return "";
    const lang = core().App.currentLang;
    const rows = r.items.slice(0, 8).map(({ vol, comm }) => {
      const name = lang === "ar" ? (vol.full_name_ar || vol.full_name) : (vol.full_name || vol.full_name_ar);
      const cn = lang === "ar" ? (comm.name_ar || comm.name_en) : (comm.name_en || comm.name_ar);
      const digits = String(vol.whatsapp || vol.phone || "").replace(/[^0-9]/g, "");
      const first = String(name || "").split(" ")[0];
      const msg = L(`السلام عليكم ${first} 🌿\nافتقدناك في آخر اجتماعات ${cn}، نتمنى أن تكون بخير. هل هناك ما يمكننا المساعدة فيه؟`,
        `Hi ${first} 🌿\nWe missed you at the last ${cn} meetings — hope all is well. Anything we can help with?`);
      return `<div class="abs-row">
        <button type="button" class="abs-name" data-vol="${esc(vol.id)}">${esc(name)}</button>
        <span class="abs-comm">${esc(cn)}</span>
        ${digits ? `<a class="btn btn-whatsapp btn-sm" target="_blank" rel="noopener" href="https://wa.me/${digits}?text=${encodeURIComponent(msg)}">${core().ic("whatsapp", 13)} ${L("اطمئن عليه", "Check in")}</a>` : ""}
      </div>`;
    }).join("");
    return `<section class="card abs-card" id="absence-alert">
      <div class="abs-head">
        <span class="abs-icon">${core().ic("alert", 18)}</span>
        <div>
          <h3>${L("تنبيه غياب متكرر", "Repeated absence")}</h3>
          <p>${L(`${r.items.length} متطوع غاب عن آخر 3 اجتماعات متتالية للجنته (دون عذر).`, `${r.items.length} volunteer(s) missed their committee's last 3 meetings (unexcused).`)}</p>
        </div>
      </div>
      <div class="abs-list">${rows}</div>
    </section>`;
  }

  function place(container) {
    if (!result || result.uid !== uid() || !result.items.length) return;
    if (core().App.currentView !== "dashboard") return;
    if (container.querySelector("#absence-alert")) return;
    const hero = container.querySelector(".dash-hero");
    if (!hero) return;
    hero.insertAdjacentHTML("afterend", html(result));
    container.querySelectorAll("#absence-alert .abs-name").forEach(b => {
      b.onclick = () => core().navigateTo("volunteer-profile", { id: b.getAttribute("data-vol") });
    });
  }

  async function mount(container) {
    if (!container || !allowed()) return;
    if (result && result.uid === uid() && Date.now() - result.at < TTL) { place(container); return; }
    if (!loading) loading = compute().then(r => { result = r; }).catch(() => { result = { at: Date.now(), uid: uid(), items: [] }; }).finally(() => { loading = null; });
    await loading;
    place(container);
  }

  // Re-attach after the dashboard re-renders itself (e.g. background refresh).
  const main = document.getElementById("main-content");
  if (main && window.MutationObserver) {
    new MutationObserver(() => { if (result && core().App.currentView === "dashboard") place(main); })
      .observe(main, { childList: true });
  }

  return { mount, reset: () => { result = null; } };
})();
