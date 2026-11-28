/**
 * Attendance confirmation (RSVP) before a meeting or event.
 *  - Volunteers: "سأحضر" / "أعتذر" on each upcoming item in their portal.
 *  - Admins & committee leads: a summary panel on the meeting page.
 * After the meeting nothing changes: the roster the lead saves stays the
 * source of truth for attendance and hours.
 *
 * Backend contract:
 *   GET  /api/portal/me → meetings[].myRsvp: "coming" | "not_coming" | null
 *        (the key being present is what switches the buttons on)
 *   POST /api/portal/meetings/:id/rsvp  { response, reason? } → { rsvp }
 *   GET  /api/meetings/:id/rsvps → { items: [{ volunteerId, response, reason,
 *        respondedAt, volunteer: { fullName, fullNameAr } }],
 *        summary: { coming, notComing, noResponse } }
 */
window.AtharRSVP = (function () {
  "use strict";

  const core = () => window.AtharCore;
  const L = (ar, en) => (core().App.currentLang === "ar" ? ar : en);
  const esc = (s) => core().escapeHtml(s);
  const ic = (n, s) => core().ic(n, s);

  function enabledFor(meeting) {
    return !!meeting && Object.prototype.hasOwnProperty.call(meeting, "myRsvp");
  }

  function portalButtons(meeting) {
    if (!enabledFor(meeting)) return "";
    const r = meeting.myRsvp;
    const id = esc(meeting.id);
    return `<div class="rsvp-bar" data-meeting="${id}">
      ${r ? `<span class="rsvp-state rsvp-${r === "coming" ? "yes" : "no"}">${r === "coming" ? ic("check_circle", 13) + " " + L("أكّدت حضورك", "You're coming") : ic("x_circle", 13) + " " + L("اعتذرت عن الحضور", "You declined")}</span>` : `<span class="rsvp-ask">${L("هل ستحضر؟", "Will you attend?")}</span>`}
      <button type="button" class="rsvp-btn rsvp-btn-yes ${r === "coming" ? "is-on" : ""}" data-r="coming">${L("سأحضر", "I'll attend")}</button>
      <button type="button" class="rsvp-btn rsvp-btn-no ${r === "not_coming" ? "is-on" : ""}" data-r="not_coming">${L("أعتذر", "Can't make it")}</button>
    </div>`;
  }

  function bindPortal(container, data, rerender) {
    container.querySelectorAll(".rsvp-bar .rsvp-btn").forEach(btn => {
      btn.onclick = async () => {
        const bar = btn.closest(".rsvp-bar");
        const id = bar.getAttribute("data-meeting");
        const response = btn.getAttribute("data-r");
        bar.querySelectorAll("button").forEach(b => { b.disabled = true; });
        try {
          await window.AtharAPI.portal.rsvp(id, response);
          const m = (data.meetings || []).find(x => String(x.id) === String(id));
          if (m) m.myRsvp = response;
          core().showToast(response === "coming" ? L("تم تأكيد حضورك — نراك هناك 🌿", "Confirmed — see you there 🌿") : L("تم تسجيل اعتذارك، شكراً لإبلاغنا", "Noted — thanks for letting us know"), response === "coming" ? "success" : "info");
          rerender();
        } catch (e) {
          bar.querySelectorAll("button").forEach(b => { b.disabled = false; });
          core().showToast((e && e.message) || L("تعذّر الحفظ", "Could not save"), "error");
        }
      };
    });
  }

  async function mountPanel(container, meeting) {
    const slot = container.querySelector("#rsvp-panel");
    if (!slot || !meeting) return;
    let res;
    try { res = await window.AtharAPI.meetings.rsvps(meeting.id); }
    catch (e) { slot.remove(); return; }   // endpoint not available yet
    const items = (res && res.items) || [];
    const sum = (res && res.summary) || {
      coming: items.filter(i => i.response === "coming").length,
      notComing: items.filter(i => i.response === "not_coming").length,
      noResponse: null,
    };
    const name = (v) => (v ? (core().App.currentLang === "ar" ? (v.fullNameAr || v.fullName) : (v.fullName || v.fullNameAr)) : "") || "";
    const list = (resp) => items.filter(i => i.response === resp)
      .map(i => `<li>${esc(name(i.volunteer))}${i.reason ? ` <em>— ${esc(i.reason)}</em>` : ""}</li>`).join("");
    slot.innerHTML = `<section class="card rsvp-panel">
      <div class="rsvp-panel-head">
        <h3>${ic("user_check", 16)} ${L("تأكيدات الحضور", "Attendance confirmations")}</h3>
        <div class="rsvp-counts">
          <span class="rsvp-count rsvp-yes"><b class="num-ltr">${Number(sum.coming || 0)}</b> ${L("سيحضر", "coming")}</span>
          <span class="rsvp-count rsvp-no"><b class="num-ltr">${Number(sum.notComing || 0)}</b> ${L("معتذر", "declined")}</span>
          ${sum.noResponse != null ? `<span class="rsvp-count"><b class="num-ltr">${Number(sum.noResponse)}</b> ${L("لم يرد", "no reply")}</span>` : ""}
        </div>
      </div>
      ${items.length ? `<details class="rsvp-details"><summary>${L("عرض الأسماء", "Show names")}</summary>
        <div class="rsvp-cols">
          <div><h4>${L("سيحضر", "Coming")}</h4><ul>${list("coming") || `<li class="muted">—</li>`}</ul></div>
          <div><h4>${L("معتذر", "Declined")}</h4><ul>${list("not_coming") || `<li class="muted">—</li>`}</ul></div>
        </div></details>` : `<p class="rsvp-none">${L("لم يؤكد أحد بعد.", "No replies yet.")}</p>`}
    </section>`;
  }

  return { enabledFor, portalButtons, bindPortal, mountPanel };
})();
