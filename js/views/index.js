/**
 * Athar Views Registry
 * Each view file registers itself: window.AtharViews[viewKey] = (container, params) => { ... };
 * The core router dispatches by looking up window.AtharViews[viewKey].
 */

window.AtharViews = window.AtharViews || {};
