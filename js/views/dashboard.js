/**
 * View: Dashboard
 */
(function () {
  "use strict";

  const {
    App, t, formatDate, ic, showToast, navigateTo
  } = window.AtharCore;

  function renderDashboard(container) {
    const state = window.AtharStore.getState();
    const totalVolunteers = state.volunteers.filter(v => v.status !== "archived").length;
    const totalCommittees = state.committees.filter(c => c.status === "active").length;
    const totalHours = state.volunteer_hours.filter(h => h.status === "approved").reduce((acc, h) => acc + Number(h.hours), 0);
    const totalCerts = state.certificates.filter(c => c.status === "issued").length;

    const pendingHours = state.volunteer_hours.filter(h => h.status === "pending").length;
    const draftCerts = state.certificates.filter(c => c.status === "draft").length;
    const upcomingMeetings = state.meetings.filter(m => m.status === "scheduled").slice(0, 3);
    const recentAudit = state.audit_logs.slice(0, 5);

    // -------- Dynamic "this month" trends --------
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const newVolsThisMonth = state.volunteers.filter(v => {
      if (v.status === "archived" || !v.join_date) return false;
      const d = new Date(v.join_date);
      return !isNaN(d) && d >= monthStart;
    }).length;

    const hoursThisMonth = state.volunteer_hours
      .filter(h => h.status === "approved" && h.date)
      .filter(h => {
        const d = new Date(h.date);
        return !isNaN(d) && d >= monthStart;
      })
      .reduce((sum, h) => sum + Number(h.hours), 0);

    const certsThisMonth = state.certificates.filter(c => {
      if (c.status !== "issued" || !c.issue_date) return false;
      const d = new Date(c.issue_date);
      return !isNaN(d) && d >= monthStart;
    }).length;
    // --------------------------------------------

    const volunteerHoursMap = {};
    state.volunteer_hours.filter(h => h.status === "approved").forEach(h => {
      volunteerHoursMap[h.volunteer_id] = (volunteerHoursMap[h.volunteer_id] || 0) + Number(h.hours);
    });

    const topVols = Object.keys(volunteerHoursMap)
      .map(vid => ({ vol: state.volunteers.find(v => v.id === vid), hours: volunteerHoursMap[vid] }))
      .filter(item => item.vol)
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 4);

    // Reusable trend renderer
    const trend = (count, unit) => {
      if (count > 0) {
        return `<div class="kpi-trend">${ic("trending_up", 12)} +${count}${unit} this month</div>`;
      }
      return `<div class="kpi-trend" style="color:var(--neutral-500);">0 this month</div>`;
    };

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <div class="breadcrumb-trail">
            <span class="breadcrumb-item">${t("app_name")}</span>
            <span class="breadcrumb-separator">/</span>
            <span>${t("nav_dashboard")}</span>
          </div>
          <h1 class="view-title">${t("nav_dashboard")}</h1>
          <p class="view-subtitle">${t("welcome_back")} ${App.currentUser.full_name} &bull; ${new Date().toLocaleDateString(App.currentLang === 'ar' ? 'ar-SA' : 'en-US')}</p>
        </div>
        <div class="view-header-actions">
          <button class="btn btn-secondary btn-sm" id="btn-dash-refresh">
            ${ic("refresh", 14)} ${t("refresh")}
          </button>
          <button class="btn btn-secondary btn-sm" id="btn-dash-export">
            ${ic("download", 14)} ${t("export_csv")}
          </button>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card kpi-volunteers" id="kpi-card-vols">
          <div class="kpi-header">
            <span class="kpi-title">${t("kpi_volunteers")}</span>
            <div class="kpi-icon-badge">${ic("users", 20, { strokeWidth: 2 })}</div>
          </div>
          <div class="kpi-value num-ltr">${totalVolunteers}</div>
          ${trend(newVolsThisMonth, "")}
        </div>

        <div class="kpi-card kpi-committees" id="kpi-card-comms">
          <div class="kpi-header">
            <span class="kpi-title">${t("kpi_committees")}</span>
            <div class="kpi-icon-badge">${ic("building", 20, { strokeWidth: 2 })}</div>
          </div>
          <div class="kpi-value num-ltr">${totalCommittees}</div>
          <div class="kpi-trend" style="color:var(--neutral-500);">${totalCommittees === 1 ? '1 active unit' : `${totalCommittees} active units`}</div>
        </div>

        <div class="kpi-card kpi-hours" id="kpi-card-hours">
          <div class="kpi-header">
            <span class="kpi-title">${t("kpi_total_hours")}</span>
            <div class="kpi-icon-badge">${ic("clock", 20, { strokeWidth: 2 })}</div>
          </div>
          <div class="kpi-value num-ltr">${totalHours.toLocaleString()} h</div>
          ${trend(hoursThisMonth, " h")}
        </div>

        <div class="kpi-card kpi-certs" id="kpi-card-certs">
          <div class="kpi-header">
            <span class="kpi-title">${t("kpi_certificates")}</span>
            <div class="kpi-icon-badge">${ic("award", 20, { strokeWidth: 2 })}</div>
          </div>
          <div class="kpi-value num-ltr">${totalCerts}</div>
          ${trend(certsThisMonth, "")}
        </div>
      </div>

      <div class="dashboard-grid">
        <div class="card">
          <div class="card-header">
            <div class="card-title">${ic("calendar", 18)} ${t("upcoming_meetings")}</div>
            <button class="btn btn-secondary btn-sm" id="btn-goto-meetings">${t("view")}</button>
          </div>
  ${upcomingMeetings.length === 0 ? `
            <div class="empty-state" style="padding:32px 16px;">
              <div class="empty-state-icon">${ic("calendar", 36, { strokeWidth: 1.5 })}</div>
              <div class="empty-state-title">${t("no_upcoming_meetings")}</div>
            </div>
          ` : `            <div style="display:flex; flex-direction:column; gap:12px;">
              ${upcomingMeetings.map(m => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:var(--neutral-50); border:1px solid var(--neutral-300); border-radius:var(--radius-md); cursor:pointer;" onclick="window.AtharApp.navigateTo('meeting-detail', {id:'${m.id}'})">
                  <div>
                    <div style="font-weight:700; color:var(--neutral-900);">${App.currentLang === 'ar' ? m.title_ar : m.title_en}</div>
                    <div style="font-size:12px; color:var(--neutral-500); margin-top:2px;">${m.location} &bull; ${m.start_time} - ${m.end_time}</div>
                  </div>
                  <div style="text-align:right;">
                    <span class="badge badge-primary">${formatDate(m.meeting_date)}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">${ic("clock", 18)} ${t("pending_approvals")}</div>
          </div>
          <div style="display:flex; flex-direction:column; gap:10px;">
            <div style="display:flex; justify-content:space-between; align-items:center; padding:14px; background:var(--warning-light); border:1px solid var(--warning-border); border-radius:var(--radius-md); cursor:pointer;" onclick="window.AtharApp.navigateTo('volunteer-hours')">
              <div style="display:flex; align-items:center; gap:10px;">
                <span style="color:var(--warning);">${ic("clock", 20)}</span>
                <span style="font-weight:600; color:var(--neutral-900);">${pendingHours} ${t("hours_awaiting_approval")}</span>
              </div>
              <span class="btn btn-secondary btn-sm">${t("view")}</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; padding:14px; background:var(--primary-light); border:1px solid var(--primary-border); border-radius:var(--radius-md); cursor:pointer;" onclick="window.AtharApp.navigateTo('certificates')">
              <div style="display:flex; align-items:center; gap:10px;">
                <span style="color:var(--primary);">${ic("award", 20)}</span>
                <span style="font-weight:600; color:var(--neutral-900);">${draftCerts} ${t("certs_in_draft")}</span>
              </div>
              <span class="btn btn-secondary btn-sm">${t("view")}</span>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">${ic("building", 18)} ${t("volunteers_per_committee")}</div>
          </div>
          <div style="display:flex; flex-direction:column; gap:16px;">
    ${state.committees.length === 0
        ? `<div class="empty-state" style="padding:32px 16px;">
             <div class="empty-state-icon">${ic("building", 36, { strokeWidth: 1.5 })}</div>
             <div class="empty-state-title">No committees yet</div>
           </div>`
        : state.committees.map(c => {
          const count = state.volunteers.filter(v => v.committee_id === c.id && v.status !== "archived").length;
          const percent = totalVolunteers > 0 ? Math.min(100, Math.round((count / totalVolunteers) * 100)) : 0;
          return `
                  <div>
                    <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:600; margin-bottom:6px;">
                      <span>${App.currentLang === 'ar' ? c.name_ar : c.name_en}</span>
                      <span class="num-ltr">${count} vols (${percent}%)</span>
                    </div>
                    <div style="height:10px; background:var(--neutral-200); border-radius:var(--radius-full); overflow:hidden;">
                      <div style="width:${percent}%; height:100%; background:linear-gradient(90deg, var(--primary), #8A3FFC); border-radius:var(--radius-full);"></div>
                    </div>
                  </div>
                `;
        }).join('')
      }
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">${ic("award", 18)} ${t("top_active_volunteers")}</div>
          </div>
          <div style="display:flex; flex-direction:column; gap:10px;">
                       ${topVols.length === 0
        ? `<div class="empty-state" style="padding:32px 16px;">
             <div class="empty-state-icon">${ic("award", 36, { strokeWidth: 1.5 })}</div>
             <div class="empty-state-title">No approved hours yet</div>
           </div>`
        : topVols.map((item, idx) => `
                <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:var(--neutral-50); border:1px solid var(--neutral-300); border-radius:var(--radius-md); cursor:pointer;" onclick="window.AtharApp.navigateTo('volunteer-profile', {id:'${item.vol.id}'})">
                  <div style="display:flex; align-items:center; gap:12px;">
                    <span style="font-weight:800; font-size:14px; color:${idx === 0 ? '#F59E0B' : idx === 1 ? '#94A3B8' : '#B45309'};">#${idx + 1}</span>
                    <div class="user-avatar" style="width:28px; height:28px; font-size:11px;">${item.vol.full_name.charAt(0)}</div>
                    <div>
                      <div style="font-weight:700; color:var(--neutral-900); font-size:13px;">${App.currentLang === 'ar' ? (item.vol.full_name_ar || item.vol.full_name) : item.vol.full_name}</div>
                      <div style="font-size:11px; color:var(--neutral-500);">${item.vol.skills ? item.vol.skills.slice(0, 2).join(', ') : ''}</div>
                    </div>
                  </div>
                  <div style="font-weight:800; color:var(--success); font-size:14px;" class="num-ltr">${item.hours} h</div>
                </div>
              `).join('')
      }
          </div>
        </div>

        <div class="card dashboard-widget-full">
          <div class="card-header">
            <div class="card-title">${ic("activity", 18)} ${t("recent_activity")}</div>
            <button class="btn btn-secondary btn-sm" onclick="window.AtharApp.navigateTo('audit-logs')">${t("view")}</button>
          </div>
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${recentAudit.length === 0
        ? `<p style="color:var(--neutral-500); font-size:13px; padding:12px 0;">No activity recorded yet.</p>`
        : recentAudit.map(al => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; border-bottom:1px solid var(--neutral-200); font-size:13px;">
                  <div style="display:flex; align-items:center; gap:10px;">
                    <span class="badge ${al.action === 'create' ? 'badge-success' : al.action === 'approve' || al.action === 'issue' ? 'badge-primary' : al.action === 'revoke' ? 'badge-danger' : 'badge-neutral'}">${al.action}</span>
                    <span style="font-weight:600; color:var(--neutral-900);">${al.details}</span>
                  </div>
                  <div style="font-size:12px; color:var(--neutral-500);" class="num-ltr">
                    ${al.user_name} &bull; ${al.created_at}
                  </div>
                </div>
              `).join('')
      }
          </div>
        </div>
      </div>
    `;

    document.getElementById("btn-dash-refresh").onclick = async () => {
      try { await window.AtharStore.loadAll(); } catch (e) { console.warn(e); }
      showToast(t("refresh"), "success");
      renderDashboard(container);
    };

    document.getElementById("btn-dash-export").onclick = () => {
      const headers = ["ID", "Name", "Committee", "Status", "Total Hours"];
      const rows = state.volunteers.map(v => {
        const comm = state.committees.find(c => c.id === v.committee_id);
        const stats = window.AtharStore.getVolunteerStats(v.id);
        return [v.national_id, v.full_name, comm ? comm.name_en : "Unassigned", v.status, stats ? stats.totalHours : 0];
      });
      window.ExportUtil.downloadCSV("Athar_Volunteers_Summary.csv", headers, rows);
      showToast("CSV Exported successfully!");
    };

    document.getElementById("kpi-card-vols").onclick = () => navigateTo("volunteers");
    document.getElementById("kpi-card-comms").onclick = () => navigateTo("committees");
    document.getElementById("kpi-card-hours").onclick = () => navigateTo("volunteer-hours");
    document.getElementById("kpi-card-certs").onclick = () => navigateTo("certificates");
    document.getElementById("btn-goto-meetings").onclick = () => navigateTo("meetings");
  }

  window.AtharViews.dashboard = (c, p) => renderDashboard(c);
})();