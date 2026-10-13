/**
 * View: Reports & Analytics
 */
(function () {
  "use strict";

  const { App, t, formatDate, ic, showToast } = window.AtharCore;

  function renderReports(container) {
    let currentReport = App.activeReportType || "volunteers_comm";

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <div class="breadcrumb-trail">
            <span class="breadcrumb-item" onclick="window.AtharApp.navigateTo('dashboard')">${t("app_name")}</span>
            <span class="breadcrumb-separator">/</span>
            <span>${t("nav_reports")}</span>
          </div>
          <h1 class="view-title">${t("reports_title")}</h1>
          <p class="view-subtitle">Generate statistical summaries, committee counts, and exportable datasets</p>
        </div>
        <div class="view-header-actions">
          <button class="btn btn-secondary btn-sm" id="btn-rep-export-csv">${t("export_csv")}</button>
          <button class="btn btn-secondary btn-sm" id="btn-rep-print">${t("print")}</button>
        </div>
      </div>

      <div class="filter-bar">
        <div class="filter-group">
          <label style="font-weight:600; font-size:13px;">${t("report_type")}:</label>
          <select id="report-type-select" class="form-control" style="width:260px; font-weight:600;">
            <option value="volunteers_comm" ${currentReport === 'volunteers_comm' ? 'selected' : ''}>${t("report_volunteers_comm")}</option>
            <option value="attendance" ${currentReport === 'attendance' ? 'selected' : ''}>${t("report_attendance")}</option>
            <option value="evaluations" ${currentReport === 'evaluations' ? 'selected' : ''}>${t("report_evaluations")}</option>
            <option value="hours" ${currentReport === 'hours' ? 'selected' : ''}>${t("report_hours")}</option>
            <option value="certificates" ${currentReport === 'certificates' ? 'selected' : ''}>${t("report_certificates")}</option>
            <option value="top_volunteers" ${currentReport === 'top_volunteers' ? 'selected' : ''}>${t("report_top_volunteers")}</option>
          </select>
        </div>
      </div>

      <div id="report-display-container">
        ${renderReportContent(currentReport)}
      </div>
    `;

    document.getElementById("report-type-select").onchange = (e) => {
      App.activeReportType = e.target.value;
      renderReports(container);
    };

    document.getElementById("btn-rep-print").onclick = () => {
      window.ExportUtil.printElement("report-display-container", "Athar Analytics Report");
    };

    document.getElementById("btn-rep-export-csv").onclick = () => {
      exportCurrentReportCSV(currentReport);
    };
  }

  function renderReportContent(type) {
    const state = window.AtharStore.getState();

    if (type === "volunteers_comm") {
      return `
        <div class="card">
          <h3 style="margin-bottom:16px;">1. Volunteers Distribution by Committee</h3>
          <div style="display:flex; flex-direction:column; gap:16px; margin-bottom:24px;">
            ${state.committees.map(c => {
              const count = state.volunteers.filter(v => v.committee_id === c.id && v.status !== "archived").length;
              const total = state.volunteers.filter(v => v.status !== "archived").length;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return `
                <div>
                  <div style="display:flex; justify-content:space-between; font-weight:700; margin-bottom:4px;">
                    <span>${App.currentLang === 'ar' ? c.name_ar : c.name_en}</span>
                    <span class="num-ltr">${count} volunteers (${pct}%)</span>
                  </div>
                  <div style="height:14px; background:var(--neutral-200); border-radius:var(--radius-full); overflow:hidden;">
                    <div style="width:${pct}%; height:100%; background:linear-gradient(90deg, var(--primary), #8A3FFC);"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    if (type === "attendance") {
      return `
        <div class="card">
          <h3 style="margin-bottom:16px;">2. Meeting Attendance Rates</h3>
          <div class="table-container">
            <table class="data-table">
              <thead><tr><th>Meeting</th><th>Date</th><th>Present</th><th>Late</th><th>Absent</th><th>Rate</th></tr></thead>
              <tbody>
                ${state.meetings.filter(m => m.status === 'completed').map(m => {
                  const records = state.attendance.filter(a => a.meeting_id === m.id);
                  const p = records.filter(a => a.status === 'present').length;
                  const l = records.filter(a => a.status === 'late').length;
                  const ab = records.filter(a => a.status === 'absent').length;
                  const rate = records.length > 0 ? Math.round(((p + l) / records.length) * 100) : 0;
                  return `
                    <tr>
                      <td style="font-weight:700;">${App.currentLang === 'ar' ? m.title_ar : m.title_en}</td>
                      <td>${m.meeting_date}</td>
                      <td><span class="num-ltr" style="color:var(--success); font-weight:700;">${p}</span></td>
                      <td><span class="num-ltr" style="color:var(--warning); font-weight:700;">${l}</span></td>
                      <td><span class="num-ltr" style="color:var(--danger); font-weight:700;">${ab}</span></td>
                      <td><span class="badge badge-success num-ltr">${rate}%</span></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    if (type === "hours") {
      const totalHours = state.volunteer_hours.filter(h => h.status === 'approved').reduce((a, b) => a + Number(b.hours), 0);
      return `
        <div class="card">
          <h3 style="margin-bottom:16px;">4. Volunteer Hours Aggregation</h3>
          <div style="padding:16px; background:var(--primary-light); border-radius:var(--radius-md); margin-bottom:16px; font-size:18px; font-weight:800; color:var(--primary);">
            Grand Total Approved Service: ${totalHours} Hours
          </div>
          <div class="table-container">
            <table class="data-table">
              <thead><tr><th>Committee</th><th>Approved Hours</th><th>Pending Hours</th></tr></thead>
              <tbody>
                ${state.committees.map(c => {
                  const appH = state.volunteer_hours.filter(h => h.committee_id === c.id && h.status === 'approved').reduce((a, b) => a + Number(b.hours), 0);
                  const pendH = state.volunteer_hours.filter(h => h.committee_id === c.id && h.status === 'pending').reduce((a, b) => a + Number(b.hours), 0);
                  return `
                    <tr>
                      <td style="font-weight:700;">${App.currentLang === 'ar' ? c.name_ar : c.name_en}</td>
                      <td><span class="num-ltr" style="font-weight:700; color:var(--success);">${appH} h</span></td>
                      <td><span class="num-ltr" style="font-weight:700; color:var(--warning);">${pendH} h</span></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    return `<div class="card"><p>Standard dataset ready for inspection.</p></div>`;
  }

  function exportCurrentReportCSV(type) {
    const state = window.AtharStore.getState();
    if (type === "volunteers_comm") {
      const headers = ["Committee ID", "Committee Name (EN)", "Committee Name (AR)", "Volunteer Count"];
      const rows = state.committees.map(c => {
        const count = state.volunteers.filter(v => v.committee_id === c.id && v.status !== "archived").length;
        return [c.id, c.name_en, c.name_ar, count];
      });
      window.ExportUtil.downloadCSV("Report_Volunteers_Per_Committee.csv", headers, rows);
    } else {
      const headers = ["ID", "Name", "Approved Hours"];
      const rows = state.volunteers.map(v => {
        const s = window.AtharStore.getVolunteerStats(v.id);
        return [v.id, v.full_name, s ? s.totalHours : 0];
      });
      window.ExportUtil.downloadCSV("Report_Export.csv", headers, rows);
    }
    showToast("Report exported as CSV (with UTF-8 BOM)");
  }

  window.AtharViews.reports = (c, p) => renderReports(c);
})();
