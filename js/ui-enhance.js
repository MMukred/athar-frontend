/**
 * Athar UI enhancements — presentation only, no data or behaviour changes.
 *
 * Runs after every view render (watches #main-content) and:
 *  1. Collapses long filter bars behind a "Filters" toggle, keeping search visible.
 *  2. Labels every table cell with its column header so tables can be shown
 *     as stacked cards on phones (see css/ui.css).
 *  3. Hides the floating "+" button on the dashboard, which already has quick actions.
 */
(function () {
  "use strict";

  const isAr = () => document.documentElement.getAttribute("lang") !== "en";
  const OPEN_KEY = "athar_filters_open";

  function readOpenState() {
    try { return JSON.parse(sessionStorage.getItem(OPEN_KEY) || "{}"); } catch (e) { return {}; }
  }
  function writeOpenState(state) {
    try { sessionStorage.setItem(OPEN_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  function isActiveControl(el) {
    if (el.matches("select")) {
      const first = el.options && el.options[0];
      return !!first && el.value !== first.value;
    }
    if (el.matches("input[type=number], input[type=date], input[type=text]:not(:first-child)")) {
      return String(el.value || "").trim() !== "";
    }
    return false;
  }

  function enhanceFilterBars(root) {
    root.querySelectorAll(".filter-bar").forEach(function (bar, barIndex) {
      if (bar.dataset.fbReady === "1") return;
      const group = bar.querySelector(".filter-group") || bar;
      const items = Array.from(group.children);
      if (items.length < 4) return; // short bars stay as they are

      bar.dataset.fbReady = "1";
      bar.classList.add("fb-collapsible");

      // Keep the first search box (or first control) visible.
      const keep = items.find(function (el) {
        return el.matches("input[type=search], input[type=text]") || el.querySelector("input[type=search], input[type=text]");
      }) || items[0];
      keep.classList.add("fb-keep");

      const controls = items.filter(function (el) { return el !== keep; });
      const activeCount = controls.reduce(function (n, el) {
        const fields = (el.matches("select, input") ? [el] : Array.from(el.querySelectorAll("select, input")))
          .filter(function (f) { return !/per-page|page-size/.test(f.id || ""); });
        return n + fields.filter(isActiveControl).length;
      }, 0);

      const viewKey = (location.hash || "#").split("/")[0] + ":" + barIndex;
      const state = readOpenState();
      const open = !!state[viewKey];
      if (open) bar.classList.add("fb-open");

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-secondary btn-sm fb-toggle fb-keep";
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.innerHTML =
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h18l-7 8v6l-4 2v-8z"/></svg>' +
        '<span>' + (isAr() ? "فلترة" : "Filters") + "</span>" +
        (activeCount ? '<span class="fb-count">' + activeCount + "</span>" : "");
      btn.addEventListener("click", function () {
        const nowOpen = !bar.classList.contains("fb-open");
        bar.classList.toggle("fb-open", nowOpen);
        btn.setAttribute("aria-expanded", nowOpen ? "true" : "false");
        const s = readOpenState();
        s[viewKey] = nowOpen;
        writeOpenState(s);
      });
      keep.insertAdjacentElement("afterend", btn);
    });
  }

  function labelTables(root) {
    root.querySelectorAll("table.data-table").forEach(function (table) {
      if (table.dataset.cardReady === "1") return;
      const heads = Array.from(table.querySelectorAll("thead th")).map(function (th) {
        return (th.textContent || "").replace(/[▲▼⇅↑↓]/g, "").replace(/\s+/g, " ").trim();
      });
      if (!heads.length) return;
      table.dataset.cardReady = "1";
      table.classList.add("table-cards");
      table.querySelectorAll("tbody tr").forEach(function (tr) {
        Array.from(tr.children).forEach(function (td, i) {
          if (td.tagName !== "TD") return;
          const label = heads[i] || "";
          if (label) td.setAttribute("data-label", label);
          else td.classList.add("td-nolabel");
        });
      });
    });
  }

  function syncFab() {
    const fab = document.getElementById("fab-wrap");
    if (!fab) return;
    const view = (location.hash || "#dashboard").replace(/^#/, "").split("/")[0] || "dashboard";
    document.body.classList.toggle("on-dashboard", view === "dashboard");
  }

  let scheduled = false;
  function run() {
    scheduled = false;
    const main = document.getElementById("main-content");
    if (!main) return;
    enhanceFilterBars(main);
    labelTables(main);
    syncFab();
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(run);
  }

  function start() {
    const main = document.getElementById("main-content");
    if (!main) return;
    new MutationObserver(schedule).observe(main, { childList: true, subtree: true });
    window.addEventListener("hashchange", schedule);
    schedule();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
