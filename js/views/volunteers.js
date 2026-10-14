/**
 * View: Volunteers (list + profile + tabs)
 */
(function () {
  "use strict";

  const {
    App, t, formatDate, age, genderStyle, splitNotes,
    ic, showToast, showConfirmModal, hasPermission, navigateTo
  } = window.AtharCore;

  // =========================================================================
  // Small helpers
  // =========================================================================
  function avatarHtml(vol, size) {
    const s = genderStyle(vol.gender);
    const initials = (vol.full_name || "?").charAt(0).toUpperCase();
    const px = size || 32;
    const fs = Math.max(10, Math.round(px * 0.42));
    return `
      <div class="user-avatar" style="
        width:${px}px; height:${px}px; font-size:${fs}px;
        background:${s.bg};
        color:${s.text};
        border:2px solid ${s.border};
        box-shadow:0 0 0 3px ${s.ring};
      ">${initials}</div>
    `;
  }

  function genderChip(gender) {
    if (!gender) return "";
    const s = genderStyle(gender);
    const label = gender === "female" ? (t("female") || "Female") : (t("male") || "Male");
    const dotColor = s.border;
    return `<span style="display:inline-flex; align-items:center; gap:4px; padding:1px 8px; border-radius:9999px; font-size:10px; font-weight:700; background:${s.bg}; color:${s.text}; border:1px solid ${s.border};">
      <span style="width:6px; height:6px; border-radius:50%; background:${dotColor};"></span>${label}
    </span>`;
  }

  // =========================================================================
  // Volunteer Details Modal
  // =========================================================================
  function openVolunteerDetailsModal(volunteerId) {
    const state = window.AtharStore.getState();
    const v = state.volunteers.find(x => x.id === volunteerId);
    if (!v) return;

    const comm = state.committees.find(c => c.id === v.committee_id);
    const stats = window.AtharStore.getVolunteerStats(v.id);
    const a = age(v.dob);
    const gs = genderStyle(v.gender);

    const modal = document.getElementById("modal-container");
    modal.innerHTML = `
      <div class="overlay-backdrop" id="vol-details-backdrop">
        <div class="modal-dialog" style="max-width:600px;">
          <div class="modal-header" style="border-bottom:3px solid ${gs.border};">
            <h3 class="modal-title">${ic("user", 18)} ${t("volunteer_profile") || "Volunteer Details"}</h3>
            <button class="btn-icon" id="vol-details-close">&times;</button>
          </div>
          <div class="modal-body">
            <div style="display:flex; align-items:center; gap:16px; padding:16px; background:${gs.bg}; border:1px solid ${gs.border}; border-radius:var(--radius-md); margin-bottom:18px;">
              ${avatarHtml(v, 64)}
              <div style="flex:1;">
                <div style="font-size:20px; font-weight:800; color:var(--neutral-900);">
                  ${App.currentLang === 'ar' ? (v.full_name_ar || v.full_name) : v.full_name}
                </div>
                <div style="display:flex; align-items:center; gap:8px; margin-top:6px; flex-wrap:wrap;">
                  ${genderChip(v.gender)}
                  ${a !== null ? `<span style="font-size:12px; font-weight:700; color:var(--neutral-700);">${a} ${App.currentLang === 'ar' ? 'سنة' : 'years old'}</span>` : ''}
                  <span class="badge ${v.status === 'active' ? 'badge-success' : 'badge-neutral'}">${t(v.status)}</span>
                </div>
              </div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:18px;">
              <div>
                <div style="font-size:11px; color:var(--neutral-500); font-weight:700; text-transform:uppercase;">${t("phone") || "Phone"}</div>
                <div class="num-ltr" style="font-weight:600; font-size:14px;">${v.phone || "—"}</div>
              </div>
              <div>
                <div style="font-size:11px; color:var(--neutral-500); font-weight:700; text-transform:uppercase;">${t("whatsapp") || "WhatsApp"}</div>
                <div class="num-ltr" style="font-weight:600; font-size:14px;">${v.whatsapp || "—"}</div>
              </div>
              <div>
                <div style="font-size:11px; color:var(--neutral-500); font-weight:700; text-transform:uppercase;">${t("email") || "Email"}</div>
                <div style="font-weight:600; font-size:13px; word-break:break-all;">${v.email || "—"}</div>
              </div>
              <div>
                <div style="font-size:11px; color:var(--neutral-500); font-weight:700; text-transform:uppercase;">${App.currentLang === 'ar' ? 'الجنسية' : 'Nationality'}</div>
                <div style="font-weight:600; font-size:14px;">${v.nationality || "—"}</div>
              </div>
              <div>
                <div style="font-size:11px; color:var(--neutral-500); font-weight:700; text-transform:uppercase;">${App.currentLang === 'ar' ? 'المستوى الدراسي' : 'Study Level'}</div>
                <div style="font-weight:600; font-size:14px;">${v.study_level || "—"}</div>
              </div>
              <div>
                <div style="font-size:11px; color:var(--neutral-500); font-weight:700; text-transform:uppercase;">${t("dob") || "Date of Birth"}</div>
                <div class="num-ltr" style="font-weight:600; font-size:14px;">${v.dob || "—"}</div>
              </div>
              <div>
                <div style="font-size:11px; color:var(--neutral-500); font-weight:700; text-transform:uppercase;">${t("committee") || "Committee"}</div>
                <div style="font-weight:600; font-size:14px;">${comm ? (App.currentLang === 'ar' ? comm.name_ar : comm.name_en) : "—"}</div>
              </div>
              <div>
                <div style="font-size:11px; color:var(--neutral-500); font-weight:700; text-transform:uppercase;">${t("join_date") || "Join Date"}</div>
                <div class="num-ltr" style="font-weight:600; font-size:14px;">${formatDate(v.join_date)}</div>
              </div>
            </div>

            <div class="profile-stats-grid" style="margin-bottom:18px;">
              <div class="stat-box"><span class="stat-box-label">${t("kpi_total_hours")}</span><span class="stat-box-value num-ltr">${stats ? stats.totalHours : 0}</span></div>
              <div class="stat-box"><span class="stat-box-label">${t("attendance_rate")}</span><span class="stat-box-value num-ltr">${stats ? stats.attendanceRate : 0}%</span></div>
              <div class="stat-box"><span class="stat-box-label">${t("avg_evaluation")}</span><span class="stat-box-value num-ltr">${stats ? stats.avgEvaluation : 0}</span></div>
              <div class="stat-box"><span class="stat-box-label">${t("kpi_certificates")}</span><span class="stat-box-value num-ltr">${stats ? stats.certsCount : 0}</span></div>
            </div>

            ${splitNotes(v.notes).length > 0 ? `
              <div style="margin-bottom:16px;">
                <div style="font-size:12px; font-weight:700; color:var(--neutral-600); margin-bottom:6px;">${t("notes") || "Notes"}</div>
                <div style="display:flex; flex-direction:column; gap:6px;">
                  ${splitNotes(v.notes).map(n => `
                    <div style="padding:8px 12px; background:var(--neutral-50); border-inline-start:3px solid var(--primary); border-radius:6px; font-size:13px; color:var(--neutral-700);">
                      ${n}
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            ${(v.skills && v.skills.length) ? `
              <div style="display:flex; flex-wrap:wrap; gap:6px;">
                ${v.skills.map(s => `<span class="tag-chip">#${s}</span>`).join('')}
              </div>
            ` : ''}
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="vol-details-cancel">${t("close") || "Close"}</button>
            <button class="btn btn-primary" id="vol-details-open">${t("view") || "View"} →</button>
          </div>
        </div>
      </div>
    `;

    const close = () => { modal.innerHTML = ""; };
    document.getElementById("vol-details-close").onclick = close;
    document.getElementById("vol-details-cancel").onclick = close;
    document.getElementById("vol-details-backdrop").onclick = (e) => {
      if (e.target.id === "vol-details-backdrop") close();
    };
    document.getElementById("vol-details-open").onclick = () => {
      close();
      navigateTo("volunteer-profile", { id: v.id });
    };
  }

  // Expose for inline onclick
  window.AtharVolunteers = window.AtharVolunteers || {};
  window.AtharVolunteers.openDetails = openVolunteerDetailsModal;

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
    let filterGender = App.volFilterGender || "all";
    let filterAgeMin = App.volFilterAgeMin ?? "";
    let filterAgeMax = App.volFilterAgeMax ?? "";
    let search = App.searchQuery || "";
    const perPage = App.pagination.volunteersPerPage || 20;

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
        if (filterGender !== "all" && v.gender !== filterGender) return false;

        if (filterAgeMin !== "" || filterAgeMax !== "") {
          const a = age(v.dob);
          if (a === null) return false;
          if (filterAgeMin !== "" && a < Number(filterAgeMin)) return false;
          if (filterAgeMax !== "" && a > Number(filterAgeMax)) return false;
        }

        if (search) {
          const q = search.toLowerCase();
          const matchName = (v.full_name && v.full_name.toLowerCase().includes(q)) ||
            (v.full_name_ar && v.full_name_ar.includes(q));
          const matchId = v.national_id && v.national_id.includes(q);
          const matchPhone = v.phone && v.phone.includes(q);
          const matchNat = v.nationality && v.nationality.toLowerCase().includes(q);
          if (!matchName && !matchId && !matchPhone && !matchNat) return false;
        }
        return true;
      });
    }

    const filtered = getFilteredVolunteers();
    const totalCount = filtered.length;
    const page = App.pagination.volunteersPage;
    const totalPages = Math.max(1, Math.ceil(totalCount / perPage));
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
          <p class="view-subtitle">
            <span style="color:var(--primary); font-weight:700;">${totalCount}</span>
            ${t("rows")} &bull; ${page * perPage - perPage + 1}–${Math.min(page * perPage, totalCount)}
          </p>
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
          <input type="text" id="vol-search-box" class="form-control" style="width:200px;" placeholder="${t("search_placeholder")}" value="${search}">
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
          <select id="vol-filter-gender" class="form-control" style="width:130px;">
            <option value="all">${App.currentLang === 'ar' ? 'الجنس: الكل' : 'Gender: All'}</option>
            <option value="male" ${filterGender === 'male' ? 'selected' : ''}>${App.currentLang === 'ar' ? 'ذكر' : 'Male'}</option>
            <option value="female" ${filterGender === 'female' ? 'selected' : ''}>${App.currentLang === 'ar' ? 'أنثى' : 'Female'}</option>
          </select>
          <div style="display:flex; align-items:center; gap:4px;">
            <span style="font-size:12px; color:var(--neutral-600);">${App.currentLang === 'ar' ? 'العمر:' : 'Age:'}</span>
            <input type="number" id="vol-filter-age-min" class="form-control num-ltr" style="width:70px;" placeholder="min" value="${filterAgeMin}" min="0" max="130">
            <span style="color:var(--neutral-400);">–</span>
            <input type="number" id="vol-filter-age-max" class="form-control num-ltr" style="width:70px;" placeholder="max" value="${filterAgeMax}" min="0" max="130">
          </div>
          <select id="vol-filter-skill" class="form-control" style="width:150px;">
            <option value="all">${t("all_skills")}</option>
            ${allSkills.map(s => `<option value="${s}" ${filterSkill === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
          <select id="vol-per-page" class="form-control" style="width:110px;">
            <option value="10" ${perPage === 10 ? 'selected' : ''}>10 / page</option>
            <option value="20" ${perPage === 20 ? 'selected' : ''}>20 / page</option>
            <option value="50" ${perPage === 50 ? 'selected' : ''}>50 / page</option>
            <option value="100" ${perPage === 100 ? 'selected' : ''}>100 / page</option>
            <option value="5000" ${perPage >= 5000 ? 'selected' : ''}>${App.currentLang === 'ar' ? 'الكل' : 'All'}</option>
          </select>
          <button class="btn btn-secondary btn-sm" id="btn-reset-vol-filters">${t("reset")}</button>
        </div>
      </div>

      <div id="bulk-selection-container" style="display:${App.selectedVolunteerIds.size > 0 ? 'block' : 'none'};">
        <div class="bulk-action-bar">
          <span class="bulk-count">${App.selectedVolunteerIds.size} ${t("rows")} selected</span>
          <div class="bulk-buttons">
            ${hasPermission("volunteer_hours", "create") ? `
              <button class="btn btn-primary btn-sm" id="btn-bulk-log-hours">
                ${ic("clock", 14)} ${App.currentLang === 'ar' ? 'تسجيل ساعات' : 'Log Hours'}
              </button>
            ` : ''}
            ${hasPermission("evaluations", "create") ? `
              <button class="btn btn-primary btn-sm" id="btn-bulk-rate">
                ${ic("star", 14)} ${App.currentLang === 'ar' ? 'تقييم جماعي' : 'Rate'}
              </button>
            ` : ''}
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
                <th>${App.currentLang === 'ar' ? 'العمر' : 'Age'}</th>
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
                <tr><td colspan="9"><div class="empty-state">
                  <div class="empty-state-icon" style="color:var(--neutral-400);">${ic("users", 48, { strokeWidth: 1.5 })}</div>
                  <div class="empty-state-title">${t("no_volunteers_found")}</div>
                  <div class="empty-state-desc">${t("create_first_volunteer")}</div>
                </div></td></tr>
              ` : pagedVols.map(v => {
      const comm = state.committees.find(c => c.id === v.committee_id);
      const stats = window.AtharStore.getVolunteerStats(v.id);
      const isSelected = App.selectedVolunteerIds.has(v.id);
      const a = age(v.dob);
      const gs = genderStyle(v.gender);

      return `
                  <tr class="${isSelected ? 'row-selected' : ''}" style="border-inline-start:3px solid ${v.gender ? gs.border : 'transparent'};">
                    <td class="col-cb">
                      <input type="checkbox" class="vol-row-cb" data-id="${v.id}" ${isSelected ? 'checked' : ''}>
                    </td>
                    <td>
                      <div style="display:flex; align-items:center; gap:10px; cursor:pointer;"
                           onclick="window.AtharVolunteers.openDetails('${v.id}')">
                        ${avatarHtml(v, 36)}
                        <div>
                          <div style="font-weight:700; color:var(--neutral-900);">
                            ${App.currentLang === 'ar' ? (v.full_name_ar || v.full_name) : v.full_name}
                          </div>
                          <div style="display:flex; gap:6px; align-items:center; margin-top:2px;">
                            ${genderChip(v.gender)}
                            ${v.nationality ? `<span style="font-size:10px; color:var(--neutral-500);">${v.nationality}</span>` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      ${a !== null
          ? `<span class="num-ltr" style="font-weight:700; font-size:14px;">${a}</span> <span style="font-size:11px; color:var(--neutral-500);">${App.currentLang === 'ar' ? 'سنة' : 'y'}</span>`
          : '<span style="color:var(--neutral-400);">—</span>'}
                    </td>
                    <td><span style="font-weight:500;">${comm ? (App.currentLang === 'ar' ? comm.name_ar : comm.name_en) : '<span style="color:var(--neutral-400);">—</span>'}</span></td>
                    <td>
                      <span class="badge ${v.status === 'active' ? 'badge-success' : v.status === 'suspended' ? 'badge-warning' : v.status === 'archived' ? 'badge-danger' : 'badge-neutral'}">
                        ${t(v.status)}
                      </span>
                    </td>
                    <td><span class="num-ltr" style="font-weight:700;">${stats ? stats.totalHours : 0} h</span></td>
                      <td>
                      ${v.whatsapp ? `
                        <div style="display:flex; flex-direction:column; gap:4px; align-items:flex-start;">
                          <a href="https://wa.me/${v.whatsapp.replace(/[^0-9]/g, '')}" target="_blank" class="btn btn-whatsapp btn-sm" style="padding:2px 8px; font-size:11px;" onclick="event.stopPropagation();">
                            ${ic("whatsapp", 12)} WhatsApp
                          </a>
                          <span class="num-ltr" style="font-size:11px; color:var(--neutral-600); font-family:var(--font-mono);">${v.whatsapp}</span>
                        </div>
                      ` : '—'}
                    </td>
                    <td><span class="num-ltr" style="font-size:12px; color:var(--neutral-600);">${formatDate(v.join_date)}</span></td>
                    <td>
                      <div class="row-actions-cell">
                        <button class="btn btn-secondary btn-sm" onclick="window.AtharVolunteers.openDetails('${v.id}')" title="${App.currentLang === 'ar' ? 'تفاصيل سريعة' : 'Quick details'}">${ic("eye", 12)}</button>
                        <button class="btn btn-secondary btn-sm" onclick="window.AtharApp.navigateTo('volunteer-profile', {id:'${v.id}'})">${t("view")}</button>
                        ${canEdit ? `<button class="btn btn-secondary btn-sm" onclick="window.AtharModals.openAddVolunteerSlideover('${v.id}')">${t("edit")}</button>` : ''}
                        ${v.status === 'archived'
          ? `<button class="btn btn-success btn-sm" onclick="window.AtharApp.restoreVolunteer('${v.id}')">${t("restore")}</button>`
          : (canDelete ? `<button class="btn btn-danger-outline btn-sm" onclick="window.AtharApp.archiveVolunteer('${v.id}')">${t("archive")}</button>` : '')}
                      </div>
                    </td>
                  </tr>
                `;
    }).join('')}
            </tbody>
          </table>
        </div>

        <div class="pagination-bar">
          <div>${t("showing")} ${Math.min((page - 1) * perPage + 1, totalCount)}–${Math.min(page * perPage, totalCount)} ${t("of")} ${totalCount} ${t("rows")}</div>
          <div class="pagination-controls">
            <button class="page-btn" id="vol-prev-btn" ${page <= 1 ? 'disabled' : ''}>${t("prev")}</button>
            ${(function () {
        if (totalPages <= 7) {
          return Array.from({ length: totalPages }, (_, i) => i + 1)
            .map(p => `<button class="page-btn ${p === page ? 'active' : ''} vol-page-num" data-page="${p}">${p}</button>`)
            .join('');
        }
        const windowSize = 7;
        const half = Math.floor(windowSize / 2);
        let start = Math.max(1, page - half);
        let end = start + windowSize - 1;
        if (end > totalPages) {
          end = totalPages;
          start = end - windowSize + 1;
        }
        const pages = [];
        for (let p = start; p <= end; p++) pages.push(p);
        return pages
          .map(p => `<button class="page-btn ${p === page ? 'active' : ''} vol-page-num" data-page="${p}">${p}</button>`)
          .join('');
      })()}
            <button class="page-btn" id="vol-next-btn" ${page >= totalPages ? 'disabled' : ''}>${t("next")}</button>
          </div>
        </div>
      </div>
    `;

    // Filters
    const bind = (id, evt, handler) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener(evt, handler);
    };

    bind("vol-search-box", "input", (e) => { App.searchQuery = e.target.value; App.pagination.volunteersPage = 1; renderVolunteersList(container); });
    bind("vol-filter-comm", "change", (e) => { App.volFilterComm = e.target.value; App.pagination.volunteersPage = 1; renderVolunteersList(container); });
    bind("vol-filter-status", "change", (e) => { App.volFilterStatus = e.target.value; App.pagination.volunteersPage = 1; renderVolunteersList(container); });
    bind("vol-filter-gender", "change", (e) => { App.volFilterGender = e.target.value; App.pagination.volunteersPage = 1; renderVolunteersList(container); });
    bind("vol-filter-age-min", "change", (e) => { App.volFilterAgeMin = e.target.value; App.pagination.volunteersPage = 1; renderVolunteersList(container); });
    bind("vol-filter-age-max", "change", (e) => { App.volFilterAgeMax = e.target.value; App.pagination.volunteersPage = 1; renderVolunteersList(container); });
    bind("vol-filter-skill", "change", (e) => { App.volFilterSkill = e.target.value; App.pagination.volunteersPage = 1; renderVolunteersList(container); });
    bind("vol-per-page", "change", (e) => {
      App.pagination.volunteersPerPage = Number(e.target.value);
      App.pagination.volunteersPage = 1;
      renderVolunteersList(container);
    });

    bind("btn-reset-vol-filters", "click", () => {
      App.volFilterComm = "all";
      App.volFilterStatus = "active";
      App.volFilterSkill = "all";
      App.volFilterGender = "all";
      App.volFilterAgeMin = "";
      App.volFilterAgeMax = "";
      App.searchQuery = "";
      App.pagination.volunteersPage = 1;
      App.pagination.volunteersPerPage = 20;
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

    // ---- Bulk: Log Hours ----
    const bulkLogHours = document.getElementById("btn-bulk-log-hours");
    if (bulkLogHours) {
      bulkLogHours.onclick = () => {
        const ids = Array.from(App.selectedVolunteerIds);
        if (!ids.length) { showToast("No volunteers selected", "error"); return; }
        if (!window.AtharModals || typeof window.AtharModals.openBulkLogHoursSlideover !== "function") {
          showToast("Bulk log hours is not available — modals.js not updated", "error");
          return;
        }
        window.AtharModals.openBulkLogHoursSlideover(ids);
      };
    }

    // ---- Bulk: Rate ----
    const bulkRate = document.getElementById("btn-bulk-rate");
    if (bulkRate) {
      bulkRate.onclick = () => {
        const ids = Array.from(App.selectedVolunteerIds);
        if (!ids.length) { showToast("No volunteers selected", "error"); return; }
        if (!window.AtharModals || typeof window.AtharModals.openBulkRatingModal !== "function") {
          showToast("Bulk rating is not available — modals.js not updated", "error");
          return;
        }
        window.AtharModals.openBulkRatingModal(ids);
      };
    }

    const bulkArchive = document.getElementById("btn-bulk-archive");
    if (bulkArchive) {
      bulkArchive.onclick = () => {
        const count = App.selectedVolunteerIds.size;
        showConfirmModal({
          title: t("confirm_destructive"),
          message: `Archive ${count} volunteer${count > 1 ? 's' : ''}? Records preserved.`,
          onConfirm: async () => {
            const ids = Array.from(App.selectedVolunteerIds);
            const results = await Promise.allSettled(ids.map((id) => window.AtharAPI.volunteers.archive(id)));
            const ok = results.filter((r) => r.status === "fulfilled").length;
            const fail = results.length - ok;
            App.selectedVolunteerIds.clear();
            await window.AtharStore.refreshVolunteers();
            if (fail === 0) showToast(`Archived ${ok} volunteer${ok > 1 ? 's' : ''}`, "success");
            else if (ok === 0) showToast("Failed to archive volunteers", "error");
            else showToast(`Archived ${ok}, failed ${fail}`, "warning");
            renderVolunteersList(container);
          },
        });
      };
    }

    const bulkExport = document.getElementById("btn-bulk-export");
    if (bulkExport) {
      bulkExport.onclick = () => {
        const selectedList = state.volunteers.filter(v => App.selectedVolunteerIds.has(v.id));
        const headers = ["ID", "Name", "National ID", "Phone", "Email", "Age", "Gender", "Nationality", "Status"];
        const rows = selectedList.map(v => [v.id, v.full_name, v.national_id || "", v.phone || "", v.email || "", age(v.dob) ?? "", v.gender || "", v.nationality || "", v.status]);
        window.ExportUtil.downloadCSV("Selected_Volunteers.csv", headers, rows);
      };
    }

    const exportCsv = document.getElementById("btn-export-vols-csv");
    if (exportCsv) {
      exportCsv.onclick = () => {
        const headers = ["ID", "Name (EN)", "Name (AR)", "National ID", "Phone", "WhatsApp", "Email", "Age", "DOB", "Gender", "Nationality", "Study Level", "Committee", "Status", "Join Date"];
        const rows = filtered.map(v => {
          const c = state.committees.find(x => x.id === v.committee_id);
          return [
            v.id,
            v.full_name,
            v.full_name_ar || "",
            v.national_id || "",
            v.phone || "",
            v.whatsapp || "",
            v.email || "",
            age(v.dob) ?? "",
            v.dob || "",
            v.gender || "",
            v.nationality || "",
            v.study_level || "",
            c ? c.name_en : "",
            v.status,
            v.join_date || "",
          ];
        });
        window.ExportUtil.downloadCSV("Athar_Volunteers_Filtered.csv", headers, rows);
      };
    }

    const addBtn = document.getElementById("btn-add-volunteer");
    if (addBtn) addBtn.onclick = () => window.AtharModals.openAddVolunteerSlideover();
  }

  // =========================================================================
  // Volunteer Profile — with gender hero, age, split notes
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
    const a = age(vol.dob);
    const gs = genderStyle(vol.gender);
    const notesArr = splitNotes(vol.notes);
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

    // Evaluations tab with completion summary
    const evalsHtml = evaluations.length === 0
      ? `<div class="empty-state"><p>${t("add_evaluation")}</p></div>`
      : evaluations.map(e => {
        const scores = state.evaluation_scores.filter(s => s.evaluation_id === e.id);
        const allCrit = state.criteria.filter(c => c.is_active);
        const missing = allCrit.filter(c => !scores.find(s => s.criteria_id === c.id));
        const isComplete = missing.length === 0;
        return `
          <div class="card">
            <div class="card-header">
              <div>
                <span style="font-weight:700; font-size:16px;">${e.period_label}</span>
                <span style="margin:0 8px; color:var(--neutral-400);">&bull;</span>
                <span style="font-size:12px; color:var(--neutral-500);">${e.evaluated_at}</span>
                ${isComplete
            ? '<span class="badge badge-success" style="margin-inline-start:8px;">✓ Complete</span>'
            : `<span class="badge badge-warning" style="margin-inline-start:8px;">⚠ ${missing.length} missing</span>`}
              </div>
              <div style="font-size:18px; font-weight:800; color:#F59E0B;">${e.overall_score} / 5.0</div>
            </div>
            <p style="color:var(--neutral-700); font-size:13px; margin-bottom:12px;">${e.notes || ''}</p>
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:10px; background:var(--neutral-50); padding:12px; border-radius:var(--radius-md);">
              ${allCrit.map(c => {
              const sc = scores.find(s => s.criteria_id === c.id);
              return `
                  <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; ${sc ? '' : 'opacity:0.5;'}">
                    <span style="font-weight:600;">${App.currentLang === 'ar' ? c.name_ar : c.name_en}</span>
                    <span style="color:${sc ? '#F59E0B' : 'var(--danger)'}; font-weight:700;">${sc ? sc.score + ' / 5' : '—'}</span>
                  </div>
                `;
            }).join('')}
            </div>
          </div>
        `;
      }).join('');

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

      <div class="profile-hero" style="border-inline-start:6px solid ${gs.border}; background:linear-gradient(to bottom, ${gs.bg}22, var(--white));">
        <div class="profile-hero-left">
          ${avatarHtml(vol, 84)}
          <div class="profile-hero-info">
            <div class="profile-name-row">
              <span class="profile-name">${App.currentLang === 'ar' ? (vol.full_name_ar || vol.full_name) : vol.full_name}</span>
              <span class="badge ${vol.status === 'active' ? 'badge-success' : 'badge-neutral'}">${t(vol.status)}</span>
              ${genderChip(vol.gender)}
            </div>
            <div class="profile-meta-row">
              ${a !== null ? `<div class="profile-meta-item"><strong>${a}</strong> ${App.currentLang === 'ar' ? 'سنة' : 'years old'}</div>` : ''}
              ${vol.nationality ? `<div class="profile-meta-item">${vol.nationality}</div>` : ''}
              ${vol.study_level ? `<div class="profile-meta-item">${vol.study_level}</div>` : ''}
              <div class="profile-meta-item">
                <span>${ic("building", 14)}</span>
                <span>${comm ? (App.currentLang === 'ar' ? comm.name_ar : comm.name_en) : '—'}</span>
              </div>
              <div class="profile-meta-item">
                <span>${ic("calendar", 14)}</span>
                <span>${formatDate(vol.join_date)}</span>
              </div>
              ${vol.phone ? `<div class="profile-meta-item">${ic("user", 14)} <span class="num-ltr">${vol.phone}</span></div>` : ''}
                ${vol.whatsapp ? `
                <a href="https://wa.me/${vol.whatsapp.replace(/[^0-9]/g, '')}" target="_blank" class="btn btn-whatsapp btn-sm" style="padding:3px 10px;">
                  ${ic("whatsapp", 12)} WhatsApp
                </a>
                <span class="num-ltr profile-meta-item" style="font-family:var(--font-mono); font-size:12px; color:var(--neutral-700);">${vol.whatsapp}</span>
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
        ${activeTab === "overview" ? `
          <div class="profile-stats-grid">
            <div class="stat-box"><span class="stat-box-label">${t("kpi_total_hours")}</span><span class="stat-box-value num-ltr" style="color:var(--primary);">${stats.totalHours} h</span></div>
            <div class="stat-box"><span class="stat-box-label">${t("attendance_rate")}</span><span class="stat-box-value num-ltr" style="color:var(--success);">${stats.attendanceRate}%</span></div>
            <div class="stat-box"><span class="stat-box-label">${t("avg_evaluation")}</span><span class="stat-box-value num-ltr" style="color:#F59E0B;">${stats.avgEvaluation} / 5</span></div>
            <div class="stat-box"><span class="stat-box-label">${t("kpi_certificates")}</span><span class="stat-box-value num-ltr">${stats.certsCount}</span></div>
          </div>

          <div class="card" style="margin-bottom:16px;">
            <div class="card-title" style="margin-bottom:12px;">${ic("tag", 16)} ${t("skills")}</div>
            <div style="display:flex; flex-wrap:wrap; gap:8px;">
              ${(vol.skills && vol.skills.length > 0) ? vol.skills.map(s => `<span class="tag-chip">#${s}</span>`).join('') : '<p style="color:var(--neutral-500);">—</p>'}
            </div>
          </div>

          <div class="card" style="margin-bottom:16px;">
            <div class="card-title" style="margin-bottom:12px;">${ic("info", 16)} ${App.currentLang === 'ar' ? 'التفاصيل الشخصية' : 'Personal Details'}</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
              <div><div style="font-size:11px; color:var(--neutral-500); font-weight:700;">${App.currentLang === 'ar' ? 'الجنسية' : 'Nationality'}</div><div style="font-weight:600;">${vol.nationality || '—'}</div></div>
              <div><div style="font-size:11px; color:var(--neutral-500); font-weight:700;">${App.currentLang === 'ar' ? 'المستوى الدراسي' : 'Study Level'}</div><div style="font-weight:600;">${vol.study_level || '—'}</div></div>
              <div><div style="font-size:11px; color:var(--neutral-500); font-weight:700;">${t("dob")}</div><div class="num-ltr" style="font-weight:600;">${vol.dob || '—'} ${a !== null ? `(${a} ${App.currentLang === 'ar' ? 'سنة' : 'y'})` : ''}</div></div>
              <div><div style="font-size:11px; color:var(--neutral-500); font-weight:700;">${t("gender")}</div><div style="font-weight:600;">${genderChip(vol.gender) || '—'}</div></div>
            </div>
          </div>

          <div class="card">
            <div class="card-title" style="margin-bottom:12px;">${ic("note", 16)} ${t("notes")}</div>
            ${notesArr.length === 0
          ? '<p style="color:var(--neutral-500);">—</p>'
          : `<div style="display:flex; flex-direction:column; gap:8px;">
                   ${notesArr.map((n, i) => `
                     <div style="padding:10px 14px; background:var(--neutral-50); border-inline-start:3px solid var(--primary); border-radius:8px; font-size:13px; color:var(--neutral-800); line-height:1.6;">
                       <span style="color:var(--neutral-400); font-size:11px; font-weight:700; margin-inline-end:6px;">#${i + 1}</span>
                       ${n}
                     </div>
                   `).join('')}
                 </div>`}
          </div>
        ` : activeTab === "attendance" ? `
          <div class="table-container"><table class="data-table">
            <thead><tr><th>Meeting</th><th>Date</th><th>Status</th><th>Remarks</th></tr></thead>
            <tbody>
              ${attendanceRecords.length === 0 ? `<tr><td colspan="4" style="text-align:center; padding:24px;">—</td></tr>` : attendanceRecords.map(a => {
            const mtg = state.meetings.find(m => m.id === a.meeting_id);
            return `<tr>
                  <td style="font-weight:600;">${mtg ? (App.currentLang === 'ar' ? mtg.title_ar : mtg.title_en) : '—'}</td>
                  <td>${mtg ? formatDate(mtg.meeting_date) : '—'}</td>
                  <td><span class="badge ${a.status === 'present' ? 'badge-success' : a.status === 'late' ? 'badge-warning' : 'badge-danger'}">${t(a.status)}</span></td>
                  <td style="color:var(--neutral-600);">${a.note || '—'}</td>
                </tr>`;
          }).join('')}
            </tbody>
          </table></div>
        ` : activeTab === "evaluations" ? `
          <div style="display:flex; flex-direction:column; gap:16px;">${evalsHtml}</div>
               ` : activeTab === "hours" ? `
          <div class="table-container"><table class="data-table">
            <thead><tr><th>Date</th><th>Activity</th><th>Hours</th><th>Status</th><th>Description</th><th style="text-align:right;">${t("actions")}</th></tr></thead>
            <tbody>
              ${hoursLog.length === 0 ? `<tr><td colspan="6" style="text-align:center; padding:24px;">—</td></tr>` : hoursLog.map(h => `
                <tr>
                  <td>${formatDate(h.date)}</td>
                  <td style="font-weight:600;">${h.activity}</td>
                  <td><span class="num-ltr" style="font-weight:700;">${h.hours} h</span></td>
                  <td><span class="badge ${h.status === 'approved' ? 'badge-success' : h.status === 'pending' ? 'badge-warning' : 'badge-danger'}">${t(h.status)}</span></td>
                  <td style="color:var(--neutral-600); font-size:12px;">${h.description || ''}</td>
                  <td>
                    <div class="row-actions-cell">
                      <button class="btn btn-secondary btn-sm" onclick="window.AtharApp.editHours('${h.id}')" title="${App.currentLang === 'ar' ? 'تعديل' : 'Adjust'}">${ic("pencil", 12)}</button>
                      <button class="btn btn-danger-outline btn-sm" onclick="window.AtharApp.deleteHoursEntry('${h.id}')" title="${t("delete")}">${ic("trash", 12)}</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table></div>
        ` : activeTab === "certificates" ? `
          <div class="table-container"><table class="data-table">
            <thead><tr><th>Certificate No.</th><th>Hours</th><th>Issue Date</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${certs.length === 0 ? `<tr><td colspan="5" style="text-align:center; padding:24px;">—</td></tr>` : certs.map(c => `
                <tr>
                  <td style="font-family:var(--font-mono); font-weight:700;">${c.certificate_no || 'DRAFT'}</td>
                  <td><span class="num-ltr" style="font-weight:700;">${c.total_hours} h</span></td>
                  <td>${formatDate(c.issue_date)}</td>
                  <td><span class="badge ${c.status === 'issued' ? 'badge-success' : c.status === 'draft' ? 'badge-warning' : 'badge-danger'}">${t(c.status)}</span></td>
                  <td><button class="btn btn-secondary btn-sm" onclick="window.AtharApp.navigateTo('generate-certificate', {id:'${c.volunteer_id}', sub:'${c.id}'})">${t("view")}</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table></div>
        ` : `
          <div class="card">
            <div class="card-title" style="margin-bottom:16px;">${ic("history", 16)} ${t("transfer_history")}</div>
            ${transfers.length === 0 ? '<p style="color:var(--neutral-500);">—</p>' : `
              <div style="display:flex; flex-direction:column; gap:16px; border-inline-start:2px solid var(--primary-border); padding-inline-start:16px;">
                ${transfers.map(tr => {
            const fromComm = state.committees.find(c => c.id === tr.from_committee_id);
            const toComm = state.committees.find(c => c.id === tr.to_committee_id);
            return `<div>
                    <div style="font-size:12px; color:var(--neutral-500);">${tr.transferred_at}</div>
                    <div style="font-weight:700;">${fromComm ? (App.currentLang === 'ar' ? fromComm.name_ar : fromComm.name_en) : '—'} → ${toComm ? (App.currentLang === 'ar' ? toComm.name_ar : toComm.name_en) : '—'}</div>
                    <div style="font-size:13px; color:var(--neutral-700);">${tr.reason || '—'}</div>
                  </div>`;
          }).join('')}
              </div>
            `}
          </div>
        `}
      </div>
    `;

    container.querySelectorAll(".tab-btn").forEach(btn => {
      btn.onclick = () => {
        App.currentParams.sub = btn.getAttribute("data-tab");
        renderVolunteerProfile(container, volunteerId);
      };
    });

    const bind2 = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
    bind2("btn-prof-edit", () => window.AtharModals.openAddVolunteerSlideover(vol.id));
    bind2("btn-prof-transfer", () => window.AtharModals.openTransferModal(vol.id));
    bind2("btn-prof-eval", () => navigateTo("new-evaluation", { id: vol.id }));
    bind2("btn-prof-log-hours", () => window.AtharModals.openLogHoursSlideover(vol.id));
    bind2("btn-prof-gen-cert", () => navigateTo("generate-certificate", { id: vol.id }));
  }

  // Register views
  window.AtharViews.volunteers = (c, p) => renderVolunteersList(c);
  window.AtharViews.volunteerProfile = (c, p) => renderVolunteerProfile(c, p.id);
})();