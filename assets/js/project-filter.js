(function () {
  "use strict";

  var app = window.DaehoBlog;
  if (!app) return;

  function init(root, utility) {
    if (!(root instanceof HTMLElement) || root.dataset.projectFilterReady === "true") return;
    var list = root.querySelector("[data-filter-list], [data-project-list]");
    var items = Array.prototype.slice.call(root.querySelectorAll("[data-filter-item]"));
    if (!items.length) items = Array.prototype.slice.call(root.querySelectorAll("[data-project-card]"));
    if (!(list instanceof HTMLElement) && items.length && items[0].parentElement) list = items[0].parentElement;
    if (!(list instanceof HTMLElement) || !items.length) return;
    root.dataset.projectFilterReady = "true";

    var queryInput = root.querySelector("[data-project-query], [data-filter-query]");
    var statusInput = root.querySelector("[data-status-filter], [data-filter-status]");
    var technologyInput = root.querySelector("[data-technology-filter], [data-filter-technology]");
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

    function value(control) {
      return control && "value" in control ? String(control.value || "").trim() : "";
    }

    function setValue(control, next) {
      if (control && "value" in control) control.value = next;
    }

    function cardFor(item) {
      return item.matches("[data-project-card]") ? item : item.querySelector("[data-project-card]") || item;
    }

    function dataFor(item) {
      var card = cardFor(item);
      var title = item.dataset.title || card.dataset.title || (card.querySelector("h2, h3") ? card.querySelector("h2, h3").textContent : "");
      var technologies = utility.parseDelimited(item.dataset.technologies || card.dataset.technologies || "");
      var status = item.dataset.status || card.dataset.status || "";
      var search = item.dataset.search || [title, status, technologies.join(" "), card.textContent].join(" ");
      var rawOrder = Number(item.dataset.order || card.dataset.order);
      return {
        title: utility.normalizeText(title),
        search: utility.normalizeText(search),
        status: utility.normalizeText(status),
        technologies: technologies.map(utility.normalizeText),
        period: item.dataset.period || card.dataset.period || "",
        order: Number.isFinite(rawOrder) ? rawOrder : 9999,
        featured: item.dataset.featured === "true" || card.dataset.featured === "true",
      };
    }

    function state() {
      return {
        q: value(queryInput),
        status: value(statusInput),
        technology: value(technologyInput),
        sort: value(sortInput) || "featured",
      };
    }

    function urlFor(page, nextState) {
      var url = new URL(window.location.href);
      [["q", nextState.q], ["status", nextState.status], ["technology", nextState.technology]].forEach(function (pair) {
        if (pair[1]) url.searchParams.set(pair[0], pair[1]);
        else url.searchParams.delete(pair[0]);
      });
      if (nextState.sort && nextState.sort !== "featured") url.searchParams.set("sort", nextState.sort);
      else url.searchParams.delete("sort");
      if (page > 1) url.searchParams.set("page", String(page));
      else url.searchParams.delete("page");
      return url;
    }

    function updateSummary(nextState) {
      if (!(active instanceof HTMLElement)) return;
      var parts = [];
      if (nextState.q) parts.push("검색: " + nextState.q);
      if (nextState.status) parts.push("상태: " + nextState.status);
      if (nextState.technology) parts.push("기술: " + nextState.technology);
      active.textContent = parts.length ? "적용된 필터 · " + parts.join(" · ") : "";
      active.hidden = parts.length === 0;
    }

    function updatePagination(total, pages, nextState) {
      if (!(pagination instanceof HTMLElement)) return;
      pagination.hidden = pages <= 1;
      var previous = pagination.querySelector("[data-page-previous]");
      var next = pagination.querySelector("[data-page-next]");
      var first = pagination.querySelector("[data-page-first]");
      var last = pagination.querySelector("[data-page-last]");
      var status = pagination.querySelector("[data-page-status]");
      if (previous instanceof HTMLButtonElement) previous.disabled = currentPage <= 1;
      if (next instanceof HTMLButtonElement) next.disabled = currentPage >= pages;
      if (first instanceof HTMLAnchorElement) first.href = urlFor(1, nextState).toString();
      if (last instanceof HTMLAnchorElement) last.href = urlFor(pages, nextState).toString();
      if (status) status.textContent = total ? currentPage + " / " + pages + " 페이지" : "결과 없음";
    }

    function apply(updateUrl) {
      var nextState = state();
      var query = utility.normalizeText(nextState.q);
      var queryTerms = query.split(" ").filter(Boolean);
      var selectedStatus = utility.normalizeText(nextState.status);
      var selectedTechnology = utility.normalizeText(nextState.technology);
      var filtered = items.filter(function (item) {
        var data = dataFor(item);
        return (
          (!queryTerms.length || queryTerms.every(function (term) { return data.search.indexOf(term) >= 0; })) &&
          (!selectedStatus || data.status === selectedStatus) &&
          (!selectedTechnology || data.technologies.indexOf(selectedTechnology) >= 0)
        );
      });
      filtered.sort(function (left, right) {
        var a = dataFor(left);
        var b = dataFor(right);
        if (nextState.sort === "title") return a.title.localeCompare(b.title, "ko") || originalOrder.get(left) - originalOrder.get(right);
        if (nextState.sort === "period") return b.period.localeCompare(a.period, "ko", { numeric: true }) || a.order - b.order;
        if (a.featured !== b.featured) return a.featured ? -1 : 1;
        return a.order - b.order || originalOrder.get(left) - originalOrder.get(right);
      });
      filtered.forEach(function (item) {
        list.append(item);
      });
      var pages = Math.max(1, Math.ceil(filtered.length / perPage));
      currentPage = Math.max(1, Math.min(currentPage, pages));
      var visible = new Set(filtered.slice((currentPage - 1) * perPage, currentPage * perPage));
      items.forEach(function (item) {
        item.hidden = !visible.has(item);
      });
      if (count) count.textContent = String(filtered.length);
      if (empty instanceof HTMLElement) empty.hidden = filtered.length !== 0;
      updateSummary(nextState);
      updatePagination(filtered.length, pages, nextState);
      if (updateUrl) {
        var nextUrl = urlFor(currentPage, nextState);
        window.history.replaceState({}, "", nextUrl.pathname + nextUrl.search + nextUrl.hash);
      }
    }

    function reset() {
      setValue(queryInput, "");
      setValue(statusInput, "");
      setValue(technologyInput, "");
      setValue(sortInput, "featured");
      currentPage = 1;
      apply(true);
      if (queryInput instanceof HTMLElement) queryInput.focus();
    }

    var initial = new URL(window.location.href).searchParams;
    setValue(queryInput, initial.get("q") || "");
    setValue(statusInput, initial.get("status") || "");
    setValue(technologyInput, initial.get("technology") || "");
    setValue(sortInput, ["featured", "period", "title"].indexOf(initial.get("sort")) >= 0 ? initial.get("sort") : "featured");
    currentPage = Math.max(1, Number.parseInt(initial.get("page") || "1", 10) || 1);

    var form = root.querySelector("[data-filter-form], form");
    if (form) form.addEventListener("submit", function (event) { event.preventDefault(); currentPage = 1; apply(true); });
    if (queryInput) {
      queryInput.addEventListener("input", utility.debounce(function () { currentPage = 1; apply(true); }, 180));
    }
    [statusInput, technologyInput, sortInput].forEach(function (control) {
      if (control) control.addEventListener("change", function () { currentPage = 1; apply(true); });
    });
    root.querySelectorAll("[data-filter-reset]").forEach(function (button) {
      button.addEventListener("click", function (event) { event.preventDefault(); reset(); });
    });
    if (pagination) {
      pagination.addEventListener("click", function (event) {
        var target = event.target instanceof Element ? event.target.closest("[data-page-first], [data-page-last], [data-page-previous], [data-page-next]") : null;
        if (!target) return;
        event.preventDefault();
        if (target.hasAttribute("data-page-first")) currentPage = 1;
        else if (target.hasAttribute("data-page-last")) currentPage = Number(new URL(target.href, document.baseURI).searchParams.get("page") || 1);
        else if (target.hasAttribute("data-page-previous")) currentPage -= 1;
        else currentPage += 1;
        apply(true);
        root.scrollIntoView({ block: "start" });
      });
    }
    apply(true);
  }

  window.DaehoProjectFilterInit = init;
  var root = document.querySelector("[data-project-browser], [data-filter-root][data-filter-kind='projects']");
  if (root instanceof HTMLElement) init(root, app);
})();
