/**
 * Shared page chrome: phone rotate-to-portrait gate.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PowerUI = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function setupRotateGate() {
    var gate = document.getElementById("rotate-gate");
    if (!gate) return;

    var lockTargets = document.querySelectorAll(
      ".skip-link, .site-header, .site-main, .site-footer"
    );
    var wasLocked = false;

    function isLocked() {
      return window.getComputedStyle(gate).display !== "none";
    }

    function sync() {
      var locked = isLocked();
      gate.setAttribute("aria-hidden", locked ? "false" : "true");
      lockTargets.forEach(function (el) {
        el.inert = locked;
      });
      if (locked && !wasLocked) {
        var title = document.getElementById("rotate-gate-title");
        if (title) title.focus();
      }
      wasLocked = locked;
    }

    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    if (window.matchMedia) {
      var query = window.matchMedia(
        "(orientation: landscape) and (max-height: 540px) and (max-width: 1000px)"
      );
      if (query.addEventListener) {
        query.addEventListener("change", sync);
      } else if (query.addListener) {
        query.addListener(sync);
      }
    }
    sync();
  }

  return {
    setupRotateGate: setupRotateGate,
  };
});
