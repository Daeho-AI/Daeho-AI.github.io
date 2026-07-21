(function () {
  "use strict";

  var app = window.DaehoBlog;
  if (!app || document.body.dataset.bookmarksEnabled !== "true") return;
  var STORAGE_KEY = "daeho-blog:bookmarks:v1";
  var MAX_BOOKMARKS = 500;
  var renderVersion = 0;

  function validStored(value) {
    return (
      Array.isArray(value) &&
      value.length <= MAX_BOOKMARKS &&
      value.every(function (item) {
        return typeof item === "string" && item.length > 0 && item.length <= 2000;
      })
    );
  }

  function load() {
    var seen = new Set();
    return app.storage
      .get(STORAGE_KEY, [], validStored)
      .map(app.sameOriginPath)
      .filter(function (path) {
        if (!path || seen.has(path)) return false;
        seen.add(path);
        return true;
      })
      .slice(0, MAX_BOOKMARKS);
  }

  function buttonPath(button) {
    var supplied = button.dataset.bookmarkUrl || "";
    if (!supplied) {
      var card = button.closest("[data-post-card]");
      var link = card ? card.querySelector("h2 a[href], h3 a[href], a[href]") : null;
      supplied = link ? link.getAttribute("href") : document.body.dataset.pageUrl || app.canonicalUrl();
    }
    return app.sameOriginPath(supplied);
  }

  function updateButtons(paths) {
    var selected = new Set(paths);
    document.querySelectorAll("[data-bookmark-button]").forEach(function (button) {
      var path = buttonPath(button);
      var saved = Boolean(path && selected.has(path));
      button.setAttribute("aria-pressed", String(saved));
      button.classList.toggle("is-bookmarked", saved);
      var title = (button.dataset.bookmarkTitle || "게시글").trim();
      button.setAttribute("aria-label", title + (saved ? " 북마크에서 삭제" : " 북마크에 저장"));
      var label = button.querySelector("[data-bookmark-label]");
      if (label) label.textContent = saved ? "저장됨" : "북마크";
    });
  }

  function notify(paths) {
    updateButtons(paths);
    document.dispatchEvent(new CustomEvent(app.events.bookmarksChanged, { detail: { paths: paths.slice() } }));
  }

  function toggle(button) {
    var path = buttonPath(button);
    if (!path) {
      app.toast("이 항목의 북마크 주소가 올바르지 않습니다.");
      return;
    }
    var paths = load();
    var index = paths.indexOf(path);
    var adding = index < 0;
    if (adding) paths.unshift(path);
    else paths.splice(index, 1);
    paths = paths.slice(0, MAX_BOOKMARKS);
    if (!app.storage.set(STORAGE_KEY, paths)) {
      app.toast("이 브라우저에서는 북마크를 저장할 수 없습니다.");
      return;
    }
    notify(paths);
    app.toast(adding ? "북마크에 저장했습니다." : "북마크에서 삭제했습니다.");
  }

  function bookmarkEntry(item) {
    var listItem = document.createElement("li");
    var container = document.createElement("article");
    container.className = "bookmark-entry";
    var heading = document.createElement("h2");
    var link = document.createElement("a");
    link.href = item.url;
    link.textContent = item.title;
    heading.append(link);
    container.append(heading);
    if (item.description) {
      var description = document.createElement("p");
      description.textContent = item.description;
      container.append(description);
    }
    var remove = document.createElement("button");
    remove.type = "button";
    remove.className = "text-button";
    remove.dataset.bookmarkRemove = app.sameOriginPath(item.url);
    remove.textContent = "북마크 삭제";
    container.append(remove);
    listItem.append(container);
    return listItem;
  }

  function fallbackEntry(path) {
    return bookmarkEntry({ title: path, url: path, description: "" });
  }

  async function renderPage() {
    var page = document.querySelector("[data-bookmarks-page]");
    if (!(page instanceof HTMLElement)) return;
    var list = page.querySelector("[data-bookmark-list]");
    if (!(list instanceof HTMLElement)) return;
    var status = page.querySelector("[data-bookmarks-status]");
    var emptyState = page.querySelector("[data-bookmarks-empty]");
    var clearAll = page.querySelector("[data-bookmarks-clear]");

    function setPageState(total, message) {
      if (status) status.textContent = message || "저장된 북마크 " + total + "개";
      if (emptyState instanceof HTMLElement) emptyState.hidden = total !== 0;
      if (clearAll instanceof HTMLElement) clearAll.hidden = total === 0;
    }
    var version = ++renderVersion;
    var paths = load();
    list.replaceChildren();
    if (!paths.length) {
      setPageState(0);
      return;
    }
    try {
      var index = await app.loadSearchIndex(page.dataset.indexUrl || "");
      if (version !== renderVersion) return;
      var byPath = new Map();
      index.forEach(function (item) {
        var path = app.sameOriginPath(item.url);
        if (path && item.type !== "project") byPath.set(path, item);
      });
      var validPaths = paths.filter(function (path) {
        return byPath.has(path);
      });
      if (validPaths.length !== paths.length && app.storage.set(STORAGE_KEY, validPaths)) notify(validPaths);
      if (!validPaths.length) {
        setPageState(0, "저장했던 글이 더 이상 공개되어 있지 않아 북마크에서 정리했습니다.");
        return;
      }
      validPaths.forEach(function (path) {
        list.append(bookmarkEntry(byPath.get(path)));
      });
      setPageState(validPaths.length);
    } catch (error) {
      if (version !== renderVersion) return;
      paths.forEach(function (path) {
        list.append(fallbackEntry(path));
      });
      setPageState(paths.length, "글 정보를 새로 확인하지 못해 저장된 주소 " + paths.length + "개를 표시합니다.");
    }
  }

  document.addEventListener("click", function (event) {
    var button = event.target instanceof Element ? event.target.closest("[data-bookmark-button]") : null;
    if (button instanceof HTMLButtonElement) {
      event.preventDefault();
      toggle(button);
      return;
    }
    var remove = event.target instanceof Element ? event.target.closest("[data-bookmark-remove]") : null;
    if (remove) {
      var path = app.sameOriginPath(remove.dataset.bookmarkRemove || "");
      var paths = load().filter(function (saved) { return saved !== path; });
      if (app.storage.set(STORAGE_KEY, paths)) {
        notify(paths);
        app.toast("북마크에서 삭제했습니다.");
      }
      return;
    }
    var clearAll = event.target instanceof Element ? event.target.closest("[data-bookmarks-clear]") : null;
    if (clearAll) {
      if (app.storage.remove(STORAGE_KEY)) {
        notify([]);
        app.toast("북마크를 모두 삭제했습니다.");
      } else {
        app.toast("북마크를 삭제하지 못했습니다.");
      }
    }
  });
  document.addEventListener(app.events.bookmarksChanged, function () {
    void renderPage();
  });
  window.addEventListener("storage", function (event) {
    if (event.key !== STORAGE_KEY) return;
    var paths = load();
    updateButtons(paths);
    void renderPage();
  });

  updateButtons(load());
  void renderPage();
})();
