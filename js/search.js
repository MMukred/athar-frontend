/**
 * Athar Search — global quick-jump.
 * Searches volunteers, committees, meetings, events and certificates from the
 * topbar input (desktop), with a mobile panel for small screens.
 * Fully client-side: reads the AtharStore cache loaded at boot.
 */
window.AtharSearch = (function () {
  "use strict";

  const { App, t, ic, hasPermission, navigateTo, escapeHtml } = window.AtharCore;

  const MAX_PER_GROUP = 5;
  const DEBOUNCE_MS = 120;

  let items = [];          // flat result list across groups
  let highlight = -1;
  let debounceTimer = null;
  let inited = false;
  let activeInput = null;  // input element currently driving the list
  let activeResults = null; // results container currently rendered

  const RECENT_KEY = "athar_recent_searches";
  function getRecent() {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch (e) { return []; }
  }
  function saveRecent(q) {
    if (!q) return;
    try {
      const list = getRecent().filter(function (x) { return x !== q; });
      list.unshift(q);
      localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 5)));
    } catch (e) { /* ignore */ }
  }

  function norm(v) {
    return String(v == null ? "" : v).toLowerCase();
  }

  function matchAny(needle, values) {
    return values.some(function (v) { return v && norm(v).indexOf(needle) !== -1; });
  }

  // -------------------------------------------------------------------------
  // Result building
  // -------------------------------------------------------------------------
  function buildGroups(query) {
    const q = norm(query).trim();
    if (!q) return [];
    const state = window.AtharStore.getState();
    const groups = [];

    // ---- Volunteers ----
    if (hasPermission("volunteers", "view")) {
      const found = state.volunteers
        .filter(function (v) {
          return v.status !== "archived" &&
            matchAny(q, [v.full_name, v.full_name_ar, v.phone, v.whatsapp, v.national_id, v.email]);
        })
        .slice(0, MAX_PER_GROUP);
      if (found.length) {
        groups.push({
          label: t("nav_volunteers"),
          items: found.map(function (v) {
            const committee = state.committees.find(function (c) { return c.id === v.committee_id; });
            return {
              icon: "users",
              title: App.currentLang === "ar" ? (v.full_name_ar || v.full_name) : v.full_name,
              sub: [v.phone, committee ? (App.currentLang === "ar" ? committee.name_ar : committee.name_en) : null]
                .filter(Boolean).join(" • "),
              go: function () { navigateTo("volunteer-profile", { id: v.id }); },
            };
          }),
        });
      }
    }

    // ---- Committees ----
    if (hasPermission("committees", "view")) {
      const found = state.committees
        .filter(function (c) { return c.status !== "archived" && matchAny(q, [c.name_en, c.name_ar]); })
        .slice(0, MAX_PER_GROUP);
      if (found.length) {
        groups.push({
          label: t("nav_committees"),
          items: found.map(function (c) {
            return {
              icon: "building",
              title: App.currentLang === "ar" ? c.name_ar : c.name_en,
              sub: String(c.member_count || 0) + " " + (App.currentLang === "ar" ? "عضو" : "members"),
              go: function () { navigateTo("committee-detail", { id: c.id }); },
            };
          }),
        });
      }
    }

    // ---- Meetings & Events (split by kind) ----
    if (hasPermission("meetings", "view")) {
      const found = state.meetings
        .filter(function (m) { return matchAny(q, [m.title_en, m.title_ar, m.location]); });
      const meetings = found.filter(function (m) { return (m.kind || "meeting") === "meeting"; }).slice(0, MAX_PER_GROUP);
      const events = found.filter(function (m) { return m.kind === "event"; }).slice(0, MAX_PER_GROUP);
      const mkItem = function (m) {
        return {
          icon: m.kind === "event" ? "sparkles" : "calendar",
          title: App.currentLang === "ar" ? m.title_ar : m.title_en,
          sub: [m.meeting_date, m.location].filter(Boolean).join(" • "),
          go: function () { navigateTo("meeting-detail", { id: m.id }); },
        };
      };
      if (meetings.length) groups.push({ label: t("nav_meetings"), items: meetings.map(mkItem) });
      if (events.length) groups.push({ label: t("nav_events"), items: events.map(mkItem) });
    }

    // ---- Certificates (by number) ----
    if (hasPermission("certificates", "view")) {
      const found = state.certificates
        .filter(function (c) { return matchAny(q, [c.certificate_no]); })
        .slice(0, MAX_PER_GROUP);
      if (found.length) {
        groups.push({
          label: t("nav_certificates"),
          items: found.map(function (c) {
            const vol = state.volunteers.find(function (v) { return v.id === c.volunteer_id; });
            return {
              icon: "award",
              title: c.certificate_no,
              sub: vol
                ? (App.currentLang === "ar" ? (vol.full_name_ar || vol.full_name) : vol.full_name)
                : (c.status || ""),
              go: function () { navigateTo("generate-certificate", { id: c.volunteer_id, sub: c.id }); },
            };
          }),
        });
      }
    }

    return groups;
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------
  function renderGroups(groups) {
    items = [];
    let html = "";
    groups.forEach(function (g) {
      html += '<div class="search-group-label">' + escapeHtml(g.label) + "</div>";
      g.items.forEach(function (it) {
        const idx = items.length;
        items.push(it);
        html += '<div class="search-result-item" data-idx="' + idx + '">' +
          '<span class="sri-icon">' + ic(it.icon, 14) + "</span>" +
          '<div class="sri-text">' +
          '<div class="sri-title">' + escapeHtml(it.title) + "</div>" +
          (it.sub ? '<div class="sri-sub num-ltr">' + escapeHtml(it.sub) + "</div>" : "") +
          "</div></div>";
      });
    });
    if (!items.length) {
      html = '<div class="search-no-results">' + escapeHtml(t("search_no_results")) + "</div>";
    }
    return html;
  }

  function setHighlight(idx) {
    highlight = idx;
    if (!activeResults) return;
    const nodes = activeResults.querySelectorAll(".search-result-item");
    nodes.forEach(function (el, i) {
      const on = i === idx;
      el.classList.toggle("highlighted", on);
      if (on && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
    });
  }

  function hideResults() {
    if (activeResults) {
      activeResults.hidden = true;
      activeResults.innerHTML = "";
    }
    items = [];
    highlight = -1;
  }

  function clearInputs() {
    const d = document.getElementById("global-search-input");
    const m = document.getElementById("mobile-search-input");
    if (d) d.value = "";
    if (m) m.value = "";
  }

  function closeAll() {
    hideResults();
    const p = document.getElementById("mobile-search-panel");
    if (p) p.hidden = true;
  }

  function update(inputEl, resultsEl, query) {
    activeInput = inputEl;
    activeResults = resultsEl;
    const q = (query || "").trim();
    if (!q) {
      // Smart suggestions: recent searches + quick links (instead of a dead end).
      const recent = getRecent();
      const quick = [
        { label: t("nav_volunteers"), view: "volunteers" },
        { label: t("nav_committees"), view: "committees" },
        { label: t("nav_meetings"), view: "meetings" },
        { label: t("nav_volunteer_hours"), view: "volunteer-hours" },
      ];
      let html = "";
      if (recent.length) {
        html += '<div class="search-group-label">' + escapeHtml(t("smart_suggest_recent")) + "</div>";
        html += '<div style="display:flex; flex-wrap:wrap; gap:6px; padding:4px 2px 8px;">';
        recent.forEach(function (r) {
          html += '<button type="button" class="search-recent-chip" data-recent="' + escapeHtml(r) + '">' + escapeHtml(r) + "</button>";
        });
        html += "</div>";
      }
      html += '<div class="search-group-label">' + escapeHtml(t("smart_suggest_popular")) + "</div>";
      html += '<div style="display:flex; flex-wrap:wrap; gap:6px; padding:4px 2px 8px;">';
      quick.forEach(function (qk) {
        html += '<button type="button" class="search-recent-chip" data-quick="' + escapeHtml(qk.view) + '">' + escapeHtml(qk.label) + "</button>";
      });
      html += "</div>";
      resultsEl.innerHTML = html;
      resultsEl.hidden = false;
      items = [];
      highlight = -1;
      // bind clicks
      resultsEl.querySelectorAll("[data-recent]").forEach(function (btn) {
        btn.addEventListener("mousedown", function (e) { e.preventDefault(); });
        btn.addEventListener("click", function () {
          const val = btn.getAttribute("data-recent");
          inputEl.value = val;
          update(inputEl, resultsEl, val);
        });
      });
      resultsEl.querySelectorAll("[data-quick]").forEach(function (btn) {
        btn.addEventListener("mousedown", function (e) { e.preventDefault(); });
        btn.addEventListener("click", function () {
          const view = btn.getAttribute("data-quick");
          closeAll();
          clearInputs();
          navigateTo(view);
        });
      });
      return;
    }
    saveRecent(q);
    const groups = buildGroups(query);
    resultsEl.innerHTML = renderGroups(groups);
    resultsEl.hidden = false;
    highlight = -1;
    resultsEl.querySelectorAll(".search-result-item").forEach(function (el) {
      // Keep focus on the input while clicking a result.
      el.addEventListener("mousedown", function (e) { e.preventDefault(); });
      el.addEventListener("click", function () {
        selectItem(Number(el.getAttribute("data-idx")));
      });
      el.addEventListener("mouseenter", function () {
        setHighlight(Number(el.getAttribute("data-idx")));
      });
    });
  }

  function selectItem(idx) {
    const it = items[idx];
    if (!it) return;
    closeAll();
    clearInputs();
    it.go();
  }

  function onKeydown(e, inputEl, resultsEl) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!items.length) return;
      setHighlight(Math.min(highlight + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!items.length) return;
      setHighlight(Math.max(highlight - 1, 0));
    } else if (e.key === "Enter") {
      if (highlight >= 0 && items[highlight]) {
        e.preventDefault();
        selectItem(highlight);
        return;
      }
      // No highlighted result — keep the classic behavior: filter the
      // volunteers list with the typed query.
      if (inputEl.value.trim()) {
        saveRecent(inputEl.value.trim());
        e.preventDefault();
        App.searchQuery = inputEl.value;
        closeAll();
        navigateTo("volunteers");
      }
    } else if (e.key === "Escape") {
      if (resultsEl && !resultsEl.hidden) {
        e.preventDefault();
        hideResults();
      }
    }
  }

  function bindInput(inputEl, resultsEl, onEscapeExtra) {
    if (!inputEl || !resultsEl) return;
    inputEl.setAttribute("autocomplete", "off");
    inputEl.addEventListener("input", function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () { update(inputEl, resultsEl, inputEl.value); }, DEBOUNCE_MS);
    });
    inputEl.addEventListener("focus", function () {
      if (inputEl.value.trim()) update(inputEl, resultsEl, inputEl.value);
    });
    inputEl.addEventListener("keydown", function (e) {
      onKeydown(e, inputEl, resultsEl);
      if (e.key === "Escape" && onEscapeExtra) onEscapeExtra();
    });
    inputEl.addEventListener("blur", function () {
      setTimeout(function () { hideResults(); }, 150);
    });
  }

  // -------------------------------------------------------------------------
  // Init
  // -------------------------------------------------------------------------
  function init() {
    if (inited) return;
    inited = true;

    // Desktop input (hidden on very small screens).
    bindInput(
      document.getElementById("global-search-input"),
      document.getElementById("global-search-results")
    );

    // Mobile panel.
    const btn = document.getElementById("mobile-search-btn");
    const panel = document.getElementById("mobile-search-panel");
    const mInput = document.getElementById("mobile-search-input");
    const mResults = document.getElementById("mobile-search-results");

    if (btn && panel && mInput && mResults) {
      btn.addEventListener("click", function () {
        const willOpen = panel.hidden;
        panel.hidden = !willOpen;
        if (willOpen) mInput.focus();
      });
      bindInput(mInput, mResults, function () { panel.hidden = true; });
    }

    // Click outside closes the dropdown / panel.
    document.addEventListener("click", function (e) {
      const tgt = e.target;
      if (tgt && tgt.closest &&
        (tgt.closest(".top-bar-search") || tgt.closest("#mobile-search-panel") || tgt.closest("#mobile-search-btn"))) {
        return;
      }
      hideResults();
      const p = document.getElementById("mobile-search-panel");
      if (p && !p.hidden) p.hidden = true;
    });

    // Ctrl+K — focus desktop search, or open the mobile panel.
    if (!window._atharSearchBound) {
      window.addEventListener("keydown", function (e) {
        if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
          e.preventDefault();
          const si = document.getElementById("global-search-input");
          const p = document.getElementById("mobile-search-panel");
          const mi = document.getElementById("mobile-search-input");
          if (window.matchMedia("(max-width: 620px)").matches && p && mi) {
            p.hidden = false;
            mi.focus();
          } else if (si) {
            si.focus();
            if (si.select) si.select();
          }
        }
      });
      window._atharSearchBound = true;
    }
  }

  return {
    init: init,
    // Exposed for tests
    _buildGroups: buildGroups,
  };
})();
