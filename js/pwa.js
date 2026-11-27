/**
 * Installable web app (PWA): service worker + "Install app" buttons.
 *
 * - Android / desktop Chrome & Edge: uses the browser's install prompt.
 * - iPhone / iPad (Safari): shows the two-step "Add to Home Screen" guide,
 *   because iOS has no install prompt.
 * - Already installed (opened from the home screen): buttons stay hidden.
 */
window.AtharPWA = (function () {
  "use strict";

  const isAr = () => document.documentElement.getAttribute("lang") !== "en";
  const L = (ar, en) => (isAr() ? ar : en);
  const BANNER_KEY = "athar_install_banner_dismissed_at";

  let deferredPrompt = null;

  const isStandalone = () =>
    window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  const isIOS = () =>
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isMobile = () => window.matchMedia("(max-width: 900px)").matches;

  function canInstall() {
    if (isStandalone()) return false;
    return !!deferredPrompt || isIOS();
  }

  // ---------- Service worker ----------
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js", { scope: "./" }).catch(function () { /* app works without it */ });
    });
  }
  if (isStandalone()) document.documentElement.classList.add("is-standalone");

  // ---------- Install prompt ----------
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPrompt = e;
    refresh();
  });
  window.addEventListener("appinstalled", function () {
    deferredPrompt = null;
    hideBanner();
    refresh();
  });

  function closeSheet() {
    const s = document.getElementById("pwa-sheet");
    if (s) s.remove();
  }

  function showIOSGuide() {
    closeSheet();
    const shareIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';
    const plusIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/></svg>';
    const el = document.createElement("div");
    el.id = "pwa-sheet";
    el.className = "pwa-sheet";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.innerHTML =
      '<div class="pwa-sheet-card">' +
      '<img src="assets/icons/icon-192.png" alt="" class="pwa-sheet-icon">' +
      '<h2>' + L("ثبّت تطبيق أثر على جوالك", "Install the Athar app") + "</h2>" +
      '<ol class="pwa-steps">' +
      "<li><span class=\"pwa-step-ic\">" + shareIcon + "</span>" + L("اضغط زر المشاركة في أسفل سفاري", "Tap the Share button in Safari") + "</li>" +
      "<li><span class=\"pwa-step-ic\">" + plusIcon + "</span>" + L("اختر «إضافة إلى الشاشة الرئيسية» ثم «إضافة»", "Choose “Add to Home Screen”, then “Add”") + "</li>" +
      "</ol>" +
      '<button type="button" class="pwa-sheet-btn">' + L("فهمت", "Got it") + "</button></div>";
    el.addEventListener("click", function (e) { if (e.target === el) closeSheet(); });
    el.querySelector(".pwa-sheet-btn").onclick = closeSheet;
    document.body.appendChild(el);
  }

  async function install() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      try { await deferredPrompt.userChoice; } catch (e) { /* ignore */ }
      deferredPrompt = null;
      refresh();
      return;
    }
    if (isIOS()) { showIOSGuide(); return; }
  }

  // ---------- Buttons ----------
  const downloadIcon = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>';

  function ensureLoginButton() {
    const bar = document.querySelector(".login-toolbar");
    if (!bar) return;
    let btn = document.getElementById("login-install-btn");
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.id = "login-install-btn";
      btn.className = "login-tool-btn login-install-btn";
      btn.onclick = install;
      bar.insertBefore(btn, bar.firstChild);
    }
    btn.innerHTML = downloadIcon + "<span>" + L("ثبّت التطبيق", "Install app") + "</span>";
    btn.hidden = !canInstall();
  }

  function hideBanner() {
    const b = document.getElementById("pwa-banner");
    if (b) b.remove();
  }

  function ensureBanner() {
    const loggedIn = !document.body.classList.contains("is-logged-out");
    let dismissed = 0;
    try { dismissed = Number(localStorage.getItem(BANNER_KEY) || 0); } catch (e) { /* ignore */ }
    const recentlyDismissed = Date.now() - dismissed < 7 * 24 * 3600 * 1000;
    if (!loggedIn || !isMobile() || !canInstall() || recentlyDismissed) { hideBanner(); return; }
    if (document.getElementById("pwa-banner")) return;
    const b = document.createElement("div");
    b.id = "pwa-banner";
    b.className = "pwa-banner";
    b.innerHTML =
      '<img src="assets/icons/icon-192.png" alt="" class="pwa-banner-icon">' +
      '<div class="pwa-banner-text"><strong>' + L("ثبّت تطبيق أثر", "Install the Athar app") + "</strong><span>" +
      L("افتحه من شاشة جوالك مثل أي تطبيق", "Open it from your home screen like any app") + "</span></div>" +
      '<button type="button" class="pwa-banner-btn">' + L("تثبيت", "Install") + "</button>" +
      '<button type="button" class="pwa-banner-x" aria-label="' + L("إغلاق", "Close") + '">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button>';
    b.querySelector(".pwa-banner-btn").onclick = install;
    b.querySelector(".pwa-banner-x").onclick = function () {
      try { localStorage.setItem(BANNER_KEY, String(Date.now())); } catch (e) { /* ignore */ }
      hideBanner();
    };
    document.body.appendChild(b);
  }

  function refresh() {
    ensureLoginButton();
    ensureBanner();
  }

  // Login screen language toggle and login/logout change what should show.
  document.addEventListener("DOMContentLoaded", function () {
    refresh();
    new MutationObserver(refresh).observe(document.body, { attributes: true, attributeFilter: ["class"] });
    new MutationObserver(refresh).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  });

  return { install: install, canInstall: canInstall, isStandalone: isStandalone };
})();
