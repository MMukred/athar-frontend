/**
 * View: Volunteer self-service portal (member view)
 *
 * A scoped, read-only dashboard for the signed-in volunteer:
 *   - approved / pending hours + recent entries
 *   - their own certificates (with public verification links)
 *   - upcoming events for their committee
 *   - their committee head only (never other committees)
 *   - attendance summary
 *
 * Data comes from GET /api/portal/me, which is scoped server-side.
 */
(function () {
  "use strict";

  const { App, t, ic, escapeHtml, formatDate } = window.AtharCore;

  let requestSeq = 0;
  let cachedData = null;
  let cachedAt = 0;
  let cachedForUserId = null;

  const L = (ar, en) => (App.currentLang === "ar" ? ar : en);
  const d10 = (s) => (s ? String(s).slice(0, 10) : null);
  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const fmtHours = (v) => {
    const n = num(v);
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  };
  const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "";
  const initials = (name) => {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "•";
    return ((parts[0][0] || "") + (parts[1] ? parts[1][0] : "")).toUpperCase();
  };
  const statusBadge = (status) => {
    const cls = status === "approved" ? "badge-success"
      : status === "pending" ? "badge-warning"
        : status === "rejected" ? "badge-danger"
          : "badge-neutral";
    return `<span class="badge ${cls}">${t(status) || status}</span>`;
  };
  const nextMilestone = (hours) => {
    const steps = [10, 25, 50, 75, 100, 150, 200, 300, 500, 750, 1000];
    for (const step of steps) if (hours < step) return step;
    return Math.ceil((hours + 1) / 250) * 250;
  };

  function ringSvg(pct) {
    const r = 52;
    const c = 2 * Math.PI * r;
    const clamped = Math.max(0, Math.min(100, pct));
    const dash = (clamped / 100) * c;
    return `<svg viewBox="0 0 120 120" class="portal-ring" aria-hidden="true">
      <circle cx="60" cy="60" r="${r}" class="portal-ring-track"></circle>
      <circle cx="60" cy="60" r="${r}" class="portal-ring-bar" style="stroke-dasharray:${c.toFixed(2)};stroke-dashoffset:${(c - dash).toFixed(2)};"></circle>
    </svg>`;
  }

  function skeletonHtml() {
    return `
      <div class="view-header">
        <div class="view-header-left">
          <h1 class="view-title">${L("بوابة المتطوع", "My Portal")}</h1>
          <p class="view-subtitle">${L("جارٍ تحميل بياناتك…", "Loading your space…")}</p>
        </div>
      </div>
      <div class="portal-hero portal-skeleton-hero">
        <div class="portal-skel-line" style="width:38%;height:14px;"></div>
        <div class="portal-skel-line" style="width:58%;height:28px;margin-top:14px;"></div>
        <div class="portal-skel-line" style="width:44%;height:12px;margin-top:14px;"></div>
      </div>
      <div class="kpi-grid">
        ${[0, 1, 2, 3].map(() => `<div class="kpi-card"><div class="portal-skel-line" style="width:52%;height:11px;"></div><div class="portal-skel-line" style="width:34%;height:26px;margin-top:14px;"></div><div class="portal-skel-line" style="width:46%;height:10px;margin-top:14px;"></div></div>`).join("")}
      </div>
      <div class="portal-grid">
        <div class="card" style="min-height:220px;"><div class="portal-skel-line" style="width:30%;height:14px;"></div><div class="portal-skel-line" style="width:100%;height:12px;margin-top:22px;"></div><div class="portal-skel-line" style="width:82%;height:12px;margin-top:12px;"></div><div class="portal-skel-line" style="width:66%;height:12px;margin-top:12px;"></div></div>
        <div class="card" style="min-height:220px;"><div class="portal-skel-line" style="width:44%;height:14px;"></div><div class="portal-skel-line" style="width:100%;height:12px;margin-top:22px;"></div><div class="portal-skel-line" style="width:72%;height:12px;margin-top:12px;"></div></div>
      </div>`;
  }

  function lockedHtml(message) {
    return `
      <div class="view-header">
        <div class="view-header-left">
          <h1 class="view-title">${L("بوابة المتطوع", "My Portal")}</h1>
          <p class="view-subtitle">${L("خطوة أخيرة قبل الدخول", "One last step before you continue")}</p>
        </div>
      </div>
      <div class="card portal-locked-card">
        <div class="portal-locked-icon">${ic("lock", 26)}</div>
        <h2>${L("غيّر كلمة المرور المؤقتة", "Change your temporary password")}</h2>
        <p>${message || L("لحماية حسابك، يجب تغيير كلمة المرور المؤقتة قبل عرض بياناتك.", "For your security, please change the temporary password before viewing your data.")}</p>
        <button class="btn btn-primary" id="portal-change-pw">${ic("lock", 15)} ${L("تغيير كلمة المرور الآن", "Change password now")}</button>
      </div>`;
  }

  function errorHtml(err) {
    const msg = err && err.message ? err.message : L("تعذّر تحميل البوابة", "Could not load your portal");
    return `
      <div class="view-header">
        <div class="view-header-left">
          <h1 class="view-title">${L("بوابة المتطوع", "My Portal")}</h1>
        </div>
      </div>
      <div class="card portal-locked-card">
        <div class="portal-locked-icon portal-locked-danger">${ic("alert", 26)}</div>
        <h2>${L("حدث خطأ", "Something went wrong")}</h2>
        <p>${escapeHtml(msg)}</p>
        <button class="btn btn-primary" id="portal-retry">${ic("refresh", 15)} ${L("إعادة المحاولة", "Try again")}</button>
      </div>`;
  }

  function unlinkedHtml(data) {
    const name = data && data.account ? (data.account.fullName || "") : "";
    return `
      <div class="view-header">
        <div class="view-header-left">
          <h1 class="view-title">${L("بوابة المتطوع", "My Portal")}</h1>
          <p class="view-subtitle">${L("مرحباً", "Welcome")} ${escapeHtml(firstName(name))}</p>
        </div>
      </div>
      <div class="card portal-locked-card">
        <div class="portal-locked-icon">${ic("user_x", 26)}</div>
        <h2>${L("حسابك غير مرتبط بسجل تطوع", "Your account is not linked to a volunteer record")}</h2>
        <p>${L("تواصل مع رئيس لجنتك أو إدارة النظام لربط حسابك بسجل التطوع الخاص بك.", "Contact your committee head or the system administration to link your account to your volunteer record.")}</p>
      </div>`;
  }

  function eventRowHtml(meeting) {
    const dateStr = d10(meeting.meetingDate);
    const parts = dateStr ? dateStr.split("-") : [];
    const day = parts[2] || "—";
    const monthIdx = parts[1] ? parseInt(parts[1], 10) - 1 : -1;
    const monthsAr = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    const monthsEn = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = App.currentLang === "ar" ? (monthsAr[monthIdx] || "") : (monthsEn[monthIdx] || "");
    const title = App.currentLang === "ar"
      ? (meeting.titleAr || meeting.titleEn || "")
      : (meeting.titleEn || meeting.titleAr || "");
    const time = meeting.startTime
      ? `${meeting.startTime}${meeting.endTime ? " – " + meeting.endTime : ""}`
      : "";
    const kindLabel = meeting.kind === "event"
      ? L("فعالية", "Event")
      : L("اجتماع", "Meeting");

    return `
      <div class="portal-event">
        <div class="portal-event-date">
          <span class="portal-event-day num-ltr">${escapeHtml(day)}</span>
          <span class="portal-event-month">${escapeHtml(month)}</span>
        </div>
        <div class="portal-event-main">
          <div class="portal-event-title">${escapeHtml(title)}</div>
          <div class="portal-event-meta">
            ${time ? `<span>${ic("clock", 12)} ${escapeHtml(time)}</span>` : ""}
            ${meeting.location ? `<span>${ic("building", 12)} ${escapeHtml(meeting.location)}</span>` : ""}
          </div>
        </div>
        <span class="badge ${meeting.kind === "event" ? "badge-purple" : "badge-primary"}">${kindLabel}</span>
      </div>`;
  }

  function certificateRowHtml(cert) {
    const code = cert.certificateNo || "";
    const token = cert.verifyToken || code;
    const verifyUrl = `${window.location.origin}${window.location.pathname}#public-verify/${encodeURIComponent(token)}`;
    return `
      <div class="portal-cert">
        <div class="portal-cert-icon">${ic("award", 18)}</div>
        <div class="portal-cert-main">
          <div class="portal-cert-title" dir="ltr">${escapeHtml(code || "—")}</div>
          <div class="portal-cert-sub">${fmtHours(cert.totalHours)} ${L("ساعة", "hours")} • ${escapeHtml(formatDate(d10(cert.issueDate)))}</div>
        </div>
        <button type="button" class="btn btn-secondary btn-sm portal-copy-cert"
          data-url="${escapeHtml(verifyUrl)}"
          title="${L("نسخ رابط التحقق", "Copy verification link")}">
          ${ic("copy", 14)}
        </button>
      </div>`;
  }

  function headCardHtml(committee) {
    const head = committee && committee.head;
    if (!head) {
      return `
        <div class="portal-empty portal-empty-compact">
          <div class="portal-empty-icon">${ic("user_x", 22)}</div>
          <div>${L("لم يُعيَّن رئيس للجنة بعد", "No committee head assigned yet")}</div>
        </div>`;
    }
    const name = App.currentLang === "ar"
      ? (head.fullNameAr || head.fullName)
      : (head.fullName || head.fullNameAr);
    const role = head.isMainLeader
      ? L("رئيس اللجنة", "Committee head")
      : L("نائب رئيس اللجنة", "Co-leader");
    const phone = head.whatsapp || head.phone || "";
    const waDigits = String(phone).replace(/[^\d]/g, "");
    return `
      <div class="portal-head">
        <div class="portal-head-avatar">${escapeHtml(initials(name))}</div>
        <div class="portal-head-info">
          <div class="portal-head-name">${escapeHtml(name)}</div>
          <div class="portal-head-role">${ic("star", 12)} ${role}</div>
        </div>
      </div>
      <div class="portal-head-actions">
        ${head.email ? `<a class="btn btn-secondary btn-sm" href="mailto:${escapeHtml(head.email)}">${ic("send", 14)} ${L("بريد", "Email")}</a>` : ""}
        ${phone ? `<a class="btn btn-secondary btn-sm" href="tel:${escapeHtml(phone)}">${ic("message_circle", 14)} ${L("اتصال", "Call")}</a>` : ""}
        ${waDigits ? `<a class="btn btn-secondary btn-sm" href="https://wa.me/${escapeHtml(waDigits)}" target="_blank" rel="noopener">${ic("whatsapp", 14)} WhatsApp</a>` : ""}
      </div>`;
  }

  function attendanceHtml(attendance) {
    const total = num(attendance && attendance.total);
    if (!total) {
      return `<div class="portal-empty portal-empty-compact">
        <div class="portal-empty-icon">${ic("clipboard_check", 22)}</div>
        <div>${L("لا يوجد سجل حضور بعد", "No attendance recorded yet")}</div>
      </div>`;
    }
    const rows = [
      { key: "present", label: L("حاضر", "Present"), tone: "success" },
      { key: "late", label: L("متأخر", "Late"), tone: "warning" },
      { key: "excused", label: L("بعذر", "Excused"), tone: "info" },
      { key: "absent", label: L("غائب", "Absent"), tone: "danger" },
    ];
    return `<div class="portal-attendance">
      ${rows.map((row) => {
        const count = num(attendance[row.key]);
        const pct = total ? Math.round((count / total) * 100) : 0;
        return `<div class="portal-att-row">
          <div class="portal-att-label"><span>${row.label}</span><strong class="num-ltr">${count}</strong></div>
          <div class="portal-att-bar"><span class="portal-att-fill portal-att-${row.tone}" style="width:${pct}%"></span></div>
        </div>`;
      }).join("")}
    </div>`;
  }

  function hoursTableHtml(entries) {
    if (!entries || !entries.length) {
      return `<div class="portal-empty">
        <div class="portal-empty-icon">${ic("clock", 24)}</div>
        <div class="portal-empty-title">${L("لا توجد ساعات مسجلة بعد", "No hours recorded yet")}</div>
        <div class="portal-empty-desc">${L("ستظهر هنا الساعات التي يعتمدها فريق الإدارة.", "Approved hours will appear here once the admin team reviews them.")}</div>
      </div>`;
    }
    return `<div class="table-container">
      <table class="data-table portal-hours-table">
        <thead><tr>
          <th>${L("النشاط", "Activity")}</th>
          <th>${L("التاريخ", "Date")}</th>
          <th>${L("الساعات", "Hours")}</th>
          <th>${L("الحالة", "Status")}</th>
        </tr></thead>
        <tbody>
          ${entries.map((entry) => `
            <tr>
              <td>
                <div class="portal-hours-activity">${escapeHtml(entry.activity || "—")}</div>
                ${entry.description ? `<div class="portal-hours-desc">${escapeHtml(entry.description)}</div>` : ""}
              </td>
              <td><span class="num-ltr">${escapeHtml(formatDate(d10(entry.date)))}</span></td>
              <td><span class="num-ltr" style="font-weight:700;">${fmtHours(entry.hours)} h</span></td>
              <td>${statusBadge(entry.status)}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
  }

  function portalHtml(data) {
    const v = data.volunteer || {};
    const committee = data.committee;
    const hours = data.hours || {};
    const approved = num(hours.approved);
    const pending = num(hours.pending);
    const certs = data.certificates || [];
    const meetings = data.meetings || [];
    const attendance = data.attendance || {};
    const name = App.currentLang === "ar" ? (v.fullNameAr || v.fullName) : (v.fullName || v.fullNameAr);
    const committeeName = committee
      ? (App.currentLang === "ar" ? (committee.nameAr || committee.nameEn) : (committee.nameEn || committee.nameAr))
      : L("بدون لجنة", "No committee");
    const milestone = nextMilestone(approved);
    const progress = milestone ? Math.round((approved / milestone) * 100) : 0;
    const needsPasswordChange = !!(data.account && data.account.mustChangePassword) || !!App.currentUser.must_change_password;

    return `
      <div class="view-header portal-view-header">
        <div class="view-header-left">
          <h1 class="view-title">${L("بوابة المتطوع", "My Portal")}</h1>
          <p class="view-subtitle">${L("مساحتك الشخصية لمتابعة أثرك التطوعي", "Your personal space to follow your volunteer impact")}</p>
        </div>
        <div class="view-header-actions">
          <button type="button" class="btn btn-secondary btn-sm" id="portal-refresh">${ic("refresh", 14)} ${t("refresh") || L("تحديث", "Refresh")}</button>
        </div>
      </div>

      ${needsPasswordChange ? `
        <div class="portal-alert">
          <div class="portal-alert-icon">${ic("lock", 18)}</div>
          <div class="portal-alert-body">
            <strong>${L("أنت تستخدم كلمة مرور مؤقتة", "You are using a temporary password")}</strong>
            <span>${L("غيّرها الآن لحماية حسابك — لن تُطلب منك مرة أخرى.", "Change it now to protect your account — you will only be asked once.")}</span>
          </div>
          <button type="button" class="btn btn-primary btn-sm" id="portal-change-pw">${L("تغيير الآن", "Change now")}</button>
        </div>` : ""}

      <div class="portal-hero">
        <div class="portal-hero-main">
          <div class="portal-hero-eyebrow">${ic("sparkles", 14)} ${L("بوابة المتطوع", "Volunteer portal")}</div>
          <h2 class="portal-hero-title">${L("أهلاً", "Welcome")} ${escapeHtml(firstName(name))} <span class="portal-wave">👋</span></h2>
          <p class="portal-hero-sub">${L("كل ساعة تقدمها تصنع أثراً. هذه لمحة عن رحلتك.", "Every hour you give creates impact. Here is your journey so far.")}</p>
          <div class="portal-hero-meta">
            <span class="portal-meta-chip">${ic("building", 13)} ${escapeHtml(committeeName)}</span>
            <span class="portal-meta-chip">${ic("calendar", 13)} ${L("عضو منذ", "Member since")} ${escapeHtml(formatDate(d10(v.joinDate)))}</span>
            <span class="portal-meta-chip portal-meta-status">${ic("user_check", 13)} ${t(v.status) || v.status || ""}</span>
          </div>
        </div>
        <div class="portal-hero-ring">
          <div class="portal-ring-wrap">
            ${ringSvg(progress)}
            <div class="portal-ring-value">
              <strong class="num-ltr">${fmtHours(approved)}</strong>
              <span>${L("ساعة معتمدة", "approved hours")}</span>
            </div>
          </div>
          <div class="portal-ring-caption">${L("الهدف التالي", "Next milestone")}: <strong class="num-ltr">${milestone} h</strong></div>
        </div>
      </div>

      <div class="kpi-grid portal-kpis">
        <div class="kpi-card kpi-hours">
          <div class="kpi-header">
            <span class="kpi-title">${L("الساعات المعتمدة", "Approved hours")}</span>
            <div class="kpi-icon-badge">${ic("check_circle", 18)}</div>
          </div>
          <div class="kpi-value num-ltr">${fmtHours(approved)} h</div>
          <div class="kpi-trend">${num(hours.approvedCount)} ${L("سجل معتمد", "approved entries")}</div>
        </div>
        <div class="kpi-card kpi-pending">
          <div class="kpi-header">
            <span class="kpi-title">${L("قيد المراجعة", "Pending review")}</span>
            <div class="kpi-icon-badge">${ic("clock", 18)}</div>
          </div>
          <div class="kpi-value num-ltr">${fmtHours(pending)} h</div>
          <div class="kpi-trend">${num(hours.pendingCount)} ${L("سجل بانتظار الاعتماد", "entries awaiting approval")}</div>
        </div>
        <div class="kpi-card kpi-certs">
          <div class="kpi-header">
            <span class="kpi-title">${L("شهاداتي", "My certificates")}</span>
            <div class="kpi-icon-badge">${ic("award", 18)}</div>
          </div>
          <div class="kpi-value num-ltr">${certs.length}</div>
          <div class="kpi-trend">${certs.length ? L("جاهزة للتحقق", "ready to verify") : L("لا شهادات بعد", "none yet")}</div>
        </div>
        <div class="kpi-card kpi-events">
          <div class="kpi-header">
            <span class="kpi-title">${L("فعالياتي القادمة", "Upcoming events")}</span>
            <div class="kpi-icon-badge">${ic("calendar", 18)}</div>
          </div>
          <div class="kpi-value num-ltr">${meetings.length}</div>
          <div class="kpi-trend">${meetings.length ? L("فعالية مجدولة", "scheduled") : L("لا فعاليات قادمة", "nothing scheduled")}</div>
        </div>
      </div>

      <div class="portal-grid">
        <div class="portal-main-col">
          <section class="card">
            <div class="card-header">
              <div class="card-title">${ic("calendar", 18)} ${L("الفعاليات القادمة", "Upcoming events")}</div>
              <span class="portal-count-pill">${meetings.length}</span>
            </div>
            ${meetings.length
              ? `<div class="portal-timeline">${meetings.map(eventRowHtml).join("")}</div>`
              : `<div class="portal-empty">
                  <div class="portal-empty-icon">${ic("calendar", 24)}</div>
                  <div class="portal-empty-title">${L("لا توجد فعاليات قادمة", "No upcoming events")}</div>
                  <div class="portal-empty-desc">${L("ستظهر هنا الاجتماعات والفعاليات الخاصة بلجنتك.", "Your committee's meetings and events will appear here.")}</div>
                </div>`}
          </section>

          <section class="card">
            <div class="card-header">
              <div class="card-title">${ic("clock", 18)} ${L("آخر ساعاتي", "Recent hours")}</div>
              <span class="portal-count-pill">${num(hours.approvedCount) + num(hours.pendingCount)}</span>
            </div>
            ${hoursTableHtml(hours.recent)}
          </section>
        </div>

        <aside class="portal-side-col">
          <section class="card portal-head-card">
            <div class="card-header">
              <div class="card-title">${ic("user", 18)} ${L("رئيس لجنتي", "My committee head")}</div>
            </div>
            ${headCardHtml(committee)}
            ${committee ? `<div class="portal-head-committee">${ic("building", 13)} ${escapeHtml(committeeName)}</div>` : ""}
          </section>

          <section class="card">
            <div class="card-header">
              <div class="card-title">${ic("award", 18)} ${L("شهاداتي", "My certificates")}</div>
              <span class="portal-count-pill">${certs.length}</span>
            </div>
            ${certs.length
              ? `<div class="portal-certs">${certs.map(certificateRowHtml).join("")}</div>`
              : `<div class="portal-empty portal-empty-compact">
                  <div class="portal-empty-icon">${ic("award", 22)}</div>
                  <div>${L("لا شهادات صادرة بعد", "No certificates issued yet")}</div>
                </div>`}
          </section>

          <section class="card">
            <div class="card-header">
              <div class="card-title">${ic("clipboard_check", 18)} ${L("ملخص الحضور", "Attendance summary")}</div>
            </div>
            ${attendanceHtml(attendance)}
          </section>
        </aside>
      </div>

      <div class="portal-footer-note">
        ${ic("shield", 13)}
        ${L("بياناتك خاصة — تعرض هذه البوابة سجلك أنت فقط.", "Your data is private — this portal only shows your own record.")}
      </div>`;
  }

  function bindActions(container) {
    const refresh = container.querySelector("#portal-refresh");
    if (refresh) refresh.onclick = () => renderPortal(container, {}, true);

    const retry = container.querySelector("#portal-retry");
    if (retry) retry.onclick = () => renderPortal(container, {}, true);

    container.querySelectorAll("#portal-change-pw").forEach((btn) => {
      btn.onclick = () => {
        if (window.AtharModals && window.AtharModals.openChangePasswordModal) {
          window.AtharModals.openChangePasswordModal(true);
        }
      };
    });

    container.querySelectorAll(".portal-copy-cert").forEach((btn) => {
      btn.onclick = async () => {
        const url = btn.getAttribute("data-url") || "";
        try {
          await navigator.clipboard.writeText(url);
          window.AtharCore.showToast(L("تم نسخ رابط التحقق", "Verification link copied"), "success");
        } catch {
          window.AtharCore.showToast(url, "info", { duration: 8000 });
        }
      };
    });
  }

  async function fetchPortal() {
    if (!window.AtharAPI || !window.AtharAPI.portal) {
      throw new Error(L("واجهة البوابة غير متاحة", "Portal API is not available"));
    }
    return window.AtharAPI.portal.me();
  }

  async function renderPortal(container, params, force) {
    if (!container || !container.isConnected) return;
    const seq = ++requestSeq;

    const currentUserId = App.currentUser && App.currentUser.id;
    const cacheValid = !force && cachedData && cachedForUserId === currentUserId && Date.now() - cachedAt < 20000;
    if (cacheValid) {
      container.innerHTML = portalHtml(cachedData);
      bindActions(container);
      return;
    }

    container.innerHTML = skeletonHtml();

    try {
      const data = await fetchPortal();
      if (seq !== requestSeq || !container.isConnected) return;

      if (data && data.linked === false) {
        container.innerHTML = unlinkedHtml(data);
        bindActions(container);
        return;
      }

      cachedData = data;
      cachedAt = Date.now();
      cachedForUserId = currentUserId;
      container.innerHTML = portalHtml(data);
      bindActions(container);
    } catch (err) {
      if (seq !== requestSeq || !container.isConnected) return;
      if (err && err.code === "MUST_CHANGE_PASSWORD") {
        container.innerHTML = lockedHtml();
        bindActions(container);
        return;
      }
      if (err && err.status === 401) {
        container.innerHTML = errorHtml(new Error(L("انتهت الجلسة. سجّل الدخول من جديد.", "Session expired. Please sign in again.")));
      } else {
        container.innerHTML = errorHtml(err);
      }
      bindActions(container);
    }
  }

  window.AtharViews = window.AtharViews || {};
  window.AtharViews.portal = renderPortal;
  window.AtharViews["volunteer-portal"] = renderPortal;
})();
