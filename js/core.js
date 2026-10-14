/**
 * Athar Core — shared state, helpers, router, sidebar, toasts.
 * Loaded before modals, views, and app.js. Exposes window.AtharCore.
 */

window.AtharCore = (function () {
  "use strict";

  // ===========================================================
  // Application State
  // ===========================================================
  const App = {
    currentLang: "ar",
    currentUser: null,
    currentView: "dashboard",
    currentParams: {},
    sidebarCollapsed: false,
    selectedVolunteerIds: new Set(),
    searchQuery: "",
    failedLoginAttempts: 0,
    lockoutUntil: 0,
    pagination: {
      volunteersPage: 1,
      volunteersPerPage: 20,
      hoursPage: 1,
      hoursPerPage: 20,
      auditPage: 1,
      auditPerPage: 12
    }
  };

  // ===========================================================
  // View key → Registry key mapping
  // ===========================================================
  const VIEW_REGISTRY = {
    "dashboard": "dashboard",
    "volunteers": "volunteers",
    "volunteer-profile": "volunteerProfile",
    "committees": "committees",
    "committee-detail": "committeeDetail",
    "meetings": "meetings",
    "events": "events",
    "meeting-detail": "meetingDetail",
    "evaluations": "evaluations",
    "new-evaluation": "newEvaluation",
    "evaluation-criteria": "evaluationCriteria",
    "volunteer-hours": "volunteerHours",
    "certificates": "certificates",
    "generate-certificate": "generateCertificate",
    "public-verify": "publicVerify",
    "reports": "reports",
    "whatsapp-templates": "whatsappTemplates",
    "users": "users",
    "audit-logs": "auditLogs",
    "settings": "settings"
  };

  // ===========================================================
  // Translation
  // ===========================================================
  function t(key) {
    const lang = App.currentLang;
    if (window.Translations && window.Translations[lang] && window.Translations[lang][key]) {
      return window.Translations[lang][key];
    }
    if (window.Translations && window.Translations.en && window.Translations.en[key]) {
      return window.Translations.en[key];
    }
    return key;
  }

  // ===========================================================
  // Date formatting
  // ===========================================================
  function formatDate(dateStr) {
    if (!dateStr) return "—";
    if (App.currentLang === "ar") {
      const parts = String(dateStr).split(" ")[0].split("-");
      if (parts.length === 3) {
        const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
        const mIdx = parseInt(parts[1], 10) - 1;
        return `${parts[2]} ${months[mIdx] || parts[1]} ${parts[0]}`;
      }
    }
    return dateStr;
  }

  // ===========================================================
  // Age from date-of-birth
  // ===========================================================
  function age(dobStr) {
    if (!dobStr) return null;
    const d = new Date(dobStr);
    if (isNaN(d.getTime())) return null;
    const now = new Date();
    let a = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
    if (a < 0 || a > 130) return null;
    return a;
  }

  // ===========================================================
  // Gender color tokens
  // ===========================================================
  function genderStyle(gender) {
    if (gender === "female") {
      return { border: "#EC4899", bg: "#FCE7F3", text: "#BE185D", ring: "rgba(236,72,153,0.25)" };
    }
    if (gender === "male") {
      return { border: "#3B82F6", bg: "#DBEAFE", text: "#1E40AF", ring: "rgba(59,130,246,0.25)" };
    }
    return { border: "#D0D7DE", bg: "#F6F8FA", text: "#57606A", ring: "rgba(140,149,159,0.20)" };
  }

  // ===========================================================
  // Notes splitter — one note per non-empty line
  // ===========================================================
  function splitNotes(text) {
    if (!text) return [];
    return String(text)
      .split(/\r?\n+/)
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
  }

  // ===========================================================
  // HTML escaping
  // ===========================================================
  function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ===========================================================
  // Icon helper
  // ===========================================================
  function ic(name, size, opts) {
    if (window.AtharIcons) return window.AtharIcons.get(name, size, opts);
    return "";
  }

  // ===========================================================
  // Toast notifications
  // ===========================================================
  function showToast(message, type) {
    type = type || "success";
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    let iconName = "check_circle";
    let iconColor = "var(--success)";
    if (type === "error") { iconName = "x_circle"; iconColor = "var(--danger)"; }
    if (type === "warning") { iconName = "alert"; iconColor = "var(--warning)"; }
    if (type === "info") { iconName = "info"; iconColor = "var(--info)"; }

    toast.innerHTML = `
      <span style="color:${iconColor}; display:flex; align-items:center;">${ic(iconName, 18)}</span>
      <span style="flex:1;">${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(8px)";
      toast.style.transition = "all 0.2s ease";
      setTimeout(() => toast.remove(), 250);
    }, 3500);
  }

  // ===========================================================
  // Confirmation modal
  // ===========================================================
  function showConfirmModal(options) {
    const { title, message, confirmText = t("confirm"), cancelText = t("cancel"), onConfirm, isDanger = true } = options;
    const modalContainer = document.getElementById("modal-container");
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="overlay-backdrop" id="confirm-modal-backdrop">
        <div class="modal-dialog" style="max-width: 440px;">
          <div class="modal-header">
            <h3 class="modal-title" style="color: ${isDanger ? 'var(--danger)' : 'var(--neutral-900)'};">
              ${isDanger ? ic("alert", 18) : ic("info", 18)} ${title}
            </h3>
            <button class="btn-icon" id="confirm-modal-close-btn">&times;</button>
          </div>
          <div class="modal-body">
            <p style="font-size: 14px; color: var(--neutral-700); line-height: 1.6;">${message}</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="confirm-modal-cancel-btn">${cancelText}</button>
            <button class="btn ${isDanger ? 'btn-danger' : 'btn-primary'}" id="confirm-modal-action-btn">${confirmText}</button>
          </div>
        </div>
      </div>
    `;

    const close = () => { modalContainer.innerHTML = ""; };
    document.getElementById("confirm-modal-close-btn").onclick = close;
    document.getElementById("confirm-modal-cancel-btn").onclick = close;
    document.getElementById("confirm-modal-backdrop").onclick = (e) => {
      if (e.target.id === "confirm-modal-backdrop") close();
    };
    document.getElementById("confirm-modal-action-btn").onclick = () => {
      close();
      if (onConfirm) onConfirm();
    };
  }

  // ===========================================================
  // Permission check (RBAC)
  // ===========================================================
  function hasPermission(module, action) {
    if (!App.currentUser) return false;
    if (App.currentUser.role === "super_admin") return true;

    const superAdminOnlyActions = [
      { module: "evaluation_criteria", action: "create" },
      { module: "evaluation_criteria", action: "edit" },
      { module: "evaluation_criteria", action: "delete" },
      { module: "certificates", action: "approve" },
      { module: "certificates", action: "revoke" },
      { module: "whatsapp_templates", action: "create" },
      { module: "whatsapp_templates", action: "delete" },
      { module: "users", action: "view" },
      { module: "users", action: "create" },
      { module: "users", action: "edit" },
      { module: "users", action: "delete" },
      { module: "settings", action: "edit" }
    ];
    const isRestricted = superAdminOnlyActions.some(
      function (r) { return r.module === module && r.action === action; }
    );
    if (isRestricted) return false;

    const apiPerms = App.currentUser.permissions;
    if (apiPerms && typeof apiPerms === "object" && !Array.isArray(apiPerms)) {
      const wildcard = apiPerms["*"];
      if (wildcard && wildcard[action]) return true;
      const row = apiPerms[module];
      if (row && row[action]) return true;
      return false;
    }

    const state = window.AtharStore.getState();
    const permRow = state.permissions.find(
      function (p) { return p.user_id === App.currentUser.id && p.module === module; }
    );
    if (!permRow) return false;
    return !!permRow["can_" + action];
  }

  // ===========================================================
  // Language switch
  // ===========================================================
  function setLanguage(lang) {
    App.currentLang = lang;
    const isRtl = lang === "ar";
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("dir", isRtl ? "rtl" : "ltr");

    const state = window.AtharStore.getState();
    state.settings.default_language = lang;
    if (App.currentUser) App.currentUser.preferred_language = lang;

    const appNameEl = document.getElementById("txt-app-name");
    const appSubEl = document.getElementById("txt-app-subname");
    const searchEl = document.getElementById("global-search-input");
    const langTextEl = document.getElementById("lang-toggle-text");

    if (appNameEl) appNameEl.textContent = t("app_name");
    if (appSubEl) appSubEl.textContent = t("app_subname");
    if (searchEl) searchEl.placeholder = t("search_placeholder");
    if (langTextEl) langTextEl.textContent = lang === "ar" ? "English" : "العربية";

    updateUserMenuBadge();
    renderSidebar();
    navigateTo(App.currentView, App.currentParams, false);
  }

  // ===========================================================
  // User menu badge
  // ===========================================================
  function updateUserMenuBadge() {
    if (!App.currentUser) return;
    const isSuper = App.currentUser.role === "super_admin";
    const roleText = isSuper ? t("super_admin") : t("trusted_admin");

    const roleEl = document.getElementById("current-user-role-label");
    const nameEl = document.getElementById("user-display-name");
    const avEl = document.getElementById("user-avatar-badge");

    if (roleEl) roleEl.textContent = roleText;
    if (nameEl) nameEl.textContent = App.currentUser.full_name;
    if (avEl) avEl.textContent = App.currentUser.full_name.charAt(0);
  }

  // ===========================================================
  // Router
  // ===========================================================
  const VIEW_MODULE_MAP = {
    dashboard: "dashboard",
    volunteers: "volunteers",
    "volunteer-profile": "volunteers",
    committees: "committees",
    "committee-detail": "committees",
    meetings: "meetings",
    events: "meetings",
    "meeting-detail": "attendance",
    evaluations: "evaluations",
    "new-evaluation": "evaluations",
    "evaluation-criteria": "evaluation_criteria",
    "volunteer-hours": "volunteer_hours",
    certificates: "certificates",
    "generate-certificate": "certificates",
    "public-verify": "certificates",
    reports: "reports",
    "whatsapp-templates": "whatsapp_templates",
    users: "users",
    "audit-logs": "audit_logs",
    settings: "settings"
  };

  function navigateTo(view, params, pushState) {
    params = params || {};
    if (pushState === undefined) pushState = true;

    if (window.AtharDirty && window.AtharDirty.isDirty() && !App._navBypass) {
      window.AtharDirty.guard(() => {
        App._navBypass = true;
        navigateTo(view, params, pushState);
        App._navBypass = false;
      });
      return;
    }

    const targetModule = VIEW_MODULE_MAP[view];
    if (targetModule && !hasPermission(targetModule, "view")) {
      showToast(t("permission_denied"), "error");
      view = "dashboard";
      params = {};
    }

    App.currentView = view;
    App.currentParams = params;

    if (pushState) {
      let hash = `#${view}`;
      if (params.id) hash += `/${params.id}`;
      if (params.sub) hash += `/${params.sub}`;
      window.location.hash = hash;
    }

    renderSidebar();
    renderCurrentView();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleHashChange() {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) { navigateTo("dashboard", {}, false); return; }
    const parts = hash.split("/");
    navigateTo(parts[0] || "dashboard", { id: parts[1], sub: parts[2] }, false);
  }

  // ===========================================================
  // Sidebar — with live counts + kind-aware Events entry
  // ===========================================================
  function renderSidebar() {
    const navContainer = document.getElementById("sidebar-nav-container");
    if (!navContainer) return;

    const state = window.AtharStore.getState();

    // ---- Live counts ----
    const activeVolunteers = state.volunteers.filter(v => v.status !== "archived").length;
    const activeCommittees = state.committees.filter(c => c.status === "active").length;
    const upcomingMeetings = state.meetings.filter(m => m.status === "scheduled" && (m.kind || "meeting") === "meeting").length;
    const upcomingEvents = state.meetings.filter(m => m.status === "scheduled" && m.kind === "event").length;
    const pendingHoursCount = state.volunteer_hours.filter(h => h.status === "pending").length;
    const totalEvals = state.evaluations.length;
    const draftCerts = state.certificates.filter(c => c.status === "draft").length;
    const totalAudit = state.audit_logs.length;

    const badge = (count, tone) => {
      if (!count || count <= 0) return "";
      const style = tone === "warn"
        ? "background:var(--warning); color:white;"
        : tone === "info"
          ? "background:var(--primary-light); color:var(--primary); border:1px solid var(--primary-border);"
          : "background:var(--neutral-200); color:var(--neutral-700);";
      return `<span class="nav-badge num-ltr" style="${style}">${count > 99 ? '99+' : count}</span>`;
    };

    const navStructure = [
      {
        group: t("group_operations"),
        items: [
          { id: "dashboard", label: t("nav_dashboard"), icon: "dashboard", module: "dashboard" },
          { id: "volunteers", label: t("nav_volunteers"), icon: "users", module: "volunteers", badgeHtml: badge(activeVolunteers, "info") },
          { id: "committees", label: t("nav_committees"), icon: "building", module: "committees", badgeHtml: badge(activeCommittees, "info") },
          { id: "meetings", label: t("nav_meetings"), icon: "calendar", module: "meetings", badgeHtml: badge(upcomingMeetings, "info") },
          { id: "events", label: t("nav_events") || (App.currentLang === "ar" ? "الفعاليات" : "Events"), icon: "sparkles", module: "meetings", badgeHtml: badge(upcomingEvents, "info") },
          { id: "attendance", label: t("nav_attendance"), icon: "clipboard_check", module: "attendance", targetView: "meetings" }
        ]
      },
      {
        group: t("group_performance"),
        items: [
          { id: "evaluations", label: t("nav_evaluations"), icon: "star", module: "evaluations", badgeHtml: badge(totalEvals, "info") },
          { id: "volunteer-hours", label: t("nav_volunteer_hours"), icon: "clock", module: "volunteer_hours", badgeHtml: badge(pendingHoursCount, pendingHoursCount > 0 ? "warn" : "info") },
          { id: "certificates", label: t("nav_certificates"), icon: "award", module: "certificates", badgeHtml: badge(draftCerts, draftCerts > 0 ? "warn" : "info") }
        ]
      },
      {
        group: t("group_insights"),
        items: [
          { id: "reports", label: t("nav_reports"), icon: "bar_chart", module: "reports" }
        ]
      },
      {
        group: t("group_admin"),
        items: [
          { id: "users", label: t("nav_users"), icon: "shield", module: "users" },
          { id: "whatsapp-templates", label: t("nav_whatsapp_templates"), icon: "message_circle", module: "whatsapp_templates" },
          { id: "evaluation-criteria", label: t("nav_evaluation_criteria"), icon: "sliders", module: "evaluation_criteria" },
          { id: "audit-logs", label: t("nav_audit_logs"), icon: "file_text", module: "audit_logs", badgeHtml: badge(totalAudit, "info") },
          { id: "settings", label: t("nav_settings"), icon: "settings", module: "settings" }
        ]
      }
    ];

    // Which kind is the currently open meeting-detail? (for correct highlight)
    let currentDetailKind = "meeting";
    if (App.currentView === "meeting-detail" && App.currentParams && App.currentParams.id) {
      const openMeeting = state.meetings.find(m => m.id === App.currentParams.id);
      if (openMeeting) currentDetailKind = openMeeting.kind || "meeting";
    }

    let html = "";
    navStructure.forEach(group => {
      const accessibleItems = group.items.filter(item => hasPermission(item.module, "view"));
      if (accessibleItems.length === 0) return;

      html += `<div class="nav-group-title">${group.group}</div>`;
      accessibleItems.forEach(item => {
        const isActive = (App.currentView === item.id) ||
          (item.id === "volunteers" && App.currentView === "volunteer-profile") ||
          (item.id === "committees" && App.currentView === "committee-detail") ||
          (item.id === "meetings" && App.currentView === "meeting-detail" && currentDetailKind !== "event") ||
          (item.id === "events" && App.currentView === "meeting-detail" && currentDetailKind === "event") ||
          (item.id === "certificates" && (App.currentView === "generate-certificate" || App.currentView === "public-verify"));

        html += `
          <a class="nav-item ${isActive ? 'active' : ''}" data-nav-target="${item.targetView || item.id}">
            <div class="nav-item-content">
              <span class="nav-icon">${ic(item.icon, 18, { strokeWidth: 2 })}</span>
              <span class="nav-label">${item.label}</span>
            </div>
            ${item.badgeHtml || ''}
          </a>
        `;
      });
    });

    navContainer.innerHTML = html;
    navContainer.querySelectorAll(".nav-item").forEach(el => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        navigateTo(el.getAttribute("data-nav-target"));
      });
    });
  }

  // ===========================================================
  // View dispatcher
  // ===========================================================
  function renderCurrentView() {
    const container = document.getElementById("main-content");
    if (!container) return;

    const key = VIEW_REGISTRY[App.currentView] || "dashboard";
    const renderer = (window.AtharViews || {})[key];
    if (typeof renderer === "function") {
      renderer(container, App.currentParams);
    } else {
      container.innerHTML = `<div class="empty-state"><p>View not found: ${App.currentView}</p></div>`;
    }
  }
  // ===========================================================
  // Loading skeleton renderer
  // ===========================================================
  function renderSkeleton(container, rows) {
    rows = rows || 5;
    let rowsHtml = "";
    for (let i = 0; i < rows; i++) {
      const w = 55 + Math.floor(Math.random() * 35);
      rowsHtml += `<div class="skeleton-row" style="width:${w}%;"></div>`;
    }
    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <div class="skeleton skeleton-title" style="width:180px;"></div>
          <div class="skeleton skeleton-text" style="width:120px;"></div>
        </div>
        <div class="skeleton skeleton-text" style="width:100px; height:32px;"></div>
      </div>
      <div class="card" style="padding:24px;">
        ${rowsHtml}
      </div>
    `;
  }
  // ===========================================================
  // Public API
  // ===========================================================
  return {
    App,
    t,
    formatDate,
    age,
    genderStyle,
    splitNotes,
    escapeHtml,
    ic,
    showToast,
    showConfirmModal,
    hasPermission,
    setLanguage,
    updateUserMenuBadge,
    navigateTo,
    handleHashChange,
    renderSidebar,
    renderCurrentView,
    renderSkeleton,
  };
})();