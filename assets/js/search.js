(function () {
  "use strict";

  var app = window.DaehoBlog;
  if (!app || document.body.dataset.searchEnabled !== "true") return;

  var RECENT_KEY = "daeho-blog:recent-searches:v1";
  var MAX_RECENT = 5;
  var dialog = document.querySelector("[data-search-dialog]");
  var openButtons = document.querySelectorAll("[data-search-open]");
  var returnFocus = null;
  var restoreOnClose = true;
  var dialogController = null;
  var normalizedItemCache = new WeakMap();

  function validRecent(value) {
    return (
      Array.isArray(value) &&
      value.length <= MAX_RECENT &&
      value.every(function (item) {
        return typeof item === "string" && item.length > 0 && item.length <= 200;
      })
    );
  }

  function recentSearches() {
    return app.storage.get(RECENT_KEY, [], validRecent);
  }

  function saveRecent(query) {
    var trimmed = String(query || "").trim().slice(0, 200);
    if (!trimmed) return;
    var normalized = app.normalizeText(trimmed);
    var next = recentSearches().filter(function (item) {
      return app.normalizeText(item) !== normalized;
    });
    next.unshift(trimmed);
    app.storage.set(RECENT_KEY, next.slice(0, MAX_RECENT));
  }

  function clearNode(node) {
    if (node) node.replaceChildren();
  }

  function appendHighlighted(container, text, query) {
    var source = String(text || "");
    var needle = String(query || "").trim();
    if (!needle) {
      container.append(document.createTextNode(source));
      return;
    }
    var sourceFolded = source.toLocaleLowerCase("ko-KR");
    var needleFolded = needle.toLocaleLowerCase("ko-KR");
    var offset = 0;
    var index = sourceFolded.indexOf(needleFolded, offset);
    while (index >= 0 && needleFolded.length > 0) {
      if (index > offset) container.append(document.createTextNode(source.slice(offset, index)));
      var mark = document.createElement("mark");
      mark.textContent = source.slice(index, index + needle.length);
      container.append(mark);
      offset = index + needle.length;
      index = sourceFolded.indexOf(needleFolded, offset);
    }
    if (offset < source.length) container.append(document.createTextNode(source.slice(offset)));
  }

  function searchItems(items, rawQuery, limit) {
    var query = app.normalizeText(rawQuery);
    if (!query) return [];
    var terms = query.split(" ").filter(Boolean).slice(0, 12);
    return items
      .map(function (item, originalIndex) {
        var normalized = normalizedItemCache.get(item);
        if (!normalized) {
          normalized = {
            title: app.normalizeText(item.title),
            taxonomy: app.normalizeText(item.categories.concat(item.tags).join(" ") + " " + item.series),
            description: app.normalizeText(item.description),
            body: app.normalizeText(item.searchableText),
          };
          normalizedItemCache.set(item, normalized);
        }
        var title = normalized.title;
        var taxonomy = normalized.taxonomy;
        var description = normalized.description;
        var body = normalized.body;
        var combined = title + " " + taxonomy + " " + description + " " + body;
        if (
          !terms.every(function (term) {
            return combined.indexOf(term) >= 0;
          })
        ) {
          return null;
        }
        var score = item.featured ? 5 : 0;
        if (title === query) score += 140;
        else if (title.indexOf(query) === 0) score += 100;
        else if (title.indexOf(query) >= 0) score += 70;
        if (taxonomy === query) score += 55;
        terms.forEach(function (term) {
          if (title.indexOf(term) >= 0) score += 25;
          if (taxonomy.indexOf(term) >= 0) score += 18;
          if (description.indexOf(term) >= 0) score += 8;
          if (body.indexOf(term) >= 0) score += 2;
        });
        return { item: item, score: score, originalIndex: originalIndex };
      })
      .filter(Boolean)
      .sort(function (left, right) {
        return right.score - left.score || left.originalIndex - right.originalIndex;
      })
      .slice(0, limit)
      .map(function (result) {
        return result.item;
      });
  }

  function resultNode(item, query, optionMode) {
    var link = document.createElement("a");
    link.className = "search-result";
    link.href = item.url;
    if (optionMode) {
      link.setAttribute("role", "option");
      link.setAttribute("aria-selected", "false");
      link.tabIndex = -1;
    }

    var heading = document.createElement("strong");
    appendHighlighted(heading, item.title, query);
    link.append(heading);

    if (item.description) {
      var description = document.createElement("p");
      description.className = "search-result-description";
      appendHighlighted(description, item.description, query);
      link.append(description);
    }

    var metadata = [];
    if (item.categories.length) metadata.push(item.categories[0]);
    if (item.series) metadata.push("Series · " + item.series);
    if (item.readingTime) metadata.push("약 " + item.readingTime + "분");
    if (metadata.length) {
      var meta = document.createElement("small");
      meta.textContent = metadata.join(" · ");
      link.append(meta);
    }
    return link;
  }

  function messageNode(message, className) {
    var paragraph = document.createElement("p");
    paragraph.className = className || "search-hint";
    paragraph.textContent = message;
    return paragraph;
  }

  function createController(root, input, results, options) {
    if (!(root instanceof Element) || !(input instanceof HTMLInputElement) || !(results instanceof HTMLElement)) return null;
    var items = [];
    var loaded = false;
    var loading = null;
    var activeIndex = -1;
    var limit = Math.max(1, Math.min(50, Number(options.limit) || 8));
    if (options.optionMode) {
      if (!results.id) results.id = (options.idPrefix || "search") + "-results";
      input.setAttribute("role", "combobox");
      input.setAttribute("aria-autocomplete", "list");
      input.setAttribute("aria-controls", results.id);
      input.setAttribute("aria-expanded", "true");
    }

    function optionsInResults() {
      return Array.prototype.slice.call(results.querySelectorAll('[role="option"]'));
    }

    function select(index) {
      var choices = optionsInResults();
      choices.forEach(function (choice) {
        choice.classList.remove("is-active");
        choice.setAttribute("aria-selected", "false");
      });
      if (!choices.length) {
        activeIndex = -1;
        input.removeAttribute("aria-activedescendant");
        return;
      }
      activeIndex = (index + choices.length) % choices.length;
      var active = choices[activeIndex];
      if (!active.id) active.id = (options.idPrefix || "search-option") + "-" + activeIndex;
      active.classList.add("is-active");
      active.setAttribute("aria-selected", "true");
      input.setAttribute("aria-activedescendant", active.id);
      active.scrollIntoView({ block: "nearest" });
    }

    function render() {
      activeIndex = -1;
      input.removeAttribute("aria-activedescendant");
      var query = input.value.trim();
      clearNode(results);
      if (!query) {
        if (loaded && options.emptySuggestions) {
          var suggestionLimit = Math.max(1, Math.min(4, Number(options.emptySuggestionLimit) || 4));
          var featured = items.filter(function (item) { return item.featured; });
          var ordinary = items.filter(function (item) { return !item.featured; });
          var suggestions = featured.concat(ordinary).slice(0, suggestionLimit);
          var suggestionFragment = document.createDocumentFragment();
          suggestions.forEach(function (item) {
            suggestionFragment.append(resultNode(item, "", Boolean(options.optionMode)));
          });
          if (suggestions.length) results.append(suggestionFragment);
          else results.append(messageNode(options.emptyMessage || "검색어를 입력하세요."));
        } else {
          results.append(messageNode(options.emptyMessage || "검색어를 입력하세요."));
        }
        if (typeof options.onEmpty === "function") options.onEmpty();
        if (typeof options.onResults === "function") options.onResults(0, query, "empty");
        return;
      }
      if (!loaded) {
        results.append(messageNode("검색 데이터를 불러오는 중입니다."));
        if (typeof options.onResults === "function") options.onResults(0, query, "loading");
        return;
      }
      var matches = searchItems(items, query, limit);
      if (!matches.length) {
        results.append(messageNode("검색 결과가 없습니다. 다른 검색어를 입력해 보세요.", "search-empty"));
        if (typeof options.onResults === "function") options.onResults(0, query, "ready");
        return;
      }
      var fragment = document.createDocumentFragment();
      matches.forEach(function (item) {
        fragment.append(resultNode(item, query, Boolean(options.optionMode)));
      });
      results.append(fragment);
      if (typeof options.onResults === "function") options.onResults(matches.length, query, "ready");
    }

    function ensureLoaded() {
      if (loaded) return Promise.resolve(items);
      if (loading) return loading;
      loading = app
        .loadSearchIndex("/search.json")
        .then(function (loadedItems) {
          items = loadedItems;
          loaded = true;
          render();
          return items;
        })
        .catch(function () {
          clearNode(results);
          results.append(messageNode("검색 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.", "search-error"));
          if (typeof options.onResults === "function") options.onResults(0, input.value.trim(), "error");
          app.toast("검색 데이터를 불러오지 못했습니다.");
          return [];
        })
        .finally(function () {
          loading = null;
        });
      return loading;
    }

    var delayedRender = app.debounce(function () {
      if (typeof options.onQuery === "function") options.onQuery(input.value.trim());
      render();
      if (input.value.trim()) void ensureLoaded();
    }, 160);
    input.addEventListener("input", delayedRender);
    input.addEventListener("keydown", function (event) {
      if (!options.optionMode) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        select(activeIndex + 1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        select(activeIndex - 1);
      } else if (event.key === "Enter" && activeIndex >= 0) {
        var active = optionsInResults()[activeIndex];
        if (active instanceof HTMLAnchorElement) {
          event.preventDefault();
          saveRecent(input.value);
          window.location.assign(active.href);
        }
      }
    });
    results.addEventListener("click", function (event) {
      if (event.target instanceof Element && event.target.closest("a[href]")) saveRecent(input.value);
    });

    render();
    return { render: render, ensureLoaded: ensureLoaded };
  }

  function setupDialog() {
    if (!(dialog instanceof HTMLDialogElement)) return;
    var input = dialog.querySelector("[data-search-input]");
    var results = dialog.querySelector("[data-search-results]");
    var recentSection = dialog.querySelector("[data-recent-searches]");
    var recentList = dialog.querySelector("[data-recent-search-list]");
    var clearRecent = dialog.querySelector("[data-clear-recent-searches]");
    var form = dialog.querySelector("form");
    if (!(input instanceof HTMLInputElement) || !(results instanceof HTMLElement)) return;

    function renderRecent() {
      if (!(recentSection instanceof HTMLElement) || !(recentList instanceof HTMLElement)) return;
      clearNode(recentList);
      var values = recentSearches();
      recentSection.hidden = values.length === 0 || Boolean(input.value.trim());
      values.forEach(function (query) {
        var item = document.createElement("li");
        var button = document.createElement("button");
        button.type = "button";
        button.className = "text-button";
        button.textContent = query;
        button.addEventListener("click", function () {
          input.value = query;
          recentSection.hidden = true;
          dialogController.render();
          void dialogController.ensureLoaded();
          input.focus();
        });
        item.append(button);
        recentList.append(item);
      });
    }

    dialogController = createController(dialog, input, results, {
      limit: Number(dialog.dataset.searchLimit) || 8,
      optionMode: true,
      idPrefix: "global-search-option",
      emptySuggestions: true,
      emptySuggestionLimit: 4,
      emptyMessage: "검색어를 입력하면 사이트 안의 글과 프로젝트를 찾습니다.",
      onEmpty: renderRecent,
      onQuery: renderRecent,
    });
    if (!dialogController) return;
    input.setAttribute("aria-expanded", "false");

    function close(restore) {
      restoreOnClose = restore !== false;
      app.closeDialog(dialog);
    }

    function open(trigger) {
      returnFocus = trigger instanceof HTMLElement ? trigger : document.activeElement;
      restoreOnClose = true;
      if (!app.openDialog(dialog, trigger)) return;
      input.setAttribute("aria-expanded", "true");
      renderRecent();
      void dialogController.ensureLoaded();
      window.requestAnimationFrame(function () {
        input.focus();
        input.select();
      });
    }

    openButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        open(button);
      });
    });
    dialog.querySelectorAll("[data-search-close]").forEach(function (button) {
      button.addEventListener("click", function () {
        close(true);
      });
    });
    dialog.addEventListener("cancel", function (event) {
      event.preventDefault();
      close(true);
    });
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) close(true);
    });
    dialog.addEventListener("close", function () {
      input.setAttribute("aria-expanded", "false");
      if (restoreOnClose && returnFocus instanceof HTMLElement && document.contains(returnFocus)) returnFocus.focus();
      returnFocus = null;
      restoreOnClose = true;
    });
    document.addEventListener("daeho:dialog-opening", function (event) {
      if (dialog.open && event.detail && event.detail.dialog !== dialog) close(false);
    });
    if (clearRecent) {
      clearRecent.addEventListener("click", function () {
        app.storage.remove(RECENT_KEY);
        renderRecent();
        app.toast("최근 검색어를 지웠습니다.");
      });
    }
    if (form) {
      form.addEventListener("submit", function () {
        saveRecent(input.value);
      });
    }

    document.addEventListener("keydown", function (event) {
      var shortcut = (event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLocaleLowerCase() === "k";
      var slash = event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey;
      if ((!shortcut && !slash) || app.isEditableTarget(event.target)) return;
      event.preventDefault();
      if (dialog.open) input.focus();
      else open(openButtons[0] || null);
    });
  }

  function setupSearchPage() {
    var root = document.querySelector("[data-search-page]");
    if (!(root instanceof HTMLElement)) return;
    var input = root.querySelector("[data-search-page-input]");
    var results = root.querySelector("[data-search-page-results]");
    var status = root.querySelector("[data-search-page-status]");
    var fallback = root.querySelector("[data-search-fallback]");
    if (!(input instanceof HTMLInputElement) || !(results instanceof HTMLElement)) return;
    var url = new URL(window.location.href);
    input.value = url.searchParams.get("q") || "";
    var controller = createController(root, input, results, {
      limit: Number(root.dataset.searchLimit) || 50,
      optionMode: false,
      emptyMessage: "검색어를 입력하면 공개된 글과 프로젝트를 찾습니다.",
      onQuery: function (query) {
        var next = new URL(window.location.href);
        if (query) next.searchParams.set("q", query);
        else next.searchParams.delete("q");
        window.history.replaceState({}, "", next.pathname + next.search + next.hash);
      },
      onResults: function (total, query, phase) {
        if (fallback instanceof HTMLElement) fallback.hidden = Boolean(query);
        if (!(status instanceof HTMLElement)) return;
        if (phase === "loading") status.textContent = "검색 데이터를 불러오는 중입니다.";
        else if (phase === "error") status.textContent = "검색 데이터를 불러오지 못했습니다.";
        else if (phase === "empty") status.textContent = "검색어를 입력하면 결과가 여기에 표시됩니다.";
        else status.textContent = "‘" + query + "’ 검색 결과 " + total + "개";
      },
    });
    if (!controller) return;
    if (input.value.trim()) {
      controller.render();
      void controller.ensureLoaded();
      saveRecent(input.value);
    }
  }

  setupDialog();
  setupSearchPage();
})();
