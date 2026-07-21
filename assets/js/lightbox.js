(function () {
  "use strict";

  var app = window.DaehoBlog;
  var content = document.querySelector("[data-post-article] .post-content, .post-content");
  var dialog = document.querySelector("dialog[data-lightbox-dialog]");
  if (!app || !(content instanceof HTMLElement) || !(dialog instanceof HTMLDialogElement)) return;
  var targetImage = dialog.querySelector("[data-lightbox-image]");
  var caption = dialog.querySelector("[data-lightbox-caption]");
  if (!(targetImage instanceof HTMLImageElement) || !(caption instanceof HTMLElement)) return;
  if (!targetImage.getAttribute("src")) targetImage.removeAttribute("src");
  var returnFocus = null;
  var restoreOnClose = true;

  function sourceFor(image) {
    var source = image.currentSrc || image.getAttribute("src") || "";
    if (/^data:image\/(?:avif|gif|jpeg|png|webp);base64,/i.test(source)) return source;
    var url = app.safeUrl(source);
    return url ? url.toString() : "";
  }

  function captionFor(image) {
    var figure = image.closest("figure");
    var figureCaption = figure ? figure.querySelector("figcaption") : null;
    return (figureCaption ? figureCaption.textContent : image.getAttribute("alt") || "").trim();
  }

  function close(restore) {
    restoreOnClose = restore !== false;
    app.closeDialog(dialog);
  }

  function open(image) {
    var source = sourceFor(image);
    if (!source) return;
    returnFocus = image;
    restoreOnClose = true;
    targetImage.src = source;
    targetImage.alt = image.getAttribute("alt") || "";
    caption.textContent = captionFor(image);
    caption.hidden = !caption.textContent;
    dialog.classList.remove("has-error");
    if (!app.openDialog(dialog, image)) {
      targetImage.removeAttribute("src");
      returnFocus = null;
      return;
    }
    window.requestAnimationFrame(function () {
      var closeButton = dialog.querySelector("[data-lightbox-close]");
      if (closeButton instanceof HTMLElement) closeButton.focus();
    });
  }

  var images = Array.prototype.filter.call(content.querySelectorAll("img"), function (image) {
    var alt = image.getAttribute("alt");
    return alt !== null && alt.trim() !== "" && !image.closest("a[href], [data-no-lightbox]") && image.getAttribute("aria-hidden") !== "true";
  });
  if (!images.length) return;
  images.forEach(function (image) {
    image.classList.add("lightbox-target", "is-lightbox-enabled");
    image.tabIndex = 0;
    image.setAttribute("role", "button");
    image.setAttribute("aria-haspopup", "dialog");
    image.setAttribute("aria-label", (image.getAttribute("alt") || "본문 이미지") + " 확대 보기");
    image.addEventListener("click", function () {
      open(image);
    });
    image.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      open(image);
    });
  });

  dialog.querySelectorAll("[data-lightbox-close]").forEach(function (button) {
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
    targetImage.removeAttribute("src");
    targetImage.alt = "";
    caption.textContent = "";
    if (restoreOnClose && returnFocus instanceof HTMLElement && document.contains(returnFocus)) returnFocus.focus();
    returnFocus = null;
    restoreOnClose = true;
  });
  targetImage.addEventListener("error", function () {
    dialog.classList.add("has-error");
    caption.hidden = false;
    caption.textContent = "이미지를 불러오지 못했습니다.";
  });
  document.addEventListener("daeho:dialog-opening", function (event) {
    if (dialog.open && event.detail && event.detail.dialog !== dialog) close(false);
  });
})();
