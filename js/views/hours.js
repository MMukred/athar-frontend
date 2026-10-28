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
    const canEdit = hasPermission("volunteer_hours", "edit") || (App.currentUser && App.currentUser.role === "super_admin");
    const canDelete = hasPermission("volunteer_hours", "delete") || (App.currentUser && App.currentUser.role === "super_admin");

    // DEFAULT = ALL (so you see every entry)
    let filterStatus = App.hoursFilterStatus || "all";
    let filterComm = App.hoursFilterComm || "all";
    const searchQ = (App.hoursSearch || "").trim().toLowerCase();
    const dateFrom = App.hoursDateFrom || "";
    const dateTo = App.hoursDateTo || "";
    const sortKey = App.hoursSort || "date_desc";

    const nameOf = (h) => {
      const vol = state.volunteers.find(v => v.id === h.volunteer_id);
      const source = vol || h.volunteer || {};
      const nameEn = source.full_name || source.fullName || "";
      const nameAr = source.full_name_ar || source.fullNameAr || "";
      return (App.currentLang === 'ar' ? (nameAr || nameEn) : (nameEn || nameAr) || "").toLowerCase();
    };

    const filtered = state.volunteer_hours.filter(h => {
      if (filterStatus !== "all" && h.status !== filterStatus) return false;
      if (filterComm !== "all" && h.committee_id !== filterComm) return false;
      if (searchQ) {
        const hay = (nameOf(h) + " " + (h.activity || "") + " " + (h.description || "")).toLowerCase();
        if (!hay.includes(searchQ)) return false;
      }
      if (dateFrom && String(h.date || "").slice(0, 10) < dateFrom) return false;
      if (dateTo && String(h.date || "").slice(0, 10) > dateTo) return false;
      return true;
    }).sort((a, b) => {
      switch (sortKey) {
        case "date_asc": return String(a.date || "").localeCompare(String(b.date || ""));
        case "date_desc": return String(b.date || "").localeCompare(String(a.date || ""));
        case "name_asc": return nameOf(a).localeCompare(nameOf(b));
        case "hours_desc": return Number(b.hours) - Number(a.hours);
        case "status": return String(a.status || "").localeCompare(String(b.status || ""));
        default: return 0;
      }
    });

    const pendingCount = state.volunteer_hours.filter(h => h.status === "pending").length;
    const filteredPendingCount = filtered.filter(h => h.status === "pending").length;
    const totalCount = state.volunteer_hours.length;
    const displayedHours = filtered.reduce((acc, h) => acc + Number(h.hours || 0), 0);

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
            &bull; ${displayedHours} ${App.currentLang === 'ar' ? 'ساعة معروضة' : 'hours displayed'}
          </p>
        </div>
        <div class="view-header-actions">
          ${canApprove && filteredPendingCount > 0 ? `<button class="btn btn-success btn-sm" id="btn-hours-approve-visible">${ic("check_circle", 14)} ${t("hours_approve_visible")} (${filteredPendingCount})</button>` : ''}
          ${canCreate ? `<button class="btn btn-primary" id="btn-log-hours">${ic("plus", 14)} ${t("log_hours")}</button>` : ''}
        </div>
      </div>

      <div class="filter-bar">
        <div class="filter-group" style="flex-wrap:wrap; gap:8px;">
          <input type="search" id="hours-search" class="form-control" placeholder="${t("hours_search")}" value="${String(App.hoursSearch || "").replace(/"/g, '&quot;')}" style="min-width:160px;">
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
          <input type="date" id="hours-date-from" class="form-control" value="${dateFrom}" title="${t("hours_filter_from")}">
          <input type="date" id="hours-date-to" class="form-control" value="${dateTo}" title="${t("hours_filter_to")}">
          <select id="hours-sort" class="form-control">
            <option value="date_desc" ${sortKey === 'date_desc' ? 'selected' : ''}>${App.currentLang === 'ar' ? 'الأحدث أولاً' : 'Newest first'}</option>
            <option value="date_asc" ${sortKey === 'date_asc' ? 'selected' : ''}>${App.currentLang === 'ar' ? 'الأقدم أولاً' : 'Oldest first'}</option>
            <option value="name_asc" ${sortKey === 'name_asc' ? 'selected' : ''}>${App.currentLang === 'ar' ? 'الاسم' : 'Name'}</option>
            <option value="hours_desc" ${sortKey === 'hours_desc' ? 'selected' : ''}>${App.currentLang === 'ar' ? 'الأكثر ساعات' : 'Most hours'}</option>
            <option value="status" ${sortKey === 'status' ? 'selected' : ''}>${t("status")}</option>
          </select>
          <button class="btn btn-secondary btn-sm" id="btn-export-hours">${t("export_csv")}</button>
        </div>
      </div>

      <div id="hours-summary-strip" style="margin-bottom:12px; padding:10px 12px; background:var(--neutral-50); border:1px solid var(--neutral-300); border-radius:var(--radius-md); font-size:12.5px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; flex-wrap:wrap; gap:6px;">
          <span style="font-weight:700; color:var(--neutral-900);">${t("hours_summary_by_committee")}</span>
          <span style="color:var(--neutral-500);">${t("hours_displayed_total")}: <strong class="num-ltr">${displayedHours}</strong> h &bull; ${filtered.length} ${App.currentLang === 'ar' ? 'سجل' : 'records'}</span>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:6px;">
          ${(() => {
            const byComm = {};
            filtered.forEach(h => {
              const key = h.committee_id || "__none__";
              if (!byComm[key]) byComm[key] = { count: 0, hours: 0 };
              byComm[key].count++;
              byComm[key].hours += Number(h.hours || 0);
            });
            const items = Object.keys(byComm).map(k => {
              const c = k === "__none__" ? null : state.committees.find(x => x.id === k);
              const name = c ? (App.currentLang === 'ar' ? c.name_ar : c.name_en) : (App.currentLang === 'ar' ? 'بدون لجنة' : 'Unassigned');
              const d = byComm[k];
              return `<span style="display:inline-flex; align-items:center; gap:4px; padding:3px 8px; background:var(--surface); border:1px solid var(--neutral-300); border-radius:var(--radius-full); font-weight:600;">
                ${name}: <span class="num-ltr">${d.hours}</span> h (${d.count})
              </span>`;
            });
            return items.join("") || `<span style="color:var(--neutral-500);">—</span>`;
          })()}
        </div>
      </div>

      <div id="hours-bulk-bar" class="bulk-action-bar" style="display:none;">
        <span class="bulk-count" id="hours-bulk-count">0 selected</span>
        <div class="bulk-buttons">
          ${canApprove ? `<button class="btn btn-success btn-sm" id="btn-bulk-approve-hours">${ic("check_circle", 14)} ${t("bulk_approve_selected")}</button>` : ''}
          ${canEdit ? `<button class="btn btn-primary btn-sm" id="btn-bulk-edit-hours">${ic("pencil", 14)} ${App.currentLang === 'ar' ? 'تعديل جماعي' : 'Bulk Edit'}</button>` : ''}
          ${canDelete ? `<button class="btn btn-danger-outline btn-sm" id="btn-bulk-delete-hours">${ic("trash", 14)} ${t("delete")}</button>` : ''}
        </div>
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
      const source = vol || h.volunteer || {};
      const nameEn = source.full_name || source.fullName || "";
      const nameAr = source.full_name_ar || source.fullNameAr || "";
      const volName = App.currentLang === 'ar'
        ? (nameAr || nameEn || '—')
        : (nameEn || nameAr || '—');

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
                      ${canEdit ? `<button class="btn btn-secondary btn-sm" onclick="window.AtharApp.editHours('${h.id}')" title="${App.currentLang === 'ar' ? 'تعديل' : 'Edit'}">${ic("pencil", 12)} ${App.currentLang === 'ar' ? 'تعديل' : 'Edit'}</button>` : ''}
                      <div class="action-menu-wrap">
                        <button type="button" class="btn btn-secondary btn-sm action-menu-trigger" data-action-menu="h-${h.id}" title="${App.currentLang === 'ar' ? 'المزيد' : 'More'}">${ic("more_vertical", 14)}</button>
                        <div class="action-menu-dropdown" data-action-dropdown="h-${h.id}" hidden>
                          ${canApprove && h.status === 'pending' ? `
                            <button type="button" class="action-menu-item" onclick="window.AtharApp.approveHours('${h.id}')">${ic("check", 14)} ${t("approve")}</button>
                            <button type="button" class="action-menu-item action-menu-danger" onclick="window.AtharApp.rejectHours('${h.id}')">${ic("x", 14)} ${t("reject")}</button>
                          ` : ''}
                          ${canDelete ? `<button type="button" class="action-menu-item action-menu-danger" onclick="window.AtharApp.deleteHoursEntry('${h.id}')">${ic("trash", 14)} ${t("delete")}</button>` : ''}
                        </div>
                      </div>
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

    const searchEl = document.getElementById("hours-search");
    if (searchEl) {
      let timer = null;
      searchEl.oninput = (e) => {
        clearTimeout(timer);
        const val = e.target.value;
        timer = setTimeout(() => {
          App.hoursSearch = val;
          renderVolunteerHours(container);
          const el = document.getElementById("hours-search");
          if (el) { el.focus(); try { el.setSelectionRange(val.length, val.length); } catch (err) {} }
        }, 250);
      };
    }
    const fromEl = document.getElementById("hours-date-from");
    if (fromEl) fromEl.onchange = (e) => { App.hoursDateFrom = e.target.value; renderVolunteerHours(container); };
    const toEl = document.getElementById("hours-date-to");
    if (toEl) toEl.onchange = (e) => { App.hoursDateTo = e.target.value; renderVolunteerHours(container); };
    const sortEl = document.getElementById("hours-sort");
    if (sortEl) sortEl.onchange = (e) => { App.hoursSort = e.target.value; renderVolunteerHours(container); };

    const addBtn = document.getElementById("btn-log-hours");
    if (addBtn) addBtn.onclick = () => window.AtharModals.openLogHoursSlideover();

    const approveVisibleBtn = document.getElementById("btn-hours-approve-visible");
    if (approveVisibleBtn) {
      approveVisibleBtn.onclick = () => {
        const ids = filtered.filter(h => h.status === "pending").map(h => h.id);
        if (!ids.length) return;
        showConfirmModal({
          title: "Approve Visible Pending Hours",
          message: `Approve ${ids.length} pending entries in the current view?`,
          isDanger: false,
          confirmText: t("approve"),
          onConfirm: async () => {
            approveVisibleBtn.disabled = true;
            try {
              const results = await Promise.allSettled(ids.map(id => window.AtharAPI.hours.approve(id)));
              const ok = results.filter(r => r.status === "fulfilled").length;
              const fail = results.length - ok;
              await window.AtharStore.refreshHours();
              if (fail === 0) showToast(`${t("approved_successfully")} (${ok})`, "success");
              else showToast(`${ok} ✓ • ${fail} ✗`, "warning");
              renderVolunteerHours(container);
            } catch (err) {
              showToast(err.message || "Bulk approve failed", "error");
              approveVisibleBtn.disabled = false;
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

    const bulkApprove = document.getElementById("btn-bulk-approve-hours");
    if (bulkApprove) {
      bulkApprove.onclick = async () => {
        const ids = Array.from(selected);
        const pendingIds = ids.filter(id => {
          const h = state.volunteer_hours.find(x => x.id === id);
          return h && h.status === "pending";
        });
        if (!pendingIds.length) {
          showToast(App.currentLang === 'ar' ? 'لا توجد سجلات بانتظار الاعتماد ضمن التحديد' : 'No pending entries in the selection', "warning");
          return;
        }
        bulkApprove.disabled = true;
        const results = await Promise.allSettled(pendingIds.map(id => window.AtharAPI.hours.approve(id)));
        const ok = results.filter(r => r.status === "fulfilled").length;
        const fail = results.length - ok;
        await window.AtharStore.refreshHours();
        if (fail === 0) showToast(`${t("approved_successfully")} (${ok})`, "success");
        else showToast(`${ok} ✓ • ${fail} ✗`, "warning");
        selected.clear();
        renderVolunteerHours(container);
      };
    }

    const bulkDel = document.getElementById("btn-bulk-delete-hours");
    if (bulkDel) {
      bulkDel.onclick = () => {
        const ids = Array.from(selected);
        if (!ids.length) return;
        const snapshots = ids.map(id => state.volunteer_hours.find(h => h.id === id)).filter(Boolean);
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
            const deletedSnapshots = snapshots.filter((s, i) => results[i].status === "fulfilled");
            await window.AtharStore.refreshHours();
            if (fail === 0) showToast(`Deleted ${ok}`, "warning");
            else showToast(`Deleted ${ok}, failed ${fail}`, "warning");
            if (deletedSnapshots.length) {
              window.AtharCore.showUndoToast(
                App.currentLang === 'ar' ? `تم حذف ${deletedSnapshots.length} سجل` : `Deleted ${deletedSnapshots.length} entries`,
                async () => {
                  for (const s of deletedSnapshots) {
                    try {
                      const created = await window.AtharAPI.hours.create({
                        volunteerId: s.volunteer_id,
                        activity: s.activity,
                        hours: s.hours,
                        date: String(s.date || "").slice(0, 10),
                        description: s.description || s.notes || undefined,
                      });
                      if (s.status === "approved" && created && created.id) {
                        try { await window.AtharAPI.hours.approve(created.id); } catch (e) { /* already approved */ }
                      }
                    } catch (e) { /* already approved */ }
                  }
                  await window.AtharStore.refreshHours();
                  renderVolunteerHours(container);
                }
              );
            }
            selected.clear();
            renderVolunteerHours(container);
          },
        });
      };
    }

    // ---- Kebab action menu toggle ----
    container.querySelectorAll("[data-action-menu]").forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-action-menu");
        const dd = container.querySelector(`[data-action-dropdown="${id}"]`);
        container.querySelectorAll(".action-menu-dropdown").forEach(d => { if (d !== dd) d.hidden = true; });
        if (dd) dd.hidden = !dd.hidden;
      };
    });

  }

  window.AtharViews.volunteerHours = (c, p) => renderVolunteerHours(c);
})();