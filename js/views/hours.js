/**
 * View: Volunteer Hours — show ALL by default, edit inline
 */
(function () {
  "use strict";

  const { App, t, formatDate, ic, showToast, showConfirmModal, hasPermission } = window.AtharCore;

  function renderVolunteerHours(container) {
    const state = window.AtharStore.getState();
    const canCreate = hasPermission("volunteer_hours", "create");
    const canApprove = hasPermission("volunteer_hours", "approve");
    const canEdit = hasPermission("volunteer_hours", "edit") || App.currentUser.role === "super_admin";
    const canDelete = hasPermission("volunteer_hours", "delete") || App.currentUser.role === "super_admin";

    // DEFAULT = ALL (so you see every entry)
    let filterStatus = App.hoursFilterStatus || "all";
    let filterComm = App.hoursFilterComm || "all";

    const filtered = state.volunteer_hours.filter(h => {
      if (filterStatus !== "all" && h.status !== filterStatus) return false;
      if (filterComm !== "all" && h.committee_id !== filterComm) return false;
      return true;
    });

    const pendingCount = state.volunteer_hours.filter(h => h.status === "pending").length;
    const totalCount = state.volunteer_hours.length;

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <div class="breadcrumb-trail">
            <span class="breadcrumb-item" onclick="window.AtharApp.navigateTo('dashboard')">${t("app_name")}</span>
            <span class="breadcrumb-separator">/</span>
            <span>${t("nav_volunteer_hours")}</span>
          </div>
          <h1 class="view-title">${t("hours_title")}</h1>
          <p class="view-subtitle">
            ${totalCount} ${App.currentLang === 'ar' ? 'سجل إجمالي' : 'total records'}
            &bull; ${pendingCount} ${App.currentLang === 'ar' ? 'بانتظار الاعتماد' : 'pending'}
          </p>
        </div>
        <div class="view-header-actions">
          ${canApprove && pendingCount > 0 ? `<button class="btn btn-success btn-sm" id="btn-hours-approve-all">${ic("check_circle", 14)} ${t("approve_all")}</button>` : ''}
          ${canCreate ? `<button class="btn btn-primary" id="btn-log-hours">${ic("plus", 14)} ${t("log_hours")}</button>` : ''}
        </div>
      </div>

      <div class="filter-bar">
        <div class="filter-group">
          <select id="hours-filter-status" class="form-control">
            <option value="all" ${filterStatus === 'all' ? 'selected' : ''}>${t("all_statuses")} (${totalCount})</option>
            <option value="pending" ${filterStatus === 'pending' ? 'selected' : ''}>${t("pending")} (${pendingCount})</option>
            <option value="approved" ${filterStatus === 'approved' ? 'selected' : ''}>${t("approved")}</option>
            <option value="rejected" ${filterStatus === 'rejected' ? 'selected' : ''}>${t("rejected")}</option>
          </select>
          <select id="hours-filter-comm" class="form-control">
            <option value="all">${t("all_committees")}</option>
            ${state.committees.map(c => `<option value="${c.id}" ${filterComm === c.id ? 'selected' : ''}>${App.currentLang === 'ar' ? c.name_ar : c.name_en}</option>`).join('')}
          </select>
          <button class="btn btn-secondary btn-sm" id="btn-export-hours">${t("export_csv")}</button>
        </div>
      </div>

      <div id="hours-bulk-bar" class="bulk-action-bar" style="display:none;">
        <span class="bulk-count" id="hours-bulk-count">0 selected</span>
                <div class="bulk-buttons">
          ${canEdit ? `<button class="btn btn-primary btn-sm" id="btn-bulk-edit-hours">${ic("pencil", 14)} ${App.currentLang === 'ar' ? 'تعديل جماعي' : 'Bulk Edit'}</button>` : ''}
          ${canDelete ? `<button class="btn btn-danger-outline btn-sm" id="btn-bulk-delete-hours">${ic("trash", 14)} ${t("delete")}</button>` : ''}
        </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th class="col-cb"><input type="checkbox" id="hours-check-all"></th>
              <th>${t("date")}</th>
              <th>${App.currentLang === 'ar' ? 'المتطوع' : 'Volunteer'}</th>
              <th>${t("activity")}</th>
              <th>${t("hours")}</th>
              <th>${t("committee")}</th>
              <th>${t("status")}</th>
              <th style="text-align:right;">${t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.length === 0 ? `<tr><td colspan="8">
              <div class="empty-state">
                <div class="empty-state-icon">${ic("clock", 42, { strokeWidth: 1.5 })}</div>
                <div class="empty-state-title">${App.currentLang === 'ar' ? 'لا توجد سجلات' : 'No records'}</div>
                <div class="empty-state-desc">${App.currentLang === 'ar' ? 'جرّب تغيير الفلاتر.' : 'Try changing filters.'}</div>
              </div>
            </td></tr>` : filtered.map(h => {
      const vol = state.volunteers.find(v => v.id === h.volunteer_id);
      const comm = state.committees.find(c => c.id === h.committee_id);
      const volName = vol
        ? (App.currentLang === 'ar' ? (vol.full_name_ar || vol.full_name) : vol.full_name)
        : (h.volunteer && (h.volunteer.fullName || h.volunteer.full_name)) || '—';

      return `
                <tr data-hours-row="${h.id}">
                  <td class="col-cb"><input type="checkbox" class="hours-row-cb" data-id="${h.id}"></td>
                  <td>${formatDate(h.date)}</td>
                  <td>
                    <div style="font-weight:700; cursor:pointer;" onclick="window.AtharApp.navigateTo('volunteer-profile', {id:'${h.volunteer_id}', sub:'hours'})">
                      ${volName}
                    </div>
                  </td>
                  <td>
                    <div style="font-weight:600;">${h.activity}</div>
                    <div style="font-size:11px; color:var(--neutral-500);">${h.description || ''}</div>
                  </td>
                  <td><span class="num-ltr" style="font-weight:800; font-size:14px;">${h.hours} h</span></td>
                  <td>${comm ? (App.currentLang === 'ar' ? comm.name_ar : comm.name_en) : '—'}</td>
                  <td>
                    <span class="badge ${h.status === 'approved' ? 'badge-success' : h.status === 'pending' ? 'badge-warning' : 'badge-danger'}">${t(h.status)}</span>
                    ${h.rejection_reason ? `<div style="font-size:10px; color:var(--danger); max-width:180px;">${h.rejection_reason}</div>` : ''}
                  </td>
                  <td>
                    <div class="row-actions-cell">
                      ${canEdit ? `<button class="btn btn-secondary btn-sm" onclick="window.AtharApp.editHours('${h.id}')" title="${App.currentLang === 'ar' ? 'تعديل الساعات' : 'Adjust hours'}">${ic("pencil", 12)}</button>` : ''}
                      ${canApprove && h.status === 'pending' ? `
                        <button class="btn btn-success btn-sm" onclick="window.AtharApp.approveHours('${h.id}')" title="${t("approve")}">${ic("check", 12)}</button>
                        <button class="btn btn-danger-outline btn-sm" onclick="window.AtharApp.rejectHours('${h.id}')" title="${t("reject")}">${ic("x", 12)}</button>
                      ` : ''}
                      ${canDelete ? `<button class="btn btn-danger-outline btn-sm" onclick="window.AtharApp.deleteHoursEntry('${h.id}')" title="${t("delete")}">${ic("trash", 12)}</button>` : ''}
                    </div>
                  </td>
                </tr>
              `;
    }).join('')}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById("hours-filter-status").onchange = (e) => {
      App.hoursFilterStatus = e.target.value;
      renderVolunteerHours(container);
    };
    document.getElementById("hours-filter-comm").onchange = (e) => {
      App.hoursFilterComm = e.target.value;
      renderVolunteerHours(container);
    };

    const addBtn = document.getElementById("btn-log-hours");
    if (addBtn) addBtn.onclick = () => window.AtharModals.openLogHoursSlideover();

    const approveAllBtn = document.getElementById("btn-hours-approve-all");
    if (approveAllBtn) {
      approveAllBtn.onclick = () => {
        showConfirmModal({
          title: "Approve All Pending Hours",
          message: `Approve all ${pendingCount} pending entries?`,
          isDanger: false,
          confirmText: t("approve"),
          onConfirm: async () => {
            approveAllBtn.disabled = true;
            try {
              const res = await window.AtharAPI.hours.bulkApprove();
              await window.AtharStore.refreshHours();
              showToast(`Approved ${res?.count ?? 0}`, "success");
              renderVolunteerHours(container);
            } catch (err) {
              showToast(err.message || "Bulk approve failed", "error");
              approveAllBtn.disabled = false;
            }
          },
        });
      };
    }

    const exportBtn = document.getElementById("btn-export-hours");
    if (exportBtn) {
      exportBtn.onclick = () => {
        const headers = ["ID", "Volunteer", "Date", "Activity", "Hours", "Status"];
        const rows = filtered.map(h => {
          const vol = state.volunteers.find(v => v.id === h.volunteer_id);
          return [h.id, vol ? vol.full_name : h.volunteer_id, h.date, h.activity, h.hours, h.status];
        });
        window.ExportUtil.downloadCSV("Volunteer_Hours_Report.csv", headers, rows);
      };
    }

    // ============= Bulk selection =============
    const selected = new Set();
    const bulkBar = document.getElementById("hours-bulk-bar");
    const bulkCount = document.getElementById("hours-bulk-count");
    const checkAll = document.getElementById("hours-check-all");

    function updateBulkBar() {
      bulkCount.textContent = `${selected.size} ${App.currentLang === 'ar' ? 'محدد' : 'selected'}`;
      bulkBar.style.display = selected.size > 0 ? "flex" : "none";
    }

    if (checkAll) {
      checkAll.onchange = (e) => {
        container.querySelectorAll(".hours-row-cb").forEach(cb => {
          cb.checked = e.target.checked;
          const id = cb.getAttribute("data-id");
          if (e.target.checked) selected.add(id);
          else selected.delete(id);
        });
        updateBulkBar();
      };
    }

    container.querySelectorAll(".hours-row-cb").forEach(cb => {
      cb.onchange = () => {
        const id = cb.getAttribute("data-id");
        if (cb.checked) selected.add(id);
        else selected.delete(id);
        updateBulkBar();
      };
    });

    const bulkEdit = document.getElementById("btn-bulk-edit-hours");
    if (bulkEdit) {
      bulkEdit.onclick = () => {
        const ids = Array.from(selected);
        if (!ids.length) return;
        window.AtharApp.bulkEditHours(ids);
      };
    }

    const bulkDel = document.getElementById("btn-bulk-delete-hours");
    if (bulkDel) {
      bulkDel.onclick = () => {
        const ids = Array.from(selected);
        if (!ids.length) return;
        showConfirmModal({
          title: t("confirm_destructive"),
          message: App.currentLang === 'ar'
            ? `سيتم حذف ${ids.length} سجل نهائياً. لا يمكن التراجع.`
            : `Permanently delete ${ids.length} hours entr${ids.length === 1 ? 'y' : 'ies'}? This cannot be undone.`,
          confirmText: t("delete"),
          isDanger: true,
          onConfirm: async () => {
            const results = await Promise.allSettled(ids.map(id => window.AtharAPI.hours.delete(id)));
            const ok = results.filter(r => r.status === "fulfilled").length;
            const fail = results.length - ok;
            await window.AtharStore.refreshHours();
            if (fail === 0) showToast(`Deleted ${ok}`, "warning");
            else showToast(`Deleted ${ok}, failed ${fail}`, "warning");
            renderVolunteerHours(container);
          },
        });
      };
    }
  }

  window.AtharViews.volunteerHours = (c, p) => renderVolunteerHours(c);
})();