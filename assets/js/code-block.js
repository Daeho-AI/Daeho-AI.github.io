(function () {
  "use strict";

  var app = window.DaehoBlog;
  var content = document.querySelector("[data-post-article] .post-content, .post-content");
  if (!app || !(content instanceof HTMLElement)) return;
  var blocks = Array.prototype.slice.call(content.querySelectorAll("pre"));
  if (!blocks.length) return;

  function languageFor(pre, code, source) {
    var candidates = [code, pre, source, pre.parentElement];
    for (var index = 0; index < candidates.length; index += 1) {
      var element = candidates[index];
      if (!element) continue;
      var className = element.className;
      if (typeof className !== "string") continue;
      var match = className.match(/(?:^|\s)(?:language|lang)-([a-z0-9_+#.-]+)/i);
      if (match) return match[1].replace(/[^a-z0-9_+#.-]/gi, "").toUpperCase();
    }
    return "TEXT";
  }

  blocks.forEach(function (pre) {
    var code = pre.querySelector("code") || pre;
    if (code.matches(".language-mermaid") || pre.closest(".language-mermaid")) return;
    var highlighted = pre.parentElement && pre.parentElement.classList.contains("highlight") ? pre.parentElement : null;
    var source = highlighted || pre;
    if (source.closest("[data-code-enhanced]")) return;

    var wrapper = document.createElement("div");
    wrapper.className = "code-block";
    wrapper.dataset.codeEnhanced = "";
    source.parentNode.insertBefore(wrapper, source);

    var toolbar = document.createElement("div");
    toolbar.className = "code-block-toolbar";
    var label = document.createElement("span");
    label.className = "code-block-language";
    label.textContent = source.dataset.codeTitle || pre.dataset.codeTitle || languageFor(pre, code, source);

    var actions = document.createElement("div");
    actions.className = "code-block-actions";
    var wrapButton = document.createElement("button");
    wrapButton.type = "button";
    wrapButton.className = "code-wrap-button";
    wrapButton.setAttribute("aria-pressed", "false");
    wrapButton.textContent = "줄바꿈";

    var copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "code-copy-button";
    copyButton.textContent = "복사";
    copyButton.setAttribute("aria-label", label.textContent + " 코드 복사");

    wrapButton.addEventListener("click", function () {
      var wrapped = wrapper.classList.toggle("is-wrapped");
      wrapButton.setAttribute("aria-pressed", String(wrapped));
      wrapButton.textContent = wrapped ? "줄바꿈 해제" : "줄바꿈";
    });
    copyButton.addEventListener("click", async function () {
      var copied = await app.copyText(code.textContent || "");
      app.toast(copied ? "코드를 복사했습니다." : "코드를 복사하지 못했습니다.");
      copyButton.textContent = copied ? "복사됨" : "복사 실패";
      window.setTimeout(function () {
        copyButton.textContent = "복사";
      }, 1800);
    });

    actions.append(wrapButton, copyButton);
    toolbar.append(label, actions);
    wrapper.append(toolbar, source);
  });
})();
