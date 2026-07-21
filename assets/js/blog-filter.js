(function () {
  "use strict";

  var app = window.DaehoBlog;
  var root = document.querySelector("[data-blog-browser], [data-filter-root][data-filter-kind='posts']");
  if (!app || !(root instanceof HTMLElement)) {
    // Compatibility for the current project page while its dedicated script is being loaded separately.
    var projectRoot = document.querySelector("[data-project-browser], [data-filter-root][data-filter-kind='projects']");
    if (app && projectRoot instanceof HTMLElement) initProjectCompatibility(projectRoot, app);
    return;
  }

  var list = root.querySelector("[data-filter-list], [data-blog-list]");
  var items = Array.prototype.slice.call(root.querySelectorAll("[data-filter-item]"));
  if (!items.length) items = Array.prototype.slice.call(root.querySelectorAll("[data-post-card]"));
  if (!(list instanceof HTMLElement) && items.length && items[0].parentElement) list = items[0].parentElement;
  if (!(list instanceof HTMLElement) || !items.length) return;

  var queryInput = root.querySelector("[data-blog-query], [data-filter-query]");
  var categoryInput = root.querySelector("[data-category-filter], [data-filter-category]");
  var tagInput = root.querySelector("[data-tag-filter], [data-filter-tag]");
  var seriesInput = root.querySelector("[data-series-filter], [data-filter-series]");
  var sortInput = root.querySelector("[data-sort-filter], [data-filter-sort]");
  var count = root.querySelector("[data-result-count]");
  var active = root.querySelector("[data-active-filters]");
  var empty = root.querySelector("[data-filter-empty]");
  var pagination = root.querySelector("[data-pagination]");
  var perPage = Math.max(1, Math.min(100, Number(root.dataset.perPage || root.dataset.pageSize) || 8));
  var currentPage = 1;
  var originalOrder = new Map();
  items.forEach(function (item, index) {
    originalOrder.set(item, index);
  });

  function controlValue(control) {
    return control && "value" in control ? String(control.value || "").trim() : "";
  }

  function setControl(control, value) {
    if (control && "value" in control) control.value = value;
  }

  function itemCard(item) {
    return item.matches("[data-post-card]") ? item : item.querySelector("[data-post-card]") || item;
  }

  function metadata(item) {
    var card = itemCard(item);
    var title = item.dataset.title || card.dataset.title || "";
    var description = card.dataset.description || "";
    var categories = app.parseDelimited(item.dataset.categories || card.dataset.categories || "");
    var tags = app.parseDelimited(item.dataset.tags || card.dataset.tags || "");
    var series = item.dataset.series || card.dataset.series || "";
    var search = item.dataset.search || [title, description, categories.join(" "), tags.join(" "), series].join(" ");
    var rawDate = item.dataset.date || card.dataset.date || "0";
    var numericDate = Number(rawDate);
    var date = Number.isFinite(numericDate) && numericDate > 0 ? numericDate : Date.parse(rawDate) || 0;
    return {
      title: title,
      normalizedTitle: app.normalizeText(title),
      search: app.normalizeText(search),
      categories: categories.map(app.normalizeText),
      tags: tags.map(app.normalizeText),
      series: app.normalizeText(series),
      date: date,
      pinned: item.dataset.pinned === "true" || card.dataset.pinned === "true",
    };
  }

  function exactMatch(values, selected) {
    if (!selected) return true;
    var normalized = app.normalizeText(selected);
    return Array.isArray(values) ? values.indexOf(normalized) >= 0 : values === normalized;
  }

  function stateFromControls() {
    return {
      q: controlValue(queryInput),
      category: controlValue(categoryInput),
      tag: controlValue(tagInput),
      series: controlValue(seriesInput),
      sort: controlValue(sortInput) || "newest",
    };
  }

  function pageUrl(page, state) {
    var next = new URL(window.location.href);
    [["q", state.q], ["category", state.category], ["tag", state.tag], ["series", state.series]].forEach(function (pair) {
      if (pair[1]) next.searchParams.set(pair[0], pair[1]);
      else next.searchParams.delete(pair[0]);
    });
    if (state.sort && state.sort !== "newest") next.searchParams.set("sort", state.sort);
    else next.searchParams.delete("sort");
    if (page > 1) next.searchParams.set("page", String(page));
    else next.searchParams.delete("page");
    return next;
  }

  function syncUrl(state) {
    var next = pageUrl(currentPage, state);
    window.history.replaceState({}, "", next.pathname + next.search + next.hash);
  }

  function updateActiveFilters(state) {
    if (!(active instanceof HTMLElement)) return;
    var parts = [];
    if (state.q) parts.push("검색: " + state.q);
    if (state.category) parts.push("카테고리: " + state.category);
    if (state.tag) parts.push("태그: " + state.tag);
    if (state.series) parts.push("시리즈: " + state.series);
    active.textContent = parts.length ? "적용된 필터 · " + parts.join(" · ") : "";
    active.hidden = parts.length === 0;
  }

  function updatePagination(total, pages, state) {
    if (!(pagination instanceof HTMLElement)) return;
    pagination.hidden = pages <= 1;
    var previous = pagination.querySelector("[data-page-previous]");
    var next = pagination.querySelector("[data-page-next]");
    var first = pagination.querySelector("[data-page-first]");
    var last = pagination.querySelector("[data-page-last]");
    var status = pagination.querySelector("[data-page-status]");
    if (previous instanceof HTMLButtonElement) previous.disabled = currentPage <= 1;
    if (next instanceof HTMLButtonElement) next.disabled = currentPage >= pages;
    if (first instanceof HTMLAnchorElement) first.href = pageUrl(1, state).toString();
    if (last instanceof HTMLAnchorElement) last.href = pageUrl(pages, state).toString();
    if (status) status.textContent = total ? currentPage + " / " + pages + " 페이지" : "결과 없음";
  }

  function apply(updateUrl) {
    var state = stateFromControls();
    var query = app.normalizeText(state.q);
    var queryTerms = query.split(" ").filter(Boolean);
    var filtered = items.filter(function (item) {
      var data = metadata(item);
      return (
        (!queryTerms.length || queryTerms.every(function (term) { return data.search.indexOf(term) >= 0; })) &&
        exactMatch(data.categories, state.category) &&
        exactMatch(data.tags, state.tag) &&
        exactMatch(data.series, state.series)
      );
    });

    filtered.sort(function (left, right) {
      var a = metadata(left);
      var b = metadata(right);
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (state.sort === "oldest") return a.date - b.date || originalOrder.get(left) - originalOrder.get(right);
      if (state.sort === "title") return a.normalizedTitle.localeCompare(b.normalizedTitle, "ko") || originalOrder.get(left) - originalOrder.get(right);
      return b.date - a.date || originalOrder.get(left) - originalOrder.get(right);
    });
    filtered.forEach(function (item) {
      list.append(item);
    });

    var pages = Math.max(1, Math.ceil(filtered.length / perPage));
    currentPage = Math.max(1, Math.min(currentPage, pages));
    var start = (currentPage - 1) * perPage;
    var visible = new Set(filtered.slice(start, start + perPage));
    items.forEach(function (item) {
      item.hidden = !visible.has(item);
    });
    if (count) count.textContent = String(filtered.length);
    if (empty instanceof HTMLElement) empty.hidden = filtered.length !== 0;
    updateActiveFilters(state);
    updatePagination(filtered.length, pages, state);
    if (updateUrl) syncUrl(state);
  }

  function reset() {
    setControl(queryInput, "");
    setControl(categoryInput, "");
    setControl(tagInput, "");
    setControl(seriesInput, "");
    setControl(sortInput, "newest");
    currentPage = 1;
    apply(true);
    if (queryInput instanceof HTMLElement) queryInput.focus();
  }

  var initial = new URL(window.location.href).searchParams;
  setControl(queryInput, initial.get("q") || "");
  setControl(categoryInput, initial.get("category") || "");
  setControl(tagInput, initial.get("tag") || "");
  setControl(seriesInput, initial.get("series") || "");
  setControl(sortInput, ["newest", "oldest", "title"].indexOf(initial.get("sort")) >= 0 ? initial.get("sort") : "newest");
  currentPage = Math.max(1, Number.parseInt(initial.get("page") || "1", 10) || 1);

  var form = root.querySelector("[data-filter-form], form");
  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      currentPage = 1;
      apply(true);
    });
  }
  if (queryInput) {
    queryInput.addEventListener(
      "input",
      app.debounce(function () {
        currentPage = 1;
        apply(true);
      }, 180)
    );
  }
  [categoryInput, tagInput, seriesInput, sortInput].forEach(function (control) {
    if (control) {
      control.addEventListener("change", function () {
        currentPage = 1;
        apply(true);
      });
    }
  });
  root.querySelectorAll("[data-filter-reset]").forEach(function (button) {
    button.addEventListener("click", function (event) {
      event.preventDefault();
      reset();
    });
  });
  if (pagination) {
    pagination.addEventListener("click", function (event) {
      var target = event.target instanceof Element ? event.target.closest("[data-page-first], [data-page-last], [data-page-previous], [data-page-next]") : null;
      if (!target) return;
      event.preventDefault();
      var pages = Math.max(1, Math.ceil(items.filter(function (item) { return !item.hidden; }).length / perPage));
      if (target.hasAttribute("data-page-first")) currentPage = 1;
      else if (target.hasAttribute("data-page-last")) currentPage = Number(new URL(target.href, document.baseURI).searchParams.get("page") || pages);
      else if (target.hasAttribute("data-page-previous")) currentPage -= 1;
      else currentPage += 1;
      apply(true);
      root.scrollIntoView({ block: "start" });
    });
  }
  apply(true);

  function initProjectCompatibility(projectRoot, utility) {
    if (typeof window.DaehoProjectFilterInit === "function") window.DaehoProjectFilterInit(projectRoot, utility);
  }
})();
