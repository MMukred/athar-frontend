/**
 * View: Reports & Analytics
 */
(function () {
  "use strict";

  const { App, t, formatDate, ic, showToast, escapeHtml } = window.AtharCore;

  function isHoc() { return !!(App.currentUser && App.currentUser.role === "committee_leader"); }
  function hocCid() { return isHoc() ? (App.currentUser.committee_id || (App.currentUser.committee && App.currentUser.committee.id) || null) : null; }

  function scopedCommittees() {
    const state = window.AtharStore.getState();
    const all = (state.committees || []).filter(c => c.status !== "archived");
    if (isHoc()) {
      const cid = hocCid();
      return cid ? all.filter(c => c.id === cid) : [];
    }
    return all;
  }

  function scopedVolunteers() {
    const state = window.AtharStore.getState();
    let vols = (state.volunteers || []).filter(v => v.status !== "archived");
    if (isHoc()) {
      const cid = hocCid();
      vols = cid ? vols.filter(v => v.committee_id === cid) : [];
    }
    return vols;
  }

  function scopedHours() {
    const state = window.AtharStore.getState();
    let hrs = state.volunteer_hours || [];
    if (isHoc()) {
      const cid = hocCid();
      hrs = cid ? hrs.filter(h => h.committee_id === cid) : [];
    }
    return hrs;
  }

  function scopedMeetings() {
    const state = window.AtharStore.getState();
    let mtgs = state.meetings || [];
    if (isHoc()) {
      const cid = hocCid();
      mtgs = cid ? mtgs.filter(m => m.committee_id === cid) : [];
    }
    return mtgs;
  }

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
          <p class="view-subtitle">${t("reports_subtitle") || "Generate statistical summaries, committee counts, and exportable datasets"}</p>
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

      ${window.AtharReportCharts ? window.AtharReportCharts.html({ hours: scopedHours(), meetings: scopedMeetings() }) : ""}

      <div id="report-display-container">
        ${renderReportContent(currentReport)}
      </div>
    `;
    if (window.AtharReportCharts) window.AtharReportCharts.bind(container);

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
    const committees = scopedCommittees();
    const volunteers = scopedVolunteers();
    const hours = scopedHours();
    const meetings = scopedMeetings();

    if (type === "volunteers_comm") {
      const total = volunteers.length;
      return `
        <div class="card">
          <h3 style="margin-bottom:16px;">${t("report_volunteers_comm")}</h3>
          <div style="display:flex; flex-direction:column; gap:16px; margin-bottom:24px;">
            ${committees.map(c => {
              const count = volunteers.filter(v => v.committee_id === c.id).length;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return `
                <div>
                  <div style="display:flex; justify-content:space-between; font-weight:700; margin-bottom:4px;">
                    <span>${escapeHtml(App.currentLang === 'ar' ? c.name_ar : c.name_en)}</span>
                    <span class="num-ltr">${count} (${pct}%)</span>
                  </div>
                  <div style="height:14px; background:var(--neutral-200); border-radius:var(--radius-full); overflow:hidden;">
                    <div style="width:${pct}%; height:100%; background:var(--accent);"></div>
                  </div>
                </div>
              `;
            }).join('')}
            ${committees.length === 0 ? `<p style="color:var(--neutral-500);">${t("no_data") || "No data"}</p>` : ''}
          </div>
          <div style="font-weight:700;">${t("total") || "Total"}: ${total}</div>
        </div>
      `;
    }

    if (type === "attendance") {
      const completed = meetings.filter(m => m.status === 'completed');
      return `
        <div class="card">
          <h3 style="margin-bottom:16px;">${t("report_attendance")}</h3>
          <div class="table-container">
            <table class="data-table">
              <thead><tr><th>${t("meeting") || "Meeting"}</th><th>${t("date") || "Date"}</th><th>${t("present") || "Present"}</th><th>${t("late") || "Late"}</th><th>${t("absent") || "Absent"}</th><th>${t("rate") || "Rate"}</th></tr></thead>
              <tbody>
                ${completed.length === 0 ? `<tr><td colspan="6" style="text-align:center; color:var(--neutral-500);">${t("no_data") || "No completed meetings"}</td></tr>` : completed.map(m => {
                  const s = m.attendance_summary || {};
                  const p = s.present || 0;
                  const l = s.late || 0;
                  const ab = s.absent || 0;
                  const total = s.total || 0;
                  const rate = total > 0 ? Math.round(((p + l) / total) * 100) : 0;
                  return `
                    <tr>
                      <td style="font-weight:700;">${escapeHtml(App.currentLang === 'ar' ? m.title_ar : m.title_en)}</td>
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

    if (type === "evaluations") {
      const evals = state.evaluations || [];
      const scoped = isHoc() ? evals.filter(e => {
        const v = (state.volunteers || []).find(x => x.id === e.volunteer_id);
        return v && v.committee_id === hocCid();
      }) : evals;
      const byComm = committees.map(c => {
        const ce = scoped.filter(e => {
          const v = (state.volunteers || []).find(x => x.id === e.volunteer_id);
          return v && v.committee_id === c.id;
        });
        const avg = ce.length ? (ce.reduce((a, b) => a + Number(b.overall_score || b.score || 0), 0) / ce.length).toFixed(1) : "—";
        return { c, count: ce.length, avg };
      });
      return `
        <div class="card">
          <h3 style="margin-bottom:16px;">${t("report_evaluations")}</h3>
          <div class="table-container">
            <table class="data-table">
              <thead><tr><th>${t("committee") || "Committee"}</th><th>${t("count") || "Evaluations"}</th><th>${t("average") || "Avg Score"}</th></tr></thead>
              <tbody>
                ${byComm.map(r => `
                  <tr>
                    <td style="font-weight:700;">${escapeHtml(App.currentLang === 'ar' ? r.c.name_ar : r.c.name_en)}</td>
                    <td class="num-ltr">${r.count}</td>
                    <td class="num-ltr">${r.avg}</td>
                  </tr>
                `).join('')}
                ${byComm.length === 0 ? `<tr><td colspan="3" style="text-align:center; color:var(--neutral-500);">${t("no_data") || "No data"}</td></tr>` : ''}
              </tbody>
            </table>
          </div>
          <div style="margin-top:12px; font-weight:700;">${t("total") || "Total"}: ${scoped.length}</div>
        </div>
      `;
    }

    if (type === "hours") {
      const totalHours = hours.filter(h => h.status === 'approved').reduce((a, b) => a + Number(b.hours), 0);
      const pendingHours = hours.filter(h => h.status === 'pending').reduce((a, b) => a + Number(b.hours), 0);
      return `
        <div class="card">
          <h3 style="margin-bottom:16px;">${t("report_hours")}</h3>
          <div style="display:flex; gap:12px; margin-bottom:16px; flex-wrap:wrap;">
            <div style="padding:16px; background:var(--primary-light); border-radius:var(--radius-md); font-size:18px; font-weight:800; color:var(--primary); flex:1; min-width:180px;">
              ${t("approved") || "Approved"}: ${totalHours} h
            </div>
            <div style="padding:16px; background:var(--warning-light); border-radius:var(--radius-md); font-size:18px; font-weight:800; color:var(--warning-strong); flex:1; min-width:180px;">
              ${t("pending") || "Pending"}: ${pendingHours} h
            </div>
          </div>
          <div class="table-container">
            <table class="data-table">
              <thead><tr><th>${t("committee") || "Committee"}</th><th>${t("approved") || "Approved"} (h)</th><th>${t("pending") || "Pending"} (h)</th></tr></thead>
              <tbody>
                ${committees.map(c => {
                  const appH = hours.filter(h => h.committee_id === c.id && h.status === 'approved').reduce((a, b) => a + Number(b.hours), 0);
                  const pendH = hours.filter(h => h.committee_id === c.id && h.status === 'pending').reduce((a, b) => a + Number(b.hours), 0);
                  return `
                    <tr>
                      <td style="font-weight:700;">${escapeHtml(App.currentLang === 'ar' ? c.name_ar : c.name_en)}</td>
                      <td><span class="num-ltr" style="font-weight:700; color:var(--success);">${appH} h</span></td>
                      <td><span class="num-ltr" style="font-weight:700; color:var(--warning);">${pendH} h</span></td>
                    </tr>
                  `;
                }).join('')}
                ${committees.length === 0 ? `<tr><td colspan="3" style="text-align:center; color:var(--neutral-500);">${t("no_data") || "No data"}</td></tr>` : ''}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    if (type === "certificates") {
      const certs = state.certificates || [];
      const scoped = isHoc() ? certs.filter(c => {
        const v = (state.volunteers || []).find(x => x.id === c.volunteer_id);
        return v && v.committee_id === hocCid();
      }) : certs;
      const byStatus = ["draft", "issued", "revoked"].map(s => ({ status: s, count: scoped.filter(c => c.status === s).length }));
      const byComm = committees.map(c => ({
        c,
        count: scoped.filter(cert => {
          const v = (state.volunteers || []).find(x => x.id === cert.volunteer_id);
          return v && v.committee_id === c.id;
        }).length,
      }));
      return `
        <div class="card">
          <h3 style="margin-bottom:16px;">${t("report_certificates")}</h3>
          <div style="display:flex; gap:12px; margin-bottom:16px; flex-wrap:wrap;">
            ${byStatus.map(s => `
              <div style="padding:12px 16px; background:var(--neutral-100); border-radius:var(--radius-md); font-weight:700; min-width:120px; text-align:center;">
                ${s.status}: <span class="num-ltr">${s.count}</span>
              </div>
            `).join('')}
          </div>
          <div class="table-container">
            <table class="data-table">
              <thead><tr><th>${t("committee") || "Committee"}</th><th>${t("count") || "Certificates"}</th></tr></thead>
              <tbody>
                ${byComm.map(r => `
                  <tr>
                    <td style="font-weight:700;">${escapeHtml(App.currentLang === 'ar' ? r.c.name_ar : r.c.name_en)}</td>
                    <td class="num-ltr">${r.count}</td>
                  </tr>
                `).join('')}
                ${byComm.length === 0 ? `<tr><td colspan="2" style="text-align:center; color:var(--neutral-500);">${t("no_data") || "No data"}</td></tr>` : ''}
              </tbody>
            </table>
          </div>
          <div style="margin-top:12px; font-weight:700;">${t("total") || "Total"}: ${scoped.length}</div>
        </div>
      `;
    }

    if (type === "top_volunteers") {
      const stats = volunteers.map(v => {
        const s = window.AtharStore.getVolunteerStats(v.id);
        return { v, hours: s ? (s.totalHours || 0) : 0, attendance: s ? (s.attendanceRate || 0) : 0 };
      }).sort((a, b) => b.hours - a.hours).slice(0, 10);
      return `
        <div class="card">
          <h3 style="margin-bottom:16px;">${t("report_top_volunteers")}</h3>
          <div class="table-container">
            <table class="data-table">
              <thead><tr><th>#</th><th>${t("volunteer") || "Volunteer"}</th><th>${t("committee") || "Committee"}</th><th>${t("hours") || "Hours"}</th><th>${t("attendance_rate") || "Attendance"}</th></tr></thead>
              <tbody>
                ${stats.length === 0 ? `<tr><td colspan="5" style="text-align:center; color:var(--neutral-500);">${t("no_data") || "No data"}</td></tr>` : stats.map((r, i) => {
                  const c = committees.find(x => x.id === r.v.committee_id);
                  return `
                    <tr>
                      <td class="num-ltr">${i + 1}</td>
                      <td style="font-weight:700;">${escapeHtml(App.currentLang === 'ar' ? (r.v.full_name_ar || r.v.full_name) : r.v.full_name)}</td>
                      <td>${escapeHtml(c ? (App.currentLang === 'ar' ? c.name_ar : c.name_en) : "—")}</td>
                      <td class="num-ltr" style="font-weight:700; color:var(--success);">${r.hours} h</td>
                      <td class="num-ltr">${r.attendance}%</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    return `<div class="card"><p>${t("no_data") || "No data available."}</p></div>`;
  }

  function exportCurrentReportCSV(type) {
    const state = window.AtharStore.getState();
    const committees = scopedCommittees();
    const volunteers = scopedVolunteers();
    const hours = scopedHours();
    const meetings = scopedMeetings();

    if (type === "volunteers_comm") {
      const headers = ["Committee ID", "Committee Name (EN)", "Committee Name (AR)", "Volunteer Count"];
      const rows = committees.map(c => {
        const count = volunteers.filter(v => v.committee_id === c.id).length;
        return [c.id, c.name_en, c.name_ar, count];
      });
      window.ExportUtil.downloadCSV("Report_Volunteers_Per_Committee.csv", headers, rows);
    } else if (type === "attendance") {
      const headers = ["Meeting", "Date", "Present", "Late", "Absent", "Rate %"];
      const rows = meetings.filter(m => m.status === 'completed').map(m => {
        const s = m.attendance_summary || {};
        const p = s.present || 0, l = s.late || 0, ab = s.absent || 0, total = s.total || 0;
        const rate = total > 0 ? Math.round(((p + l) / total) * 100) : 0;
        return [App.currentLang === 'ar' ? m.title_ar : m.title_en, m.meeting_date, p, l, ab, rate];
      });
      window.ExportUtil.downloadCSV("Report_Attendance.csv", headers, rows);
    } else if (type === "hours") {
      const headers = ["Committee", "Approved Hours", "Pending Hours"];
      const rows = committees.map(c => {
        const appH = hours.filter(h => h.committee_id === c.id && h.status === 'approved').reduce((a, b) => a + Number(b.hours), 0);
        const pendH = hours.filter(h => h.committee_id === c.id && h.status === 'pending').reduce((a, b) => a + Number(b.hours), 0);
        return [App.currentLang === 'ar' ? c.name_ar : c.name_en, appH, pendH];
      });
      window.ExportUtil.downloadCSV("Report_Hours.csv", headers, rows);
    } else if (type === "evaluations") {
      const headers = ["Committee", "Evaluations", "Avg Score"];
      const rows = committees.map(c => {
        const scoped = (state.evaluations || []).filter(e => {
          const v = (state.volunteers || []).find(x => x.id === e.volunteer_id);
          return v && v.committee_id === c.id && (!isHoc() || v.committee_id === hocCid());
        });
        const avg = scoped.length ? (scoped.reduce((a, b) => a + Number(b.overall_score || b.score || 0), 0) / scoped.length).toFixed(1) : 0;
        return [App.currentLang === 'ar' ? c.name_ar : c.name_en, scoped.length, avg];
      });
      window.ExportUtil.downloadCSV("Report_Evaluations.csv", headers, rows);
    } else if (type === "certificates") {
      const headers = ["Committee", "Certificates"];
      const rows = committees.map(c => {
        const count = (state.certificates || []).filter(cert => {
          const v = (state.volunteers || []).find(x => x.id === cert.volunteer_id);
          return v && v.committee_id === c.id && (!isHoc() || v.committee_id === hocCid());
        }).length;
        return [App.currentLang === 'ar' ? c.name_ar : c.name_en, count];
      });
      window.ExportUtil.downloadCSV("Report_Certificates.csv", headers, rows);
    } else if (type === "top_volunteers") {
      const headers = ["Rank", "Volunteer", "Committee", "Hours", "Attendance %"];
      const rows = volunteers.map(v => {
        const s = window.AtharStore.getVolunteerStats(v.id);
        const c = committees.find(x => x.id === v.committee_id);
        return [v.id, App.currentLang === 'ar' ? (v.full_name_ar || v.full_name) : v.full_name, c ? (App.currentLang === 'ar' ? c.name_ar : c.name_en) : "", s ? (s.totalHours || 0) : 0, s ? (s.attendanceRate || 0) : 0];
      }).sort((a, b) => b[3] - a[3]).slice(0, 10);
      window.ExportUtil.downloadCSV("Report_Top_Volunteers.csv", headers, rows);
    } else {
      const headers = ["ID", "Name", "Approved Hours"];
      const rows = volunteers.map(v => {
        const s = window.AtharStore.getVolunteerStats(v.id);
        return [v.id, v.full_name, s ? s.totalHours : 0];
      });
      window.ExportUtil.downloadCSV("Report_Export.csv", headers, rows);
    }
    showToast("Report exported as CSV (with UTF-8 BOM)");
  }

  window.AtharViews.reports = (c, p) => renderReports(c);
})();
