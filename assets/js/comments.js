(function () {
  "use strict";

  var root = document.querySelector("[data-comments]");
  if (!(root instanceof HTMLElement)) return;
  if (!window.DaehoOwnerContext || window.DaehoOwnerContext.externalScriptsAllowed !== true) {
    root.hidden = true;
    return;
  }

  var mount = root.querySelector("[data-giscus-mount]");
  if (!(mount instanceof HTMLElement)) return;
  var media = window.matchMedia("(prefers-color-scheme: dark)");
  var mapping = root.dataset.giscusMapping || "pathname";
  var strict = root.dataset.giscusStrict || "1";
  var reactionsEnabled = root.dataset.giscusReactionsEnabled || "1";
  var inputPosition = root.dataset.giscusInputPosition || "top";
  var language = root.dataset.giscusLang || "ko";
  var valid =
    /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(root.dataset.giscusRepo || "") &&
    /^[A-Za-z0-9_-]{6,256}$/.test(root.dataset.giscusRepoId || "") &&
    Boolean((root.dataset.giscusCategory || "").trim()) &&
    /^[A-Za-z0-9_-]{6,256}$/.test(root.dataset.giscusCategoryId || "") &&
    ["pathname", "url", "title", "og:title", "specific", "number"].includes(mapping) &&
    ["0", "1"].includes(strict) &&
    ["0", "1"].includes(reactionsEnabled) &&
    ["top", "bottom"].includes(inputPosition) &&
    /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/.test(language);
  if (!valid) return;

  function effectiveTheme(event) {
    if (event && event.detail && (event.detail.theme === "dark" || event.detail.theme === "light")) {
      return event.detail.theme;
    }
    var mode = document.documentElement.getAttribute("data-theme") || "system";
    if (mode === "dark" || mode === "light") return mode;
    return media.matches ? "dark" : "light";
  }

  function update(event) {
    var frame = root.querySelector("iframe.giscus-frame");
    if (!(frame instanceof HTMLIFrameElement) || !frame.contentWindow) return;
    frame.contentWindow.postMessage(
      { giscus: { setConfig: { theme: effectiveTheme(event) } } },
      "https://giscus.app"
    );
  }

  var observer = new MutationObserver(function () {
    var frame = root.querySelector("iframe.giscus-frame");
    if (!(frame instanceof HTMLIFrameElement)) return;
    frame.addEventListener("load", update, { once: true });
    update();
    observer.disconnect();
  });
  observer.observe(root, { childList: true, subtree: true });

  var script = document.createElement("script");
  script.src = "https://giscus.app/client.js";
  script.async = true;
  script.crossOrigin = "anonymous";
  script.setAttribute("data-repo", root.dataset.giscusRepo || "");
  script.setAttribute("data-repo-id", root.dataset.giscusRepoId || "");
  script.setAttribute("data-category", root.dataset.giscusCategory || "");
  script.setAttribute("data-category-id", root.dataset.giscusCategoryId || "");
  script.setAttribute("data-mapping", mapping);
  script.setAttribute("data-strict", strict);
  script.setAttribute("data-reactions-enabled", reactionsEnabled);
  script.setAttribute("data-emit-metadata", "0");
  script.setAttribute("data-input-position", inputPosition);
  script.setAttribute("data-theme", effectiveTheme());
  script.setAttribute("data-lang", language);
  script.addEventListener("error", function () {
    observer.disconnect();
    root.hidden = true;
  }, { once: true });

  root.hidden = false;
  mount.append(script);
  document.addEventListener("daeho:themechange", update);
  if (typeof media.addEventListener === "function") media.addEventListener("change", update);
  else if (typeof media.addListener === "function") media.addListener(update);
})();
