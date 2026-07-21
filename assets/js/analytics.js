(() => {
  "use strict";

  const banner = document.querySelector("[data-analytics-consent]");
  if (!(banner instanceof HTMLElement)) return;
  if (!window.DaehoOwnerContext || window.DaehoOwnerContext.externalScriptsAllowed !== true) {
    banner.hidden = true;
    return;
  }

  const storageKey = "daeho-ai:analytics-consent:v1";
  const isHttpsUrl = (value) => {
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  };

  const appendScript = (source, attributes = {}) => {
    if (!isHttpsUrl(source)) return false;
    const script = document.createElement("script");
    script.src = source;
    script.async = true;
    Object.entries(attributes).forEach(([name, value]) => script.setAttribute(name, value));
    document.head.append(script);
    return true;
  };

  const enableProvider = () => {
    const provider = banner.dataset.provider || "";
    if (provider === "google" && /^G-[A-Z0-9]+$/i.test(banner.dataset.googleId || "")) {
      appendScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(banner.dataset.googleId)}`);
      window.dataLayer = window.dataLayer || [];
      const gtag = (...args) => window.dataLayer.push(args);
      gtag("js", new Date());
      gtag("config", banner.dataset.googleId, { anonymize_ip: true });
      return;
    }
    if (provider === "umami" && banner.dataset.umamiId) {
      appendScript(banner.dataset.umamiUrl || "", { "data-website-id": banner.dataset.umamiId });
      return;
    }
    if (provider === "plausible" && banner.dataset.plausibleDomain) {
      appendScript(banner.dataset.plausibleUrl || "", { defer: "", "data-domain": banner.dataset.plausibleDomain });
    }
  };

  let decision = "";
  try {
    decision = window.localStorage.getItem(storageKey) || "";
  } catch {
    decision = "";
  }

  if (decision === "accepted") {
    enableProvider();
    return;
  }
  if (decision === "rejected") return;

  banner.hidden = false;
  banner.querySelector("[data-consent-accept]")?.addEventListener("click", () => {
    try { window.localStorage.setItem(storageKey, "accepted"); } catch { /* Consent still applies for this page. */ }
    banner.hidden = true;
    enableProvider();
  });
  banner.querySelector("[data-consent-reject]")?.addEventListener("click", () => {
    try { window.localStorage.setItem(storageKey, "rejected"); } catch { /* The banner can still close for this page. */ }
    banner.hidden = true;
  });
})();
