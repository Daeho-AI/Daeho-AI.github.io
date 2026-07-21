(function () {
  "use strict";

  var app = window.DaehoBlog;
  var article = document.querySelector("[data-post-article]");
  if (!app || !(article instanceof HTMLElement)) return;

  var content = article.querySelector(".post-content");
  if (!(content instanceof HTMLElement)) return;

  var KATEX_CSS_URL = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css";
  var KATEX_URL = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js";
  var KATEX_AUTO_RENDER_URL = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js";
  var MERMAID_URL = "https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js";
  var enhancementFailureNotified = false;
  var renderedMermaidEntries = [];
  var mermaidRenderQueue = Promise.resolve();
  var requestedMermaidTheme = "";

  function externalScriptsAllowed() {
    return Boolean(window.DaehoOwnerContext && window.DaehoOwnerContext.externalScriptsAllowed === true);
  }

  function loadStylesheet(source, name) {
    return new Promise(function (resolve, reject) {
      if (!externalScriptsAllowed()) {
        reject(new Error("소유자 편집 컨텍스트에서는 외부 스타일을 불러오지 않습니다."));
        return;
      }
      var existing = document.querySelector('link[data-post-stylesheet="' + name + '"]');
      if (existing instanceof HTMLLinkElement) {
        if (existing.sheet) resolve();
        else {
          existing.addEventListener("load", resolve, { once: true });
          existing.addEventListener("error", reject, { once: true });
        }
        return;
      }
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = source;
      link.dataset.postStylesheet = name;
      link.addEventListener("load", resolve, { once: true });
      link.addEventListener("error", reject, { once: true });
      document.head.append(link);
    });
  }

  function loadLibrary(source, name) {
    return new Promise(function (resolve, reject) {
      if (!externalScriptsAllowed()) {
        reject(new Error("소유자 편집 컨텍스트에서는 외부 스크립트를 불러오지 않습니다."));
        return;
      }
      var script = document.createElement("script");
      script.src = source;
      script.async = true;
      script.dataset.postLibrary = name;
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener(
        "error",
        function () {
          script.remove();
          reject(new Error(name + " 라이브러리를 불러오지 못했습니다."));
        },
        { once: true }
      );
      document.head.append(script);
    });
  }

  function notifyEnhancementFailure() {
    if (enhancementFailureNotified) return;
    enhancementFailureNotified = true;
    app.toast("수식 또는 다이어그램을 표시하지 못해 원문을 유지했습니다.");
  }

  async function renderMath() {
    await loadStylesheet(KATEX_CSS_URL, "katex-0.16.11");
    await loadLibrary(KATEX_URL, "katex-0.16.11");
    if (!window.katex) throw new Error("KaTeX가 초기화되지 않았습니다.");
    await loadLibrary(KATEX_AUTO_RENDER_URL, "katex-auto-render-0.16.11");
    if (typeof window.renderMathInElement !== "function") throw new Error("KaTeX 자동 렌더러가 초기화되지 않았습니다.");
    window.renderMathInElement(content, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false },
        { left: "$", right: "$", display: false },
      ],
      throwOnError: false,
      trust: false,
    });
  }

  function mermaidEntries() {
    var seenTargets = new Set();
    return Array.prototype.slice
      .call(content.querySelectorAll("code.language-mermaid, .language-mermaid code"))
      .map(function (code) {
        var languageWrapper = code.closest(".language-mermaid");
        var target = languageWrapper && languageWrapper !== code ? languageWrapper : code.closest("pre") || code;
        if (!target.parentNode || seenTargets.has(target)) return null;
        seenTargets.add(target);
        var diagram = document.createElement("div");
        diagram.className = "mermaid";
        var source = code.textContent || "";
        diagram.textContent = source;
        return { target: target, diagram: diagram, source: source, parent: target.parentNode, next: target.nextSibling };
      })
      .filter(Boolean);
  }

  function currentMermaidTheme(explicitTheme) {
    if (explicitTheme === "dark") return "dark";
    if (explicitTheme === "light") return "default";
    var mode = document.documentElement.getAttribute("data-theme") || "system";
    var systemDark = typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
    return mode === "dark" || (mode === "system" && systemDark) ? "dark" : "default";
  }

  function restoreMermaidSource(entries) {
    entries.forEach(function (entry) {
      if (entry.target.isConnected) return;
      if (entry.diagram.parentNode) {
        entry.diagram.replaceWith(entry.target);
        return;
      }
      if (entry.parent && entry.parent.isConnected) {
        var reference = entry.next && entry.next.parentNode === entry.parent ? entry.next : null;
        entry.parent.insertBefore(entry.target, reference);
      }
    });
    renderedMermaidEntries = [];
  }

  async function runMermaidEntries(entries, theme, replaceOriginal) {
    try {
      if (replaceOriginal) {
        entries.forEach(function (entry) {
          entry.target.replaceWith(entry.diagram);
        });
      }
      entries.forEach(function (entry) {
        entry.diagram.removeAttribute("data-processed");
        entry.diagram.textContent = entry.source;
      });
      window.mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: theme });
      await window.mermaid.run({ nodes: entries.map(function (entry) { return entry.diagram; }) });
    } catch (error) {
      restoreMermaidSource(entries);
      throw error;
    }
  }

  function queueMermaidRerender(theme) {
    requestedMermaidTheme = theme;
    mermaidRenderQueue = mermaidRenderQueue
      .then(async function () {
        if (!renderedMermaidEntries.length) return;
        var entries = renderedMermaidEntries.slice();
        await runMermaidEntries(entries, requestedMermaidTheme, false);
      })
      .catch(notifyEnhancementFailure);
  }

  async function renderMermaid() {
    var entries = mermaidEntries();
    if (!entries.length) return;
    await loadLibrary(MERMAID_URL, "mermaid-11.4.1");
    if (!window.mermaid || typeof window.mermaid.initialize !== "function" || typeof window.mermaid.run !== "function") {
      throw new Error("Mermaid가 초기화되지 않았습니다.");
    }
    var theme = requestedMermaidTheme || currentMermaidTheme();
    requestedMermaidTheme = theme;
    await runMermaidEntries(entries, theme, true);
    renderedMermaidEntries = entries;
    if (requestedMermaidTheme !== theme) queueMermaidRerender(requestedMermaidTheme);
  }

  function scheduleEnhancements() {
    if (!externalScriptsAllowed()) return;
    var task = async function () {
      if (article.dataset.math === "true") {
        try {
          await renderMath();
        } catch (error) {
          notifyEnhancementFailure();
        }
      }
      if (article.dataset.mermaid === "true") {
        try {
          await renderMermaid();
        } catch (error) {
          notifyEnhancementFailure();
        }
      }
    };
    var run = function () { void task(); };
    if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(run, { timeout: 1200 });
    else window.setTimeout(run, 0);
  }

  function svgNode(name, attributes) {
    var node = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.keys(attributes).forEach(function (attribute) {
      node.setAttribute(attribute, attributes[attribute]);
    });
    return node;
  }

  function calloutIcon(type) {
    var svg = svgNode("svg", {
      class: "callout-icon",
      viewBox: "0 0 16 16",
      width: "16",
      height: "16",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1.5",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "aria-hidden": "true",
      focusable: "false",
    });
    if (type === "NOTE") {
      svg.append(svgNode("circle", { cx: "8", cy: "8", r: "6" }));
      svg.append(svgNode("path", { d: "M8 7.25v4" }));
      svg.append(svgNode("circle", { cx: "8", cy: "4.5", r: ".65", fill: "currentColor", stroke: "none" }));
    } else if (type === "TIP") {
      svg.append(svgNode("path", { d: "M5.5 11h5M6.5 13.5h3M8 1.5a4.25 4.25 0 0 0-2.7 7.53c.62.52.95 1.05 1.05 1.47h3.3c.1-.42.43-.95 1.05-1.47A4.25 4.25 0 0 0 8 1.5Z" }));
    } else if (type === "IMPORTANT") {
      svg.append(svgNode("polygon", { points: "8,1 15,8 8,15 1,8" }));
      svg.append(svgNode("path", { d: "M8 4.5v4.25" }));
      svg.append(svgNode("circle", { cx: "8", cy: "11.5", r: ".65", fill: "currentColor", stroke: "none" }));
    } else if (type === "WARNING") {
      svg.append(svgNode("path", { d: "M8 1.5 15 14H1L8 1.5Z" }));
      svg.append(svgNode("path", { d: "M8 5.5v4" }));
      svg.append(svgNode("circle", { cx: "8", cy: "12", r: ".65", fill: "currentColor", stroke: "none" }));
    } else {
      svg.append(svgNode("polygon", { points: "5,1 11,1 15,5 15,11 11,15 5,15 1,11 1,5" }));
      svg.append(svgNode("path", { d: "m5.5 5.5 5 5m0-5-5 5" }));
    }
    return svg;
  }

  function firstMeaningfulText(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var node = walker.nextNode();
    while (node) {
      if (
        node.nodeValue &&
        node.nodeValue.trim() &&
        node.parentElement &&
        node.parentElement.closest("blockquote") === root
      ) {
        return node;
      }
      node = walker.nextNode();
    }
    return null;
  }

  function enhanceCallouts() {
    content.querySelectorAll("blockquote").forEach(function (blockquote) {
      if (blockquote.classList.contains("callout")) return;
      var text = firstMeaningfulText(blockquote);
      if (!text) return;
      var value = text.nodeValue || "";
      var marker = value.match(/^(\s*)\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/);
      if (!marker) return;
      var type = marker[2];
      var markerText = "[!" + type + "]";
      var markerStart = marker[1].length;
      text.nodeValue = value.slice(0, markerStart) + value.slice(markerStart + markerText.length);
      blockquote.classList.add("callout", "callout-" + type.toLocaleLowerCase("en-US"));
      blockquote.setAttribute("role", "note");
      var title = document.createElement("div");
      title.className = "callout-title";
      var label = document.createElement("span");
      label.textContent = type;
      title.append(calloutIcon(type), label);
      blockquote.insertBefore(title, blockquote.firstChild);
    });
  }

  content.querySelectorAll("img").forEach(function (image) {
    if (!image.hasAttribute("loading")) image.setAttribute("loading", "lazy");
    if (!image.hasAttribute("decoding")) image.setAttribute("decoding", "async");
  });
  content.querySelectorAll('a[target="_blank"]').forEach(function (link) {
    var rel = new Set((link.getAttribute("rel") || "").split(/\s+/).filter(Boolean));
    rel.add("noopener");
    rel.add("noreferrer");
    link.setAttribute("rel", Array.from(rel).join(" "));
  });
  content.querySelectorAll("table").forEach(function (table) {
    if (table.closest(".table-scroll") || !table.parentNode) return;
    var wrapper = document.createElement("div");
    wrapper.className = "table-scroll";
    table.parentNode.insertBefore(wrapper, table);
    wrapper.append(table);
  });
  enhanceCallouts();

  var progress = document.querySelector("progress[data-reading-progress]");
  if (progress instanceof HTMLProgressElement) {
    var progressFrame = 0;
    progress.max = 100;

    function updateProgress() {
      progressFrame = 0;
      var rect = content.getBoundingClientRect();
      var contentTop = rect.top + window.scrollY;
      var contentHeight = Math.max(content.scrollHeight, rect.height);
      var travel = Math.max(1, contentHeight - window.innerHeight * 0.55);
      var read = window.scrollY + window.innerHeight * 0.25 - contentTop;
      var percentage = Math.max(0, Math.min(100, (read / travel) * 100));
      progress.value = Number.isFinite(percentage) ? percentage : 0;
      progress.hidden = contentHeight < window.innerHeight * 0.8;
      progress.setAttribute("aria-valuetext", Math.round(progress.value) + "% 읽음");
    }

    function requestProgressUpdate() {
      if (progressFrame) return;
      progressFrame = window.requestAnimationFrame(updateProgress);
    }
    window.addEventListener("scroll", requestProgressUpdate, { passive: true });
    window.addEventListener("resize", requestProgressUpdate, { passive: true });
    updateProgress();
  }

  article.querySelectorAll("[data-share-button]").forEach(function (button) {
    button.addEventListener("click", async function () {
      var suppliedUrl = button.dataset.shareUrl || app.canonicalUrl();
      var url = app.safeUrl(suppliedUrl);
      var shareUrl = url ? url.toString() : app.canonicalUrl();
      var title = (button.dataset.shareTitle || document.title).trim();
      if (navigator.share) {
        try {
          await navigator.share({ title: title, url: shareUrl });
          app.toast("공유 창을 열었습니다.");
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
        }
      }
      var copied = await app.copyText(shareUrl);
      app.toast(copied ? "게시글 주소를 복사했습니다." : "주소를 복사하지 못했습니다.");
    });
  });

  if (article.dataset.mermaid === "true") {
    document.addEventListener(app.events.themeChanged, function (event) {
      var detailTheme = event.detail && typeof event.detail.theme === "string" ? event.detail.theme : "";
      var theme = currentMermaidTheme(detailTheme);
      requestedMermaidTheme = theme;
      if (renderedMermaidEntries.length) queueMermaidRerender(theme);
    });
  }

  scheduleEnhancements();
})();
