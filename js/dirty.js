/**
 * Athar Dirty Form Tracker
 * Detects unsaved changes in forms and guards against accidental data loss.
 *
 * Usage:
 *   AtharDirty.track(formElement);             // start tracking
 *   AtharDirty.isDirty();                      // check
 *   AtharDirty.guard(() => { closeModal(); }); // run callback only if user confirms discard
 *   AtharDirty.beginSubmit();                  // call in form submit handler
 *   AtharDirty.clear();                        // call after successful save
 */

window.AtharDirty = (function () {
  "use strict";

  let dirty = false;
  let currentForm = null;
  let listeners = [];
  let submitInProgress = false;
  let bypassOnce = false;

  function track(formEl) {
    clear();
    if (!formEl) return;
    currentForm = formEl;
    const handler = () => { dirty = true; };
    formEl.addEventListener("input", handler, { passive: true });
    formEl.addEventListener("change", handler, { passive: true });
    listeners.push({ el: formEl, type: "input", fn: handler });
    listeners.push({ el: formEl, type: "change", fn: handler });
  }

  function clear() {
    listeners.forEach(l => l.el.removeEventListener(l.type, l.fn));
    listeners = [];
    currentForm = null;
    dirty = false;
    submitInProgress = false;
  }

  function markClean() { dirty = false; }
  function isDirty() { return dirty && !submitInProgress; }
  function beginSubmit() { submitInProgress = true; }
  function endSubmit() { submitInProgress = false; }
  function setBypassOnce(val) { bypassOnce = !!val; }
  function consumeBypass() {
    const v = bypassOnce;
    bypassOnce = false;
    return v;
  }

  /**
   * Run `onProceed` immediately if form is clean.
   * Otherwise show a confirm modal; run `onProceed` only after "Discard".
   */
  function guard(onProceed) {
    if (!isDirty()) {
      onProceed();
      return;
    }

    const t = (k, fallback) => {
      const lang = (window.AtharApp?.getLang?.()) || (window.AtharCore?.App?.currentLang) || "ar";
      if (window.Translations && window.Translations[lang] && window.Translations[lang][k]) {
        return window.Translations[lang][k];
      }
      return fallback;
    };

    const modalFn = window.AtharCore?.showConfirmModal || window.AtharApp?.showConfirmModal;

    if (typeof modalFn === "function") {
      modalFn({
        title: t("unsaved_title", "تغييرات غير محفوظة / Unsaved Changes"),
        message: t("unsaved_message", "لديك تغييرات غير محفوظة. هل أنت متأكد من رغبتك في تجاهلها؟ / You have unsaved changes. Discard them?"),
        confirmText: t("unsaved_discard", "تجاهل / Discard"),
        cancelText: t("unsaved_keep_editing", "متابعة التحرير / Keep Editing"),
        isDanger: true,
        onConfirm: () => {
          clear();
          onProceed();
        }
      });
    } else {
      if (window.confirm(t("unsaved_message", "You have unsaved changes. Discard them?"))) {
        clear();
        onProceed();
      }
    }
  }

  return {
    track,
    clear,
    isDirty,
    markClean,
    beginSubmit,
    endSubmit,
    guard,
    setBypassOnce,
    consumeBypass,
    _state: () => ({ dirty, submitInProgress, bypassOnce })
  };
})();
