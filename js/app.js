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
      // Anonymous visitors landing on a certificate verification link get the
      // standalone public verification page instead of the login screen.
      const hashParts = (window.location.hash || "").replace(/^#/, "").split("/");
      if (hashParts[0] === "public-verify" && window.AtharViews && window.AtharViews.showPublicVerifyStandalone) {
        document.body.classList.add("is-logged-out");
        window.AtharViews.showPublicVerifyStandalone(hashParts[1] || "");
        return;
      }
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
    const themeBtn = document.getElementById("theme-toggle-btn");
    const userBtn = document.getElementById("user-profile-btn");

    // ---- Sidebar: desktop collapse / mobile off-canvas drawer ----
    const sidebarEl = document.getElementById("app-sidebar");
    const sidebarOverlay = document.getElementById("sidebar-overlay");
    const mobileNavMq = window.matchMedia("(max-width: 900px)");

    function closeMobileSidebar() {
      if (sidebarEl) sidebarEl.classList.remove("mobile-open");
      if (sidebarOverlay) sidebarOverlay.classList.remove("show");
      document.body.classList.remove("sidebar-open");
    }

    if (sidebarBtn) sidebarBtn.onclick = function () {
      if (mobileNavMq.matches && sidebarEl) {
        const open = !sidebarEl.classList.contains("mobile-open");
        sidebarEl.classList.toggle("mobile-open", open);
        if (sidebarOverlay) sidebarOverlay.classList.toggle("show", open);
        document.body.classList.toggle("sidebar-open", open);
        return;
      }
      App.sidebarCollapsed = !App.sidebarCollapsed;
      if (sidebarEl) sidebarEl.classList.toggle("collapsed", App.sidebarCollapsed);
    };
    if (sidebarOverlay) sidebarOverlay.onclick = closeMobileSidebar;
    if (sidebarEl) sidebarEl.addEventListener("click", function (e) {
      if (mobileNavMq.matches && e.target.closest(".nav-item")) closeMobileSidebar();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeMobileSidebar();
    });
    if (mobileNavMq.addEventListener) {
      mobileNavMq.addEventListener("change", function () { closeMobileSidebar(); });
    }
    if (brandBtn) brandBtn.onclick = function () { navigateTo("dashboard"); };
    if (langBtn) langBtn.onclick = function () { setLanguage(App.currentLang === "ar" ? "en" : "ar"); };
    if (themeBtn) themeBtn.onclick = function () { window.AtharCore.toggleTheme(); };
    if (userBtn) userBtn.onclick = function () { window.AtharModals.openUserMenuModal(); };

    // ---- Quick add menu ----
    const quickAddBtn = document.getElementById("quick-add-btn");
    const quickAddMenu = document.getElementById("quick-add-menu");
    function closeQuickAdd() { if (quickAddMenu) quickAddMenu.hidden = true; }
    function renderQuickAddMenu() {
      if (!quickAddMenu) return;
      const items = [];
      if (window.AtharCore.hasPermission("volunteers", "create")) items.push({ label: t("quick_add_volunteer"), icon: "users", onClick: () => window.AtharModals.openAddVolunteerSlideover() });
      if (window.AtharCore.hasPermission("volunteer_hours", "create")) items.push({ label: t("quick_add_hours"), icon: "clock", onClick: () => window.AtharModals.openLogHoursSlideover() });
      if (window.AtharCore.hasPermission("meetings", "create")) items.push({ label: t("quick_add_meeting"), icon: "calendar", onClick: () => window.AtharModals.openCreateMeetingSlideover() });
      quickAddMenu.innerHTML = items.length
        ? items.map((it, i) => `<button type="button" class="quick-add-item" data-idx="${i}">${ic(it.icon, 16)} <span>${it.label}</span></button>`).join("")
        : `<div class="quick-add-empty">—</div>`;
      quickAddMenu.querySelectorAll(".quick-add-item").forEach((btn, i) => {
        btn.onclick = () => { items[i].onClick(); closeQuickAdd(); };
      });
    }
    if (quickAddBtn) {
      quickAddBtn.onclick = (e) => {
        e.stopPropagation();
        if (!quickAddMenu) return;
        if (quickAddMenu.hidden) { renderQuickAddMenu(); quickAddMenu.hidden = false; }
        else quickAddMenu.hidden = true;
      };
    }
    document.addEventListener("click", (e) => {
      if (quickAddMenu && !quickAddMenu.hidden && !e.target.closest("#quick-add-wrap")) closeQuickAdd();
    });

    // ---- Global search (quick-jump: volunteers, committees, meetings, certificates) ----
    if (window.AtharSearch) window.AtharSearch.init();

    // ---- Router ----
    if (!App._routerBound) {
      window.addEventListener("hashchange", handleHashChange);
      App._routerBound = true;
    }

    // ---- First render ----
    handleHashChange();

    // ---- Default-password hygiene ----
    if (App.currentUser && App.currentUser.must_change_password) {
      showPasswordWarningBanner();
      // Prompt once per browser session; the banner stays until resolved.
      if (sessionStorage.getItem("athar_pw_prompted") !== "1") {
        sessionStorage.setItem("athar_pw_prompted", "1");
        setTimeout(function () {
          if (window.AtharModals && window.AtharModals.openChangePasswordModal) {
            window.AtharModals.openChangePasswordModal(true);
          }
        }, 800);
      }
    }
  }

  // =========================================================================
  // Persistent banner while the account still uses the default password
  // =========================================================================
  function showPasswordWarningBanner() {
    if (document.getElementById("pw-warning-banner")) return;
    if (sessionStorage.getItem("athar_pw_banner_dismissed") === "1") return;

    const banner = document.createElement("div");
    banner.id = "pw-warning-banner";
    banner.className = "pw-warning-banner";
    banner.innerHTML = `
      <span class="pw-warning-text">${ic("lock", 15)} ${t("password_change_banner")}</span>
      <span style="display:flex; gap:8px; flex-shrink:0;">
        <button class="btn btn-primary btn-sm" id="pw-banner-change">${t("change_now")}</button>
        <button class="btn btn-secondary btn-sm" id="pw-banner-later">${t("later")}</button>
      </span>
    `;
    document.body.appendChild(banner);
    document.getElementById("pw-banner-change").onclick = function () {
      if (window.AtharModals && window.AtharModals.openChangePasswordModal) {
        window.AtharModals.openChangePasswordModal(true);
      }
    };
    document.getElementById("pw-banner-later").onclick = function () {
      sessionStorage.setItem("athar_pw_banner_dismissed", "1");
      banner.remove();
    };
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

    // Anonymous visitors arriving from a certificate QR / verify link get the
    // standalone public verification page instead of the login screen.
    const hashParts = (window.location.hash || "").replace(/^#/, "").split("/");
    if (hashParts[0] === "public-verify" && window.AtharViews && window.AtharViews.showPublicVerifyStandalone) {
      document.body.classList.add("is-logged-out");
      window.AtharViews.showPublicVerifyStandalone(hashParts[1] || "");
      return;
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
    bulkEditHours: function (hoursIds) {
      window.AtharModals.openBulkEditHoursModal(hoursIds);
    },


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
    openChangePasswordModal: (...a) => window.AtharModals.openChangePasswordModal(...a),
    openResetPasswordModal: (...a) => window.AtharModals.openResetPasswordModal(...a),
    openBulkTransferModal: (...a) => window.AtharModals.openBulkTransferModal(...a),
    openWhatsAppReminderModal: (...a) => window.AtharModals.openWhatsAppReminderModal(...a),
    openImportVolunteersModal: (...a) => window.AtharModals.openImportVolunteersModal(...a),

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
            window.AtharCore.showUndoToast(
              (App.currentLang === "ar" ? "تمت أرشفة " : "Archived ") + v.full_name,
              async function () {
                try {
                  await window.AtharAPI.volunteers.restore(volId);
                  await window.AtharStore.refreshVolunteers();
                  renderCurrentView();
                } catch (err) {
                  window.AtharCore.showToast(err.message || "Restore failed", "error");
                }
              }
            );
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

    approveVolunteer: async function (volId) {
      try {
        await window.AtharAPI.volunteers.update(volId, { status: "active" });
        await window.AtharStore.refreshVolunteers();
        showToast(App.currentLang === "ar" ? "تم قبول المتطوع" : "Volunteer approved", "success");
        renderCurrentView();
      } catch (err) {
        showToast(err.message || "Approve failed", "error");
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

    rejectHours: function (hoursId) {
      window.AtharModals.openRejectHoursModal(hoursId);
    },

    editHours: function (hoursId) {
      window.AtharModals.openEditHoursModal(hoursId);
    },

    deleteHoursEntry: function (hoursId) {
      const state = window.AtharStore.getState();
      const entry = state.volunteer_hours.find(function (h) { return h.id === hoursId; });
      window.AtharCore.showConfirmModal({
        title: t("confirm_destructive"),
        message: App.currentLang === 'ar'
          ? 'سيتم حذف سجل الساعات نهائياً. لا يمكن التراجع.'
          : 'This hours entry will be permanently deleted. This cannot be undone.',
        confirmText: t("delete"),
        isDanger: true,
        onConfirm: async function () {
          try {
            await window.AtharAPI.hours.delete(hoursId);
            await window.AtharStore.refreshHours();
            window.AtharCore.showUndoToast(
              App.currentLang === 'ar' ? 'تم حذف سجل الساعات' : 'Hours entry deleted',
              async function () {
                if (!entry) return;
                try {
                  const created = await window.AtharAPI.hours.create({
                    volunteerId: entry.volunteer_id,
                    activity: entry.activity,
                    hours: entry.hours,
                    date: String(entry.date || "").slice(0, 10),
                    description: entry.description || entry.notes || undefined,
                  });
                  if (entry.status === "approved" && created && created.id) {
                    try { await window.AtharAPI.hours.approve(created.id); } catch (e) { /* already approved */ }
                  }
                  await window.AtharStore.refreshHours();
                  renderCurrentView();
                } catch (err) {
                  window.AtharCore.showToast(err.message || "Undo failed", "error");
                }
              }
            );
            renderCurrentView();
          } catch (err) {
            showToast(err.message || "Delete failed", "error");
          }
        },
      });
    },

goVolunteersFilter: function (status, flags) {
      const App = window.AtharCore.App;
      App.volFilterStatus = status || "all";
      App.volFilterFollowup = !!(flags && flags.followup);
      App.volFilterReady = !!(flags && flags.ready);
      App.volFilterDup = !!(flags && flags.dup);
      App.volFilterNew = !!(flags && flags.newMonth);
      window.AtharCore.navigateTo("volunteers");
    },
    goHoursFilter: function (status) {
      const App = window.AtharCore.App;
      App.hoursFilterStatus = status || "all";
      window.AtharCore.navigateTo("volunteer-hours");
    },
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
        .replace("{verify_url}", cert.qr_code || `${window.location.origin}${window.location.pathname}#public-verify/${cert.certificate_no}`);
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