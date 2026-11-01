/**
 * Athar Spotlight — full-screen command palette (Ctrl/Cmd+K).
 * Reuses AtharSearch._buildGroups for results; presents them in a
 * Spotlight/Raycast-style overlay with keyboard navigation.
 */
window.AtharSpotlight = (function () {
  "use strict";
  const { App, t, ic, escapeHtml, navigateTo } = window.AtharCore;

  let overlay = null;
  let input = null;
  let results = null;
  let items = [];
  let highlight = -1;
  let debounceTimer = null;

  function open() {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.className = "spotlight-backdrop";
    overlay.innerHTML = `
      <div class="spotlight-panel" role="dialog" aria-modal="true" aria-label="Search">
        <div class="spotlight-input-wrap">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input class="spotlight-input" type="text" placeholder="${escapeHtml(t('search_placeholder') || 'Search volunteers, committees, meetings…')}" autocomplete="off" spellcheck="false">
          <span class="spotlight-kbd">Esc</span>
        </div>
        <div class="spotlight-results"></div>
        <div class="spotlight-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>Enter</kbd> open</span>
          <span><kbd>Esc</kbd> close</span>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    input = overlay.querySelector(".spotlight-input");
    results = overlay.querySelector(".spotlight-results");

    // close on backdrop click
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close();
    });
    input.addEventListener("input", function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(render, 80);
    });
    input.addEventListener("keydown", onKeydown);
    // prevent body scroll
    document.body.style.overflow = "hidden";
    setTimeout(function () { input.focus(); }, 10);
    render();
  }

  function close() {
    if (!overlay) return;
    overlay.remove();
    overlay = null; input = null; results = null;
    items = []; highlight = -1;
    document.body.style.overflow = "";
  }

  function onKeydown(e) {
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); highlight = Math.min(highlight + 1, items.length - 1); paint(); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); highlight = Math.max(highlight - 1, 0); paint(); return; }
    if (e.key === "Enter") {
      e.preventDefault();
      const it = items[highlight];
      if (it && it.go) { close(); it.go(); }
      return;
    }
  }

  function render() {
    const q = input.value.trim();
    items = [];
    highlight = 0;
    if (!q) {
      // show recent searches + quick nav
      results.innerHTML = `<div class="spotlight-empty">${escapeHtml(t('search_type_to_find') || 'Type to search volunteers, committees, meetings and more…')}</div>`;
      return;
    }
    if (!window.AtharSearch || !window.AtharSearch._buildGroups) {
      results.innerHTML = `<div class="spotlight-empty">Search unavailable</div>`;
      return;
    }
    const groups = window.AtharSearch._buildGroups(q);
    if (!groups || !groups.length) {
      results.innerHTML = `<div class="spotlight-empty">${escapeHtml(t('no_results') || 'No results found')}</div>`;
      return;
    }
    let html = "";
    groups.forEach(function (g) {
      html += `<div class="spotlight-group-title">${escapeHtml(g.label || g.title || g.group)}</div>`;
      (g.items || []).forEach(function (it) {
        const idx = items.length;
        items.push(it);
        html += `
          <div class="spotlight-item" data-idx="${idx}">
            <div class="spotlight-item-icon">${ic(it.icon || 'search', 16)}</div>
            <div class="spotlight-item-body">
              <div class="spotlight-item-title">${escapeHtml(it.title)}</div>
              ${it.sub ? `<div class="spotlight-item-sub">${escapeHtml(it.sub)}</div>` : ''}
            </div>
          </div>
        `;
      });
    });
    results.innerHTML = html;
    // bind clicks
    results.querySelectorAll(".spotlight-item").forEach(function (el) {
      el.addEventListener("click", function () {
        const idx = parseInt(el.getAttribute("data-idx"), 10);
        const it = items[idx];
        if (it && it.go) { close(); it.go(); }
      });
    });
    paint();
  }

  function paint() {
    results.querySelectorAll(".spotlight-item").forEach(function (el, i) {
      el.classList.toggle("is-active", i === highlight);
    });
    const active = results.querySelector(".spotlight-item.is-active");
    if (active) active.scrollIntoView({ block: "nearest" });
  }

  // Hijack Ctrl/Cmd+K
  if (!window._atharSpotlightBound) {
    window.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        open();
      }
    });
    window._atharSpotlightBound = true;
  }

  return { open: open, close: close };
})();
