/**
 * View: Committees (list + detail)
 */
(function () {
  "use strict";

  const { App, t, formatDate, ic, showToast, hasPermission, navigateTo } = window.AtharCore;

  function renderCommitteesList(container) {
    const state = window.AtharStore.getState();
    const canCreate = hasPermission("committees", "create");
    let isGridView = App.committeesView !== "list";

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <div class="breadcrumb-trail">
            <span class="breadcrumb-item" onclick="window.AtharApp.navigateTo('dashboard')">${t("app_name")}</span>
            <span class="breadcrumb-separator">/</span>
            <span>${t("nav_committees")}</span>
          </div>
          <h1 class="view-title">${t("committees_title")}</h1>
          <p class="view-subtitle">${state.committees.filter(c => c.status === 'active').length} active organizational units</p>
        </div>
        <div class="view-header-actions">
          <button class="btn btn-secondary btn-sm" id="btn-toggle-comm-view">
            ${isGridView ? t("list_view") : t("grid_view")}
          </button>
          ${canCreate ? `<button class="btn btn-primary" id="btn-add-committee">${ic("plus", 14)} ${t("add_committee")}</button>` : ''}
        </div>
      </div>

      ${isGridView ? `
        <div class="committees-grid">
          ${state.committees.map(comm => {
            const memberCount = state.volunteers.filter(v => v.committee_id === comm.id && v.status !== "archived").length;
            const commHours = state.volunteer_hours
              .filter(h => h.committee_id === comm.id && h.status === "approved")
              .reduce((acc, h) => acc + Number(h.hours), 0);
            return `
              <div class="committee-card">
                <div>
                  <div class="committee-card-header">
                    <div>
                      <div class="committee-card-title">${App.currentLang === 'ar' ? comm.name_ar : comm.name_en}</div>
                      <div style="font-size:12px; color:var(--neutral-500);">${App.currentLang === 'ar' ? comm.name_en : comm.name_ar}</div>
                    </div>
                    <span class="badge ${comm.status === 'active' ? 'badge-success' : 'badge-neutral'}">${t(comm.status)}</span>
                  </div>
                  <p class="committee-card-desc">${App.currentLang === 'ar' ? comm.description_ar : comm.description_en}</p>
                </div>
                <div>
                  <div class="committee-stats-row">
                    <div class="committee-stat-item">
                      <span class="committee-stat-val num-ltr">${memberCount}</span>
                      <span class="committee-stat-lbl">${t("members_count")}</span>
                    </div>
                    <div class="committee-stat-item">
                      <span class="committee-stat-val num-ltr">${commHours} h</span>
                      <span class="committee-stat-lbl">${t("hours")}</span>
                    </div>
                    <div class="committee-stat-item">
                      <span class="committee-stat-val" style="font-size:13px; font-weight:600;">${comm.manager_name || 'Admin'}</span>
                      <span class="committee-stat-lbl">${t("manager")}</span>
                    </div>
                  </div>
                  <button class="btn btn-secondary" style="width:100%;" onclick="window.AtharApp.navigateTo('committee-detail', {id:'${comm.id}'})">
                    ${t("view")} ${t("details")} &#8594;
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : `
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Committee Name</th>
                <th>Manager</th>
                <th>Active Members</th>
                <th>Total Hours</th>
                <th>Status</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${state.committees.map(comm => {
                const count = state.volunteers.filter(v => v.committee_id === comm.id && v.status !== "archived").length;
                const hours = state.volunteer_hours.filter(h => h.committee_id === comm.id && h.status === "approved").reduce((a, b) => a + Number(b.hours), 0);
                return `
                  <tr>
                    <td>
                      <div style="font-weight:700;">${App.currentLang === 'ar' ? comm.name_ar : comm.name_en}</div>
                      <div style="font-size:11px; color:var(--neutral-500);">${comm.name_en}</div>
                    </td>
                    <td>${comm.manager_name || '—'}</td>
                    <td><span class="num-ltr" style="font-weight:700;">${count}</span></td>
                    <td><span class="num-ltr" style="font-weight:700;">${hours} h</span></td>
                    <td><span class="badge ${comm.status === 'active' ? 'badge-success' : 'badge-neutral'}">${t(comm.status)}</span></td>
                    <td>
                      <div class="row-actions-cell">
                        <button class="btn btn-secondary btn-sm" onclick="window.AtharApp.navigateTo('committee-detail', {id:'${comm.id}'})">${t("view")}</button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `}
    `;

    document.getElementById("btn-toggle-comm-view").onclick = () => {
      App.committeesView = isGridView ? "list" : "grid";
      renderCommitteesList(container);
    };

    const addBtn = document.getElementById("btn-add-committee");
    if (addBtn) addBtn.onclick = () => window.AtharModals.openAddCommitteeModal();
  }

  function renderCommitteeDetail(container, committeeId) {
    const state = window.AtharStore.getState();
    const comm = state.committees.find(c => c.id === committeeId);
    if (!comm) {
      container.innerHTML = `<div class="empty-state"><p>Committee not found</p></div>`;
      return;
    }

    const members = state.volunteers.filter(v => v.committee_id === comm.id && v.status !== "archived");
    const commMeetings = state.meetings.filter(m => m.committee_id === comm.id || m.committee_id === null);
    const commHours = state.volunteer_hours.filter(h => h.committee_id === comm.id && h.status === "approved");
    const totalHours = commHours.reduce((a, b) => a + Number(b.hours), 0);
    let activeTab = App.currentParams.sub || "members";

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <div class="breadcrumb-trail">
            <span class="breadcrumb-item" onclick="window.AtharApp.navigateTo('committees')">${t("back_to_committees")}</span>
            <span class="breadcrumb-separator">/</span>
            <span>${App.currentLang === 'ar' ? comm.name_ar : comm.name_en}</span>
          </div>
          <h1 class="view-title">${App.currentLang === 'ar' ? comm.name_ar : comm.name_en}</h1>
          <p class="view-subtitle">${comm.name_en} &bull; Manager: ${comm.manager_name || 'Admin'}</p>
        </div>
        <div class="view-header-actions">
          ${hasPermission("committees", "edit") ? `<button class="btn btn-secondary btn-sm" id="btn-edit-comm-name">${ic("pencil", 14)} ${t("edit")}</button>` : ''}
          ${hasPermission("meetings", "create") ? `<button class="btn btn-primary btn-sm" onclick="window.AtharModals.openCreateMeetingSlideover('${comm.id}')">${ic("plus", 14)} ${t("add_meeting")}</button>` : ''}
        </div>
      </div>

      <div class="profile-stats-grid">
        <div class="stat-box">
          <span class="stat-box-label">${t("members_count")}</span>
          <span class="stat-box-value num-ltr">${members.length}</span>
        </div>
        <div class="stat-box">
          <span class="stat-box-label">${t("kpi_total_hours")}</span>
          <span class="stat-box-value num-ltr" style="color:var(--success);">${totalHours} h</span>
        </div>
        <div class="stat-box">
          <span class="stat-box-label">Meetings</span>
          <span class="stat-box-value num-ltr">${commMeetings.length}</span>
        </div>
        <div class="stat-box">
          <span class="stat-box-label">Manager</span>
          <span style="font-size:16px; font-weight:700; color:var(--neutral-900);">${comm.manager_name || 'Admin'}</span>
        </div>
      </div>

      <div class="tabs-header">
        <div class="tab-btn ${activeTab === 'members' ? 'active' : ''}" data-tab="members">${t("tab_members")} (${members.length})</div>
        <div class="tab-btn ${activeTab === 'meetings' ? 'active' : ''}" data-tab="meetings">${t("tab_meetings")} (${commMeetings.length})</div>
        <div class="tab-btn ${activeTab === 'hours' ? 'active' : ''}" data-tab="hours">${t("tab_hours_summary")}</div>
      </div>

      <div id="comm-tab-container">
        ${activeTab === 'members' ? `
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr><th>Volunteer</th><th>Status</th><th>Hours</th><th>Skills</th><th style="text-align:right;">Actions</th></tr>
              </thead>
              <tbody>
                ${members.length === 0 ? `<tr><td colspan="5" style="text-align:center; padding:24px;">No members assigned yet.</td></tr>` : members.map(m => {
                  const s = window.AtharStore.getVolunteerStats(m.id);
                  return `
                    <tr>
                      <td style="font-weight:700; cursor:pointer;" onclick="window.AtharApp.navigateTo('volunteer-profile', {id:'${m.id}'})">
                        ${App.currentLang === 'ar' ? (m.full_name_ar || m.full_name) : m.full_name}
                      </td>
                      <td><span class="badge badge-success">${m.status}</span></td>
                      <td><span class="num-ltr" style="font-weight:700;">${s ? s.totalHours : 0} h</span></td>
                      <td>${(m.skills || []).map(sk => `<span class="tag-chip">#${sk}</span>`).join(' ')}</td>
                      <td>
                        <div class="row-actions-cell">
                          <button class="btn btn-secondary btn-sm" onclick="window.AtharApp.navigateTo('volunteer-profile', {id:'${m.id}'})">${t("view")}</button>
                          ${hasPermission("volunteers", "transfer") ? `<button class="btn btn-secondary btn-sm" onclick="window.AtharModals.openTransferModal('${m.id}')">${t("transfer_volunteer")}</button>` : ''}
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        ` : activeTab === 'meetings' ? `
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr><th>Title</th><th>Date</th><th>Time</th><th>Status</th><th>Action</th></tr>
              </thead>
              <tbody>
                ${commMeetings.map(mt => `
                  <tr>
                    <td style="font-weight:700;">${App.currentLang === 'ar' ? mt.title_ar : mt.title_en}</td>
                    <td>${formatDate(mt.meeting_date)}</td>
                    <td class="num-ltr">${mt.start_time} - ${mt.end_time}</td>
                    <td><span class="badge ${mt.status === 'completed' ? 'badge-success' : 'badge-primary'}">${t(mt.status)}</span></td>
                    <td>
                      <button class="btn btn-secondary btn-sm" onclick="window.AtharApp.navigateTo('meeting-detail', {id:'${mt.id}'})">${t("view")}</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div class="card">
            <h3 style="margin-bottom:12px;">Hours Breakdown</h3>
            <p>Total recorded approved volunteer service: <strong>${totalHours} hours</strong></p>
          </div>
        `}
      </div>
    `;

    container.querySelectorAll(".tab-btn").forEach(btn => {
      btn.onclick = () => {
        App.currentParams.sub = btn.getAttribute("data-tab");
        renderCommitteeDetail(container, committeeId);
      };
    });

    const editBtn = document.getElementById("btn-edit-comm-name");
    if (editBtn) editBtn.onclick = () => window.AtharModals.openAddCommitteeModal(comm.id);
  }

  window.AtharViews.committees = (c, p) => renderCommitteesList(c);
  window.AtharViews.committeeDetail = (c, p) => renderCommitteeDetail(c, p.id);
})();
