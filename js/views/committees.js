/**
 * View: Committees (list + detail)
 */
(function () {
  "use strict";

  const { App, t, formatDate, ic, showToast, showConfirmModal, hasPermission, navigateTo } = window.AtharCore;

  // =========================================================================
  // Committees List
  // =========================================================================
  function renderCommitteesList(container) {
    const state = window.AtharStore.getState();
    const canCreate = hasPermission("committees", "create");
    const canDelete = hasPermission("committees", "delete");
    const canEdit = hasPermission("committees", "edit");

    let isGridView = App.committeesView !== "list";
    let filterStatus = App.committeesFilterStatus || "active";

    const allCommittees = state.committees || [];
    const visible = allCommittees.filter(c => {
      if (filterStatus === "all") return true;
      if (filterStatus === "active") return c.status === "active";
      if (filterStatus === "archived") return c.status === "archived";
      return true;
    });

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <div class="breadcrumb-trail">
            <span class="breadcrumb-item" onclick="window.AtharApp.navigateTo('dashboard')">${t("app_name")}</span>
            <span class="breadcrumb-separator">/</span>
            <span>${t("nav_committees")}</span>
          </div>
          <h1 class="view-title">${t("committees_title")}</h1>
          <p class="view-subtitle">
            ${allCommittees.filter(c => c.status === 'active').length} active &bull;
            ${allCommittees.filter(c => c.status === 'archived').length} archived
          </p>
        </div>
        <div class="view-header-actions">
          <select id="comm-filter-status" class="form-control" style="width:140px;">
            <option value="active" ${filterStatus === 'active' ? 'selected' : ''}>${t("active")}</option>
            <option value="archived" ${filterStatus === 'archived' ? 'selected' : ''}>${t("archived")}</option>
            <option value="all" ${filterStatus === 'all' ? 'selected' : ''}>${t("all_statuses")}</option>
          </select>
          <button class="btn btn-secondary btn-sm" id="btn-toggle-comm-view">
            ${isGridView ? t("list_view") : t("grid_view")}
          </button>
          ${canCreate ? `<button class="btn btn-primary" id="btn-add-committee">${ic("plus", 14)} ${t("add_committee")}</button>` : ''}
        </div>
      </div>

      ${visible.length === 0 ? `
        <div class="card" style="text-align:center; padding:48px;">
          <div style="color:var(--neutral-400); margin-bottom:12px;">${ic("building", 42, { strokeWidth: 1.5 })}</div>
          <div style="font-weight:700; font-size:16px; margin-bottom:4px;">
            ${filterStatus === 'archived' ? 'No archived committees' : 'No committees found'}
          </div>
          <p style="color:var(--neutral-500); font-size:13px;">
            ${filterStatus === 'archived' ? 'Archived committees will appear here.' : 'Create a committee to get started.'}
          </p>
        </div>
      ` : isGridView ? `
        <div class="committees-grid">
          ${visible.map(comm => {
      const memberCount = state.volunteers.filter(v => v.committee_id === comm.id && v.status !== "archived").length;
      const commHours = state.volunteer_hours
        .filter(h => h.committee_id === comm.id && h.status === "approved")
        .reduce((acc, h) => acc + Number(h.hours), 0);
      const isArchived = comm.status === "archived";

      return `
              <div class="committee-card" style="${isArchived ? 'opacity:0.7;border-style:dashed;' : ''}">
                <div>
                  <div class="committee-card-header">
                    <div>
                      <div class="committee-card-title">${App.currentLang === 'ar' ? comm.name_ar : comm.name_en}</div>
                      <div style="font-size:12px; color:var(--neutral-500);">${App.currentLang === 'ar' ? comm.name_en : comm.name_ar}</div>
                    </div>
                    <span class="badge ${comm.status === 'active' ? 'badge-success' : 'badge-neutral'}">${t(comm.status)}</span>
                  </div>
                  <p class="committee-card-desc">${App.currentLang === 'ar' ? (comm.description_ar || '') : (comm.description_en || '')}</p>
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
                      <span class="committee-stat-val" style="font-size:13px; font-weight:600;">${comm.manager_name || '—'}</span>
                      <span class="committee-stat-lbl">${t("manager")}</span>
                    </div>
                  </div>
                  <div style="display:flex; gap:8px;">
                    <button class="btn btn-secondary" style="flex:1;" onclick="window.AtharApp.navigateTo('committee-detail', {id:'${comm.id}'})">
                      ${t("view")} ${t("details")}
                    </button>
                    ${isArchived
          ? (canEdit ? `<button class="btn btn-success btn-sm" data-comm-action="restore" data-comm-id="${comm.id}" data-comm-name="${comm.name_en}">${t("restore")}</button>` : '')
          : (canDelete ? `<button class="btn btn-danger-outline btn-sm" data-comm-action="archive" data-comm-id="${comm.id}" data-comm-name="${comm.name_en}">${t("delete")}</button>` : '')
        }
                  </div>
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
              ${visible.map(comm => {
      const count = state.volunteers.filter(v => v.committee_id === comm.id && v.status !== "archived").length;
      const hours = state.volunteer_hours.filter(h => h.committee_id === comm.id && h.status === "approved").reduce((a, b) => a + Number(b.hours), 0);
      const isArchived = comm.status === "archived";
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
                        ${isArchived
          ? (canEdit ? `<button class="btn btn-success btn-sm" data-comm-action="restore" data-comm-id="${comm.id}" data-comm-name="${comm.name_en}">${t("restore")}</button>` : '')
          : (canDelete ? `<button class="btn btn-danger-outline btn-sm" data-comm-action="archive" data-comm-id="${comm.id}" data-comm-name="${comm.name_en}">${t("delete")}</button>` : '')
        }
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

    // Status filter
    const filterSel = document.getElementById("comm-filter-status");
    if (filterSel) {
      filterSel.onchange = (e) => {
        App.committeesFilterStatus = e.target.value;
        renderCommitteesList(container);
      };
    }

    // Grid/list toggle
    const toggleBtn = document.getElementById("btn-toggle-comm-view");
    if (toggleBtn) {
      toggleBtn.onclick = () => {
        App.committeesView = isGridView ? "list" : "grid";
        renderCommitteesList(container);
      };
    }

    // Add button
    const addBtn = document.getElementById("btn-add-committee");
    if (addBtn) addBtn.onclick = () => window.AtharModals.openAddCommitteeModal();

    // Archive / Restore buttons
    container.querySelectorAll("[data-comm-action]").forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute("data-comm-id");
        const name = btn.getAttribute("data-comm-name");
        const action = btn.getAttribute("data-comm-action");

        if (action === "archive") {
          showConfirmModal({
            title: t("confirm_destructive"),
            message: `Delete committee "${name}"?\n\nIt will be archived (soft-deleted) and can be restored later. Committees with active members cannot be archived — remove or transfer members first.`,
            confirmText: t("delete"),
            isDanger: true,
            onConfirm: async () => {
              btn.disabled = true;
              try {
                await window.AtharAPI.committees.archive(id);
                await window.AtharStore.refreshCommittees();
                showToast(`Committee archived`, "success");
                renderCommitteesList(container);
              } catch (err) {
                if (err.code === "COMMITTEE_HAS_MEMBERS") {
                  showToast(err.message || "Cannot archive committee with active members.", "error");
                } else if (err.status === 403) {
                  showToast("You don't have permission to delete committees.", "error");
                } else {
                  showToast(err.message || "Delete failed", "error");
                }
                btn.disabled = false;
              }
            },
          });
        }

        if (action === "restore") {
          btn.disabled = true;
          try {
            await window.AtharAPI.committees.restore(id);
            await window.AtharStore.refreshCommittees();
            showToast(`Committee restored`, "success");
            renderCommitteesList(container);
          } catch (err) {
            showToast(err.message || "Restore failed", "error");
            btn.disabled = false;
          }
        }
      };
    });
  }

  // =========================================================================
  // Committee Detail
  // =========================================================================
  function renderCommitteeDetail(container, committeeId) {
    const state = window.AtharStore.getState();
    const comm = state.committees.find(c => c.id === committeeId);
    if (!comm) {
      container.innerHTML = `<div class="empty-state"><p>Committee not found</p></div>`;
      return;
    }

    const canDelete = hasPermission("committees", "delete");
    const canEdit = hasPermission("committees", "edit");
    const isArchived = comm.status === "archived";

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
          <p class="view-subtitle">
            ${comm.name_en} &bull; Manager: ${comm.manager_name || '—'}
            ${isArchived ? '&bull; <span class="badge badge-neutral">' + t("archived") + '</span>' : ''}
          </p>
        </div>
        <div class="view-header-actions">
          ${isArchived && canEdit ? `<button class="btn btn-success btn-sm" id="btn-restore-comm">${ic("refresh", 14)} ${t("restore")}</button>` : ''}
          ${!isArchived && canEdit ? `<button class="btn btn-secondary btn-sm" id="btn-edit-comm-name">${ic("pencil", 14)} ${t("edit")}</button>` : ''}
          ${!isArchived && hasPermission("meetings", "create") ? `<button class="btn btn-primary btn-sm" onclick="window.AtharModals.openCreateMeetingSlideover('${comm.id}')">${ic("plus", 14)} ${t("add_meeting")}</button>` : ''}
          ${!isArchived && canDelete ? `<button class="btn btn-danger-outline btn-sm" id="btn-delete-comm">${ic("trash", 14)} ${t("delete")}</button>` : ''}
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
          <span style="font-size:16px; font-weight:700; color:var(--neutral-900);">${comm.manager_name || '—'}</span>
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

    const restoreBtn = document.getElementById("btn-restore-comm");
    if (restoreBtn) {
      restoreBtn.onclick = async () => {
        restoreBtn.disabled = true;
        try {
          await window.AtharAPI.committees.restore(comm.id);
          await window.AtharStore.refreshCommittees();
          showToast("Committee restored", "success");
          renderCommitteeDetail(container, committeeId);
        } catch (err) {
          showToast(err.message || "Restore failed", "error");
          restoreBtn.disabled = false;
        }
      };
    }

    const deleteBtn = document.getElementById("btn-delete-comm");
    if (deleteBtn) {
      deleteBtn.onclick = () => {
        showConfirmModal({
          title: t("confirm_destructive"),
          message: `Delete committee "${comm.name_en}"?\n\nIt will be archived (soft-deleted) and can be restored later. Committees with active members cannot be archived.`,
          confirmText: t("delete"),
          isDanger: true,
          onConfirm: async () => {
            try {
              await window.AtharAPI.committees.archive(comm.id);
              await window.AtharStore.refreshCommittees();
              showToast("Committee archived", "success");
              navigateTo("committees");
            } catch (err) {
              if (err.code === "COMMITTEE_HAS_MEMBERS") {
                showToast(err.message || "Cannot archive committee with active members.", "error");
              } else if (err.status === 403) {
                showToast("You don't have permission to delete committees.", "error");
              } else {
                showToast(err.message || "Delete failed", "error");
              }
            }
          },
        });
      };
    }
  }

  window.AtharViews.committees = (c, p) => renderCommitteesList(c);
  window.AtharViews.committeeDetail = (c, p) => renderCommitteeDetail(c, p.id);
})();