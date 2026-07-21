(function () {
  "use strict";

  var menu = document.querySelector("[data-mobile-menu]");
  var panel = menu ? menu.querySelector(".mobile-navigation-panel") : null;
  var openButton = document.querySelector("[data-menu-open]");
  var closeButtons = document.querySelectorAll("[data-menu-close], [data-menu-backdrop]");
  var moreMenus = document.querySelectorAll("[data-more-menu]");
  var lastTrigger = null;
  var inertState = new Map();

  function setBackgroundInert(active) {
    document.querySelectorAll(".site-header .header-inner, .site-main, .site-footer, .search-dialog, .lightbox-dialog, .owner-editor").forEach(function (element) {
      if (!(element instanceof HTMLElement) || !("inert" in element)) return;
      if (active) {
        if (!inertState.has(element)) inertState.set(element, Boolean(element.inert));
        element.inert = true;
      } else if (inertState.has(element)) {
        element.inert = inertState.get(element);
      }
    });
    if (!active) inertState.clear();
  }

  function focusableElements(container) {
    return Array.prototype.filter.call(
      container.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'),
      function (element) {
        return !element.hidden && element.getAttribute("aria-hidden") !== "true";
      }
    );
  }

  function closeMenu(returnFocus) {
    if (!(menu instanceof HTMLElement) || menu.hidden) return;
    menu.hidden = true;
    menu.setAttribute("aria-hidden", "true");
    document.body.classList.remove("menu-open");
    setBackgroundInert(false);
    if (openButton) openButton.setAttribute("aria-expanded", "false");
    if (returnFocus && lastTrigger instanceof HTMLElement && document.contains(lastTrigger)) lastTrigger.focus();
  }

  function openMenu(trigger) {
    if (!(menu instanceof HTMLElement)) return;
    document.dispatchEvent(new CustomEvent("daeho:dialog-opening", { detail: { dialog: null, trigger: trigger || null } }));
    lastTrigger = trigger instanceof HTMLElement ? trigger : openButton;
    menu.hidden = false;
    menu.setAttribute("aria-hidden", "false");
    document.body.classList.add("menu-open");
    setBackgroundInert(true);
    if (openButton) openButton.setAttribute("aria-expanded", "true");
    window.requestAnimationFrame(function () {
      var first = panel instanceof HTMLElement ? focusableElements(panel)[0] : null;
      if (first) first.focus();
    });
  }

  if (menu instanceof HTMLElement && panel instanceof HTMLElement && openButton instanceof HTMLElement) {
    openButton.addEventListener("click", function () {
      if (menu.hidden) openMenu(openButton);
      else closeMenu(true);
    });
    closeButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        closeMenu(true);
      });
    });
    menu.addEventListener("click", function (event) {
      if (event.target instanceof Element && event.target.closest("a[href]")) closeMenu(false);
    });
    menu.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu(true);
        return;
      }
      if (event.key !== "Tab") return;
      var items = focusableElements(panel);
      if (!items.length) {
        event.preventDefault();
        return;
      }
      var first = items[0];
      var last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  var mobileQuery = window.matchMedia("(max-width: 48rem)");
  function closeAfterViewportChange(event) {
    if (!event.matches) closeMenu(false);
  }
  if (typeof mobileQuery.addEventListener === "function") mobileQuery.addEventListener("change", closeAfterViewportChange);
  else if (typeof mobileQuery.addListener === "function") mobileQuery.addListener(closeAfterViewportChange);

  document.addEventListener("daeho:dialog-opening", function () {
    closeMenu(false);
  });

  moreMenus.forEach(function (details) {
    details.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && details.open) {
        event.preventDefault();
        details.open = false;
        var summary = details.querySelector("summary");
        if (summary) summary.focus();
      }
    });
  });

  document.addEventListener("click", function (event) {
    moreMenus.forEach(function (details) {
      if (details.open && event.target instanceof Node && !details.contains(event.target)) details.open = false;
    });
  });
})();
