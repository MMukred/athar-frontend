/**
 * Mobile app shell: bottom tab bar (phones only, ≤760px).
 *  - Volunteers:  بوابتي · أفكاري · [امسح] · حسابي
 *  - Staff:       الرئيسية · المتطوعون · [+] · الاجتماعات · المزيد
 * "المزيد" opens the existing side drawer, "+" opens the existing quick-actions
 * menu, "حسابي" opens the existing account menu — nothing is duplicated.
 * The bar is rebuilt whenever the sidebar re-renders (login, navigation,
 * language change), so it always mirrors the user's role and live badges.
 */
(function () {
  "use strict";

  const MQ = window.matchMedia("(max-width: 760px)");
  const core = () => window.AtharCore;
  const L = (ar, en) => (core().App.currentLang === "ar" ? ar : en);

  let bar = null;

  function ensureBar() {
    if (bar) return bar;
    bar = document.createElement("nav");
    bar.id = "app-tabbar";
    bar.className = "app-tabbar";
    bar.setAttribute("aria-label", "App navigation");
    document.body.appendChild(bar);
    return bar;
  }

  function tab(id, label, icon, opts) {
    opts = opts || {};
    const App = core().App;
    const active = opts.active != null ? opts.active : App.currentView === id;
    return `<button type="button" class="tab-item ${active ? "is-active" : ""} ${opts.center ? "tab-center" : ""}" data-tab="${id}" aria-label="${label}" ${active ? 'aria-current="page"' : ""}>
      <span class="tab-icon">${core().ic(icon, opts.center ? 24 : 21, { strokeWidth: opts.center ? 2.4 : 2 })}${opts.badge ? `<span class="tab-badge num-ltr">${opts.badge > 99 ? "99+" : opts.badge}</span>` : ""}${opts.dot ? '<span class="tab-dot"></span>' : ""}</span>
      ${opts.center ? "" : `<span class="tab-label">${label}</span>`}
    </button>`;
  }

  function closeQuick() {
    const menu = document.getElementById("fab-menu");
    const main = document.getElementById("fab-main");
    if (menu && !menu.hidden) {
      menu.hidden = true;
      if (main) { main.classList.remove("is-open"); main.setAttribute("aria-expanded", "false"); }
    }
  }

  function render() {
    closeQuick();
    const App = core().App;
    const user = App.currentUser;
    const loggedIn = !!user && !document.body.classList.contains("is-logged-out");
    document.body.classList.toggle("has-tabbar", loggedIn && MQ.matches);
    if (!loggedIn) { if (bar) bar.hidden = true; return; }
    ensureBar().hidden = !MQ.matches;
    if (!MQ.matches) return;

    const ideasOn = window.AtharIdeas && window.AtharIdeas.isOn();
    let html = "";
    if (user.role === "volunteer") {
      html += tab("portal", L("بوابتي", "Portal"), "user");
      if (ideasOn) html += tab("ideas", L("أفكاري", "Ideas"), "sparkles");
      html += tab("scan", L("امسح الحضور", "Scan"), "qr_code", { center: true, active: false });
      html += tab("account", L("حسابي", "Account"), "settings", { active: false });
    } else {
      const has = (m) => core().hasPermission(m, "view");
      const st = window.AtharStore.getState();
      const drawerBadges = document.querySelectorAll("#sidebar-nav-container .nav-badge[style*='--warning']").length;
      html += tab("dashboard", L("الرئيسية", "Home"), "dashboard");
      if (has("volunteers")) {
        const pend = (st.volunteers || []).filter(v => v.status === "pending").length;
        html += tab("volunteers", L("المتطوعون", "Volunteers"), "users", {
          active: ["volunteers", "volunteer-profile", "applications"].includes(App.currentView),
          badge: core().hasPermission("volunteers", "edit") ? pend : 0,
        });
      }
      html += tab("quick", L("إجراء سريع", "Quick action"), "plus", { center: true, active: false });
      if (has("meetings")) html += tab("meetings", L("الاجتماعات", "Meetings"), "calendar", { active: ["meetings", "events", "meeting-detail"].includes(App.currentView) });
      const mainIds = ["dashboard", "volunteers", "volunteer-profile", "applications", "meetings", "events", "meeting-detail"];
      html += tab("more", L("المزيد", "More"), "sliders", { active: !mainIds.includes(App.currentView), dot: drawerBadges > 0 });
    }
    bar.innerHTML = html;
    bar.style.setProperty("--tab-count", String(bar.children.length));

    bar.querySelectorAll(".tab-item").forEach(b => {
      b.onclick = (ev) => {
        // Keep the page's "click outside closes the menu" handlers from firing.
        ev.stopPropagation();
        const id = b.getAttribute("data-tab");
        if (navigator.vibrate) { try { navigator.vibrate(8); } catch (e) { /* ignore */ } }
        if (id === "scan") { if (window.AtharScanner) window.AtharScanner.open(); return; }
        if (id === "account") { if (window.AtharModals) window.AtharModals.openUserMenuModal(); return; }
        if (id === "more") { const t = document.getElementById("sidebar-toggle-btn"); if (t) t.click(); return; }
        if (id === "quick") { const f = document.getElementById("fab-main"); if (f) f.click(); return; }
        core().navigateTo(id);
      };
    });
  }

  // Rebuild after every sidebar render (covers login, navigation, language, badges).
  const nav = document.getElementById("sidebar-nav-container");
  if (nav && window.MutationObserver) new MutationObserver(render).observe(nav, { childList: true });
  if (MQ.addEventListener) MQ.addEventListener("change", render);
  const bodyObs = new MutationObserver(render);
  bodyObs.observe(document.body, { attributes: true, attributeFilter: ["class"] });

  window.AtharMobileNav = { render };
})();
