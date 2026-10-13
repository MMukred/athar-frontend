/**
 * Athar Authentication Module — API-backed
 *
 * Login/logout/session all go through AtharAPI (js/api.js).
 * No local password hashing, no local session tokens.
 * Access token is kept in memory by the API client.
 * Refresh token is stored in sessionStorage (or localStorage with "remember me").
 */

window.AtharAuth = (function () {
  "use strict";

  const LOCKOUT_KEY = "athar_lockout_v1";
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_MINUTES = 15;

  let currentUser = null;
  let sessionTimer = null;
  let activityBound = false;
  let lastActivity = Date.now();

  // =========================================================================
  // Lockout (client-side UX guard — server also rate-limits)
  // =========================================================================
  function getLockout(email) {
    try {
      const raw = localStorage.getItem(LOCKOUT_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data[email.toLowerCase()] || null;
    } catch {
      return null;
    }
  }

  function setLockout(email, untilTs, attempts) {
    let data = {};
    try { data = JSON.parse(localStorage.getItem(LOCKOUT_KEY) || "{}"); } catch { }
    data[email.toLowerCase()] = { until: untilTs, attempts };
    localStorage.setItem(LOCKOUT_KEY, JSON.stringify(data));
  }

  function clearLockout(email) {
    let data = {};
    try { data = JSON.parse(localStorage.getItem(LOCKOUT_KEY) || "{}"); } catch { }
    delete data[email.toLowerCase()];
    localStorage.setItem(LOCKOUT_KEY, JSON.stringify(data));
  }

  function registerFailedAttempt(email) {
    const lock = getLockout(email);
    const attempts = (lock ? lock.attempts : 0) + 1;
    if (attempts >= MAX_ATTEMPTS) {
      setLockout(email, Date.now() + LOCKOUT_MINUTES * 60 * 1000, attempts);
    } else {
      setLockout(email, 0, attempts);
    }
  }

  // =========================================================================
  // User shape adapter
  // API returns camelCase — frontend expects snake_case
  // =========================================================================
  function normalizeUser(apiUser) {
    if (!apiUser) return null;
    return {
      id: apiUser.id,
      email: apiUser.email,
      full_name: apiUser.fullName || apiUser.full_name,
      full_name_ar: apiUser.fullNameAr || apiUser.full_name_ar || null,
      preferred_language: apiUser.preferredLanguage || apiUser.preferred_language || "ar",
      role: apiUser.role,
      is_active: apiUser.isActive !== false,
      permissions: apiUser.permissions || {},
      last_login_at: apiUser.lastLoginAt || apiUser.last_login_at || null,
    };
  }

  // =========================================================================
  // Session check — async
  // =========================================================================
  async function checkSession() {
    if (!window.AtharAPI || !window.AtharAPI.hasSession()) return false;
    try {
      const apiUser = await window.AtharAPI.auth.me();
      currentUser = normalizeUser(apiUser);
      return true;
    } catch (e) {
      try { window.AtharAPI.clearTokens(); } catch { }
      currentUser = null;
      return false;
    }
  }

  // =========================================================================
  // Login
  // =========================================================================
  async function login(email, password, remember) {
    const normEmail = String(email || "").trim().toLowerCase();

    const lock = getLockout(normEmail);
    if (lock && lock.until > Date.now()) {
      const mins = Math.ceil((lock.until - Date.now()) / 60000);
      return { success: false, error: "Account locked. Try again in " + mins + " minute(s)." };
    }

    try {
      const data = await window.AtharAPI.auth.login(normEmail, password, !!remember);
      currentUser = normalizeUser(data.user);
      clearLockout(normEmail);
      return { success: true, user: currentUser };
    } catch (e) {
      if (e.status === 401 || e.code === "INVALID_CREDENTIALS") {
        registerFailedAttempt(normEmail);
        return { success: false, error: "Invalid email or password." };
      }
      if (e.status === 403 || e.code === "ACCOUNT_DISABLED") {
        return { success: false, error: "This account has been deactivated." };
      }
      if (e.status === 429 || e.code === "TOO_MANY_ATTEMPTS") {
        return { success: false, error: e.message || "Too many login attempts. Please wait 15 minutes." };
      }
      if (e.code === "NETWORK_ERROR" || e.status === 0) {
        return { success: false, error: "Cannot reach the server. Check your connection." };
      }
      return { success: false, error: e.message || "Login failed. Please try again." };
    }
  }

  // =========================================================================
  // Logout
  // =========================================================================
  async function logout(silent) {
    try {
      await window.AtharAPI.auth.logout();
    } catch { }

    currentUser = null;
    stopSessionWatcher();

    if (!silent) {
      showLoginScreen();
      document.body.classList.add("is-logged-out");
      const app = document.getElementById("app");
      if (app) app.style.display = "none";
    }
  }

  // =========================================================================
  // Session watcher — idle timeout
  // =========================================================================
  function bindActivityListeners() {
    if (activityBound) return;
    const onActivity = function () { lastActivity = Date.now(); };
    ["click", "keydown", "mousemove", "touchstart"].forEach(function (evt) {
      document.addEventListener(evt, onActivity, { passive: true });
    });
    activityBound = true;
  }

  function startSessionWatcher() {
    if (sessionTimer) clearInterval(sessionTimer);
    lastActivity = Date.now();
    bindActivityListeners();

    sessionTimer = setInterval(function () {
      if (!currentUser) return;
      let timeoutMin = 15;
      try {
        const state = window.AtharStore.getState();
        timeoutMin = Number(state.settings.session_timeout_minutes) || 15;
      } catch { }

      const idleMs = Date.now() - lastActivity;
      if (idleMs > timeoutMin * 60 * 1000) {
        logout(true);
        if (window.AtharApp && window.AtharApp.showToast) {
          window.AtharApp.showToast("Session expired due to inactivity. Please sign in again.", "warning");
        }
      }
    }, 30 * 1000);
  }

  function stopSessionWatcher() {
    if (sessionTimer) {
      clearInterval(sessionTimer);
      sessionTimer = null;
    }
  }

  // =========================================================================
  // Login screen
  // =========================================================================
  function applyLoginTranslations() {
    const lang = (window.AtharApp && window.AtharApp.getLang && window.AtharApp.getLang()) || "ar";
    const isAr = lang === "ar";
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("dir", isAr ? "rtl" : "ltr");

    const setText = function (id, txt) {
      const el = document.getElementById(id);
      if (el) el.textContent = txt;
    };

    setText("login-title", isAr ? "أثر" : "Athar");
    setText("login-subtitle", isAr ? "نظام إدارة المتطوعين واللجان" : "Volunteer & Committees Management System");
    setText("login-email-label", isAr ? "البريد الإلكتروني" : "Email Address");
    setText("login-password-label", isAr ? "كلمة المرور" : "Password");
    setText("login-remember-label", isAr ? "تذكرني" : "Remember me");
    setText("login-submit-btn", isAr ? "تسجيل الدخول" : "Sign In");
    setText("login-lang-text", isAr ? "English" : "العربية");
  }

  function showLoginScreen() {
    const screen = document.getElementById("login-screen");
    if (!screen) return;
    screen.style.display = "flex";
    document.body.classList.add("is-logged-out");
    const app = document.getElementById("app");
    if (app) app.style.display = "none";
    applyLoginTranslations();
    setTimeout(function () {
      const emailInput = document.getElementById("login-email");
      if (emailInput) emailInput.focus();
    }, 100);
  }

  function hideLoginScreen() {
    const screen = document.getElementById("login-screen");
    if (screen) screen.style.display = "none";
    document.body.classList.remove("is-logged-out");
    const app = document.getElementById("app");
    if (app) app.style.display = "";
  }

  function bindLoginUI() {
    const form = document.getElementById("login-form");
    const errorBox = document.getElementById("login-error");
    const submitBtn = document.getElementById("login-submit-btn");
    const toggleBtn = document.getElementById("password-toggle");
    const langBtn = document.getElementById("login-lang-toggle");

    if (!form) return;

    if (toggleBtn) {
      toggleBtn.onclick = function () {
        const pw = document.getElementById("login-password");
        pw.type = pw.type === "password" ? "text" : "password";
      };
    }

    if (langBtn) {
      langBtn.onclick = function () {
        const current = (window.AtharApp && window.AtharApp.getLang && window.AtharApp.getLang()) || "ar";
        const next = current === "ar" ? "en" : "ar";
        if (window.AtharApp && window.AtharApp.setLanguageOnly) {
          window.AtharApp.setLanguageOnly(next);
        }
        applyLoginTranslations();
      };
    }

    form.onsubmit = async function (e) {
      e.preventDefault();
      if (errorBox) errorBox.style.display = "none";

      const email = document.getElementById("login-email").value;
      const password = document.getElementById("login-password").value;
      const remember = document.getElementById("login-remember").checked;

      submitBtn.disabled = true;
      const originalText = submitBtn.textContent;
      const isEn = (window.AtharApp && window.AtharApp.getLang && window.AtharApp.getLang() === "en");
      submitBtn.textContent = isEn ? "Signing in..." : "جاري تسجيل الدخول...";

      const result = await login(email, password, remember);

      submitBtn.disabled = false;
      submitBtn.textContent = originalText;

      if (!result.success) {
        if (errorBox) {
          errorBox.textContent = "⚠ " + result.error;
          errorBox.style.display = "flex";
        }
        return;
      }

      hideLoginScreen();
      document.getElementById("login-password").value = "";
      if (errorBox) errorBox.style.display = "none";

      if (window.AtharApp && window.AtharApp.boot) {
        await window.AtharApp.boot(result.user);
      }
      startSessionWatcher();
      if (window.AtharApp && window.AtharApp.showToast) {
        window.AtharApp.showToast("Welcome back, " + result.user.full_name, "success");
      }
    };
  }

  return {
    checkSession: checkSession,
    getCurrentUser: function () { return currentUser; },
    login: login,
    logout: logout,
    showLoginScreen: showLoginScreen,
    hideLoginScreen: hideLoginScreen,
    bindLoginUI: bindLoginUI,
    startSessionWatcher: startSessionWatcher,
    stopSessionWatcher: stopSessionWatcher,
    applyLoginTranslations: applyLoginTranslations,
  };
})();