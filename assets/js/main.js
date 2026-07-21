(function () {
  "use strict";

  var app = window.DaehoBlog || {};
  var toastTimer = 0;
  var searchIndexPromises = new Map();
  var MAX_STORED_JSON_LENGTH = 200000;
  var MAX_SEARCH_INDEX_LENGTH = 5 * 1024 * 1024;

  function normalizeText(value) {
    var text = typeof value === "string" ? value : String(value || "");
    try {
      text = text.normalize("NFKC");
    } catch (error) {
      // Older browsers can still search the un-normalized value.
    }
    return text.toLocaleLowerCase("ko-KR").replace(/\s+/g, " ").trim();
  }

  function isEditableTarget(target) {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])"));
  }

  function safeUrl(value, options) {
    if (typeof value !== "string" || !value.trim()) return null;
    var url;
    try {
      url = new URL(value, document.baseURI);
    } catch (error) {
      return null;
    }

    var allowedProtocols = (options && options.protocols) || ["http:", "https:"];
    if (allowedProtocols.indexOf(url.protocol) < 0) return null;
    if (options && options.sameOrigin && url.origin !== window.location.origin) return null;
    return url;
  }

  function sameOriginPath(value) {
    var url = safeUrl(value, { sameOrigin: true });
    if (!url) return "";
    url.username = "";
    url.password = "";
    url.hash = "";
    url.search = "";
    return url.pathname || "/";
  }

  function canonicalUrl() {
    var canonical = document.querySelector('link[rel="canonical"]');
    var url = safeUrl(canonical && canonical.getAttribute("href") ? canonical.getAttribute("href") : window.location.href);
    if (!url) url = new URL(window.location.href);
    url.hash = "";
    url.search = "";
    return url.toString();
  }

  function storageGet(key, fallback, validator) {
    try {
      var raw = window.localStorage.getItem(key);
      if (raw === null) return fallback;
      if (raw.length > MAX_STORED_JSON_LENGTH) return fallback;
      var parsed = JSON.parse(raw);
      return typeof validator !== "function" || validator(parsed) ? parsed : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function storageSet(key, value) {
    try {
      var serialized = JSON.stringify(value);
      if (serialized.length > MAX_STORED_JSON_LENGTH) return false;
      window.localStorage.setItem(key, serialized);
      return true;
    } catch (error) {
      return false;
    }
  }

  function storageRemove(key) {
    try {
      window.localStorage.removeItem(key);
      return true;
    } catch (error) {
      return false;
    }
  }

  function toast(message) {
    var region = document.querySelector("[data-toast-region]");
    if (!(region instanceof HTMLElement) || typeof message !== "string" || !message.trim()) return;
    window.clearTimeout(toastTimer);
    var notice = document.createElement("div");
    notice.className = "toast";
    notice.textContent = message.trim();
    region.replaceChildren(notice);
    region.hidden = false;
    region.classList.add("is-visible");
    toastTimer = window.setTimeout(function () {
      region.classList.remove("is-visible");
      region.hidden = true;
      region.replaceChildren();
    }, 3500);
  }

  async function copyText(value) {
    var text = typeof value === "string" ? value : "";
    if (!text) return false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (error) {
      // Fall through to the selection-based compatibility path.
    }

    var buffer = document.createElement("textarea");
    buffer.value = text;
    buffer.readOnly = true;
    buffer.tabIndex = -1;
    buffer.setAttribute("aria-hidden", "true");
    buffer.className = "visually-hidden";
    document.body.append(buffer);
    buffer.select();
    var copied = false;
    try {
      copied = document.execCommand("copy");
    } catch (error) {
      copied = false;
    } finally {
      buffer.remove();
    }
    return copied;
  }

  function syncDialogState() {
    var visitorDialogOpen = Array.prototype.some.call(document.querySelectorAll("dialog[open]"), function (dialog) {
      return !dialog.matches("#owner-editor-panel, .owner-editor-panel");
    });
    document.body.classList.toggle("dialog-open", visitorDialogOpen);
  }

  function closeDialog(dialog) {
    if (!(dialog instanceof HTMLDialogElement) || !dialog.open) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
    syncDialogState();
  }

  function openDialog(dialog, trigger) {
    if (!(dialog instanceof HTMLDialogElement)) return false;
    var ownerDialog = document.querySelector("#owner-editor-panel[open], dialog.owner-editor-panel[open]");
    if (ownerDialog && ownerDialog !== dialog) {
      toast("콘텐츠 편집 창을 닫은 뒤 이 기능을 사용해 주세요.");
      return false;
    }

    document.dispatchEvent(
      new CustomEvent("daeho:dialog-opening", {
        detail: { dialog: dialog, trigger: trigger instanceof HTMLElement ? trigger : null },
      })
    );
    document.querySelectorAll("dialog[open]").forEach(function (other) {
      if (other !== dialog && !other.matches("#owner-editor-panel, .owner-editor-panel")) closeDialog(other);
    });

    try {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    } catch (error) {
      return false;
    }
    syncDialogState();
    return true;
  }

  function debounce(callback, delay) {
    var timer = 0;
    return function () {
      var context = this;
      var args = arguments;
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        callback.apply(context, args);
      }, delay);
    };
  }

  function parseDelimited(value) {
    if (typeof value !== "string" || !value) return [];
    return value
      .split(value.indexOf("||") >= 0 ? "||" : "|")
      .map(function (item) {
        return item.trim();
      })
      .filter(Boolean);
  }

  function indexSourceUrl(explicitSource) {
    if (typeof explicitSource === "string" && explicitSource.trim()) {
      return safeUrl(explicitSource, { sameOrigin: true });
    }
    var sourceElement = document.querySelector(
      "[data-search-index-url], [data-search-page][data-index-url]"
    );
    var source = document.body.dataset.searchIndexUrl || "";
    if (!source && sourceElement) {
      source =
        sourceElement.getAttribute("data-search-index-url") ||
        sourceElement.getAttribute("data-index-url") ||
        sourceElement.getAttribute("href") ||
        "";
    }
    if (!source) source = "/search.json";
    return safeUrl(source, { sameOrigin: true });
  }

  function cleanString(value, maximum) {
    return typeof value === "string" ? value.slice(0, maximum) : "";
  }

  function cleanStringList(value) {
    return Array.isArray(value)
      ? value
          .filter(function (item) {
            return typeof item === "string";
          })
          .slice(0, 50)
          .map(function (item) {
            return item.slice(0, 200);
          })
      : [];
  }

  function cleanSearchItem(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    var url = safeUrl(typeof value.url === "string" ? value.url : "", { sameOrigin: true });
    var title = cleanString(value.title, 500).trim();
    if (!url || !title) return null;
    return {
      title: title,
      url: url.pathname + url.search + url.hash,
      description: cleanString(value.description, 2000),
      date: cleanString(value.date, 80),
      categories: cleanStringList(value.categories),
      tags: cleanStringList(value.tags),
      series: cleanString(value.series, 300),
      searchableText: cleanString(value.searchable_text || value.searchableText, 12000),
      cover: cleanString(value.cover, 2000),
      readingTime: Number.isFinite(Number(value.reading_time || value.readingTime))
        ? Math.max(1, Math.min(999, Number(value.reading_time || value.readingTime)))
        : 0,
      type: cleanString(value.type, 40) || "post",
      featured: value.featured === true,
    };
  }

  function loadSearchIndex(explicitSource) {
    var url = indexSourceUrl(explicitSource);
    if (!url) return Promise.reject(new Error("검색 인덱스 경로가 올바르지 않습니다."));
    var key = url.toString();
    if (searchIndexPromises.has(key)) return searchIndexPromises.get(key);
    var request = (async function () {
      var response = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
        referrerPolicy: "same-origin",
      });
      if (!response.ok) throw new Error("검색 인덱스를 불러오지 못했습니다.");
      var declaredLength = Number(response.headers.get("content-length") || 0);
      if (declaredLength > MAX_SEARCH_INDEX_LENGTH) throw new Error("검색 인덱스가 너무 큽니다.");
      var source = await response.text();
      if (source.length > MAX_SEARCH_INDEX_LENGTH) throw new Error("검색 인덱스가 너무 큽니다.");
      var parsed = JSON.parse(source);
      if (!Array.isArray(parsed)) throw new Error("검색 인덱스 형식이 올바르지 않습니다.");
      return parsed.slice(0, 10000).map(cleanSearchItem).filter(Boolean);
    })().catch(function (error) {
      searchIndexPromises.delete(key);
      throw error;
    });
    searchIndexPromises.set(key, request);
    return request;
  }

  app.normalizeText = normalizeText;
  app.isEditableTarget = isEditableTarget;
  app.safeUrl = safeUrl;
  app.sameOriginPath = sameOriginPath;
  app.canonicalUrl = canonicalUrl;
  app.storage = { get: storageGet, set: storageSet, remove: storageRemove };
  app.toast = toast;
  app.copyText = copyText;
  app.openDialog = openDialog;
  app.closeDialog = closeDialog;
  app.debounce = debounce;
  app.parseDelimited = parseDelimited;
  app.loadSearchIndex = loadSearchIndex;
  app.events = {
    bookmarksChanged: "daeho:bookmarks-changed",
    recentChanged: "daeho:recently-viewed-changed",
    themeChanged: "daeho:themechange",
  };
  window.DaehoBlog = app;

  function prepareTableWrapper(wrapper, table) {
    wrapper.tabIndex = 0;
    if (!wrapper.hasAttribute("role")) wrapper.setAttribute("role", "region");
    if (!wrapper.hasAttribute("aria-label") && !wrapper.hasAttribute("aria-labelledby")) {
      var caption = table.querySelector("caption");
      var captionText = caption ? caption.textContent.trim() : "";
      wrapper.setAttribute("aria-label", captionText ? captionText + " 표 스크롤 영역" : "표 스크롤 영역");
    }
  }

  document.querySelectorAll(".prose table").forEach(function (table) {
    var existingWrapper = table.closest(".table-scroll, .table-wrapper");
    if (existingWrapper instanceof HTMLElement) {
      existingWrapper.classList.add("table-scroll");
      prepareTableWrapper(existingWrapper, table);
      return;
    }
    if (!table.parentNode) return;
    var wrapper = document.createElement("div");
    wrapper.className = "table-scroll";
    table.parentNode.insertBefore(wrapper, table);
    wrapper.append(table);
    prepareTableWrapper(wrapper, table);
  });

  document.addEventListener("close", syncDialogState, true);
  document.querySelectorAll("[data-current-year]").forEach(function (element) {
    element.textContent = String(new Date().getFullYear());
  });
  var errorPathWrapper = document.querySelector("[data-error-path-wrapper]");
  var errorPath = document.querySelector("[data-error-path]");
  if (errorPathWrapper instanceof HTMLElement && errorPath instanceof HTMLElement) {
    var requestedPath = window.location.pathname + window.location.search;
    if (requestedPath.length > 2048) requestedPath = requestedPath.slice(0, 2047) + "…";
    errorPath.textContent = requestedPath;
    errorPathWrapper.hidden = false;
  }

  if (document.body.dataset.pwaEnabled === "true" && "serviceWorker" in navigator) {
    var serviceWorkerUrl = safeUrl(document.body.dataset.serviceWorkerUrl || "", { sameOrigin: true });
    if (serviceWorkerUrl) {
      window.addEventListener(
        "load",
        function () {
          navigator.serviceWorker.register(serviceWorkerUrl.pathname).catch(function () {
            // Offline support is optional; a registration failure must not affect reading.
          });
        },
        { once: true }
      );
    }
  }
})();
