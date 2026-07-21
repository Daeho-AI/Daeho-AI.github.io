(function () {
  "use strict";

  var root = document.documentElement;
  var themeKey = "theme";
  var darkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");
  var mobileMenuQuery = window.matchMedia("(max-width: 48rem)");
  var manualThemeSelected = false;

  function readStoredTheme() {
    try {
      var storedTheme = window.localStorage.getItem(themeKey);
      return storedTheme === "light" || storedTheme === "dark" ? storedTheme : null;
    } catch (error) {
      return null;
    }
  }

  function writeStoredTheme(theme) {
    try {
      window.localStorage.setItem(themeKey, theme);
    } catch (error) {
      // The selected theme still applies for this page when storage is unavailable.
    }
  }

  function systemTheme() {
    return darkModeQuery.matches ? "dark" : "light";
  }

  function updateThemeControls(theme) {
    var isDark = theme === "dark";
    var label = isDark ? "라이트 모드로 전환" : "다크 모드로 전환";
    var themeColor = document.querySelector('meta[name="theme-color"]');

    document.querySelectorAll("[data-theme-toggle]").forEach(function (button) {
      button.setAttribute("aria-label", label);
      button.setAttribute("title", label);
      button.setAttribute("aria-pressed", String(isDark));
    });

    document.querySelectorAll("[data-theme-icon]").forEach(function (icon) {
      icon.textContent = isDark ? "☀" : "☾";
      icon.setAttribute("aria-hidden", "true");
    });

    document.querySelectorAll("[data-theme-label]").forEach(function (element) {
      element.textContent = label;
    });

    if (themeColor) {
      themeColor.setAttribute("content", isDark ? "#0c121c" : "#f8fafc");
    }
  }

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    root.style.colorScheme = theme;
    updateThemeControls(theme);
  }

  var storedTheme = readStoredTheme();
  manualThemeSelected = storedTheme !== null;
  applyTheme(storedTheme || systemTheme());

  document.querySelectorAll("[data-theme-toggle]").forEach(function (button) {
    button.addEventListener("click", function () {
      var nextTheme = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      manualThemeSelected = true;
      applyTheme(nextTheme);
      writeStoredTheme(nextTheme);
    });
  });

  function handleSystemThemeChange() {
    if (!manualThemeSelected) {
      applyTheme(systemTheme());
    }
  }

  if (typeof darkModeQuery.addEventListener === "function") {
    darkModeQuery.addEventListener("change", handleSystemThemeChange);
  } else if (typeof darkModeQuery.addListener === "function") {
    darkModeQuery.addListener(handleSystemThemeChange);
  }

  window.addEventListener("storage", function (event) {
    if (event.key !== themeKey) {
      return;
    }

    var synchronizedTheme = event.newValue;
    manualThemeSelected = synchronizedTheme === "light" || synchronizedTheme === "dark";
    applyTheme(manualThemeSelected ? synchronizedTheme : systemTheme());
  });

  var menuToggle = document.querySelector("[data-menu-toggle]");
  var siteNav = document.querySelector("[data-site-nav]");
  var menuOverlay = document.querySelector("[data-menu-overlay]");
  var menuIsOpen = false;

  function getMenuLinks() {
    if (!siteNav) {
      return [];
    }

    return Array.prototype.slice.call(
      siteNav.querySelectorAll("a[href], button:not([disabled])")
    );
  }

  function setNavAccessibility(isOpen) {
    if (!siteNav) {
      return;
    }

    if (mobileMenuQuery.matches) {
      siteNav.setAttribute("aria-hidden", String(!isOpen));
      if ("inert" in siteNav) {
        siteNav.inert = !isOpen;
      }
    } else {
      siteNav.removeAttribute("aria-hidden");
      if ("inert" in siteNav) {
        siteNav.inert = false;
      }
    }
  }

  function setMenu(isOpen, returnFocus) {
    if (!menuToggle || !siteNav) {
      return;
    }

    menuIsOpen = Boolean(isOpen && mobileMenuQuery.matches);
    menuToggle.setAttribute("aria-expanded", String(menuIsOpen));
    menuToggle.setAttribute("aria-label", menuIsOpen ? "메뉴 닫기" : "메뉴 열기");
    menuToggle.setAttribute("title", menuIsOpen ? "메뉴 닫기" : "메뉴 열기");
    siteNav.classList.toggle("is-open", menuIsOpen);
    document.body.classList.toggle("menu-open", menuIsOpen);
    setNavAccessibility(menuIsOpen);

    if (menuOverlay) {
      menuOverlay.hidden = !menuIsOpen;
      menuOverlay.classList.toggle("is-visible", menuIsOpen);
      menuOverlay.setAttribute("aria-hidden", String(!menuIsOpen));
    }

    if (menuIsOpen) {
      window.requestAnimationFrame(function () {
        var firstLink = getMenuLinks()[0];
        if (firstLink) {
          firstLink.focus();
        }
      });
    } else if (returnFocus) {
      menuToggle.focus();
    }
  }

  if (menuToggle && siteNav) {
    setMenu(false, false);

    menuToggle.addEventListener("click", function () {
      setMenu(!menuIsOpen, false);
    });

    siteNav.addEventListener("click", function (event) {
      if (event.target.closest("a[href]")) {
        setMenu(false, false);
      }
    });

    if (menuOverlay) {
      menuOverlay.addEventListener("click", function () {
        setMenu(false, true);
      });
    }

    document.addEventListener("click", function (event) {
      if (
        menuIsOpen &&
        !siteNav.contains(event.target) &&
        !menuToggle.contains(event.target)
      ) {
        setMenu(false, true);
      }
    });

    document.addEventListener("keydown", function (event) {
      if (!menuIsOpen) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setMenu(false, true);
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      var menuLinks = getMenuLinks();
      var firstLink = menuLinks[0];
      var lastLink = menuLinks[menuLinks.length - 1];
      var activeElement = document.activeElement;

      if (!firstLink || !lastLink) {
        event.preventDefault();
        menuToggle.focus();
      } else if (activeElement === menuToggle) {
        event.preventDefault();
        (event.shiftKey ? lastLink : firstLink).focus();
      } else if (event.shiftKey && activeElement === firstLink) {
        event.preventDefault();
        menuToggle.focus();
      } else if (!event.shiftKey && activeElement === lastLink) {
        event.preventDefault();
        menuToggle.focus();
      } else if (!siteNav.contains(activeElement)) {
        event.preventDefault();
        firstLink.focus();
      }
    });

    function handleMenuViewportChange() {
      var focusWasInMenu = siteNav.contains(document.activeElement);
      setMenu(false, focusWasInMenu && mobileMenuQuery.matches);
    }

    if (typeof mobileMenuQuery.addEventListener === "function") {
      mobileMenuQuery.addEventListener("change", handleMenuViewportChange);
    } else if (typeof mobileMenuQuery.addListener === "function") {
      mobileMenuQuery.addListener(handleMenuViewportChange);
    }
  }

  document.querySelectorAll("[data-current-year]").forEach(function (element) {
    element.textContent = String(new Date().getFullYear());
  });
})();
