(function () {
  "use strict";

  var app = window.DaehoBlog;
  var content = document.querySelector("[data-post-article] .post-content, .post-content");
  if (!app || !(content instanceof HTMLElement)) return;

  var headings = Array.prototype.slice.call(content.querySelectorAll("h2, h3"));
  if (!headings.length) return;
  var usedIds = new Set();
  var claimedIds = new Set();
  document.querySelectorAll("[id]").forEach(function (element) {
    if (element.id) usedIds.add(element.id);
  });

  function slug(text) {
    var normalized = String(text || "");
    try {
      normalized = normalized.normalize("NFKC");
    } catch (error) {
      // Use the original heading text in older browsers.
    }
    normalized = normalized
      .toLocaleLowerCase("ko-KR")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^\p{Letter}\p{Number}_-]/gu, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    return normalized || "section";
  }

  function uniqueId(base, currentId) {
    if (currentId && !claimedIds.has(currentId)) {
      claimedIds.add(currentId);
      return currentId;
    }
    var candidate = currentId || base;
    var suffix = 2;
    while (usedIds.has(candidate)) {
      candidate = (currentId || base) + "-" + suffix;
      suffix += 1;
    }
    usedIds.add(candidate);
    claimedIds.add(candidate);
    return candidate;
  }

  var headingData = headings.map(function (heading) {
    var title = heading.textContent.trim();
    var id = uniqueId(slug(title), heading.id);
    heading.id = id;

    if (!heading.querySelector(":scope > [data-heading-anchor]")) {
      var copyButton = document.createElement("button");
      copyButton.type = "button";
      copyButton.className = "heading-anchor";
      copyButton.dataset.headingAnchor = "";
      copyButton.setAttribute("aria-label", title + " 제목 링크 복사");
      copyButton.textContent = "#";
      copyButton.addEventListener("click", async function () {
        var url = app.canonicalUrl() + "#" + encodeURIComponent(id);
        var copied = await app.copyText(url);
        app.toast(copied ? "제목 링크를 복사했습니다." : "제목 링크를 복사하지 못했습니다.");
      });
      heading.append(copyButton);
    }
    return { heading: heading, id: id, title: title, level: heading.tagName === "H3" ? 3 : 2 };
  });

  var toc = document.querySelector("[data-toc]");
  var list = toc ? toc.querySelector("[data-toc-list]") : null;
  if (!(toc instanceof HTMLElement) || !(list instanceof HTMLElement) || headingData.length < 2) {
    if (toc instanceof HTMLElement) toc.hidden = true;
    return;
  }

  list.replaceChildren();
  var links = [];
  headingData.forEach(function (entry) {
    var item = document.createElement("li");
    item.className = entry.level === 3 ? "toc-level-3" : "toc-level-2";
    var link = document.createElement("a");
    link.href = "#" + encodeURIComponent(entry.id);
    link.textContent = entry.title;
    link.dataset.tocLink = entry.id;
    link.addEventListener("click", function () {
      setActive(entry.id);
    });
    item.append(link);
    list.append(item);
    links.push(link);
  });
  toc.hidden = false;

  var toggle = toc.querySelector("[data-toc-toggle]");
  var nav = list.closest("nav") || list;
  if (toggle) {
    toggle.addEventListener("click", function () {
      var expanded = toggle.getAttribute("aria-expanded") !== "false";
      toggle.setAttribute("aria-expanded", String(!expanded));
      nav.hidden = expanded;
      toc.classList.toggle("is-collapsed", expanded);
    });
  }

  function setActive(id) {
    links.forEach(function (link) {
      if (link.dataset.tocLink === id) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });
  }

  var scrollFrame = 0;
  function updateActiveHeading() {
    scrollFrame = 0;
    var threshold = 110;
    var activeEntry = headingData[0];
    headingData.forEach(function (entry) {
      if (entry.heading.getBoundingClientRect().top <= threshold) activeEntry = entry;
    });
    setActive(activeEntry.id);
  }
  function requestUpdate() {
    if (!scrollFrame) scrollFrame = window.requestAnimationFrame(updateActiveHeading);
  }
  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate, { passive: true });
  updateActiveHeading();
})();
