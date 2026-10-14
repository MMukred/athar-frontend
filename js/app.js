/**
 * Athar — Application Boot
 * Thin file: only handles DOM ready, login gating, and wiring.
 * All views live in js/views/*.js
 * All modal openers live in js/modals.js
 * All shared helpers live in js/core.js
 */

(function () {
  "use strict";

  const {
    App,
    t,
    ic,
    showToast,
    showConfirmModal,
    updateUserMenuBadge,
    setLanguage,
    navigateTo,
    handleHashChange,
    renderSidebar,
    renderCurrentView
  } = window.AtharCore;

  // =========================================================================
  // Initial Boot (called after successful login)
  // =========================================================================
  async function boot(user) {
    if (user) {
      App.currentUser = user;
    } else if (window.AtharAuth) {
      App.currentUser = window.AtharAuth.getCurrentUser();
    }

    if (!App.currentUser) {
      if (window.AtharAuth) window.AtharAuth.showLoginScreen();
      return;
    }
    // ---- Boot skeleton (visible while data loads) ----
    const mainEl = document.getElementById("main-content");
    if (mainEl) window.AtharCore.renderSkeleton(mainEl, 6);

    // Load all data from API before rendering
    try {
      await window.AtharStore.loadAll();
    } catch (e) {
      console.error("[boot] loadAll failed", e);
    }

    const state = window.AtharStore.getState();

    App.currentLang = App.currentUser.preferred_language || state.settings.default_language || "ar";
    setLanguage(App.currentLang);

    // ---- Global ESC key closes top-most modal/slide-over ----
    if (!window._atharEscBound) {
      window.addEventListener("keydown", function (e) {
        if (e.key !== "Escape") return;
        const slideover = document.querySelector("#slideover-container .slide-over");
        const modal = document.querySelector("#modal-container .modal-dialog");
        if (!slideover && !modal) return;
        const closer = slideover
          ? document.querySelector("#slideover-container .drawer-header .btn-icon")
          : document.querySelector("#modal-container .modal-header .btn-icon");
        if (closer) closer.click();
      });
      window._atharEscBound = true;
    }

    // ---- Topbar wiring ----
    const sidebarBtn = document.getElementById("sidebar-toggle-btn");
    const brandBtn = document.getElementById("brand-home-btn");
    const langBtn = document.getElementById("lang-toggle-btn");
    const userBtn = document.getElementById("user-profile-btn");
    const searchInput = document.getElementById("global-search-input");

    if (sidebarBtn) sidebarBtn.onclick = function () {
      App.sidebarCollapsed = !App.sidebarCollapsed;
      document.getElementById("app-sidebar").classList.toggle("collapsed", App.sidebarCollapsed);
    };
    if (brandBtn) brandBtn.onclick = function () { navigateTo("dashboard"); };
    if (langBtn) langBtn.onclick = function () { setLanguage(App.currentLang === "ar" ? "en" : "ar"); };
    if (userBtn) userBtn.onclick = function () { window.AtharModals.openUserMenuModal(); };

    // ---- Global search ----
    if (searchInput) {
      searchInput.onkeydown = function (e) {
        if (e.key === "Enter") {
          App.searchQuery = searchInput.value;
          navigateTo("volunteers");
        }
      };
    }

    if (!window._atharSearchBound) {
      window.addEventListener("keydown", function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === "k") {
          e.preventDefault();
          const si = document.getElementById("global-search-input");
          if (si) si.focus();
        }
      });
      window._atharSearchBound = true;
    }

    // ---- Router ----
    if (!App._routerBound) {
      window.addEventListener("hashchange", handleHashChange);
      App._routerBound = true;
    }

    // ---- First render ----
    handleHashChange();
  }

  // =========================================================================
  // Bootstrap — check auth first, then render
  // =========================================================================
  async function bootstrap() {
    if (window.AtharAuth) {
      window.AtharAuth.bindLoginUI();
    }

    const authed = window.AtharAuth && await window.AtharAuth.checkSession();
    if (authed) {
      const user = window.AtharAuth.getCurrentUser();
      if (user) {
        await boot(user);
        window.AtharAuth.startSessionWatcher();
        return;
      }
    }

    if (window.AtharAuth) window.AtharAuth.showLoginScreen();
  }

  // =========================================================================
  // Public API
  // =========================================================================
  function getLang() { return App.currentLang; }

  function setLanguageOnly(lang) {
    App.currentLang = lang;
    const isRtl = lang === "ar";
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("dir", isRtl ? "rtl" : "ltr");
    if (App.currentUser) {
      App.currentUser.preferred_language = lang;
    }
  }

  window.AtharApp = {
    navigateTo,
    setLanguage,
    getLang,
    setLanguageOnly,
    showToast,
    showConfirmModal,
    boot,
    renderCurrentView,

    // Modal openers (proxied to AtharModals)
    openAddVolunteerSlideover: (...a) => window.AtharModals.openAddVolunteerSlideover(...a),
    openTransferModal: (...a) => window.AtharModals.openTransferModal(...a),
    openLogHoursSlideover: (...a) => window.AtharModals.openLogHoursSlideover(...a),
    openCreateMeetingSlideover: (...a) => window.AtharModals.openCreateMeetingSlideover(...a),
    openCreateEventSlideover: (...a) => window.AtharModals.openCreateEventSlideover(...a),   // ← NEW
    openAddCommitteeModal: (...a) => window.AtharModals.openAddCommitteeModal(...a),
    openPermissionsEditor: (...a) => window.AtharModals.openPermissionsEditor(...a),
    openDiffModal: (...a) => window.AtharModals.openDiffModal(...a),
    openRoleSimulatorModal: (...a) => window.AtharModals.openRoleSimulatorModal(...a),
    openRevokeCertModal: (...a) => window.AtharModals.openRevokeCertModal(...a),
    openUserMenuModal: (...a) => window.AtharModals.openUserMenuModal(...a),
    openEditWhatsAppTemplate: (...a) => window.AtharModals.openEditWhatsAppTemplate(...a),
    duplicateWhatsAppTemplate: (...a) => window.AtharModals.duplicateWhatsAppTemplate(...a),
    deleteWhatsAppTemplate: (...a) => window.AtharModals.deleteWhatsAppTemplate(...a),
    openBulkLogHoursSlideover: (...a) => window.AtharModals.openBulkLogHoursSlideover(...a),
    openBulkRatingModal: (...a) => window.AtharModals.openBulkRatingModal(...a),

    logout: () => window.AtharAuth && window.AtharAuth.logout(),

    // =========================================================
    // Volunteer actions
    // =========================================================
    archiveVolunteer: function (volId) {
      const state = window.AtharStore.getState();
      const v = state.volunteers.find(function (x) { return x.id === volId; });
      if (!v) return;
      window.AtharCore.showConfirmModal({
        title: t("confirm_destructive"),
        message: "Archive " + v.full_name + "? Record hidden but preserved for history and certificates.",
        confirmText: t("archive"),
        onConfirm: async function () {
          try {
            await window.AtharAPI.volunteers.archive(volId);
            await window.AtharStore.refreshVolunteers();
            showToast(t("deleted_successfully"), "warning");
            renderCurrentView();
          } catch (err) {
            showToast(err.message || "Archive failed", "error");
          }
        },
      });
    },

    restoreVolunteer: async function (volId) {
      try {
        await window.AtharAPI.volunteers.restore(volId);
        await window.AtharStore.refreshVolunteers();
        showToast("Volunteer restored to active status", "success");
        renderCurrentView();
      } catch (err) {
        showToast(err.message || "Restore failed", "error");
      }
    },

    // =========================================================
    // Hours actions
    // =========================================================
    approveHours: async function (hoursId) {
      try {
        await window.AtharAPI.hours.approve(hoursId);
        await window.AtharStore.refreshHours();
        showToast(t("approved_successfully"), "success");
        renderCurrentView();
      } catch (err) {
        if (err.code === "ALREADY_APPROVED") {
          showToast("Hours already approved", "warning");
        } else {
          showToast(err.message || "Approval failed", "error");
        }
      }
    },

    rejectHours: async function (hoursId) {
      const reason = prompt(t("rejection_prompt"), "Hours unverified");
      if (!reason || reason.trim().length < 3) return;

      try {
        await window.AtharAPI.hours.reject(hoursId, reason.trim());
        await window.AtharStore.refreshHours();
        showToast(t("rejected_successfully"), "warning");
        renderCurrentView();
      } catch (err) {
        if (err.code === "ALREADY_REJECTED") {
          showToast("Hours already rejected", "warning");
        } else {
          showToast(err.message || "Rejection failed", "error");
        }
      }
    },

    // =========================================================
    // Evaluation actions
    // =========================================================
    deleteEvaluation: function (evalId) {
      const state = window.AtharStore.getState();
      const ev = state.evaluations.find(function (e) { return e.id === evalId; });
      if (!ev) return;
      const vol = state.volunteers.find(function (v) { return v.id === ev.volunteer_id; });
      window.AtharCore.showConfirmModal({
        title: t("confirm_destructive"),
        message: "Delete evaluation for " + (vol ? vol.full_name : "this volunteer") + " (" + ev.period_label + ")? This cannot be undone.",
        confirmText: t("delete"),
        onConfirm: async function () {
          try {
            await window.AtharAPI.evaluations.delete(evalId);
            await window.AtharStore.refreshEvaluations();
            showToast("Evaluation deleted", "warning");
            renderCurrentView();
          } catch (err) {
            showToast(err.message || "Delete failed", "error");
          }
        },
      });
    },

    // =========================================================
    // Certificate actions
    // =========================================================
    sendCertWhatsApp: function (certId) {
      const state = window.AtharStore.getState();
      const cert = state.certificates.find(c => c.id === certId);
      if (!cert) return;
      const vol = state.volunteers.find(v => v.id === cert.volunteer_id);
      if (!vol || !vol.whatsapp) {
        showToast("Volunteer has no WhatsApp number", "error");
        return;
      }
      const tmpl = state.whatsapp_templates.find(t => t.name.includes("Certificate") && t.language === cert.language) || state.whatsapp_templates[2];
      let msg = tmpl ? tmpl.body : "Your certificate is ready!";
      msg = msg.replace("{name}", vol.full_name)
        .replace("{certificate_no}", cert.certificate_no)
        .replace("{hours}", cert.total_hours)
        .replace("{verify_url}", cert.qr_code || `https://athar.org/verify/${cert.certificate_no}`);
      window.open(`https://wa.me/${vol.whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(msg)}`, "_blank");
    },

    printCertificateDoc: function () {
      window.ExportUtil.printElement("printable-certificate-document", "Official Volunteer Service Certificate");
    }
  };

  // Kick off
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }
})();