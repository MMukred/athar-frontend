/**
 * View: Dashboard
 */
(function () {
  "use strict";

  const {
    App, t, formatDate, ic, showToast, navigateTo, escapeHtml
  } = window.AtharCore;

  // =========================================================
  // Committee leader dashboard — committee-scoped view
  // =========================================================
  function renderLeaderDashboard(container, committeeId) {
    const state = window.AtharStore.getState();
    const L = (ar, en) => (App.currentLang === "ar" ? ar : en);
    const hp = window.AtharCore.hasPermission;
    const userName = (App.currentUser && (App.currentUser.full_name || App.currentUser.fullName)) || "";

    const headerActions = `
      <div class="view-header-actions">
        <button class="btn btn-secondary btn-sm" id="btn-leader-refresh">
          ${ic("refresh", 14)} ${t("refresh")}
        </button>
        <button class="btn btn-secondary btn-sm" id="btn-leader-export">
          ${ic("download", 14)} ${t("export_csv")}
        </button>
      </div>`;
    const headerActionsRefreshOnly = `
      <div class="view-header-actions">
        <button class="btn btn-secondary btn-sm" id="btn-leader-refresh">
          ${ic("refresh", 14)} ${t("refresh")}
        </button>
      </div>`;

    if (!committeeId) {
      container.innerHTML = `
        <div class="view-header">
          <div class="view-header-left">
            <div class="breadcrumb-trail">
              <span class="breadcrumb-item">${t("app_name")}</span>
              <span class="breadcrumb-separator">/</span>
              <span>${L("لوحة رئيس اللجنة", "Committee leader dashboard")}</span>
            </div>
            <h1 class="view-title">${L("لوحة رئيس اللجنة", "Committee leader dashboard")}</h1>
            <p class="view-subtitle">${t("welcome_back")} ${escapeHtml(userName)}</p>
          </div>
          ${headerActionsRefreshOnly}
        </div>
        <div class="card" style="padding:40px 24px; text-align:center;">
          <div style="color:var(--warning); margin-bottom:12px;">${ic("alert", 42, { strokeWidth: 1.5 })}</div>
          <div style="font-weight:800; font-size:16px; margin-bottom:6px;">${L("لم يتم تعيين لجنة لحسابك", "No committee assigned to your account")}</div>
          <p style="color:var(--neutral-500); font-size:13px; max-width:520px; margin:0 auto;">
            ${L("اطلب من مدير النظام تعيين لجنتك من صفحة المستخدمين، ثم حدّث الصفحة.", "Ask a super admin to assign your committee from the Users page, then refresh.")}
          </p>
        </div>`;
      const refreshBtn = document.getElementById("btn-leader-refresh");
      if (refreshBtn) {
        refreshBtn.onclick = async () => {
          refreshBtn.disabled = true;
          try {
            await window.AtharAuth.checkSession();
            const fresh = window.AtharAuth.getCurrentUser();
            if (fresh) App.currentUser = fresh;
            await window.AtharStore.loadAll();
          } catch (e) { console.warn(e); }
          const freshCid = App.currentUser.committee_id
            || (App.currentUser.committee && App.currentUser.committee.id)
            || null;
          renderLeaderDashboard(container, freshCid);
        };
      }
      return;
    }

    const fallbackCommittee = App.currentUser && App.currentUser.committee ? App.currentUser.committee : null;
    const committee = state.committees.find(c => c.id === committeeId) || fallbackCommittee;
    const committeeName = committee
      ? (App.currentLang === "ar" ? (committee.name_ar || committee.nameAr) : (committee.name_en || committee.nameEn))
      : L("لجنتي", "My committee");
    const committeeDesc = committee
      ? (App.currentLang === "ar" ? (committee.description_ar || committee.descriptionAr) : (committee.description_en || committee.descriptionEn))
      : "";

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Defensive client-side scoping — the API already scopes leaders.
    const members = state.volunteers.filter(v =>
      v.status !== "archived" && v.committee_id === committeeId
    );
    const memberIds = new Set(members.map(v => v.id));
    const hours = state.volunteer_hours.filter(h => memberIds.has(h.volunteer_id));
    const approvedHours = hours.filter(h => h.status === "approved");
    const pendingHours = hours.filter(h => h.status === "pending");
    const evaluations = state.evaluations.filter(e => memberIds.has(e.volunteer_id));
    const meetings = state.meetings.filter(m => m.committee_id === committeeId);

    const totalApproved = approvedHours.reduce((sum, h) => sum + Number(h.hours || 0), 0);
    const hoursThisMonth = approvedHours
      .filter(h => h.date && new Date(h.date) >= monthStart)
      .reduce((sum, h) => sum + Number(h.hours || 0), 0);
    const newMembersThisMonth = members.filter(v => v.join_date && new Date(v.join_date) >= monthStart).length;
    const upcomingMeetings = meetings
      .filter(m => m.status === "scheduled" && m.meeting_date && String(m.meeting_date).slice(0, 10) >= todayStr)
      .sort((a, b) => String(a.meeting_date).localeCompare(String(b.meeting_date)));

    const hoursByMember = {};
    approvedHours.forEach(h => {
      hoursByMember[h.volunteer_id] = (hoursByMember[h.volunteer_id] || 0) + Number(h.hours || 0);
    });
    const evalCountByMember = {};
    evaluations.forEach(e => {
      evalCountByMember[e.volunteer_id] = (evalCountByMember[e.volunteer_id] || 0) + 1;
    });

    const activityMap = state.volunteer_activity || {};
    const lastActivityOf = (v) => {
      const a = activityMap[v.id];
      if (!a) return null;
      const dates = [a.lastHours, a.lastAttendance].filter(Boolean);
      return dates.length ? dates.slice().sort().pop() : null;
    };
    const daysSince = (v) => {
      const last = lastActivityOf(v);
      if (!last) return null;
      const ts = new Date(last).getTime();
      if (isNaN(ts)) return null;
      return Math.max(0, Math.floor((Date.now() - ts) / 86400000));
    };
    const lastActivityLabel = (v) => {
      const d = daysSince(v);
      if (d === null) return "—";
      if (d === 0) return L("اليوم", "Today");
      if (d === 1) return L("أمس", "Yesterday");
      return L(`قبل ${d} يوم`, `${d}d ago`);
    };

    const unratedIds = members.filter(v => !evalCountByMember[v.id]).map(v => v.id);
    const idleCount = state.activityLoaded
      ? members.filter(v => { const d = daysSince(v); return d !== null && d >= 30; }).length
      : 0;
    const ratedCount = members.length - unratedIds.length;
    const coverage = members.length ? Math.round((ratedCount / members.length) * 100) : 0;

    const memberName = (v) => (App.currentLang === "ar" ? (v.full_name_ar || v.full_name) : v.full_name) || "";
    const sortedMembers = members.slice().sort((a, b) => {
      const diff = (hoursByMember[b.id] || 0) - (hoursByMember[a.id] || 0);
      if (diff !== 0) return diff;
      return memberName(a).localeCompare(memberName(b), App.currentLang === "ar" ? "ar" : "en");
    });

    const statusBadge = (v) => {
      if (v.status === "active") return `<span class="badge badge-success">${L("نشط", "Active")}</span>`;
      if (v.status === "pending") return `<span class="badge badge-warning">${L("قيد الانتظار", "Pending")}</span>`;
      return `<span class="badge badge-neutral">${L("غير نشط", "Inactive")}</span>`;
    };

    // -------- Six-month hours trend (committee only) --------
    const monthLabels = [];
    const monthKeys = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      monthLabels.push(d.toLocaleDateString(App.currentLang === "ar" ? "ar" : "en", { month: "short" }));
    }
    const hoursByMonth = monthKeys.map(k =>
      approvedHours
        .filter(h => String(h.date || "").startsWith(k))
        .reduce((sum, h) => sum + Number(h.hours || 0), 0));
    const maxMonthHours = Math.max(...hoursByMonth, 1);
    const monthIdx = monthKeys.map((_, i) => i);
    if (App.currentLang === "ar") monthIdx.reverse();
    const barW = 34, gap = 22, chartH = 140, chartW = monthIdx.length * (barW + gap);
    const barsSvg = `
      <svg viewBox="0 0 ${chartW} ${chartH + 30}" width="100%" height="200" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${t("hours_trend")}">
        ${monthIdx.map((i, pos) => {
          const h = hoursByMonth[i];
          const barH = Math.round((h / maxMonthHours) * chartH);
          const x = pos * (barW + gap);
          const y = chartH - barH;
          return `
            <rect class="chart-bar" x="${x}" y="${y}" width="${barW}" height="${Math.max(barH, 2)}" rx="6" fill="var(--primary)" opacity="${h > 0 ? 0.9 : 0.15}"></rect>
            <text x="${x + barW / 2}" y="${y - 6}" text-anchor="middle" font-size="11" font-weight="700" fill="var(--neutral-600)">${h > 0 ? Math.round(h) : ""}</text>
            <text x="${x + barW / 2}" y="${chartH + 20}" text-anchor="middle" font-size="11" fill="var(--neutral-500)">${monthLabels[i]}</text>`;
        }).join("")}
      </svg>`;

    const hBarRow = (name, value, max, color, onClick) => {
      const pct = Math.max(4, Math.round((value / max) * 100));
      const safeName = escapeHtml(name);
      return `
        <div class="hbar-row" ${onClick ? `style="cursor:pointer;" onclick="${onClick}"` : ""}>
          <div class="hbar-label" title="${safeName}">${safeName}</div>
          <div class="hbar-track"><div class="hbar-fill" style="width:${pct}%; background:${color};"></div></div>
          <div class="hbar-value num-ltr">${Math.round(value)}</div>
        </div>`;
    };

    const topMembers = sortedMembers.filter(v => (hoursByMember[v.id] || 0) > 0).slice(0, 5);
    const maxTopHours = Math.max(...topMembers.map(v => hoursByMember[v.id] || 0), 1);

    const pendingList = pendingHours
      .slice()
      .sort((a, b) => String(b.date || b.created_at || "").localeCompare(String(a.date || a.created_at || "")))
      .slice(0, 5);
    const recentEvals = evaluations
      .slice()
      .sort((a, b) => String(b.evaluated_at || "").localeCompare(String(a.evaluated_at || "")))
      .slice(0, 5);

    // -------- Action center --------
    const actionItems = [];
    if (pendingHours.length > 0) {
      actionItems.push({
        icon: "clock", color: "var(--warning)", bg: "var(--warning-light)",
        count: pendingHours.length,
        label: L("اقتراحات ساعات بانتظار الموافقة", "Hours suggestions awaiting approval"),
        sub: L("يعتمدها مدير النظام", "Approved by a super admin"),
        onClick: "window.AtharApp.goHoursFilter('pending')",
      });
    }
    if (idleCount > 0) {
      actionItems.push({
        icon: "message_circle", color: "var(--primary)", bg: "var(--primary-light)",
        count: idleCount,
        label: L("أعضاء بلا نشاط 30+ يوم", "Members idle 30+ days"),
        sub: L("تواصل معهم", "Reach out"),
        onClick: "window.AtharApp.goVolunteersFilter('active', { followup: true })",
      });
    }
    if (unratedIds.length > 0) {
      actionItems.push({
        icon: "star", color: "var(--success)", bg: "var(--success-light)",
        count: unratedIds.length,
        label: L("أعضاء بلا تقييم", "Members not rated yet"),
        sub: L("ابدأ التقييم", "Start rating"),
        onClick: "window.AtharApp.navigateTo('evaluations')",
      });
    }

    const memberRows = sortedMembers.map(v => {
      const name = memberName(v);
      const searchBlob = [v.full_name, v.full_name_ar, v.email, v.phone, v.whatsapp]
        .filter(Boolean).join(" ").toLowerCase();
      const joined = v.join_date ? formatDate(String(v.join_date).slice(0, 10)) : "";
      return `
        <div class="leader-member-row" data-search="${escapeHtml(searchBlob)}">
          <div class="user-avatar" style="width:36px; height:36px; font-size:13px;">${escapeHtml(String(name).trim().charAt(0) || "?")}</div>
          <div class="leader-member-main">
            <div class="leader-member-name">${escapeHtml(name)}</div>
            <div class="leader-member-sub">
              ${statusBadge(v)}
              ${joined ? `<span>•</span><span>${L("انضم", "Joined")} ${joined}</span>` : ""}
            </div>
          </div>
          <div class="leader-member-metrics">
            <div class="leader-member-metric">
              <strong class="num-ltr">${(hoursByMember[v.id] || 0).toLocaleString()}</strong>
              <span>${L("ساعة", "hours")}</span>
            </div>
            <div class="leader-member-metric">
              <strong class="num-ltr">${evalCountByMember[v.id] || 0}</strong>
              <span>${L("تقييم", "ratings")}</span>
            </div>
            <div class="leader-member-metric">
              <strong>${lastActivityLabel(v)}</strong>
              <span>${L("آخر نشاط", "last activity")}</span>
            </div>
          </div>
          <div class="leader-member-actions">
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.AtharApp.navigateTo('volunteer-profile', {id:'${v.id}'})" title="${L("عرض الملف", "View profile")}">
              ${ic("eye", 14)}<span>${L("عرض", "View")}</span>
            </button>
            ${hp("volunteer_hours", "create") ? `
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.AtharModals.openLogHoursSlideover('${v.id}')" title="${L("اقتراح ساعات", "Suggest hours")}">
                ${ic("clock", 14)}<span>${L("ساعات", "Hours")}</span>
              </button>` : ""}
            ${hp("evaluations", "create") ? `
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.AtharApp.navigateTo('new-evaluation', {id:'${v.id}'})" title="${L("تقييم العضو", "Rate member")}">
                ${ic("star", 14)}<span>${L("تقييم", "Rate")}</span>
              </button>` : ""}
          </div>
        </div>`;
    }).join("");

    const pendingRows = pendingList.map(h => {
      const vol = members.find(v => v.id === h.volunteer_id);
      const name = vol ? memberName(vol) : L("متطوع", "Volunteer");
      const initial = String(name).trim().charAt(0) || "?";
      return `
        <div class="leader-pending-row">
          <div class="user-avatar" style="width:32px; height:32px; font-size:12px;">${escapeHtml(initial)}</div>
          <div class="leader-pending-main">
            <div class="leader-pending-title">${escapeHtml(name)} — ${escapeHtml(h.activity || "")}</div>
            <div class="leader-pending-sub">
              ${h.date ? formatDate(String(h.date).slice(0, 10)) : ""}
              ${h.description ? ` • ${escapeHtml(h.description)}` : ""}
            </div>
          </div>
          <div style="text-align:end; flex-shrink:0;">
            <div class="num-ltr" style="font-weight:800; color:var(--neutral-900);">${Number(h.hours)} h</div>
            <span class="badge badge-warning">${L("بانتظار الموافقة", "Pending approval")}</span>
          </div>
        </div>`;
    }).join("");

    const evalRows = recentEvals.map(ev => {
      const vol = members.find(v => v.id === ev.volunteer_id);
      const evaluator = state.users.find(u => u.id === ev.evaluator_id);
      return `
        <div class="leader-pending-row">
          <div class="leader-pending-main">
            <div class="leader-pending-title">${escapeHtml(vol ? memberName(vol) : L("متطوع", "Volunteer"))}</div>
            <div class="leader-pending-sub">
              <span class="badge badge-primary">${escapeHtml(ev.period_label || "")}</span>
              ${evaluator ? ` • ${escapeHtml(evaluator.full_name)}` : ""}
            </div>
          </div>
          <div style="text-align:end; flex-shrink:0;">
            <div class="num-ltr" style="font-weight:800; color:var(--warning);">${Number(ev.overall_score || 0).toFixed(1)} / 5</div>
            <div style="font-size:11px; color:var(--neutral-500);" class="num-ltr">${ev.evaluated_at ? formatDate(String(ev.evaluated_at).slice(0, 10)) : ""}</div>
          </div>
        </div>`;
    }).join("");

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <div class="breadcrumb-trail">
            <span class="breadcrumb-item">${t("app_name")}</span>
            <span class="breadcrumb-separator">/</span>
            <span>${L("لوحة رئيس اللجنة", "Committee leader dashboard")}</span>
          </div>
          <h1 class="view-title">${L("لوحة رئيس اللجنة", "Committee leader dashboard")}</h1>
          <p class="view-subtitle">${t("welcome_back")} ${escapeHtml(userName)} &bull; ${escapeHtml(committeeName)} &bull; ${now.toLocaleDateString(App.currentLang === "ar" ? "ar-SA" : "en-US")}</p>
        </div>
        ${headerActions}
      </div>

      <div class="leader-committee-banner">
        <div class="leader-committee-icon">${ic("building", 24, { strokeWidth: 2 })}</div>
        <div class="leader-committee-body">
          <div class="leader-committee-name">${escapeHtml(committeeName)}</div>
          ${committeeDesc ? `<div class="leader-committee-desc">${escapeHtml(committeeDesc)}</div>` : ""}
        </div>
        <div class="leader-committee-meta">
          <span class="badge badge-primary num-ltr">${members.length} ${L("عضو", "members")}</span>
          <span class="badge badge-success num-ltr">${totalApproved.toLocaleString()} h</span>
          <button type="button" class="btn btn-secondary btn-sm" id="leader-open-committee">${ic("building", 14)} ${L("صفحة اللجنة", "Committee page")}</button>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card kpi-volunteers" id="leader-kpi-members">
          <div class="kpi-header">
            <span class="kpi-title">${L("أعضاء اللجنة", "Committee members")}</span>
            <div class="kpi-icon-badge">${ic("users", 20, { strokeWidth: 2 })}</div>
          </div>
          <div class="kpi-value num-ltr" data-count-to="${members.length}">${members.length}</div>
          <div class="kpi-trend" style="color:var(--neutral-500);">${newMembersThisMonth > 0 ? `+${newMembersThisMonth} ${L("هذا الشهر", "this month")}` : L("لا إضافات هذا الشهر", "No new members this month")}</div>
        </div>

        <div class="kpi-card kpi-hours" id="leader-kpi-hours">
          <div class="kpi-header">
            <span class="kpi-title">${L("الساعات المعتمدة", "Approved hours")}</span>
            <div class="kpi-icon-badge">${ic("clock", 20, { strokeWidth: 2 })}</div>
          </div>
          <div class="kpi-value num-ltr">${totalApproved.toLocaleString()} h</div>
          <div class="kpi-trend">${ic("trending_up", 12)} +${hoursThisMonth.toLocaleString()} h ${L("هذا الشهر", "this month")}</div>
        </div>

        <div class="kpi-card kpi-certs" id="leader-kpi-pending">
          <div class="kpi-header">
            <span class="kpi-title">${L("اقتراحات بانتظار الموافقة", "Pending suggestions")}</span>
            <div class="kpi-icon-badge">${ic("clock", 20, { strokeWidth: 2 })}</div>
          </div>
          <div class="kpi-value num-ltr" data-count-to="${pendingHours.length}">${pendingHours.length}</div>
          <div class="kpi-trend" style="color:var(--neutral-500);">${L("يعتمدها مدير النظام", "Approved by a super admin")}</div>
        </div>

        <div class="kpi-card kpi-committees" id="leader-kpi-meetings">
          <div class="kpi-header">
            <span class="kpi-title">${L("الاجتماعات القادمة", "Upcoming meetings")}</span>
            <div class="kpi-icon-badge">${ic("calendar", 20, { strokeWidth: 2 })}</div>
          </div>
          <div class="kpi-value num-ltr" data-count-to="${upcomingMeetings.length}">${upcomingMeetings.length}</div>
          <div class="kpi-trend" style="color:var(--neutral-500);">${upcomingMeetings.length ? formatDate(String(upcomingMeetings[0].meeting_date).slice(0, 10)) : L("لا اجتماعات قادمة", "Nothing scheduled")}</div>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <div class="card-header">
          <div class="card-title">${ic("zap", 18)} ${L("إجراءات سريعة", "Quick actions")}</div>
        </div>
        <div class="quick-actions-grid">
          ${hp("volunteer_hours", "create") ? `
            <button type="button" class="quick-action-btn" onclick="window.AtharModals.openLogHoursSlideover()">
              ${ic("clock", 18)}<span>${L("اقتراح ساعات", "Suggest hours")}</span>
            </button>` : ""}
          ${hp("evaluations", "create") ? `
            <button type="button" class="quick-action-btn" onclick="window.AtharApp.navigateTo('new-evaluation')">
              ${ic("star", 18)}<span>${L("تقييم عضو", "Rate a member")}</span>
            </button>` : ""}
          ${hp("evaluations", "create") && unratedIds.length > 0 ? `
            <button type="button" class="quick-action-btn" id="leader-bulk-rate">
              ${ic("users", 18)}<span>${L("تقييم غير المقيّمين", "Rate unrated")} (${unratedIds.length})</span>
            </button>` : ""}
          <button type="button" class="quick-action-btn" onclick="window.AtharApp.navigateTo('volunteers')">
            ${ic("users", 18)}<span>${L("أعضاء اللجنة", "Committee members")}</span>
          </button>
          <button type="button" class="quick-action-btn" onclick="window.AtharApp.navigateTo('meetings')">
            ${ic("calendar", 18)}<span>${L("الاجتماعات", "Meetings")}</span>
          </button>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <div class="card-header">
          <div class="card-title">${ic("alert", 18)} ${L("بحاجة لإجراء", "Needs action")}</div>
        </div>
        ${actionItems.length === 0
          ? `<div class="empty-state" style="padding:20px 16px;"><div class="empty-state-desc">${L("لا توجد إجراءات مطلوبة حالياً", "Nothing needs your attention right now")}</div></div>`
          : `<div class="action-tiles-grid">
              ${actionItems.map(a => `
                <button type="button" class="action-tile" onclick="${a.onClick}" style="--tile-color:${a.color};">
                  <div class="action-tile-icon" style="color:${a.color}; background:${a.bg};">${ic(a.icon, 20)}</div>
                  <div class="action-tile-body">
                    <div class="action-tile-count num-ltr">${a.count}</div>
                    <div class="action-tile-label">${a.label}</div>
                    ${a.sub ? `<div class="action-tile-sub">${a.sub}</div>` : ""}
                  </div>
                  <span class="action-tile-arrow">${ic("chevron_right", 14)}</span>
                </button>`).join("")}
            </div>`}
      </div>

      <div class="card" style="margin-bottom:16px;">
        <div class="card-header" style="gap:12px; flex-wrap:wrap;">
          <div class="card-title">${ic("users", 18)} ${L("أعضاء اللجنة", "Committee members")} <span class="badge badge-neutral num-ltr">${members.length}</span></div>
          ${members.length > 0 ? `
            <div class="leader-member-toolbar">
              <input type="search" id="leader-member-search" class="form-control leader-member-search" placeholder="${L("ابحث بالاسم أو الجوال...", "Search by name or phone...")}">
              <button type="button" class="btn btn-secondary btn-sm" id="leader-members-view-all">${L("عرض الكل", "View all")}</button>
            </div>` : ""}
        </div>
        ${members.length === 0
          ? `<div class="empty-state" style="padding:32px 16px;">
               <div class="empty-state-icon">${ic("users", 36, { strokeWidth: 1.5 })}</div>
               <div class="empty-state-title">${L("لا يوجد أعضاء في لجنتك بعد", "No members in your committee yet")}</div>
               <div class="empty-state-desc">${L("سيظهر الأعضاء هنا بعد إضافتهم وتعيينهم للجنة.", "Members will appear here once they are added to your committee.")}</div>
             </div>`
          : `<div class="leader-member-list" id="leader-member-list">${memberRows}</div>
             <div class="leader-member-empty" id="leader-member-empty">${L("لا يوجد أعضاء مطابقون للبحث", "No members match your search")}</div>`}
      </div>

      <div class="charts-grid">
        <div class="card">
          <div class="card-header">
            <div class="card-title">${ic("clock", 18)} ${t("hours_trend")}</div>
          </div>
          ${totalApproved > 0 ? barsSvg : `<div class="empty-state" style="padding:24px 16px;"><div class="empty-state-desc">${L("لا ساعات معتمدة بعد", "No approved hours yet")}</div></div>`}
        </div>
        <div class="card">
          <div class="card-header">
            <div class="card-title">${ic("star", 18)} ${L("أكثر الأعضاء نشاطاً", "Most active members")}</div>
          </div>
          ${topMembers.length
            ? topMembers.map(v => hBarRow(memberName(v), hoursByMember[v.id] || 0, maxTopHours, "var(--success)", `window.AtharApp.navigateTo('volunteer-profile', {id:'${v.id}'})`)).join("")
            : `<div class="empty-state" style="padding:24px 16px;"><div class="empty-state-desc">${L("لا ساعات معتمدة بعد", "No approved hours yet")}</div></div>`}
        </div>
        <div class="card">
          <div class="card-header">
            <div class="card-title">${ic("award", 18)} ${L("تغطية التقييم", "Evaluation coverage")}</div>
          </div>
          <div style="padding:8px 4px;">
            <div class="leader-coverage-value num-ltr">${coverage}%</div>
            <div class="leader-progress"><div class="leader-progress-fill" style="width:${coverage}%;"></div></div>
            <div style="font-size:12px; color:var(--neutral-500);">${ratedCount} / ${members.length} ${L("عضو تم تقييمه", "members rated")}</div>
            ${unratedIds.length > 0 ? `<div style="font-size:12px; color:var(--warning); margin-top:6px;">${unratedIds.length} ${L("عضو بلا تقييم", "members not rated yet")}</div>` : ""}
          </div>
        </div>
      </div>

      <div class="dashboard-grid">
        <div class="card">
          <div class="card-header">
            <div class="card-title">${ic("clock", 18)} ${L("اقتراحات الساعات", "Hours suggestions")}</div>
            <button class="btn btn-secondary btn-sm" onclick="window.AtharApp.goHoursFilter('pending')">${L("عرض الكل", "View all")}</button>
          </div>
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${pendingList.length
              ? pendingRows
              : `<div class="empty-state" style="padding:24px 16px;">
                   <div class="empty-state-icon">${ic("check_circle", 36, { strokeWidth: 1.5 })}</div>
                   <div class="empty-state-title">${L("لا اقتراحات معلّقة", "No pending suggestions")}</div>
                 </div>`}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">${ic("calendar", 18)} ${t("upcoming_meetings")}</div>
            <button class="btn btn-secondary btn-sm" id="leader-goto-meetings">${t("view")}</button>
          </div>
          ${upcomingMeetings.length === 0
            ? `<div class="empty-state" style="padding:32px 16px;">
                 <div class="empty-state-icon">${ic("calendar", 36, { strokeWidth: 1.5 })}</div>
                 <div class="empty-state-title">${t("no_upcoming_meetings")}</div>
               </div>`
            : `<div style="display:flex; flex-direction:column; gap:12px;">
                 ${upcomingMeetings.slice(0, 4).map(m => `
                   <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; padding:12px; background:var(--neutral-50); border:1px solid var(--neutral-300); border-radius:var(--radius-md); cursor:pointer;" onclick="window.AtharApp.navigateTo('meeting-detail', {id:'${m.id}'})">
                     <div style="min-width:0;">
                       <div style="font-weight:700; color:var(--neutral-900); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(App.currentLang === "ar" ? (m.title_ar || m.title_en) : m.title_en)}</div>
                       <div style="font-size:12px; color:var(--neutral-500); margin-top:2px;">${escapeHtml(m.location || "")} &bull; ${m.start_time || ""} - ${m.end_time || ""}</div>
                     </div>
                     <span class="badge badge-primary num-ltr" style="flex-shrink:0;">${formatDate(String(m.meeting_date).slice(0, 10))}</span>
                   </div>`).join("")}
               </div>`}
        </div>
      </div>

      ${recentEvals.length ? `
        <div class="card" style="margin-bottom:20px;">
          <div class="card-header">
            <div class="card-title">${ic("star", 18)} ${L("أحدث التقييمات", "Recent evaluations")}</div>
            <button class="btn btn-secondary btn-sm" onclick="window.AtharApp.navigateTo('evaluations')">${L("عرض الكل", "View all")}</button>
          </div>
          <div style="display:flex; flex-direction:column; gap:8px;">${evalRows}</div>
        </div>` : ""}
    `;

    // -------- Handlers --------
    const refreshBtn = document.getElementById("btn-leader-refresh");
    if (refreshBtn) {
      refreshBtn.onclick = async () => {
        refreshBtn.disabled = true;
        try { await window.AtharStore.loadAll(); } catch (e) { console.warn(e); }
        showToast(t("refresh"), "success");
        renderLeaderDashboard(container, committeeId);
      };
    }

    const exportBtn = document.getElementById("btn-leader-export");
    if (exportBtn) {
      exportBtn.onclick = () => {
        const headers = ["Name", "Phone", "Status", "Approved Hours", "Evaluations", "Join Date"];
        const rows = sortedMembers.map(v => [
          v.full_name,
          v.phone || "",
          v.status,
          hoursByMember[v.id] || 0,
          evalCountByMember[v.id] || 0,
          v.join_date ? String(v.join_date).slice(0, 10) : "",
        ]);
        window.ExportUtil.downloadCSV("Athar_Committee_Members.csv", headers, rows);
        showToast(L("تم تصدير الملف", "CSV exported successfully"), "success");
      };
    }

    const searchInput = document.getElementById("leader-member-search");
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        const q = searchInput.value.trim().toLowerCase();
        let visible = 0;
        container.querySelectorAll(".leader-member-row").forEach(row => {
          const match = !q || (row.getAttribute("data-search") || "").includes(q);
          row.style.display = match ? "" : "none";
          if (match) visible++;
        });
        const empty = document.getElementById("leader-member-empty");
        if (empty) empty.classList.toggle("is-visible", visible === 0);
      });
    }

    const viewAllBtn = document.getElementById("leader-members-view-all");
    if (viewAllBtn) viewAllBtn.onclick = () => navigateTo("volunteers");

    const bulkBtn = document.getElementById("leader-bulk-rate");
    if (bulkBtn) {
      bulkBtn.onclick = () => {
        if (!unratedIds.length) return;
        window.AtharModals.openBulkRatingModal(unratedIds);
      };
    }

    const openCommitteeBtn = document.getElementById("leader-open-committee");
    if (openCommitteeBtn) openCommitteeBtn.onclick = () => navigateTo("committee-detail", { id: committeeId });

    const kpiMembers = document.getElementById("leader-kpi-members");
    if (kpiMembers) kpiMembers.onclick = () => navigateTo("volunteers");
    const kpiHours = document.getElementById("leader-kpi-hours");
    if (kpiHours) kpiHours.onclick = () => navigateTo("volunteer-hours");
    const kpiPending = document.getElementById("leader-kpi-pending");
    if (kpiPending) kpiPending.onclick = () => window.AtharApp.goHoursFilter("pending");
    const kpiMeetings = document.getElementById("leader-kpi-meetings");
    if (kpiMeetings) kpiMeetings.onclick = () => navigateTo("meetings");
    const gotoMeetings = document.getElementById("leader-goto-meetings");
    if (gotoMeetings) gotoMeetings.onclick = () => navigateTo("meetings");

    // Lazy-load activity for idle/coverage numbers.
    if (!state.activityLoaded && !App.__leaderActivityTried) {
      App.__leaderActivityTried = true;
      window.AtharStore.refreshActivity().then(() => {
        if (App.currentView === "dashboard") renderLeaderDashboard(container, committeeId);
      }).catch(() => {});
    }

    // KPI count-up (skipped when reduced motion is preferred).
    const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const counters = container.querySelectorAll("[data-count-to]");
    if (!reducedMotion && counters.length) {
      const duration = 700;
      const start = performance.now();
      const tick = (nowTs) => {
        const p = Math.min(1, (nowTs - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        counters.forEach(el => {
          const target = Number(el.getAttribute("data-count-to")) || 0;
          el.textContent = Math.round(target * eased).toLocaleString();
        });
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }

  function renderDashboard(container) {
    const state = window.AtharStore.getState();
    if (App.currentUser && App.currentUser.role === "committee_leader") {
      const cid = App.currentUser.committee_id
        || (App.currentUser.committee && App.currentUser.committee.id)
        || null;
      renderLeaderDashboard(container, cid);
      return;
    }
    const totalVolunteers = state.volunteers.filter(v => v.status !== "archived").length;
    const totalCommittees = state.committees.filter(c => c.status === "active").length;
    const totalHours = state.volunteer_hours.filter(h => h.status === "approved").reduce((acc, h) => acc + Number(h.hours), 0);
    const totalCerts = state.certificates.filter(c => c.status === "issued").length;

    const pendingHours = state.volunteer_hours.filter(h => h.status === "pending").length;
    const draftCerts = state.certificates.filter(c => c.status === "draft").length;
    const upcomingMeetings = state.meetings.filter(m => m.status === "scheduled").slice(0, 3);
    const recentAudit = state.audit_logs.slice(0, 5);

    // -------- Dynamic "this month" trends --------
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const newVolsThisMonth = state.volunteers.filter(v => {
      if (v.status === "archived" || !v.join_date) return false;
      const d = new Date(v.join_date);
      return !isNaN(d) && d >= monthStart;
    }).length;

    const hoursThisMonth = state.volunteer_hours
      .filter(h => h.status === "approved" && h.date)
      .filter(h => {
        const d = new Date(h.date);
        return !isNaN(d) && d >= monthStart;
      })
      .reduce((sum, h) => sum + Number(h.hours), 0);

    const certsThisMonth = state.certificates.filter(c => {
      if (c.status !== "issued" || !c.issue_date) return false;
      const d = new Date(c.issue_date);
      return !isNaN(d) && d >= monthStart;
    }).length;
    // -------- This week --------
    const newVolsThisWeek = state.volunteers.filter(v => {
      if (v.status === "archived" || !v.join_date) return false;
      const d = new Date(v.join_date);
      return !isNaN(d) && d >= weekStart;
    }).length;
    const hoursThisWeek = state.volunteer_hours
      .filter(h => h.status === "approved" && h.date)
      .filter(h => { const d = new Date(h.date); return !isNaN(d) && d >= weekStart; })
      .reduce((sum, h) => sum + Number(h.hours), 0);
    const meetingsThisWeek = state.meetings.filter(m => {
      if (!m.meeting_date) return false;
      const d = new Date(m.meeting_date);
      return !isNaN(d) && d >= weekStart && d <= now;
    }).length;
    // --------------------------------------------

    const volunteerHoursMap = {};
    state.volunteer_hours.filter(h => h.status === "approved").forEach(h => {
      volunteerHoursMap[h.volunteer_id] = (volunteerHoursMap[h.volunteer_id] || 0) + Number(h.hours);
    });

    const topVols = Object.keys(volunteerHoursMap)
      .map(vid => ({ vol: state.volunteers.find(v => v.id === vid), hours: volunteerHoursMap[vid] }))
      .filter(item => item.vol)
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 4);

    // Reusable trend renderer
    const trend = (count, unit) => {
      if (count > 0) {
        return `<div class="kpi-trend">${ic("trending_up", 12)} +${count}${unit} this month</div>`;
      }
      return `<div class="kpi-trend" style="color:var(--neutral-500);">0 this month</div>`;
    };

    // -------- Charts (pure SVG/CSS, no dependencies) --------
    const monthLabels = [];
    const monthKeys = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      monthLabels.push(d.toLocaleDateString(App.currentLang === "ar" ? "ar" : "en", { month: "short" }));
    }
    const hoursByMonth = monthKeys.map(k =>
      state.volunteer_hours
        .filter(h => h.status === "approved" && String(h.date || "").startsWith(k))
        .reduce((acc, h) => acc + Number(h.hours), 0));
    const maxMonthHours = Math.max(...hoursByMonth, 1);

    const monthIdx = monthKeys.map((_, i) => i);
    if (App.currentLang === "ar") monthIdx.reverse();
    const barW = 34, gap = 22, chartH = 140, chartW = monthIdx.length * (barW + gap);
    const barsSvg = `
      <svg viewBox="0 0 ${chartW} ${chartH + 30}" width="100%" height="200" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${t("hours_trend")}">
        ${monthIdx.map((i, pos) => {
      const h = hoursByMonth[i];
      const barH = Math.round((h / maxMonthHours) * chartH);
      const x = pos * (barW + gap);
      const y = chartH - barH;
      return `
            <rect class="chart-bar" x="${x}" y="${y}" width="${barW}" height="${Math.max(barH, 2)}" rx="6" fill="var(--primary)" opacity="${h > 0 ? 0.9 : 0.15}" style="cursor:pointer;" onclick="window.AtharCore.App.hoursDateFrom='${monthKeys[i]}-01'; window.AtharCore.App.hoursDateTo='${monthKeys[i].slice(0,4)}-${monthKeys[i].slice(5,7)}-'+new Date(${monthKeys[i].slice(0,4)}, ${parseInt(monthKeys[i].slice(5,7))}, 0).getDate(); window.AtharCore.App.hoursFilterStatus='all'; window.AtharCore.navigateTo('volunteer-hours')"></rect>
            <text x="${x + barW / 2}" y="${y - 6}" text-anchor="middle" font-size="11" font-weight="700" fill="var(--neutral-600)">${h > 0 ? Math.round(h) : ""}</text>
            <text x="${x + barW / 2}" y="${chartH + 20}" text-anchor="middle" font-size="11" fill="var(--neutral-500)">${monthLabels[i]}</text>
          `;
    }).join("")}
      </svg>
    `;

    const commCounts = state.committees
      .filter(c => c.status === "active")
      .map(c => ({
        id: c.id,
        name: App.currentLang === "ar" ? c.name_ar : c.name_en,
        count: state.volunteers.filter(v => v.committee_id === c.id && v.status !== "archived").length,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
    const maxCommCount = Math.max(...commCounts.map(c => c.count), 1);

    const topVolunteers = state.volunteers
      .filter(v => v.status !== "archived")
      .map(v => ({
        id: v.id,
        name: App.currentLang === "ar" ? (v.full_name_ar || v.full_name) : v.full_name,
        hours: state.volunteer_hours
          .filter(h => h.volunteer_id === v.id && h.status === "approved")
          .reduce((acc, h) => acc + Number(h.hours), 0),
      }))
      .filter(v => v.hours > 0)
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5);
    const maxTopHours = Math.max(...topVolunteers.map(v => v.hours), 1);

const certTarget = Number(state.settings.certificate_ready_hours) || 50;
    const hasActiveCert = (v) => state.certificates.some(c => c.volunteer_id === v.id && (c.status === "issued" || c.status === "approved"));
    const approvedHoursOf = (v) => { const s = window.AtharStore.getVolunteerStats(v.id); return s ? (s.totalHours || 0) : 0; };
    const isCertReady = (v) => approvedHoursOf(v) >= certTarget && !hasActiveCert(v);

    const pendingVols = state.volunteers.filter(v => v.status === "pending").length;

    const FOLLOWUP_DAYS = 30, DAY_MS = 86400000;
    const activityMap = state.volunteer_activity || {};
    const lastActivityDate = (v) => { const a = activityMap[v.id]; if (!a) return null; const ds = [a.lastHours, a.lastAttendance].filter(Boolean); if (!ds.length) return null; return ds.slice().sort().pop(); };
    const lastActivityTs = (v) => { const d = lastActivityDate(v); if (!d) return null; const ts = new Date(d).getTime(); return isNaN(ts) ? null : ts; };
    const idleDaysOf = (v) => { const last = Math.max(lastActivityTs(v) || 0, v.join_date ? new Date(v.join_date).getTime() : 0); if (!last) return null; return Math.floor((Date.now() - last) / DAY_MS); };
    const isIdle = (v) => { if (!state.activityLoaded) return false; const d = idleDaysOf(v); return d !== null && d >= FOLLOWUP_DAYS; };
    const followupCount = state.volunteers.filter(v => v.status === "active" && isIdle(v)).length;
    const readyCount = state.volunteers.filter(v => v.status !== "archived" && isCertReady(v)).length;

    // Needs-attention counts
    const idleVols = state.volunteers.filter(v => v.status === "active" && isIdle(v)).length;
    const unassignedVols = state.volunteers.filter(v => v.status !== "archived" && !v.committee_id).length;
    const emptyComms = state.committees.filter(c => c.status === "active" && state.volunteers.filter(v => v.committee_id === c.id && v.status !== "archived").length === 0).length;

    let dupCount = 0;
    try {
      const groups = (window.AtharVolunteers && window.AtharVolunteers.buildDuplicateGroups)
        ? window.AtharVolunteers.buildDuplicateGroups(state.volunteers.filter(v => v.status !== "archived"))
        : [];
      const dupMembers = new Set();
      groups.forEach(g => g.members.forEach(m => { if (m.status !== "archived") dupMembers.add(m.id); }));
      dupCount = dupMembers.size;
    } catch (e) { dupCount = 0; }

    const nowMs = Date.now();
    const dayMs = 86400000;
    const oldestPendingHoursDays = (() => {
      const pendings = state.volunteer_hours.filter(h => h.status === "pending");
      if (!pendings.length) return 0;
      const oldest = Math.min(...pendings.map(h => new Date(h.date || h.created_at || nowMs).getTime()));
      return Math.max(0, Math.floor((nowMs - oldest) / dayMs));
    })();
    const oldestPendingVolDays = (() => {
      const pendings = state.volunteers.filter(v => v.status === "pending" && v.join_date);
      if (!pendings.length) return 0;
      const oldest = Math.min(...pendings.map(v => new Date(v.join_date).getTime()));
      return Math.max(0, Math.floor((nowMs - oldest) / dayMs));
    })();

    const actionItems = [];
    const hp = window.AtharCore.hasPermission;
    if (pendingVols > 0 && (hp("volunteers", "approve") || hp("volunteers", "edit"))) actionItems.push({ key: "pendingVols", icon: "users", color: "var(--warning)", bg: "var(--warning-light)", count: pendingVols, label: t("dash_pending_vols"), sub: oldestPendingVolDays > 0 ? (App.currentLang === "ar" ? `أقدمها منذ ${oldestPendingVolDays} يوم` : `oldest ${oldestPendingVolDays}d`) : "", onClick: "window.AtharApp.goVolunteersFilter('pending', {})" });
    if (pendingHours > 0 && hp("volunteer_hours", "approve")) actionItems.push({ key: "pendingHours", icon: "clock", color: "var(--info)", bg: "var(--info-light)", count: pendingHours, label: t("dash_pending_hours"), sub: oldestPendingHoursDays > 0 ? (App.currentLang === "ar" ? `أقدمها منذ ${oldestPendingHoursDays} يوم` : `oldest ${oldestPendingHoursDays}d`) : "", onClick: "window.AtharApp.goHoursFilter('pending')" });
    if (followupCount > 0 && hp("volunteers", "view")) actionItems.push({ key: "followup", icon: "message_circle", color: "var(--primary)", bg: "var(--primary-light)", count: followupCount, label: t("dash_needs_followup"), sub: "", onClick: "window.AtharApp.goVolunteersFilter('active', { followup: true })" });
    if (readyCount > 0 && (hp("certificates", "create") || hp("volunteers", "view"))) actionItems.push({ key: "ready", icon: "award", color: "var(--success)", bg: "var(--success-light)", count: readyCount, label: t("dash_ready_certs"), sub: "", onClick: "window.AtharApp.goVolunteersFilter('all', { ready: true })" });
    if (dupCount > 0 && (hp("volunteers", "edit") || hp("volunteers", "delete"))) actionItems.push({ key: "dup", icon: "alert", color: "var(--warning)", bg: "var(--warning-light)", count: dupCount, label: t("dash_possible_dupes"), sub: "", onClick: "window.AtharApp.goVolunteersFilter('all', { dup: true })" });

    const hBarRow = (name, value, max, color, onClick) => {
      const pct = Math.max(4, Math.round((value / max) * 100));
      const safeName = String(name || "").replace(/[<>&"]/g, "");
      return `
        <div class="hbar-row" ${onClick ? `style="cursor:pointer;" onclick="${onClick}"` : ""}>
          <div class="hbar-label" title="${safeName}">${safeName}</div>
          <div class="hbar-track"><div class="hbar-fill" style="width:${pct}%; background:${color};"></div></div>
          <div class="hbar-value num-ltr">${Math.round(value)}</div>
        </div>`;
    };

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <div class="breadcrumb-trail">
            <span class="breadcrumb-item">${t("app_name")}</span>
            <span class="breadcrumb-separator">/</span>
            <span>${t("nav_dashboard")}</span>
          </div>
          <h1 class="view-title">${t("nav_dashboard")}</h1>
          <p class="view-subtitle">${t("welcome_back")} ${(App.currentUser && (App.currentUser.full_name || App.currentUser.fullName)) || ''}${App.currentUser && App.currentUser.role === "committee_leader" && App.currentUser.committee_id ? ' &bull; ' + (state.committees.find(c => c.id === App.currentUser.committee_id) ? (App.currentLang === 'ar' ? state.committees.find(c => c.id === App.currentUser.committee_id).name_ar : state.committees.find(c => c.id === App.currentUser.committee_id).name_en) : '') : ''} &bull; ${new Date().toLocaleDateString(App.currentLang === 'ar' ? 'ar-SA' : 'en-US')}</p>
        </div>
        <div class="view-header-actions">
          <button class="btn btn-secondary btn-sm" id="btn-dash-refresh">
            ${ic("refresh", 14)} ${t("refresh")}
          </button>
          <button class="btn btn-secondary btn-sm" id="btn-dash-export">
            ${ic("download", 14)} ${t("export_csv")}
          </button>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card kpi-volunteers" id="kpi-card-vols">
          <div class="kpi-header">
            <span class="kpi-title">${t("kpi_volunteers")}</span>
            <div class="kpi-icon-badge">${ic("users", 20, { strokeWidth: 2 })}</div>
          </div>
          <div class="kpi-value num-ltr" data-count-to="${totalVolunteers}">${totalVolunteers}</div>
          ${trend(newVolsThisMonth, "")}
        </div>

        <div class="kpi-card kpi-committees" id="kpi-card-comms">
          <div class="kpi-header">
            <span class="kpi-title">${t("kpi_committees")}</span>
            <div class="kpi-icon-badge">${ic("building", 20, { strokeWidth: 2 })}</div>
          </div>
          <div class="kpi-value num-ltr" data-count-to="${totalCommittees}">${totalCommittees}</div>
          <div class="kpi-trend" style="color:var(--neutral-500);">${totalCommittees === 1 ? '1 active unit' : `${totalCommittees} active units`}</div>
        </div>

        <div class="kpi-card kpi-hours" id="kpi-card-hours">
          <div class="kpi-header">
            <span class="kpi-title">${t("kpi_total_hours")}</span>
            <div class="kpi-icon-badge">${ic("clock", 20, { strokeWidth: 2 })}</div>
          </div>
          <div class="kpi-value num-ltr" data-count-to="${totalHours}" data-count-suffix=" h">${totalHours.toLocaleString()} h</div>
          ${trend(hoursThisMonth, " h")}
        </div>

        <div class="kpi-card kpi-certs" id="kpi-card-certs">
          <div class="kpi-header">
            <span class="kpi-title">${t("kpi_certificates")}</span>
            <div class="kpi-icon-badge">${ic("award", 20, { strokeWidth: 2 })}</div>
          </div>
          <div class="kpi-value num-ltr" data-count-to="${totalCerts}">${totalCerts}</div>
          ${trend(certsThisMonth, "")}
        </div>
      </div>

      <!-- This week summary -->
      <div class="card" style="margin-bottom:16px; padding:12px 16px;">
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; font-size:13px;">
          <span style="font-weight:700; color:var(--neutral-900);">${App.currentLang === "ar" ? "هذا الأسبوع" : "This week"}:</span>
          <span class="num-ltr">${newVolsThisWeek} ${App.currentLang === "ar" ? "متطوع جديد" : "new volunteers"}</span>
          <span style="color:var(--neutral-400);">•</span>
          <span class="num-ltr">${hoursThisWeek} ${App.currentLang === "ar" ? "ساعة معتمدة" : "approved hours"}</span>
          <span style="color:var(--neutral-400);">•</span>
          <span class="num-ltr">${meetingsThisWeek} ${App.currentLang === "ar" ? "اجتماع" : "meetings"}</span>
          <span style="color:var(--neutral-400);">•</span>
          <span class="num-ltr">${state.evaluations.length} ${App.currentLang === "ar" ? "تقييم" : "evaluations"}</span>
        </div>
      </div>

      <!-- Quick actions -->
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header">
          <div class="card-title">${ic("zap", 18)} ${App.currentLang === "ar" ? "إجراءات سريعة" : "Quick actions"}</div>
        </div>
        <div class="quick-actions-grid">
          ${hp("volunteers", "create") ? `<button type="button" class="quick-action-btn" onclick="window.AtharModals.openAddVolunteerSlideover()">${ic("users", 18)}<span>${t("quick_add_volunteer")}</span></button>` : ''}
          ${hp("volunteer_hours", "create") ? `<button type="button" class="quick-action-btn" onclick="window.AtharModals.openLogHoursSlideover()">${ic("clock", 18)}<span>${t("quick_add_hours")}</span></button>` : ''}
          ${hp("meetings", "create") ? `<button type="button" class="quick-action-btn" onclick="window.AtharModals.openCreateMeetingSlideover()">${ic("calendar", 18)}<span>${t("quick_add_meeting")}</span></button>` : ''}
          ${hp("certificates", "create") ? `<button type="button" class="quick-action-btn" onclick="window.AtharCore.navigateTo('generate-certificate')">${ic("award", 18)}<span>${t("generate_certificate")}</span></button>` : ''}
        </div>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <div class="card-header">
          <div class="card-title">${ic("alert", 18)} ${t("dash_action_title")}</div>
        </div>
        ${actionItems.length === 0
          ? `<div class="empty-state" style="padding:20px 16px;"><div class="empty-state-desc">${t("dash_no_actions")}</div></div>`
          : `<div class="action-tiles-grid">
              ${actionItems.map(a => `
                <button type="button" class="action-tile" onclick="${a.onClick}" style="--tile-color:${a.color};">
                  <div class="action-tile-icon" style="color:${a.color}; background:${a.bg};">${ic(a.icon, 20)}</div>
                  <div class="action-tile-body">
                    <div class="action-tile-count num-ltr">${a.count}</div>
                    <div class="action-tile-label">${a.label}</div>
                    ${a.sub ? `<div class="action-tile-sub">${a.sub}</div>` : ""}
                  </div>
                  <span class="action-tile-arrow">${ic("chevron_right", 14)}</span>
                </button>
              `).join("")}
            </div>`}
      </div>

      <div class="charts-grid">
        <div class="card">
          <div class="card-header">
            <div class="card-title">${ic("clock", 18)} ${t("hours_trend")}</div>
          </div>
          ${totalHours > 0 ? barsSvg : `<div class="empty-state" style="padding:24px 16px;"><div class="empty-state-desc">—</div></div>`}
        </div>
        <div class="card">
          <div class="card-header">
            <div class="card-title">${ic("building", 18)} ${t("committee_distribution")}</div>
          </div>
          ${commCounts.length
        ? commCounts.map(c => hBarRow(c.name, c.count, maxCommCount, "var(--primary)", `window.AtharApp.goVolunteersFilter('all', { comm: '${c.id}' })`)).join("")
        : `<div class="empty-state" style="padding:24px 16px;"><div class="empty-state-desc">—</div></div>`}
        </div>
        <div class="card">
          <div class="card-header">
            <div class="card-title">${ic("star", 18)} ${t("top_volunteers")}</div>
          </div>
          ${topVolunteers.length
        ? topVolunteers.map(v => hBarRow(v.name, v.hours, maxTopHours, "#F59E0B", `window.AtharApp.navigateTo('volunteer-profile', {id:'${v.id}'})`)).join("")
        : `<div class="empty-state" style="padding:24px 16px;"><div class="empty-state-desc">—</div></div>`}
        </div>
      </div>

      <!-- Needs attention + Committee health -->
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header">
          <div class="card-title">${ic("alert", 18)} ${App.currentLang === "ar" ? "بحاجة لاهتمام" : "Needs attention"}</div>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${idleVols > 0 ? `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:var(--warning-light); border:1px solid var(--warning-border); border-radius:var(--radius-md); cursor:pointer;" onclick="window.AtharApp.goVolunteersFilter('active', { followup: true })">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="color:var(--warning);">${ic("message_circle", 18)}</span>
              <span style="font-weight:600; color:var(--neutral-900); font-size:13px;">${idleVols} ${App.currentLang === "ar" ? "متطوع بلا نشاط 30+ يوم" : "volunteers idle 30+ days"}</span>
            </div>
            <span class="btn btn-secondary btn-sm">${t("view")}</span>
          </div>
          ` : ''}
          ${unassignedVols > 0 ? `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:var(--neutral-100); border:1px solid var(--neutral-300); border-radius:var(--radius-md); cursor:pointer;" onclick="window.AtharApp.goVolunteersFilter('all', {})">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="color:var(--neutral-500);">${ic("building", 18)}</span>
              <span style="font-weight:600; color:var(--neutral-900); font-size:13px;">${unassignedVols} ${App.currentLang === "ar" ? "متطوع بدون لجنة" : "volunteers without committee"}</span>
            </div>
            <span class="btn btn-secondary btn-sm">${t("view")}</span>
          </div>
          ` : ''}
          ${pendingVols > 0 ? `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:var(--warning-light); border:1px solid var(--warning-border); border-radius:var(--radius-md); cursor:pointer;" onclick="window.AtharApp.goVolunteersFilter('pending', {})">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="color:var(--warning);">${ic("users", 18)}</span>
              <span style="font-weight:600; color:var(--neutral-900); font-size:13px;">${pendingVols} ${t("dash_pending_vols")}</span>
            </div>
            <span class="btn btn-secondary btn-sm">${t("view")}</span>
          </div>
          ` : ''}
          ${idleVols === 0 && unassignedVols === 0 && pendingVols === 0 ? `
          <div class="empty-state" style="padding:20px 16px;">
            <div class="empty-state-icon">${ic("check_circle", 32, { strokeWidth: 1.5 })}</div>
            <div class="empty-state-title">${t("dash_no_actions")}</div>
          </div>
          ` : ''}
        </div>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <div class="card-header">
          <div class="card-title">${ic("building", 18)} ${App.currentLang === "ar" ? "صحة اللجان" : "Committee health"}</div>
        </div>
        ${emptyComms > 0 ? `
        <div style="padding:10px 12px; background:var(--warning-light); border:1px solid var(--warning-border); border-radius:var(--radius-md); margin-bottom:10px;">
          <div style="font-weight:600; color:var(--neutral-900); font-size:13px; margin-bottom:6px;">${emptyComms} ${App.currentLang === "ar" ? "لجنة بدون أعضاء" : "committees with no members"}</div>
          <div style="display:flex; flex-wrap:wrap; gap:6px;">
            ${state.committees.filter(c => c.status === 'active' && state.volunteers.filter(v => v.committee_id === c.id && v.status !== 'archived').length === 0).map(c => `
              <span class="mini-chip" style="background:var(--warning-light); color:var(--warning-strong);">${App.currentLang === 'ar' ? c.name_ar : c.name_en}</span>
            `).join('')}
          </div>
        </div>
        ` : ''}
        <div style="display:flex; flex-direction:column; gap:6px;">
          ${state.committees.filter(c => c.status === 'active').sort((a,b) => state.volunteers.filter(v => v.committee_id === b.id && v.status !== 'archived').length - state.volunteers.filter(v => v.committee_id === a.id && v.status !== 'archived').length).slice(0, 6).map(c => {
            const cnt = state.volunteers.filter(v => v.committee_id === c.id && v.status !== 'archived').length;
            const pct = totalVolunteers > 0 ? Math.round((cnt / totalVolunteers) * 100) : 0;
            return `
            <div style="display:flex; align-items:center; gap:8px; cursor:pointer;" onclick="window.AtharApp.goVolunteersFilter('all', { comm: '${c.id}' })">
              <span style="font-size:12px; font-weight:600; color:var(--neutral-900); min-width:100px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${App.currentLang === 'ar' ? c.name_ar : c.name_en}</span>
              <div style="flex:1; height:6px; background:var(--neutral-200); border-radius:9999px; overflow:hidden;">
                <div style="width:${pct}%; height:100%; background:var(--primary); border-radius:9999px;"></div>
              </div>
              <span class="num-ltr" style="font-size:11px; color:var(--neutral-500); min-width:32px; text-align:end;">${cnt}</span>
            </div>
            `;
          }).join('')}
        </div>
      </div>

      <div class="dashboard-grid">
        <div class="card">
          <div class="card-header">
            <div class="card-title">${ic("calendar", 18)} ${t("upcoming_meetings")}</div>
            <button class="btn btn-secondary btn-sm" id="btn-goto-meetings">${t("view")}</button>
          </div>
  ${upcomingMeetings.length === 0 ? `
            <div class="empty-state" style="padding:32px 16px;">
              <div class="empty-state-icon">${ic("calendar", 36, { strokeWidth: 1.5 })}</div>
              <div class="empty-state-title">${t("no_upcoming_meetings")}</div>
            </div>
          ` : `            <div style="display:flex; flex-direction:column; gap:12px;">
              ${upcomingMeetings.map(m => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:var(--neutral-50); border:1px solid var(--neutral-300); border-radius:var(--radius-md); cursor:pointer;" onclick="window.AtharApp.navigateTo('meeting-detail', {id:'${m.id}'})">
                  <div>
                    <div style="font-weight:700; color:var(--neutral-900);">${App.currentLang === 'ar' ? m.title_ar : m.title_en}</div>
                    <div style="font-size:12px; color:var(--neutral-500); margin-top:2px;">${m.location} &bull; ${m.start_time} - ${m.end_time}</div>
                  </div>
                  <div style="text-align:right;">
                    <span class="badge badge-primary">${formatDate(m.meeting_date)}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">${ic("clock", 18)} ${t("pending_approvals")}</div>
          </div>
          <div style="display:flex; flex-direction:column; gap:10px;">
            ${pendingVols > 0 ? `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:14px; background:var(--warning-light); border:1px solid var(--warning-border); border-radius:var(--radius-md); cursor:pointer;" onclick="window.AtharApp.goVolunteersFilter('pending', {})">
              <div style="display:flex; align-items:center; gap:10px;">
                <span style="color:var(--warning);">${ic("users", 20)}</span>
                <span style="font-weight:600; color:var(--neutral-900);">${pendingVols} ${t("dash_pending_vols")}</span>
              </div>
              <span class="btn btn-secondary btn-sm">${t("view")}</span>
            </div>
            ` : ''}
            ${pendingHours > 0 ? `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:14px; background:var(--warning-light); border:1px solid var(--warning-border); border-radius:var(--radius-md); cursor:pointer;" onclick="window.AtharApp.goHoursFilter('pending')">
              <div style="display:flex; align-items:center; gap:10px;">
                <span style="color:var(--warning);">${ic("clock", 20)}</span>
                <span style="font-weight:600; color:var(--neutral-900);">${pendingHours} ${t("hours_awaiting_approval")}</span>
              </div>
              <span class="btn btn-secondary btn-sm">${t("view")}</span>
            </div>
            ` : ''}
            ${draftCerts > 0 ? `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:14px; background:var(--primary-light); border:1px solid var(--primary-border); border-radius:var(--radius-md); cursor:pointer;" onclick="window.AtharCore.navigateTo('certificates')">
              <div style="display:flex; align-items:center; gap:10px;">
                <span style="color:var(--primary);">${ic("award", 20)}</span>
                <span style="font-weight:600; color:var(--neutral-900);">${draftCerts} ${t("certs_in_draft")}</span>
              </div>
              <span class="btn btn-secondary btn-sm">${t("view")}</span>
            </div>
            ` : ''}
            ${pendingVols === 0 && pendingHours === 0 && draftCerts === 0 ? `
            <div class="empty-state" style="padding:24px 16px;">
              <div class="empty-state-icon">${ic("check_circle", 36, { strokeWidth: 1.5 })}</div>
              <div class="empty-state-title">${t("dash_no_actions")}</div>
            </div>
            ` : ''}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">${ic("building", 18)} ${t("volunteers_per_committee")}</div>
          </div>
          <div style="display:flex; flex-direction:column; gap:16px;">
    ${state.committees.length === 0
        ? `<div class="empty-state" style="padding:32px 16px;">
             <div class="empty-state-icon">${ic("building", 36, { strokeWidth: 1.5 })}</div>
             <div class="empty-state-title">No committees yet</div>
           </div>`
        : state.committees.map(c => {
          const count = state.volunteers.filter(v => v.committee_id === c.id && v.status !== "archived").length;
          const percent = totalVolunteers > 0 ? Math.min(100, Math.round((count / totalVolunteers) * 100)) : 0;
          return `
                  <div>
                    <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:600; margin-bottom:6px;">
                      <span>${App.currentLang === 'ar' ? c.name_ar : c.name_en}</span>
                      <span class="num-ltr">${count} vols (${percent}%)</span>
                    </div>
                    <div style="height:10px; background:var(--neutral-200); border-radius:var(--radius-full); overflow:hidden;">
                      <div style="width:${percent}%; height:100%; background:linear-gradient(90deg, var(--primary), #8A3FFC); border-radius:var(--radius-full);"></div>
                    </div>
                  </div>
                `;
        }).join('')
      }
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">${ic("award", 18)} ${t("top_active_volunteers")}</div>
          </div>
          <div style="display:flex; flex-direction:column; gap:10px;">
                       ${topVols.length === 0
        ? `<div class="empty-state" style="padding:32px 16px;">
             <div class="empty-state-icon">${ic("award", 36, { strokeWidth: 1.5 })}</div>
             <div class="empty-state-title">No approved hours yet</div>
           </div>`
        : topVols.map((item, idx) => `
                <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:var(--neutral-50); border:1px solid var(--neutral-300); border-radius:var(--radius-md); cursor:pointer;" onclick="window.AtharApp.navigateTo('volunteer-profile', {id:'${item.vol.id}'})">
                  <div style="display:flex; align-items:center; gap:12px;">
                    <span style="font-weight:800; font-size:14px; color:${idx === 0 ? '#F59E0B' : idx === 1 ? '#94A3B8' : '#B45309'};">#${idx + 1}</span>
                    <div class="user-avatar" style="width:28px; height:28px; font-size:11px;">${item.vol.full_name.charAt(0)}</div>
                    <div>
                      <div style="font-weight:700; color:var(--neutral-900); font-size:13px;">${App.currentLang === 'ar' ? (item.vol.full_name_ar || item.vol.full_name) : item.vol.full_name}</div>
                      <div style="font-size:11px; color:var(--neutral-500);">${item.vol.skills ? item.vol.skills.slice(0, 2).join(', ') : ''}</div>
                    </div>
                  </div>
                  <div style="font-weight:800; color:var(--success); font-size:14px;" class="num-ltr">${item.hours} h</div>
                </div>
              `).join('')
      }
          </div>
        </div>

        <div class="card dashboard-widget-full">
          <div class="card-header">
            <div class="card-title">${ic("activity", 18)} ${t("recent_activity")}</div>
            <button class="btn btn-secondary btn-sm" onclick="window.AtharApp.navigateTo('audit-logs')">${t("view")}</button>
          </div>
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${recentAudit.length === 0
        ? `<p style="color:var(--neutral-500); font-size:13px; padding:12px 0;">No activity recorded yet.</p>`
        : recentAudit.map(al => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; border-bottom:1px solid var(--neutral-200); font-size:13px; gap:10px;">
                  <div style="display:flex; align-items:center; gap:10px; min-width:0;">
                    <span style="color:${al.action === 'create' ? 'var(--success)' : al.action === 'approve' || al.action === 'issue' ? 'var(--primary)' : al.action === 'revoke' || al.action === 'delete' || al.action === 'archive' ? 'var(--danger)' : 'var(--neutral-500)'}; flex-shrink:0;">${ic(al.action === 'create' ? 'plus' : al.action === 'approve' || al.action === 'issue' ? 'check_circle' : al.action === 'revoke' || al.action === 'delete' ? 'trash' : al.action === 'archive' ? 'archive' : 'activity', 16)}</span>
                    <span class="badge ${al.action === 'create' ? 'badge-success' : al.action === 'approve' || al.action === 'issue' ? 'badge-primary' : al.action === 'revoke' || al.action === 'delete' || al.action === 'archive' ? 'badge-danger' : 'badge-neutral'}">${al.action}</span>
                    <span style="font-weight:600; color:var(--neutral-900); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${al.details}</span>
                  </div>
                  <div style="font-size:11px; color:var(--neutral-500); flex-shrink:0;" class="num-ltr">
                    ${al.user_name} &bull; ${al.created_at}
                  </div>
                </div>
              `).join('')
      }
          </div>
        </div>
      </div>
    `;

    document.getElementById("btn-dash-refresh").onclick = async () => {
      try { await window.AtharStore.loadAll(); } catch (e) { console.warn(e); }
      showToast(t("refresh"), "success");
      renderDashboard(container);
    };

    document.getElementById("btn-dash-export").onclick = () => {
      const headers = ["ID", "Name", "Committee", "Status", "Total Hours"];
      const rows = state.volunteers.map(v => {
        const comm = state.committees.find(c => c.id === v.committee_id);
        const stats = window.AtharStore.getVolunteerStats(v.id);
        return [v.national_id, v.full_name, comm ? comm.name_en : "Unassigned", v.status, stats ? stats.totalHours : 0];
      });
      window.ExportUtil.downloadCSV("Athar_Volunteers_Summary.csv", headers, rows);
      showToast("CSV Exported successfully!");
    };

    document.getElementById("kpi-card-vols").onclick = () => navigateTo("volunteers");
    document.getElementById("kpi-card-comms").onclick = () => navigateTo("committees");
    document.getElementById("kpi-card-hours").onclick = () => navigateTo("volunteer-hours");
    document.getElementById("kpi-card-certs").onclick = () => navigateTo("certificates");
    document.getElementById("btn-goto-meetings").onclick = () => navigateTo("meetings");

    // Lazy-load activity for follow-up counts (re-render once available).
    if (!state.activityLoaded && !App.__dashActivityTried) {
      App.__dashActivityTried = true;
      window.AtharStore.refreshActivity().then(() => {
        if (App.currentView === "dashboard") renderDashboard(container);
      }).catch(() => { });
    }

    // -------- KPI count-up (skipped when reduced motion is preferred) --------
    const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const counters = container.querySelectorAll("[data-count-to]");
    if (!reducedMotion && counters.length) {
      const duration = 700;
      const start = performance.now();
      const tick = (now) => {
        const p = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        counters.forEach((el) => {
          const target = Number(el.getAttribute("data-count-to")) || 0;
          const suffix = el.getAttribute("data-count-suffix") || "";
          el.textContent = Math.round(target * eased).toLocaleString() + suffix;
        });
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }

  window.AtharViews.dashboard = (c, p) => renderDashboard(c);
})();