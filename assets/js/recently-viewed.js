(function () {
  "use strict";

  var app = window.DaehoBlog;
  if (!app || document.body.dataset.recentlyViewedEnabled !== "true") return;
  var STORAGE_KEY = "daeho-blog:recently-viewed:v1";
  var MAX_RECENT = 5;
  var renderVersion = 0;
  var article = document.querySelector("[data-post-article]");
  var currentPath = article
    ? app.sameOriginPath(article.dataset.postUrl || article.dataset.url || document.body.dataset.pageUrl || app.canonicalUrl())
    : "";

  function validRecords(value) {
    return (
      Array.isArray(value) &&
      value.length <= MAX_RECENT &&
      value.every(function (record) {
        return (
          record &&
          typeof record === "object" &&
          !Array.isArray(record) &&
          typeof record.url === "string" &&
          record.url.length <= 2000 &&
          typeof record.title === "string" &&
          record.title.length <= 500 &&
          Number.isFinite(record.visitedAt)
        );
      })
    );
  }

  function load() {
    var seen = new Set();
    return app.storage
      .get(STORAGE_KEY, [], validRecords)
      .map(function (record) {
        return {
          url: app.sameOriginPath(record.url),
          title: record.title.slice(0, 500),
          visitedAt: Number(record.visitedAt),
        };
      })
      .filter(function (record) {
        if (!record.url || seen.has(record.url) || !Number.isFinite(record.visitedAt)) return false;
        seen.add(record.url);
        return true;
      })
      .sort(function (left, right) {
        return right.visitedAt - left.visitedAt;
      })
      .slice(0, MAX_RECENT);
  }

  function save(records) {
    if (!app.storage.set(STORAGE_KEY, records.slice(0, MAX_RECENT))) return false;
    document.dispatchEvent(new CustomEvent(app.events.recentChanged));
    return true;
  }

  function recordCurrent() {
    if (!(article instanceof HTMLElement) || !currentPath) return;
    var titleElement = article.querySelector("h1");
    var title = (article.dataset.postTitle || article.dataset.title || (titleElement ? titleElement.textContent : document.title) || "게시글")
      .trim()
      .slice(0, 500);
    var records = load().filter(function (record) {
      return record.url !== currentPath;
    });
    records.unshift({ url: currentPath, title: title, visitedAt: Date.now() });
    save(records);
  }

  function recentItem(record, indexed) {
    var item = document.createElement("li");
    var link = document.createElement("a");
    link.href = record.url;
    link.textContent = indexed && indexed.title ? indexed.title : record.title || record.url;
    item.append(link);
    if (indexed && indexed.date) {
      var time = document.createElement("time");
      time.dateTime = indexed.date;
      time.textContent = indexed.date.slice(0, 10).replace(/-/g, ".");
      item.append(time);
    }
    return item;
  }

  async function render() {
    var sections = document.querySelectorAll("[data-recently-viewed]");
    if (!sections.length) return;
    var version = ++renderVersion;
    var records = load().filter(function (record) {
      return record.url !== currentPath;
    });
    if (!records.length) {
      sections.forEach(function (section) {
        var list = section.querySelector("[data-recent-list]");
        if (list instanceof HTMLElement) list.replaceChildren();
        section.hidden = true;
      });
      return;
    }
    var indexedByPath = null;
    try {
      var index = await app.loadSearchIndex("/posts.json");
      if (version !== renderVersion) return;
      indexedByPath = new Map();
      index.forEach(function (entry) {
        if (entry.type === "project") return;
        var path = app.sameOriginPath(entry.url);
        if (path) indexedByPath.set(path, entry);
      });
      var validAll = load().filter(function (record) {
        return indexedByPath.has(record.url);
      });
      if (validAll.length !== load().length) app.storage.set(STORAGE_KEY, validAll);
      records = validAll.filter(function (record) {
        return record.url !== currentPath;
      });
    } catch (error) {
      if (version !== renderVersion) return;
      // Stored titles remain a safe, useful fallback while the index is unavailable.
    }

    sections.forEach(function (section) {
      var list = section.querySelector("[data-recent-list]");
      if (!(list instanceof HTMLElement)) return;
      list.replaceChildren();
      records.slice(0, MAX_RECENT).forEach(function (record) {
        list.append(recentItem(record, indexedByPath ? indexedByPath.get(record.url) : null));
      });
      section.hidden = records.length === 0;
    });
  }

  document.addEventListener("click", function (event) {
    var clear = event.target instanceof Element ? event.target.closest("[data-clear-recent]") : null;
    if (!clear) return;
    if (app.storage.remove(STORAGE_KEY)) {
      document.dispatchEvent(new CustomEvent(app.events.recentChanged));
      app.toast("최근 본 글 기록을 지웠습니다.");
    } else {
      app.toast("최근 본 글 기록을 지우지 못했습니다.");
    }
  });
  document.addEventListener(app.events.recentChanged, function () {
    void render();
  });
  window.addEventListener("storage", function (event) {
    if (event.key === STORAGE_KEY) void render();
  });

  recordCurrent();
  void render();
})();
