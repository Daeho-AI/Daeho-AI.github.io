(function () {
  "use strict";

  var loader = document.currentScript;
  if (!(loader instanceof HTMLScriptElement)) return;
  var styleUrl = loader.dataset.ownerEditorStyle || "";
  var bundleUrl = loader.dataset.ownerEditorScript || "";
  var SESSION_STORAGE_KEY = "daeho-owner-editor-session";
  var SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;

  function framedDocument() {
    if (window.DaehoOwnerContext && window.DaehoOwnerContext.framed === true) return true;
    try {
      return window.top !== window.self;
    } catch (error) {
      return true;
    }
  }

  function ownerContextActive() {
    if (framedDocument()) return false;
    if (window.DaehoOwnerContext && window.DaehoOwnerContext.active === true) return true;
    try {
      if (new URLSearchParams(window.location.search).get("edit") === "1") return true;
      return SESSION_ID_PATTERN.test(window.sessionStorage.getItem(SESSION_STORAGE_KEY) || "");
    } catch (error) {
      return false;
    }
  }

  function reloadIntoOwnerContext() {
    if (framedDocument()) return;
    var url = new URL(window.location.href);
    url.searchParams.set("edit", "1");
    window.location.assign(url.toString());
  }

  document.addEventListener("keydown", function (event) {
    if (!event.ctrlKey || !event.shiftKey || event.key.toLocaleLowerCase("en-US") !== "e") return;
    if (ownerContextActive() || framedDocument()) return;
    event.preventDefault();
    reloadIntoOwnerContext();
  });

  if (!ownerContextActive() || !styleUrl || !bundleUrl) return;

  var style = document.createElement("link");
  style.rel = "stylesheet";
  style.href = styleUrl;
  style.dataset.ownerEditorAsset = "style";
  style.addEventListener("load", function () {
    var bundle = document.createElement("script");
    bundle.src = bundleUrl;
    bundle.async = false;
    bundle.dataset.ownerEditorAsset = "script";
    document.head.append(bundle);
  }, { once: true });
  style.addEventListener("error", function () {
    console.error("Owner editor styles could not be loaded; the privileged UI remains disabled.");
  }, { once: true });
  document.head.append(style);
})();
