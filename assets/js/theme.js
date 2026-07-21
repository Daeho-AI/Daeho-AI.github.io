(function () {
  "use strict";

  var root = document.documentElement;
  root.classList.add("js");

  var STORAGE_KEY = "daeho-blog:theme:v1";
  var LEGACY_KEY = "theme";
  var modes = ["system", "light", "dark"];
  var labels = {
    system: "테마: 시스템 설정",
    light: "테마: 라이트 모드",
    dark: "테마: 다크 모드",
  };
  var media = window.matchMedia("(prefers-color-scheme: dark)");

  function validMode(value) {
    return modes.indexOf(value) >= 0;
  }

  function readMode() {
    try {
      var stored = window.localStorage.getItem(STORAGE_KEY);
      if (validMode(stored)) return stored;
      var legacy = window.localStorage.getItem(LEGACY_KEY);
      if (legacy === "light" || legacy === "dark") return legacy;
    } catch (error) {
      // The configured HTML default remains usable when storage is unavailable.
    }
    var configured = root.getAttribute("data-theme") || "system";
    return validMode(configured) ? configured : "system";
  }

  function writeMode(mode) {
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
      window.localStorage.removeItem(LEGACY_KEY);
    } catch (error) {
      // The choice still applies to the current document.
    }
  }

  function effectiveTheme(mode) {
    return mode === "system" ? (media.matches ? "dark" : "light") : mode;
  }

  function updateMeta(theme) {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#0c121c" : "#f8fafc");
  }

  function updateControl(control, mode) {
    control.dataset.themeMode = mode;
    control.setAttribute("aria-label", labels[mode]);
    control.setAttribute("title", labels[mode]);
    var label = control.querySelector("[data-theme-label]");
    if (label) label.textContent = labels[mode];
    ["system", "light", "dark"].forEach(function (name) {
      var icon = control.querySelector("[data-theme-icon-" + name + "]");
      if (icon) icon.hidden = name !== mode;
    });
  }

  var controls = [];

  function applyMode(mode, persist) {
    if (!validMode(mode)) mode = "system";
    root.setAttribute("data-theme", mode);
    controls.forEach(function (control) {
      updateControl(control, mode);
    });
    var effective = effectiveTheme(mode);
    updateMeta(effective);
    if (persist) writeMode(mode);
    document.dispatchEvent(
      new CustomEvent("daeho:themechange", {
        detail: { mode: mode, theme: effective },
      })
    );
  }

  var currentMode = readMode();
  applyMode(currentMode, false);

  function initializeControls() {
    controls = Array.prototype.slice.call(document.querySelectorAll("[data-theme-control]"));
    controls.forEach(function (control) {
      updateControl(control, currentMode);
      control.addEventListener("click", function () {
        currentMode = modes[(modes.indexOf(currentMode) + 1) % modes.length];
        applyMode(currentMode, true);
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeControls, { once: true });
  } else {
    initializeControls();
  }

  function systemChanged() {
    if (currentMode === "system") applyMode(currentMode, false);
  }
  if (typeof media.addEventListener === "function") media.addEventListener("change", systemChanged);
  else if (typeof media.addListener === "function") media.addListener(systemChanged);

  window.addEventListener("storage", function (event) {
    if (event.key !== STORAGE_KEY && event.key !== LEGACY_KEY) return;
    currentMode = readMode();
    applyMode(currentMode, false);
  });
})();
