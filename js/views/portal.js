/**
 * View: Volunteer self-service portal (member view)
 */
(function () {
  "use strict";
  const { App, t, ic, escapeHtml, formatDate, navigateTo } = window.AtharCore;

  function renderPortal(container) {
    const state = window.AtharStore.getState();
    const L = (ar, en) => (App.currentLang === "ar" ? ar : en);
    const me = App.currentUser || {};
    const vol = state.volunteers.find(v => v.id === me.volunteer_id) ||
                state.volunteers.find(v => v.email && me.email && v.email.toLowerCase() === me.email.toLowerCase());
    const comm = vol ? state.committees.find(c => c.id === vol.committee_id) : null;
    const head = comm ? (comm.leader || (comm.co_leaders && comm.co_leaders[0]) || null) : null;

    // Total approved hours for this volunteer
    const myHours = state.volunteer_hours.filter(h => h.volunteer_id === vol?.id && h.status === "approved");
    const totalHours = myHours.reduce((a, h) => a + Number(h.hours), 0);

    // Own certificates
    const myCerts = state.certificates.filter(c => c.volunteer_id === vol?.id && c.status === "issued");

    // Upcoming events/meetings for own committee
    const upcoming = state.meetings.filter(m => m.status === "scheduled" && (!comm || m.committee_id === comm.id)).slice(0, 5);

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <h1 class="view-title">${L("بوابة المتطوع", "My Portal")}</h1>
          <p class="view-subtitle">${t("welcome_back")} ${escapeHtml(me.full_name || me.fullName || "")}</p>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card kpi-hours">
          <div class="kpi-header"><span class="kpi-title">${L("ساعاتي المعتمدة", "My approved hours")}</span><div class="kpi-icon-badge">${ic("clock", 20)}</div></div>
          <div class="kpi-value num-ltr">${totalHours.toLocaleString()} h</div>
          <div class="kpi-trend">${myHours.length} ${L("سجل", "entries")}</div>
        </div>
        <div class="kpi-card kpi-certs">
          <div class="kpi-header"><span class="kpi-title">${L("شهاداتي", "My certificates")}</span><div class="kpi-icon-badge">${ic("award", 20)}</div></div>
          <div class="kpi-value num-ltr">${myCerts.length}</div>
        </div>
        <div class="kpi-card kpi-committees">
          <div class="kpi-header"><span class="kpi-title">${L("اللجنة", "Committee")}</span><div class="kpi-icon-badge">${ic("building", 20)}</div></div>
          <div class="kpi-value" style="font-size:16px;">${escapeHtml(comm ? (App.currentLang === 'ar' ? comm.name_ar : comm.name_en) : "—")}</div>
        </div>
        <div class="kpi-card kpi-volunteers">
          <div class="kpi-header"><span class="kpi-title">${L("رئيس اللجنة", "Committee head")}</span><div class="kpi-icon-badge">${ic("user", 20)}</div></div>
          <div class="kpi-value" style="font-size:16px;">${escapeHtml(head ? (App.currentLang === 'ar' ? (head.full_name_ar || head.full_name) : head.full_name) : "—")}</div>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <div class="card-header"><div class="card-title">${ic("calendar", 18)} ${L("الفعاليات القادمة", "Upcoming events")}</div></div>
        ${upcoming.length === 0
          ? `<div class="empty-state" style="padding:24px 16px;"><div class="empty-state-desc">${L("لا توجد فعاليات قادمة", "No upcoming events")}</div></div>`
          : `<div style="display:flex; flex-direction:column; gap:8px;">${upcoming.map(m => `
              <div class="leader-pending-row">
                <div class="leader-pending-main">
                  <div class="leader-pending-title">${escapeHtml(App.currentLang === 'ar' ? (m.title_ar || m.title_en) : (m.title_en || m.title_ar))}</div>
                  <div class="leader-pending-sub">${m.meeting_date ? formatDate(String(m.meeting_date).slice(0,10)) : ''} ${m.start_time ? '• ' + m.start_time : ''}</div>
                </div>
              </div>`).join('')}</div>`}
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">${ic("award", 18)} ${L("شهاداتي", "My certificates")}</div></div>
        ${myCerts.length === 0
          ? `<div class="empty-state" style="padding:24px 16px;"><div class="empty-state-desc">${L("لا شهادات صادرة بعد", "No certificates issued yet")}</div></div>`
          : `<div style="display:flex; flex-direction:column; gap:8px;">${myCerts.map(c => `
              <div class="leader-pending-row">
                <div class="leader-pending-main">
                  <div class="leader-pending-title">${escapeHtml(c.certificate_no || c.certificateNo || '')}</div>
                  <div class="leader-pending-sub">${c.issue_date ? formatDate(String(c.issue_date).slice(0,10)) : ''} &bull; ${Number(c.total_hours || c.totalHours || 0)} h</div>
                </div>
                <span class="badge badge-success">${L("صادرة", "Issued")}</span>
              </div>`).join('')}</div>`}
      </div>
    `;
  }

  window.AtharViews = window.AtharViews || {};
  window.AtharViews.portal = renderPortal;
  window.AtharViews["volunteer-portal"] = renderPortal;
})();
