/**
 * View: Committees (list + detail)
 */
(function () {
  "use strict";

  const { App, t, formatDate, ic, showToast, showConfirmModal, hasPermission, navigateTo, escapeHtml } = window.AtharCore;

  // Display name for a member/volunteer row (respects the current language).
  const memberName = (m) => (App.currentLang === "ar" ? (m.full_name_ar || m.full_name) : (m.full_name || m.full_name_ar));

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
    let searchQuery = App.committeesSearch || "";

    const allCommittees = state.committees || [];
    const visible = allCommittees.filter(c => {
      if (filterStatus === "all") { /* ok */ } else if (filterStatus === "active") { if (c.status !== "active") return false; } else if (filterStatus === "archived") { if (c.status !== "archived") return false; }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const hay = ((App.currentLang === 'ar' ? c.name_ar : c.name_en) + " " + (App.currentLang === 'ar' ? c.name_en : c.name_ar) + " " + (c.description_ar || "") + " " + (c.description_en || "")).toLowerCase();
        if (!hay.includes(q)) return false;
      }
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
          <input type="search" id="comm-search" class="form-control" style="width:180px;" placeholder="${App.currentLang === 'ar' ? 'بحث في اللجان…' : 'Search committees…'}">
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
                      <span class="committee-stat-val" style="font-size:13px; font-weight:600;">${comm.leader ? escapeHtml(memberName(comm.leader)) : '—'}</span>
                      <span class="committee-stat-lbl">${t("leader")}</span>
                    </div>
                  </div>
                  <div style="font-size:12px; color:var(--neutral-600); margin-top:8px; display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                    <span style="font-weight:700; color:var(--neutral-500);">${t("co_leaders")}:</span>
                    ${comm.co_leaders && comm.co_leaders.length
          ? comm.co_leaders.map(v => `<span class="tag-chip" style="font-size:11px;">${escapeHtml(memberName(v))}</span>`).join('')
          : `<span style="color:var(--neutral-400);">${t("none_option")}</span>`}
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
                <th>${t("leader")}</th>
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
                    <td>
                      <div style="font-weight:600;">${comm.leader ? escapeHtml(memberName(comm.leader)) : '—'}</div>
                      ${comm.co_leaders && comm.co_leaders.length
          ? `<div style="font-size:11px; color:var(--neutral-500);">+${comm.co_leaders.length} ${t("co_leaders")}</div>`
          : ''}
                    </td>
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

    const commSearch = document.getElementById("comm-search");
    if (commSearch) {
      let timer = null;
      commSearch.oninput = (e) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          App.committeesSearch = e.target.value;
          renderCommitteesList(container);
        }, 200);
      };
      commSearch.value = searchQuery;
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

    // Member-based leadership: pin the leader + co-leaders to the top of the members list.
    const hasLeadership = !!(comm.leader || (comm.co_leaders && comm.co_leaders.length));
    const coLeaderIdSet = new Set((comm.co_leaders || []).map(v => v.id));
    const pinnedMembers = [];
    if (comm.leader && members.some(v => v.id === comm.leader.id)) {
      pinnedMembers.push({ volunteer: members.find(v => v.id === comm.leader.id), role: "leader" });
    }
    (comm.co_leaders || []).forEach(cl => {
      const m = members.find(v => v.id === cl.id);
      if (m && !pinnedMembers.some(p => p.volunteer.id === m.id)) {
        pinnedMembers.push({ volunteer: m, role: "co_leader" });
      }
    });
    const regularMembers = members.filter(v => !(comm.leader && v.id === comm.leader.id) && !coLeaderIdSet.has(v.id));

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
            ${comm.name_en} &bull; ${t("leader")}: ${comm.leader ? escapeHtml(memberName(comm.leader)) : '—'}
            ${isArchived ? '&bull; <span class="badge badge-neutral">' + t("archived") + '</span>' : ''}
          </p>
        </div>
        <div class="view-header-actions">
          ${isArchived && canEdit ? `<button class="btn btn-success btn-sm" id="btn-restore-comm">${ic("refresh", 14)} ${t("restore")}</button>` : ''}
          ${!isArchived && canEdit ? `<button class="btn btn-secondary btn-sm" id="btn-edit-comm-name">${ic("pencil", 14)} ${t("edit")}</button>` : ''}
          <button class="btn btn-secondary btn-sm" id="btn-print-comm">${ic("printer", 14)} ${App.currentLang === 'ar' ? 'طباعة تقرير' : 'Print report'}</button>
          ${!isArchived && hasPermission("meetings", "create") ? `<button class="btn btn-primary btn-sm" onclick="window.AtharModals.openCreateMeetingSlideover('${comm.id}')">${ic("plus", 14)} ${t("add_meeting")}</button>` : ''}
          ${!isArchived && canDelete ? `<button class="btn btn-danger-outline btn-sm" id="btn-delete-comm">${ic("trash", 14)} ${t("delete")}</button>` : ''}
        </div>
      </div>

      <div class="card" style="margin-bottom:16px;" id="leadership-card">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:12px;">
          <div class="card-title" style="margin:0;">${ic("shield", 16)} ${t("leadership")}</div>
          ${canEdit && !isArchived ? `<button class="btn btn-secondary btn-sm" id="btn-edit-leadership">${ic("pencil", 14)} ${hasLeadership ? t("edit_leadership") : t("assign_leadership")}</button>` : ''}
        </div>

        <div id="leadership-view" style="display:flex; flex-direction:column; gap:10px;">
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span style="font-size:12px; font-weight:700; color:var(--neutral-500); min-width:90px;">${t("leader")}:</span>
            ${comm.leader
          ? `<span class="tag-chip" style="font-size:13px; font-weight:700;">${ic("star", 12)} ${escapeHtml(memberName(comm.leader))}</span>`
          : `<span style="color:var(--neutral-400); font-size:13px;">${t("no_leader")}</span>`}
          </div>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span style="font-size:12px; font-weight:700; color:var(--neutral-500); min-width:90px;">${t("co_leaders")}:</span>
            ${comm.co_leaders && comm.co_leaders.length
          ? comm.co_leaders.map(v => `<span class="tag-chip" style="font-size:13px;">${escapeHtml(memberName(v))}</span>`).join('')
          : `<span style="color:var(--neutral-400); font-size:13px;">${t("none_option")}</span>`}
          </div>
        </div>

        <div id="leadership-edit" style="display:none;">
          <div class="form-field" style="margin-bottom:12px;">
            <label class="field-label">${ic("star", 13)} ${t("leader")}</label>
            <select id="leadership-leader-select" class="form-control">
              <option value="">${t("none_option")}</option>
              ${members.map(m => `<option value="${m.id}" ${comm.leader && comm.leader.id === m.id ? 'selected' : ''}>${escapeHtml(memberName(m))}</option>`).join('')}
            </select>
          </div>
          <div class="form-field" style="margin-bottom:12px;">
            <label class="field-label">${ic("users", 13)} ${t("co_leaders")}</label>
            ${members.length === 0
          ? `<div style="font-size:12px; color:var(--neutral-500);">${t("no_members_pick")}</div>`
          : `
            <div style="max-height:200px; overflow-y:auto; border:1px solid var(--neutral-300); border-radius:var(--radius-md); padding:10px; display:flex; flex-direction:column; gap:8px; background:var(--neutral-50);">
              ${members.map(m => `
                <label style="display:flex; align-items:center; gap:10px; font-size:13px; cursor:pointer;">
                  <input type="checkbox" class="leadership-co-cb" value="${m.id}" ${coLeaderIdSet.has(m.id) ? 'checked' : ''}>
                  <span style="font-weight:600;">${escapeHtml(memberName(m))}</span>
                </label>
              `).join('')}
            </div>
            <div style="font-size:11px; color:var(--neutral-500); margin-top:4px;">${t("co_leaders_hint")}</div>
          `}
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-primary btn-sm" id="btn-save-leadership">${t("save")}</button>
            <button class="btn btn-secondary btn-sm" id="btn-cancel-leadership">${t("cancel")}</button>
          </div>
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
          <span class="stat-box-label">${t("leader")}</span>
          <span style="font-size:16px; font-weight:700; color:var(--neutral-900);">${comm.leader ? escapeHtml(memberName(comm.leader)) : '—'}</span>
        </div>
      </div>

      <div class="tabs-header">
        <div class="tab-btn ${activeTab === 'members' ? 'active' : ''}" data-tab="members">${t("tab_members")} (${members.length})</div>
        <div class="tab-btn ${activeTab === 'meetings' ? 'active' : ''}" data-tab="meetings">${t("tab_meetings")} (${commMeetings.length})</div>
        <div class="tab-btn ${activeTab === 'hours' ? 'active' : ''}" data-tab="hours">${t("tab_hours_summary")}</div>
      </div>

      <div id="comm-tab-container">
        ${activeTab === 'members' ? `
          <div class="filter-bar" style="margin-bottom:12px;">
            <div class="filter-group">
              <input type="search" id="comm-member-search" class="form-control" placeholder="${App.currentLang === 'ar' ? 'بحث في الأعضاء…' : 'Search members…'}" style="min-width:180px;">
            </div>
          </div>
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr><th>Volunteer</th><th>Status</th><th>Hours</th><th>Skills</th><th style="text-align:right;">Actions</th></tr>
              </thead>
              <tbody id="comm-members-tbody">
                ${members.length === 0 ? `<tr><td colspan="5" style="text-align:center; padding:24px;">No members assigned yet.</td></tr>` : `
                  ${pinnedMembers.map(({ volunteer: m, role }) => {
      const s = window.AtharStore.getVolunteerStats(m.id);
      const roleBadge = role === "leader"
        ? `<span class="badge badge-warning" style="margin-inline-start:6px;">${ic("star", 11)} ${t("leader")}</span>`
        : `<span class="badge badge-primary" style="margin-inline-start:6px;">${t("co_leader")}</span>`;
      return `
                    <tr style="${role === "leader" ? "background:rgba(245,183,49,0.12);" : "background:rgba(74,144,226,0.08);"}">
                      <td style="font-weight:700; cursor:pointer;" onclick="window.AtharApp.navigateTo('volunteer-profile', {id:'${m.id}'})">
                        ${App.currentLang === 'ar' ? (m.full_name_ar || m.full_name) : m.full_name}
                        ${roleBadge}
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
                  ${regularMembers.map(m => {
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
                `}
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

    // Member search filter
    const memberSearch = document.getElementById("comm-member-search");
    if (memberSearch) {
      memberSearch.oninput = () => {
        const q = memberSearch.value.trim().toLowerCase();
        const tbody = document.getElementById("comm-members-tbody");
        if (!tbody) return;
        tbody.querySelectorAll("tr").forEach(tr => {
          const name = (tr.textContent || "").toLowerCase();
          tr.style.display = (!q || name.includes(q)) ? "" : "none";
        });
      };
    }

    const editBtn = document.getElementById("btn-edit-comm-name");
    if (editBtn) editBtn.onclick = () => window.AtharModals.openAddCommitteeModal(comm.id);

    const printCommBtn = document.getElementById("btn-print-comm");
    if (printCommBtn) {
      printCommBtn.onclick = () => {
        const w = window.open("", "_blank");
        if (!w) return;
        const rows = members.map(m => {
          const s = window.AtharStore.getVolunteerStats(m.id);
          return `<tr><td>${escapeHtml(memberName(m))}</td><td>${m.status}</td><td>${s ? s.totalHours : 0} h</td><td>${(m.skills || []).join(", ") || '—'}</td></tr>`;
        }).join("");
        w.document.write(`<!DOCTYPE html><html dir="${App.currentLang === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>Committee Report</title><style>body{font-family:Cairo,Inter,sans-serif;padding:24px;}table{width:100%;border-collapse:collapse;font-size:12px;}th,td{border:1px solid #ccc;padding:6px 8px;text-align:start;}th{background:#f1f3f5;}h1{font-size:18px;margin-bottom:4px;} .meta{color:#555;font-size:13px;margin-bottom:12px;}</style></head><body><h1>${App.currentLang === 'ar' ? comm.name_ar : comm.name_en}</h1><div class="meta">${comm.name_en} • ${App.currentLang === 'ar' ? 'الأعضاء' : 'Members'}: ${members.length} • ${App.currentLang === 'ar' ? 'الساعات' : 'Hours'}: ${totalHours} h • ${comm.leader ? (App.currentLang === 'ar' ? 'الرئيس' : 'Leader') + ': ' + escapeHtml(memberName(comm.leader)) : ''}</div><table><thead><tr><th>${App.currentLang === 'ar' ? 'العضو' : 'Member'}</th><th>${t("status")}</th><th>${t("hours")}</th><th>${App.currentLang === 'ar' ? 'المهارات' : 'Skills'}</th></tr></thead><tbody>${rows || '<tr><td colspan="4" style="text-align:center;">No members</td></tr>'}</tbody></table><script>window.onload=()=>window.print();</script></body></html>`);
        w.document.close();
      };
    }

    // ---- Member leadership: inline picker on the details page ----
    const editLeadershipBtn = document.getElementById("btn-edit-leadership");
    if (editLeadershipBtn) {
      const viewDiv = document.getElementById("leadership-view");
      const editDiv = document.getElementById("leadership-edit");
      const leaderSel = document.getElementById("leadership-leader-select");
      const coCheckboxes = () => Array.from(container.querySelectorAll(".leadership-co-cb"));
      const syncCoCheckboxes = () => {
        const leaderId = leaderSel ? leaderSel.value : "";
        coCheckboxes().forEach(cb => {
          const isSelectedLeader = !!leaderId && cb.value === leaderId;
          if (isSelectedLeader) cb.checked = false;
          cb.disabled = isSelectedLeader;
          const row = cb.closest("label");
          if (row) row.style.opacity = isSelectedLeader ? "0.45" : "1";
        });
      };

      editLeadershipBtn.onclick = () => {
        const showEdit = editDiv.style.display === "none";
        editDiv.style.display = showEdit ? "" : "none";
        viewDiv.style.display = showEdit ? "none" : "";
        if (showEdit) syncCoCheckboxes();
      };
      if (leaderSel) leaderSel.onchange = syncCoCheckboxes;

      const cancelLeadershipBtn = document.getElementById("btn-cancel-leadership");
      if (cancelLeadershipBtn) {
        cancelLeadershipBtn.onclick = () => {
          editDiv.style.display = "none";
          viewDiv.style.display = "";
        };
      }

      const saveLeadershipBtn = document.getElementById("btn-save-leadership");
      if (saveLeadershipBtn) {
        saveLeadershipBtn.onclick = async () => {
          const leaderId = leaderSel ? (leaderSel.value || null) : null;
          const coLeaderIds = coCheckboxes()
            .filter(cb => cb.checked && !cb.disabled)
            .map(cb => cb.value);
          saveLeadershipBtn.disabled = true;
          try {
            await window.AtharAPI.committees.update(comm.id, { leaderId, coLeaderIds });
            await window.AtharStore.refreshCommittees();
            showToast(t("leadership_saved"), "success");
            renderCommitteeDetail(container, committeeId);
          } catch (err) {
            showToast(err.message || "Save failed", "error");
            saveLeadershipBtn.disabled = false;
          }
        };
      }
    }

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