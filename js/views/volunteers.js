/**
 * View: Volunteers (list + profile + tabs)
 */
(function () {
  "use strict";

  const {
    App, t, formatDate, ic, showToast, showConfirmModal, hasPermission,
    navigateTo
  } = window.AtharCore;

  // =========================================================================
  // Volunteers List
  // =========================================================================
  function renderVolunteersList(container) {
    const state = window.AtharStore.getState();
    const canCreate = hasPermission("volunteers", "create");
    const canEdit = hasPermission("volunteers", "edit");
    const canDelete = hasPermission("volunteers", "delete");

    let filterComm = App.volFilterComm || "all";
    let filterStatus = App.volFilterStatus || "active";
    let filterSkill = App.volFilterSkill || "all";
    let search = App.searchQuery || "";

    const allSkills = Array.from(new Set(state.volunteers.flatMap(v => v.skills || []))).filter(Boolean);

    function getFilteredVolunteers() {
      return state.volunteers.filter(v => {
        if (filterStatus === "archived") {
          if (v.status !== "archived") return false;
        } else {
          if (v.status === "archived") return false;
          if (filterStatus !== "all" && v.status !== filterStatus) return false;
        }
        if (filterComm !== "all" && v.committee_id !== filterComm) return false;
        if (filterSkill !== "all" && (!v.skills || !v.skills.includes(filterSkill))) return false;
        if (search) {
          const q = search.toLowerCase();
          const matchName = (v.full_name && v.full_name.toLowerCase().includes(q)) ||
            (v.full_name_ar && v.full_name_ar.includes(q));
          const matchId = v.national_id && v.national_id.includes(q);
          const matchPhone = v.phone && v.phone.includes(q);
          if (!matchName && !matchId && !matchPhone) return false;
        }
        return true;
      });
    }

    const filtered = getFilteredVolunteers();
    const totalCount = filtered.length;
    const page = App.pagination.volunteersPage;
    const perPage = App.pagination.volunteersPerPage;
    const totalPages = Math.ceil(totalCount / perPage) || 1;
    const pagedVols = filtered.slice((page - 1) * perPage, page * perPage);

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <div class="breadcrumb-trail">
            <span class="breadcrumb-item" onclick="window.AtharApp.navigateTo('dashboard')">${t("app_name")}</span>
            <span class="breadcrumb-separator">/</span>
            <span>${t("nav_volunteers")}</span>
          </div>
          <h1 class="view-title">${t("volunteers_title")}</h1>
          <p class="view-subtitle">${t("showing")} ${totalCount} ${t("rows")}</p>
        </div>
        <div class="view-header-actions">
          <button class="btn btn-secondary btn-sm" id="btn-export-vols-csv">
            ${ic("download", 14)} ${t("export_csv")}
          </button>
          ${canCreate ? `
            <button class="btn btn-primary" id="btn-add-volunteer">
              ${ic("plus", 16)} ${t("add_volunteer")}
            </button>
          ` : ''}
        </div>
      </div>

      <div class="filter-bar">
        <div class="filter-group">
          <input type="text" id="vol-search-box" class="form-control" style="width:240px;" placeholder="${t("search_placeholder")}" value="${search}">
          <select id="vol-filter-comm" class="form-control">
            <option value="all">${t("all_committees")}</option>
            ${state.committees.map(c => `<option value="${c.id}" ${filterComm === c.id ? 'selected' : ''}>${App.currentLang === 'ar' ? c.name_ar : c.name_en}</option>`).join('')}
          </select>
          <select id="vol-filter-status" class="form-control">
            <option value="all">${t("all_statuses")}</option>
            <option value="active" ${filterStatus === 'active' ? 'selected' : ''}>${t("active")}</option>
            <option value="suspended" ${filterStatus === 'suspended' ? 'selected' : ''}>${t("suspended")}</option>
            <option value="withdrawn" ${filterStatus === 'withdrawn' ? 'selected' : ''}>${t("withdrawn")}</option>
            <option value="completed" ${filterStatus === 'completed' ? 'selected' : ''}>${t("completed")}</option>
            <option value="archived" ${filterStatus === 'archived' ? 'selected' : ''}>${t("archived")}</option>
          </select>
          <select id="vol-filter-skill" class="form-control">
            <option value="all">${t("all_skills")}</option>
            ${allSkills.map(s => `<option value="${s}" ${filterSkill === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
          <button class="btn btn-secondary btn-sm" id="btn-reset-vol-filters">${t("reset")}</button>
        </div>
      </div>

      <div id="bulk-selection-container" style="display:${App.selectedVolunteerIds.size > 0 ? 'block' : 'none'};">
        <div class="bulk-action-bar">
          <span class="bulk-count">${App.selectedVolunteerIds.size} ${t("rows")} selected</span>
          <div class="bulk-buttons">
            <button class="btn btn-secondary btn-sm" id="btn-bulk-export">${t("export_csv")}</button>
            ${canDelete ? `<button class="btn btn-danger-outline btn-sm" id="btn-bulk-archive">${t("archive")}</button>` : ''}
          </div>
        </div>
      </div>

      <div class="table-container">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th class="col-cb"><input type="checkbox" id="th-check-all" ${App.selectedVolunteerIds.size === pagedVols.length && pagedVols.length > 0 ? 'checked' : ''}></th>
                <th>${t("volunteer_name")}</th>
                <th>${t("committee")}</th>
                <th>${t("status")}</th>
                <th>${t("hours")}</th>
                <th>${t("whatsapp")}</th>
                <th>${t("join_date")}</th>
                <th style="text-align:right;">${t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              ${pagedVols.length === 0 ? `
                <tr>
                  <td colspan="8">
                    <div class="empty-state">
                      <div class="empty-state-icon" style="color:var(--neutral-400);">${ic("users", 48, { strokeWidth: 1.5 })}</div>
                      <div class="empty-state-title">${t("no_volunteers_found")}</div>
                      <div class="empty-state-desc">${t("create_first_volunteer")}</div>
                    </div>
                  </td>
                </tr>
              ` : pagedVols.map(v => {
      const comm = state.committees.find(c => c.id === v.committee_id);
      const stats = window.AtharStore.getVolunteerStats(v.id);
      const isSelected = App.selectedVolunteerIds.has(v.id);
      return `
                  <tr class="${isSelected ? 'row-selected' : ''}">
                    <td class="col-cb">
                      <input type="checkbox" class="vol-row-cb" data-id="${v.id}" ${isSelected ? 'checked' : ''}>
                    </td>
                    <td>
                      <div style="display:flex; align-items:center; gap:10px; cursor:pointer;" onclick="window.AtharApp.navigateTo('volunteer-profile', {id:'${v.id}'})">
                        <div class="user-avatar" style="width:32px; height:32px; font-size:12px;">${v.full_name.charAt(0)}</div>
                        <div>
                          <div style="font-weight:700; color:var(--neutral-900);">${App.currentLang === 'ar' ? (v.full_name_ar || v.full_name) : v.full_name}</div>
                          <div style="font-size:11px; color:var(--neutral-500); font-family:var(--font-mono);">${v.national_id || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style="font-weight:500;">${comm ? (App.currentLang === 'ar' ? comm.name_ar : comm.name_en) : '<span style="color:var(--neutral-400);">Unassigned</span>'}</span>
                    </td>
                    <td>
                      <span class="badge ${v.status === 'active' ? 'badge-success' : v.status === 'suspended' ? 'badge-warning' : v.status === 'archived' ? 'badge-danger' : 'badge-neutral'}">
                        <span class="badge-dot"></span>
                        ${t(v.status)}
                      </span>
                    </td>
                    <td>
                      <span class="num-ltr" style="font-weight:700; color:var(--neutral-900);">${stats ? stats.totalHours : 0} h</span>
                    </td>
                    <td>
                      ${v.whatsapp ? `
                        <a href="https://wa.me/${v.whatsapp.replace(/[^0-9]/g, '')}" target="_blank" class="btn btn-whatsapp btn-sm" style="padding:2px 8px; font-size:11px;" title="${t("test_link")}">
                          ${ic("whatsapp", 12)} WhatsApp
                        </a>
                      ` : '—'}
                    </td>
                    <td>
                      <span style="font-size:12px; color:var(--neutral-600);">${formatDate(v.join_date)}</span>
                    </td>
                    <td>
                      <div class="row-actions-cell">
                        <button class="btn btn-secondary btn-sm" onclick="window.AtharApp.navigateTo('volunteer-profile', {id:'${v.id}'})">${t("view")}</button>
                        ${canEdit ? `<button class="btn btn-secondary btn-sm" onclick="window.AtharModals.openAddVolunteerSlideover('${v.id}')">${t("edit")}</button>` : ''}
                        ${v.status === 'archived' ? `
                          <button class="btn btn-success btn-sm" onclick="window.AtharApp.restoreVolunteer('${v.id}')">${t("restore")}</button>
                        ` : (canDelete ? `
                          <button class="btn btn-danger-outline btn-sm" onclick="window.AtharApp.archiveVolunteer('${v.id}')">${t("archive")}</button>
                        ` : '')}
                      </div>
                    </td>
                  </tr>
                `;
    }).join('')}
            </tbody>
          </table>
        </div>

        <div class="pagination-bar">
          <div>
            ${t("showing")} ${Math.min((page - 1) * perPage + 1, totalCount)}–${Math.min(page * perPage, totalCount)} ${t("of")} ${totalCount} ${t("rows")}
          </div>
          <div class="pagination-controls">
            <button class="page-btn" id="vol-prev-btn" ${page <= 1 ? 'disabled' : ''}>${t("prev")}</button>
            ${Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `
              <button class="page-btn ${p === page ? 'active' : ''} vol-page-num" data-page="${p}">${p}</button>
            `).join('')}
            <button class="page-btn" id="vol-next-btn" ${page >= totalPages ? 'disabled' : ''}>${t("next")}</button>
          </div>
        </div>
      </div>
    `;

    // Filters
    document.getElementById("vol-search-box").addEventListener("input", (e) => {
      App.searchQuery = e.target.value;
      App.pagination.volunteersPage = 1;
      renderVolunteersList(container);
    });

    document.getElementById("vol-filter-comm").addEventListener("change", (e) => {
      App.volFilterComm = e.target.value;
      App.pagination.volunteersPage = 1;
      renderVolunteersList(container);
    });

    document.getElementById("vol-filter-status").addEventListener("change", (e) => {
      App.volFilterStatus = e.target.value;
      App.pagination.volunteersPage = 1;
      renderVolunteersList(container);
    });

    document.getElementById("vol-filter-skill").addEventListener("change", (e) => {
      App.volFilterSkill = e.target.value;
      App.pagination.volunteersPage = 1;
      renderVolunteersList(container);
    });

    document.getElementById("btn-reset-vol-filters").addEventListener("click", () => {
      App.volFilterComm = "all";
      App.volFilterStatus = "active";
      App.volFilterSkill = "all";
      App.searchQuery = "";
      App.pagination.volunteersPage = 1;
      renderVolunteersList(container);
    });

    const prevBtn = document.getElementById("vol-prev-btn");
    const nextBtn = document.getElementById("vol-next-btn");
    if (prevBtn) prevBtn.onclick = () => { App.pagination.volunteersPage--; renderVolunteersList(container); };
    if (nextBtn) nextBtn.onclick = () => { App.pagination.volunteersPage++; renderVolunteersList(container); };

    container.querySelectorAll(".vol-page-num").forEach(btn => {
      btn.onclick = () => {
        App.pagination.volunteersPage = Number(btn.getAttribute("data-page"));
        renderVolunteersList(container);
      };
    });

    const checkAll = document.getElementById("th-check-all");
    if (checkAll) {
      checkAll.onchange = (e) => {
        if (e.target.checked) pagedVols.forEach(v => App.selectedVolunteerIds.add(v.id));
        else pagedVols.forEach(v => App.selectedVolunteerIds.delete(v.id));
        renderVolunteersList(container);
      };
    }

    container.querySelectorAll(".vol-row-cb").forEach(cb => {
      cb.onchange = (e) => {
        const id = cb.getAttribute("data-id");
        if (e.target.checked) App.selectedVolunteerIds.add(id);
        else App.selectedVolunteerIds.delete(id);
        renderVolunteersList(container);
      };
    });

    const bulkArchive = document.getElementById("btn-bulk-archive");
    if (bulkArchive) {
      bulkArchive.onclick = () => {
        const count = App.selectedVolunteerIds.size;
        showConfirmModal({
          title: t("confirm_destructive"),
          message: `Archive ${count} volunteer${count > 1 ? 's' : ''}? Records preserved.`,
          onConfirm: async () => {
            const ids = Array.from(App.selectedVolunteerIds);
            const results = await Promise.allSettled(
              ids.map((id) => window.AtharAPI.volunteers.archive(id)),
            );
            const ok = results.filter((r) => r.status === "fulfilled").length;
            const fail = results.length - ok;

            App.selectedVolunteerIds.clear();
            await window.AtharStore.refreshVolunteers();

            if (fail === 0) {
              showToast(`Archived ${ok} volunteer${ok > 1 ? 's' : ''}`, "success");
            } else if (ok === 0) {
              showToast("Failed to archive volunteers", "error");
            } else {
              showToast(`Archived ${ok}, failed ${fail}`, "warning");
            }
            renderVolunteersList(container);
          },
        });
      };
    }

    const bulkExport = document.getElementById("btn-bulk-export");
    if (bulkExport) {
      bulkExport.onclick = () => {
        const selectedList = state.volunteers.filter(v => App.selectedVolunteerIds.has(v.id));
        const headers = ["ID", "Name", "National ID", "Phone", "Email", "Status"];
        const rows = selectedList.map(v => [v.id, v.full_name, v.national_id, v.phone, v.email, v.status]);
        window.ExportUtil.downloadCSV("Selected_Volunteers.csv", headers, rows);
      };
    }

    const exportCsv = document.getElementById("btn-export-vols-csv");
    if (exportCsv) {
      exportCsv.onclick = () => {
        const headers = ["ID", "Name (EN)", "Name (AR)", "National ID", "Phone", "Email", "Committee ID", "Status", "Join Date"];
        const rows = filtered.map(v => [v.id, v.full_name, v.full_name_ar || "", v.national_id || "", v.phone || "", v.email || "", v.committee_id || "", v.status, v.join_date]);
        window.ExportUtil.downloadCSV("Athar_Volunteers_Filtered.csv", headers, rows);
      };
    }

    const addBtn = document.getElementById("btn-add-volunteer");
    if (addBtn) addBtn.onclick = () => window.AtharModals.openAddVolunteerSlideover();
  }

  // =========================================================================
  // Volunteer Profile (6 tabs)
  // =========================================================================
  function renderVolunteerProfile(container, volunteerId) {
    const state = window.AtharStore.getState();
    const vol = state.volunteers.find(v => v.id === volunteerId);
    if (!vol) {
      container.innerHTML = `<div class="empty-state"><p>Volunteer not found.</p></div>`;
      return;
    }

    const comm = state.committees.find(c => c.id === vol.committee_id);
    const stats = window.AtharStore.getVolunteerStats(vol.id);
    let activeTab = App.currentParams.sub || "overview";

    const canEdit = hasPermission("volunteers", "edit");
    const canTransfer = hasPermission("volunteers", "transfer");
    const canEvaluate = hasPermission("evaluations", "create");
    const canLogHours = hasPermission("volunteer_hours", "create");
    const canCert = hasPermission("certificates", "create");

    const transfers = state.committee_transfers.filter(t => t.volunteer_id === vol.id);
    const attendanceRecords = state.attendance.filter(a => a.volunteer_id === vol.id);
    const evaluations = state.evaluations.filter(e => e.volunteer_id === vol.id);
    const hoursLog = state.volunteer_hours.filter(h => h.volunteer_id === vol.id);
    const certs = state.certificates.filter(c => c.volunteer_id === vol.id);

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <div class="breadcrumb-trail">
            <span class="breadcrumb-item" onclick="window.AtharApp.navigateTo('volunteers')">${t("back_to_volunteers")}</span>
            <span class="breadcrumb-separator">/</span>
            <span>${vol.full_name}</span>
          </div>
        </div>
      </div>

      <div class="profile-hero">
        <div class="profile-hero-left">
          <div class="profile-avatar-lg">${vol.full_name.charAt(0)}</div>
          <div class="profile-hero-info">
            <div class="profile-name-row">
              <span class="profile-name">${App.currentLang === 'ar' ? (vol.full_name_ar || vol.full_name) : vol.full_name}</span>
              <span class="badge ${vol.status === 'active' ? 'badge-success' : 'badge-neutral'}">
                <span class="badge-dot"></span> ${t(vol.status)}
              </span>
            </div>
            <div class="profile-meta-row">
              <div class="profile-meta-item">
                <span>${ic("building", 14)}</span>
                <span>${comm ? (App.currentLang === 'ar' ? comm.name_ar : comm.name_en) : 'Unassigned'}</span>
              </div>
              <div class="profile-meta-item">
                <span>${ic("calendar", 14)}</span>
                <span>Joined ${formatDate(vol.join_date)}</span>
              </div>
              ${vol.phone ? `<div class="profile-meta-item">${ic("user", 14)} <span class="num-ltr">${vol.phone}</span></div>` : ''}
              ${vol.whatsapp ? `
                <a href="https://wa.me/${vol.whatsapp.replace(/[^0-9]/g, '')}" target="_blank" class="btn btn-whatsapp btn-sm" style="padding:3px 10px;">
                  ${ic("whatsapp", 12)} WhatsApp
                </a>
              ` : ''}
              ${vol.email ? `<div class="profile-meta-item">${ic("send", 14)} ${vol.email}</div>` : ''}
            </div>
          </div>
        </div>

        <div class="profile-hero-actions">
          ${canEdit ? `<button class="btn btn-secondary btn-sm" id="btn-prof-edit">${ic("pencil", 14)} ${t("edit")}</button>` : ''}
          ${canTransfer ? `<button class="btn btn-secondary btn-sm" id="btn-prof-transfer">${ic("arrow_right", 14)} ${t("transfer_volunteer")}</button>` : ''}
          ${canEvaluate ? `<button class="btn btn-secondary btn-sm" id="btn-prof-eval">${ic("star", 14)} ${t("add_evaluation")}</button>` : ''}
          ${canLogHours ? `<button class="btn btn-secondary btn-sm" id="btn-prof-log-hours">${ic("clock", 14)} ${t("log_hours")}</button>` : ''}
          ${canCert ? `<button class="btn btn-primary btn-sm" id="btn-prof-gen-cert">${ic("award", 14)} ${t("generate_certificate")}</button>` : ''}
        </div>
      </div>

      <div class="tabs-header">
        <div class="tab-btn ${activeTab === 'overview' ? 'active' : ''}" data-tab="overview">${t("tab_overview")}</div>
        <div class="tab-btn ${activeTab === 'attendance' ? 'active' : ''}" data-tab="attendance">${t("tab_attendance")} <span class="tab-badge">${attendanceRecords.length}</span></div>
        <div class="tab-btn ${activeTab === 'evaluations' ? 'active' : ''}" data-tab="evaluations">${t("tab_evaluations")} <span class="tab-badge">${evaluations.length}</span></div>
        <div class="tab-btn ${activeTab === 'hours' ? 'active' : ''}" data-tab="hours">${t("tab_hours")} <span class="tab-badge">${hoursLog.length}</span></div>
        <div class="tab-btn ${activeTab === 'certificates' ? 'active' : ''}" data-tab="certificates">${t("tab_certificates")} <span class="tab-badge">${certs.length}</span></div>
        <div class="tab-btn ${activeTab === 'history' ? 'active' : ''}" data-tab="history">${t("tab_history")} <span class="tab-badge">${transfers.length}</span></div>
      </div>

      <div id="profile-tab-content">
        ${renderVolunteerTabContent(activeTab, vol, stats, transfers, attendanceRecords, evaluations, hoursLog, certs)}
      </div>
    `;

    container.querySelectorAll(".tab-btn").forEach(btn => {
      btn.onclick = () => {
        App.currentParams.sub = btn.getAttribute("data-tab");
        renderVolunteerProfile(container, volunteerId);
      };
    });

    const profEdit = document.getElementById("btn-prof-edit");
    if (profEdit) profEdit.onclick = () => window.AtharModals.openAddVolunteerSlideover(vol.id);

    const profTransfer = document.getElementById("btn-prof-transfer");
    if (profTransfer) profTransfer.onclick = () => window.AtharModals.openTransferModal(vol.id);

    const profEval = document.getElementById("btn-prof-eval");
    if (profEval) profEval.onclick = () => navigateTo("new-evaluation", { id: vol.id });

    const profHours = document.getElementById("btn-prof-log-hours");
    if (profHours) profHours.onclick = () => window.AtharModals.openLogHoursSlideover(vol.id);

    const profCert = document.getElementById("btn-prof-gen-cert");
    if (profCert) profCert.onclick = () => navigateTo("generate-certificate", { id: vol.id });
  }

  // =========================================================================
  // Volunteer Profile — Tab Content
  // =========================================================================
  function renderVolunteerTabContent(activeTab, vol, stats, transfers, attendance, evals, hours, certs) {
    const state = window.AtharStore.getState();

    if (activeTab === "overview") {
      return `
        <div class="profile-stats-grid">
          <div class="stat-box">
            <span class="stat-box-label">${t("kpi_total_hours")}</span>
            <span class="stat-box-value num-ltr" style="color:var(--primary);">${stats.totalHours} h</span>
          </div>
          <div class="stat-box">
            <span class="stat-box-label">${t("attendance_rate")}</span>
            <span class="stat-box-value num-ltr" style="color:var(--success);">${stats.attendanceRate}%</span>
          </div>
          <div class="stat-box">
            <span class="stat-box-label">${t("avg_evaluation")}</span>
            <span class="stat-box-value num-ltr" style="color:#F59E0B;">${stats.avgEvaluation} / 5</span>
          </div>
          <div class="stat-box">
            <span class="stat-box-label">${t("kpi_certificates")}</span>
            <span class="stat-box-value num-ltr">${stats.certsCount}</span>
          </div>
        </div>

        <div class="card" style="margin-bottom:16px;">
          <div class="card-title" style="margin-bottom:12px;">${ic("tag", 16)} ${t("skills")}</div>
          <div style="display:flex; flex-wrap:wrap; gap:8px;">
            ${(vol.skills && vol.skills.length > 0) ? vol.skills.map(s => `<span class="tag-chip">#${s}</span>`).join('') : '<p style="color:var(--neutral-500);">No skills logged</p>'}
          </div>
        </div>

        <div class="card">
          <div class="card-title" style="margin-bottom:8px;">${ic("note", 16)} ${t("notes")}</div>
          <p style="color:var(--neutral-700); line-height:1.6;">${vol.notes || 'No remarks recorded for this volunteer.'}</p>
        </div>
      `;
    }

    if (activeTab === "attendance") {
      return `
        <div class="table-container">
          <table class="data-table">
            <thead><tr><th>Meeting</th><th>Date</th><th>Status</th><th>Remarks</th></tr></thead>
            <tbody>
              ${attendance.length === 0 ? `<tr><td colspan="4" style="text-align:center; padding:24px;">No attendance records found</td></tr>` : attendance.map(a => {
        const mtg = state.meetings.find(m => m.id === a.meeting_id);
        return `
                  <tr>
                    <td style="font-weight:600;">${mtg ? (App.currentLang === 'ar' ? mtg.title_ar : mtg.title_en) : 'Meeting'}</td>
                    <td>${mtg ? formatDate(mtg.meeting_date) : '—'}</td>
                    <td><span class="badge ${a.status === 'present' ? 'badge-success' : a.status === 'late' ? 'badge-warning' : 'badge-danger'}">${t(a.status)}</span></td>
                    <td style="color:var(--neutral-600);">${a.note || '—'}</td>
                  </tr>
                `;
      }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    if (activeTab === "evaluations") {
      return `
        <div style="display:flex; flex-direction:column; gap:16px;">
          ${evals.length === 0 ? `<div class="empty-state"><p>No evaluations recorded yet.</p></div>` : evals.map(e => `
            <div class="card">
              <div class="card-header">
                <div>
                  <span style="font-weight:700; font-size:16px;">Period: ${e.period_label}</span>
                  <span style="margin:0 8px; color:var(--neutral-400);">&bull;</span>
                  <span style="font-size:12px; color:var(--neutral-500);">${e.evaluated_at}</span>
                </div>
                <div style="font-size:18px; font-weight:800; color:#F59E0B;">${e.overall_score} / 5.0</div>
              </div>
              <p style="color:var(--neutral-700); font-size:13px; margin-bottom:12px;">${e.notes || ''}</p>
              <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:10px; background:var(--neutral-50); padding:12px; border-radius:var(--radius-md);">
                ${state.evaluation_scores.filter(s => s.evaluation_id === e.id).map(sc => {
        const crit = state.criteria.find(c => c.id === sc.criteria_id);
        return `
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px;">
                      <span style="font-weight:600;">${crit ? (App.currentLang === 'ar' ? crit.name_ar : crit.name_en) : 'Criteria'}</span>
                      <span style="color:#F59E0B; font-weight:700;">${sc.score} / 5</span>
                    </div>
                  `;
      }).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    if (activeTab === "hours") {
      return `
        <div class="table-container">
          <table class="data-table">
            <thead><tr><th>Date</th><th>Activity</th><th>Hours</th><th>Status</th><th>Description</th></tr></thead>
            <tbody>
              ${hours.length === 0 ? `<tr><td colspan="5" style="text-align:center; padding:24px;">No hours recorded</td></tr>` : hours.map(h => `
                <tr>
                  <td>${formatDate(h.date)}</td>
                  <td style="font-weight:600;">${h.activity}</td>
                  <td><span class="num-ltr" style="font-weight:700;">${h.hours} h</span></td>
                  <td><span class="badge ${h.status === 'approved' ? 'badge-success' : h.status === 'pending' ? 'badge-warning' : 'badge-danger'}">${t(h.status)}</span></td>
                  <td style="color:var(--neutral-600); font-size:12px;">${h.description || ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    if (activeTab === "certificates") {
      return `
        <div class="table-container">
          <table class="data-table">
            <thead><tr><th>Certificate No.</th><th>Hours</th><th>Issue Date</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              ${certs.length === 0 ? `<tr><td colspan="5" style="text-align:center; padding:24px;">No certificates issued yet</td></tr>` : certs.map(c => `
                <tr>
                  <td style="font-family:var(--font-mono); font-weight:700;">${c.certificate_no || 'DRAFT (Unassigned)'}</td>
                  <td><span class="num-ltr" style="font-weight:700;">${c.total_hours} h</span></td>
                  <td>${formatDate(c.issue_date)}</td>
                  <td><span class="badge ${c.status === 'issued' ? 'badge-success' : c.status === 'draft' ? 'badge-warning' : 'badge-danger'}">${t(c.status)}</span></td>
                  <td>
                    <button class="btn btn-secondary btn-sm" onclick="window.AtharApp.navigateTo('generate-certificate', {id:'${c.volunteer_id}', sub:'${c.id}'})">${t("view")}</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    if (activeTab === "history") {
      return `
        <div class="card">
          <div class="card-title" style="margin-bottom:16px;">${ic("history", 16)} ${t("transfer_history")}</div>
          ${transfers.length === 0 ? `<p style="color:var(--neutral-500); padding:12px 0;">No committee transfers recorded.</p>` : `
            <div style="display:flex; flex-direction:column; gap:16px; border-left:2px solid var(--primary-border); padding-left:16px;">
              ${transfers.map(tr => {
        const fromComm = state.committees.find(c => c.id === tr.from_committee_id);
        const toComm = state.committees.find(c => c.id === tr.to_committee_id);
        return `
                  <div>
                    <div style="font-size:12px; color:var(--neutral-500);">${tr.transferred_at}</div>
                    <div style="font-weight:700; color:var(--neutral-900); font-size:14px; margin:2px 0;">
                      ${fromComm ? (App.currentLang === 'ar' ? fromComm.name_ar : fromComm.name_en) : 'Initial'} &#8594; ${toComm ? (App.currentLang === 'ar' ? toComm.name_ar : toComm.name_en) : 'Target'}
                    </div>
                    <div style="font-size:13px; color:var(--neutral-700);">Reason: ${tr.reason || 'None specified'}</div>
                  </div>
                `;
      }).join('')}
            </div>
          `}
        </div>
      `;
    }

    return "";
  }

  // Register views
  window.AtharViews.volunteers = (c, p) => renderVolunteersList(c);
  window.AtharViews.volunteerProfile = (c, p) => renderVolunteerProfile(c, p.id);
})();
