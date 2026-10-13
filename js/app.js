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

    // Load all data from API before rendering
    try {
      await window.AtharStore.loadAll();
    } catch (e) {
      console.error("[boot] loadAll failed", e);
    }

    const state = window.AtharStore.getState();

    App.currentLang = App.currentUser.preferred_language || state.settings.default_language || "ar";
    setLanguage(App.currentLang);

    // ---- 4. Global guards (unsaved changes, ESC) ----
    if (!window._atharBeforeUnloadBound) {
      window.addEventListener("beforeunload", function (e) {
        if (window.AtharDirty && window.AtharDirty.isDirty()) {
          e.preventDefault();
          e.returnValue = "";
          return "";
        }
      });
      window._atharBeforeUnloadBound = true;
    }

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

    // ---- 5. Topbar wiring ----
    const sidebarBtn = document.getElementById("sidebar-toggle-btn");
    const brandBtn = document.getElementById("brand-home-btn");
    const langBtn = document.getElementById("lang-toggle-btn");
    const roleBtn = document.getElementById("role-switcher-btn");
    const userBtn = document.getElementById("user-profile-btn");
    const searchInput = document.getElementById("global-search-input");

    if (sidebarBtn) sidebarBtn.onclick = function () {
      App.sidebarCollapsed = !App.sidebarCollapsed;
      document.getElementById("app-sidebar").classList.toggle("collapsed", App.sidebarCollapsed);
    };
    if (brandBtn) brandBtn.onclick = function () { navigateTo("dashboard"); };
    if (langBtn) langBtn.onclick = function () { setLanguage(App.currentLang === "ar" ? "en" : "ar"); };
    if (roleBtn) roleBtn.onclick = function () { window.AtharModals.openRoleSimulatorModal(); };
    if (userBtn) userBtn.onclick = function () { window.AtharModals.openUserMenuModal(); };

    // ---- 6. Global search ----
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

    // ---- 7. Router ----
    if (!App._routerBound) {
      window.addEventListener("hashchange", handleHashChange);
      App._routerBound = true;
    }

    // ---- 8. First render ----
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
        // Try to restore crypto key from sessionStorage (A5 compat — no-op if not applied)
        if (window.AtharCrypto) {
          try {
            await window.AtharCrypto.loadKeyFromSession();
            if (window.AtharCrypto.hasKey()) {
              await window.AtharStore.applyDecryption && await window.AtharStore.applyDecryption();
            }
          } catch (e) {
            console.warn("Crypto restore failed", e);
          }
        }
        await boot(user);
        window.AtharAuth.startSessionWatcher();
        return;
      }
    }

    if (window.AtharAuth) window.AtharAuth.showLoginScreen();
  }

  // =========================================================================
  // Public API — used by auth.js, modals.js, and inline onclick handlers
  // =========================================================================
  function getLang() { return App.currentLang; }

  function setLanguageOnly(lang) {
    App.currentLang = lang;
    const isRtl = lang === "ar";
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("dir", isRtl ? "rtl" : "ltr");
    if (App.currentUser) {
      App.currentUser.preferred_language = lang;
      window.AtharStore.save();
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

    // Modal openers (proxied to AtharModals for backward compatibility)
    openAddVolunteerSlideover: (...a) => window.AtharModals.openAddVolunteerSlideover(...a),
    openTransferModal: (...a) => window.AtharModals.openTransferModal(...a),
    openLogHoursSlideover: (...a) => window.AtharModals.openLogHoursSlideover(...a),
    openCreateMeetingSlideover: (...a) => window.AtharModals.openCreateMeetingSlideover(...a),
    openAddCommitteeModal: (...a) => window.AtharModals.openAddCommitteeModal(...a),
    openPermissionsEditor: (...a) => window.AtharModals.openPermissionsEditor(...a),
    openDiffModal: (...a) => window.AtharModals.openDiffModal(...a),
    openRoleSimulatorModal: (...a) => window.AtharModals.openRoleSimulatorModal(...a),
    openRevokeCertModal: (...a) => window.AtharModals.openRevokeCertModal(...a),
    openUserMenuModal: (...a) => window.AtharModals.openUserMenuModal(...a),
    openEditWhatsAppTemplate: (...a) => window.AtharModals.openEditWhatsAppTemplate(...a),
    duplicateWhatsAppTemplate: (...a) => window.AtharModals.duplicateWhatsAppTemplate(...a),
    deleteWhatsAppTemplate: (...a) => window.AtharModals.deleteWhatsAppTemplate(...a),

    // Auth shortcut
    logout: () => window.AtharAuth && window.AtharAuth.logout(),

    // Role switch (used by modal)
    switchUser: function (userId) {
      const state = window.AtharStore.getState();
      const u = state.users.find(x => x.id === userId);
      if (!u) return;
      App.currentUser = u;
      updateUserMenuBadge();
      renderSidebar();
      const modalContainer = document.getElementById("modal-container");
      if (modalContainer) modalContainer.innerHTML = "";
      showToast(`Switched active account to: ${u.full_name} (${u.role})`);
      renderCurrentView();
    },

    toggleUserActive: function (userId) {
      const state = window.AtharStore.getState();
      const u = state.users.find(x => x.id === userId);
      if (!u || u.role === "super_admin") return;
      u.is_active = !u.is_active;
      window.AtharStore.save();
      window.AtharStore.logAudit(App.currentUser, "update", "user", u.id, `${u.is_active ? 'Activated' : 'Deactivated'} user: ${u.full_name}`, null, null);
      showToast(u.is_active ? "User activated" : "User deactivated", "success");
      renderCurrentView();
    },

    // Volunteer actions
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

    // Hours actions
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

    // Certificate actions
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