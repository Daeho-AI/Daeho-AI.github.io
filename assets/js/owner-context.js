(function () {
  "use strict";

  var SESSION_STORAGE_KEY = "daeho-owner-editor-session";
  var SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;
  var framed = true;
  var editRequested = false;
  var hasSession = false;

  try {
    framed = window.top !== window.self;
  } catch (error) {
    framed = true;
  }

  try {
    editRequested = new URLSearchParams(window.location.search).get("edit") === "1";
  } catch (error) {
    editRequested = false;
  }

  try {
    hasSession = SESSION_ID_PATTERN.test(window.sessionStorage.getItem(SESSION_STORAGE_KEY) || "");
  } catch (error) {
    hasSession = false;
  }

  var active = !framed && (editRequested || hasSession);
  var context = Object.freeze({
    active: active,
    editRequested: editRequested,
    externalScriptsAllowed: !active && !framed,
    framed: framed,
    hasSession: hasSession,
  });

  Object.defineProperty(window, "DaehoOwnerContext", {
    configurable: false,
    enumerable: false,
    value: context,
    writable: false,
  });

  document.documentElement.dataset.ownerContext = active ? "true" : "false";
  document.documentElement.dataset.ownerFramed = framed ? "true" : "false";

  if (framed && editRequested) {
    try {
      window.top.location.replace(window.location.href);
    } catch (error) {
      // Cross-origin parents may block top navigation. The editor still remains disabled.
    }
  }
})();
