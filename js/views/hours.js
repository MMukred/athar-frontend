/**
 * View: Volunteer Hours
 */
(function () {
  "use strict";

  const { App, t, formatDate, ic, showToast, showConfirmModal, hasPermission } = window.AtharCore;

  function renderVolunteerHours(container) {
    const state = window.AtharStore.getState();
    const canCreate = hasPermission("volunteer_hours", "create");
    const canApprove = hasPermission("volunteer_hours", "approve");

    let filterStatus = App.hoursFilterStatus || "pending";
    let filterComm = App.hoursFilterComm || "all";

    const filtered = state.volunteer_hours.filter(h => {
      if (filterStatus !== "all" && h.status !== filterStatus) return false;
      if (filterComm !== "all" && h.committee_id !== filterComm) return false;
      return true;
    });

    const pendingCount = state.volunteer_hours.filter(h => h.status === "pending").length;

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <div class="breadcrumb-trail">
            <span class="breadcrumb-item" onclick="window.AtharApp.navigateTo('dashboard')">${t("app_name")}</span>
            <span class="breadcrumb-separator">/</span>
            <span>${t("nav_volunteer_hours")}</span>
          </div>
          <h1 class="view-title">${t("hours_title")}</h1>
          <p class="view-subtitle">${pendingCount} hours records awaiting approval</p>
        </div>
        <div class="view-header-actions">
          ${canApprove && pendingCount > 0 ? `<button class="btn btn-success btn-sm" id="btn-hours-approve-all">${ic("check_circle", 14)} ${t("approve_all")}</button>` : ''}
          ${canCreate ? `<button class="btn btn-primary" id="btn-log-hours">${ic("plus", 14)} ${t("log_hours")}</button>` : ''}
        </div>
      </div>

      <div class="filter-bar">
        <div class="filter-group">
          <select id="hours-filter-status" class="form-control">
            <option value="all">${t("all_statuses")}</option>
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

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Volunteer</th>
              <th>Activity</th>
              <th>Hours</th>
              <th>Committee</th>
              <th>Status</th>
              ${canApprove ? '<th style="text-align:right;">Approval Actions</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${filtered.length === 0 ? `<tr><td colspan="7" style="text-align:center; padding:24px;">No volunteer hours match current filters</td></tr>` : filtered.map(h => {
              const vol = state.volunteers.find(v => v.id === h.volunteer_id);
              const comm = state.committees.find(c => c.id === h.committee_id);
              return `
                <tr>
                  <td>${formatDate(h.date)}</td>
                  <td>
                    <div style="font-weight:700; cursor:pointer;" onclick="window.AtharApp.navigateTo('volunteer-profile', {id:'${h.volunteer_id}', sub:'hours'})">
                      ${vol ? (App.currentLang === 'ar' ? (vol.full_name_ar || vol.full_name) : vol.full_name) : 'Volunteer'}
                    </div>
                  </td>
                  <td>
                    <div style="font-weight:600;">${h.activity}</div>
                    <div style="font-size:11px; color:var(--neutral-500);">${h.description || ''}</div>
                  </td>
                  <td><span class="num-ltr" style="font-weight:800; color:var(--neutral-900); font-size:14px;">${h.hours} h</span></td>
                  <td>${comm ? (App.currentLang === 'ar' ? comm.name_ar : comm.name_en) : '—'}</td>
                  <td>
                    <span class="badge ${h.status === 'approved' ? 'badge-success' : h.status === 'pending' ? 'badge-warning' : 'badge-danger'}">${t(h.status)}</span>
                    ${h.rejection_reason ? `<div style="font-size:10px; color:var(--danger); max-width:180px;">${h.rejection_reason}</div>` : ''}
                  </td>
                  ${canApprove ? `
                    <td>
                      <div class="row-actions-cell">
                        ${h.status === 'pending' ? `
                          <button class="btn btn-success btn-sm" onclick="window.AtharApp.approveHours('${h.id}')" title="Approve">${ic("check", 14)} ${t("approve")}</button>
                          <button class="btn btn-danger-outline btn-sm" onclick="window.AtharApp.rejectHours('${h.id}')" title="Reject">${ic("x", 14)} ${t("reject")}</button>
                        ` : `<span style="font-size:11px; color:var(--neutral-400);">Locked</span>`}
                      </div>
                    </td>
                  ` : ''}
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
          message: `Are you sure you want to approve all ${pendingCount} pending volunteer hours?`,
          isDanger: false,
          confirmText: t("approve"),
          onConfirm: () => {
            const now = new Date().toISOString();
            state.volunteer_hours.filter(h => h.status === "pending").forEach(h => {
              h.status = "approved";
              h.approved_by = App.currentUser.id;
              h.approved_at = now;
            });
            window.AtharStore.save();
            window.AtharStore.logAudit(App.currentUser, "approve", "volunteer_hours", null, `Bulk approved all pending volunteer hours (${pendingCount} entries)`, null, null);
            showToast("All hours approved successfully");
            renderVolunteerHours(container);
          }
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
  }

  window.AtharViews.volunteerHours = (c, p) => renderVolunteerHours(c);
})();
