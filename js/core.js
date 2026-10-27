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
  // Theme (light/dark)
  // ===========================================================
  function toggleTheme() {
    const el = document.documentElement;
    const next = el.getAttribute("data-theme") === "dark" ? "light" : "dark";
    el.setAttribute("data-theme", next);
    try {
      localStorage.setItem("athar_theme", next);
    } catch (e) { /* localStorage unavailable */ }
    return next;
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
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    if (gender === "female") {
      return dark
        ? { border: "#9D3B69", bg: "#3B1B2B", text: "#F9A8D4", ring: "rgba(236,72,153,0.30)" }
        : { border: "#EC4899", bg: "#FCE7F3", text: "#BE185D", ring: "rgba(236,72,153,0.25)" };
    }
    if (gender === "male") {
      return dark
        ? { border: "#2F5FA8", bg: "#152741", text: "#93C5FD", ring: "rgba(59,130,246,0.30)" }
        : { border: "#3B82F6", bg: "#DBEAFE", text: "#1E40AF", ring: "rgba(59,130,246,0.25)" };
    }
    return dark
      ? { border: "var(--neutral-300)", bg: "var(--neutral-100)", text: "var(--neutral-500)", ring: "rgba(140,149,159,0.20)" }
      : { border: "#D0D7DE", bg: "#F6F8FA", text: "#57606A", ring: "rgba(140,149,159,0.20)" };
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
  function showToast(message, type, options) {
    type = type || "success";
    options = options || {};
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    let iconName = "check_circle";
    let iconColor = "var(--success)";
    if (type === "error") { iconName = "x_circle"; iconColor = "var(--danger)"; }
    if (type === "warning") { iconName = "alert"; iconColor = "var(--warning)"; }
    if (type === "info") { iconName = "info"; iconColor = "var(--info)"; }

    const action = options.action;
    const duration = options.duration || (action ? 7000 : 3500);

    toast.innerHTML = `
      <span style="color:${iconColor}; display:flex; align-items:center;">${ic(iconName, 18)}</span>
      <span style="flex:1;">${message}</span>
      ${action ? `<button type="button" class="toast-action-btn" id="toast-action-btn">${action.label}</button>` : ""}
    `;

    container.appendChild(toast);
    let dismissed = false;
    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      toast.style.opacity = "0";
      toast.style.transform = "translateY(8px)";
      toast.style.transition = "all 0.2s cubic-bezier(0.4, 0, 1, 1)";
      setTimeout(() => toast.remove(), 250);
    };
    if (action) {
      const btn = toast.querySelector("#toast-action-btn");
      if (btn) btn.onclick = (e) => {
        e.stopPropagation();
        try { action.onClick(); } catch (err) { console.error(err); }
        dismiss();
      };
    }
    const timer = setTimeout(dismiss, duration);
    toast.addEventListener("click", (e) => { if (e.target === toast) dismiss(); });
  }

  // Convenience wrapper for undo-style toasts.
  function showUndoToast(message, undoCallback, type) {
    return showToast(message, type || "warning", {
      duration: 8000,
      action: { label: t("undo") || "Undo", onClick: undoCallback },
    });
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
    if ((App.currentUser && App.currentUser.role === "super_admin")) return true;

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
    const mobileSearchEl = document.getElementById("mobile-search-input");
    if (mobileSearchEl) mobileSearchEl.placeholder = t("search_placeholder");
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
    const isSuper = (App.currentUser && App.currentUser.role === "super_admin");
    const roleText = isSuper ? t("super_admin") : t("trusted_admin");

    const roleEl = document.getElementById("current-user-role-label");
    const nameEl = document.getElementById("user-display-name");
    const avEl = document.getElementById("user-avatar-badge");

    if (roleEl) roleEl.textContent = roleText;
    if (nameEl) nameEl.textContent = (App.currentUser && (App.currentUser.full_name || App.currentUser.fullName)) || "";
    if (avEl) avEl.textContent = ((App.currentUser && (App.currentUser.full_name || App.currentUser.fullName)) || "?").charAt(0);
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
    // Public verification is open to everyone (mirrors the public API endpoint).
    if (view !== "public-verify" && targetModule && !hasPermission(targetModule, "view")) {
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
    const parts = hash ? hash.split("/") : [];
    if (!App.currentUser) {
      // Anonymous visitors can only reach the public verification page.
      if (parts[0] === "public-verify" && window.AtharViews && window.AtharViews.showPublicVerifyStandalone) {
        window.AtharViews.showPublicVerifyStandalone(parts[1] || "");
      }
      return;
    }
    if (!hash) { navigateTo("dashboard", {}, false); return; }
    navigateTo(parts[0] || "dashboard", { id: parts[1], sub: parts[2] }, false);
  }

  // Keep the anonymous flow in sync with hash changes (e.g. #public-verify links).
  window.addEventListener("hashchange", function () {
    if (!App.currentUser) handleHashChange();
  });

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

    // Replay the enter animation on every view change
    container.classList.remove("view-enter");
    void container.offsetWidth;
    container.classList.add("view-enter");
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
  // Celebration (confetti) — for gift moments (cert issue, etc.)
  // ===========================================================
  function celebrate(duration) {
    duration = duration || 1800;
    const container = document.createElement("div");
    container.style.cssText = "position:fixed; inset:0; pointer-events:none; z-index:9999; overflow:hidden;";
    document.body.appendChild(container);
    const colors = ["#1F6FEB", "#2DA44E", "#D29922", "#8A3FFC", "#EC4899", "#F59E0B"];
    const count = 120;
    for (let i = 0; i < count; i++) {
      const p = document.createElement("div");
      const size = 6 + Math.random() * 6;
      p.style.cssText = `position:absolute; width:${size}px; height:${size}px; background:${colors[i % colors.length]}; left:${Math.random()*100}%; top:-10px; border-radius:${Math.random() > 0.5 ? "50%" : "2px"}; opacity:0.9;`;
      container.appendChild(p);
      const dx = (Math.random() - 0.5) * 200;
      const dy = 400 + Math.random() * 400;
      const rot = Math.random() * 720;
      p.animate([
        { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)`, opacity: 0 },
      ], { duration: duration + Math.random() * 600, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" });
    }
    setTimeout(() => container.remove(), duration + 800);
  }
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
    showUndoToast,
    showConfirmModal,
    celebrate,
    hasPermission,
    setLanguage,
    updateUserMenuBadge,
    navigateTo,
    handleHashChange,
    renderSidebar,
    renderCurrentView,
    renderSkeleton,
    toggleTheme,
  };
})();

/* ============================================================================
   AtharDirty — unsaved-changes guard + form drafts.
   navigateTo() consults this module before switching views, so forms can
   warn the user instead of silently losing half-entered data.
   ========================================================================== */
window.AtharDirty = (function () {
  "use strict";

  const DRAFT_PREFIX = "athar_draft_";
  const DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

  let dirty = false;
  let source = null;
  let onDiscard = null;

  function isDirty() {
    return dirty;
  }

  function mark(sourceId, discardCallback) {
    dirty = true;
    if (sourceId) source = sourceId;
    if (typeof discardCallback === "function") onDiscard = discardCallback;
  }

  function clear() {
    dirty = false;
    source = null;
    onDiscard = null;
  }

  function guard(proceed) {
    if (!dirty) { proceed(); return; }
    const core = window.AtharCore;
    core.showConfirmModal({
      title: core.t("unsaved_title"),
      message: core.t("unsaved_message"),
      confirmText: core.t("unsaved_discard"),
      cancelText: core.t("unsaved_keep_editing"),
      isDanger: true,
      onConfirm: function () {
        const cb = onDiscard;
        clear();
        if (cb) { try { cb(); } catch (e) { /* ignore */ } }
        proceed();
      },
    });
  }

  /**
   * Auto-mark the form as dirty on any user input inside the container.
   * Returns an unbind function.
   */
  function bind(container, sourceId, discardCallback) {
    if (!container) return function () { };
    const handler = function (e) {
      const el = e.target;
      if (el && el.matches && el.matches("input, select, textarea")) {
        mark(sourceId, discardCallback);
      }
    };
    container.addEventListener("input", handler);
    container.addEventListener("change", handler);
    return function unbind() {
      container.removeEventListener("input", handler);
      container.removeEventListener("change", handler);
    };
  }

  // ---- Draft storage (localStorage, best-effort) --------------------------
  function saveDraft(key, data) {
    try {
      localStorage.setItem(DRAFT_PREFIX + key, JSON.stringify({ ts: Date.now(), data: data }));
    } catch (e) { /* storage full / unavailable */ }
  }

  function loadDraft(key) {
    try {
      const raw = localStorage.getItem(DRAFT_PREFIX + key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || (Date.now() - (parsed.ts || 0)) > DRAFT_MAX_AGE_MS) {
        localStorage.removeItem(DRAFT_PREFIX + key);
        return null;
      }
      return parsed.data || null;
    } catch (e) { return null; }
  }

  function clearDraft(key) {
    try { localStorage.removeItem(DRAFT_PREFIX + key); } catch (e) { /* ignore */ }
  }

  // Warn before closing/reloading the tab with unsaved changes.
  window.addEventListener("beforeunload", function (e) {
    if (dirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  return {
    isDirty: isDirty,
    mark: mark,
    clear: clear,
    guard: guard,
    bind: bind,
    saveDraft: saveDraft,
    loadDraft: loadDraft,
    clearDraft: clearDraft,
  };
})();