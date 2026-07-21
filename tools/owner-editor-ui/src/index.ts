import { ApiError, EditorApi, getSessionLogin } from "./api";
import { AuthError, clearSessionId, readSessionId, startLogin, storeSessionId } from "./auth";
import { EditorController } from "./editor";
import type { EditorConfig } from "./editor";
import { OwnerEditorUI } from "./ui";
import type { EditorAction } from "./ui";

interface RuntimeConfig extends EditorConfig {
  apiBase: string;
  ownerLogin: string;
}

interface OwnerContextState {
  active?: boolean;
  framed?: boolean;
}

function earlyOwnerContext(): OwnerContextState | null {
  const value = (window as Window & { DaehoOwnerContext?: unknown }).DaehoOwnerContext;
  return typeof value === "object" && value !== null ? (value as OwnerContextState) : null;
}

function framedDocument(): boolean {
  const early = earlyOwnerContext();
  if (early?.framed === true) return true;
  try {
    return window.top !== window.self;
  } catch {
    return true;
  }
}

function readConfig(root: HTMLElement): RuntimeConfig {
  return {
    apiBase: root.dataset.apiBase?.trim() || "",
    ownerLogin: root.dataset.ownerLogin?.trim() || "",
    repository: root.dataset.repository?.trim() || "",
    branch: root.dataset.branch?.trim() || "main",
    pageKind: root.dataset.pageKind?.trim() || "page",
    pagePath: root.dataset.pagePath?.trim() || "",
    pageTitle: root.dataset.pageTitle?.trim() || document.title,
  };
}

function activationRequested(): boolean {
  return new URLSearchParams(window.location.search).get("edit") === "1";
}

function reloadIntoOwnerContext(): void {
  const url = new URL(window.location.href);
  url.searchParams.set("edit", "1");
  window.location.assign(url.toString());
}

function ownerMatches(expectedOwner: string, actualLogin: string): boolean {
  return Boolean(actualLogin) && actualLogin.toLowerCase() === expectedOwner.toLowerCase();
}

function initializationError(root: HTMLElement, message: string): void {
  root.hidden = false;
  root.setAttribute("aria-hidden", "false");
  const status = document.getElementById("owner-editor-status");
  const toolbar = document.getElementById("owner-editor-toolbar");
  const toolbarActions = toolbar?.querySelector<HTMLElement>(".owner-editor-toolbar-actions");
  if (toolbar) toolbar.hidden = false;
  if (toolbarActions) toolbarActions.hidden = true;
  if (status) {
    status.hidden = false;
    status.dataset.tone = "error";
    status.textContent = message;
  }
}

function boot(): void {
  const root = document.getElementById("owner-editor-root");
  if (!(root instanceof HTMLElement)) return;

  root.hidden = true;
  root.setAttribute("aria-hidden", "true");
  if (root.dataset.enabled !== "true") return;
  if (framedDocument()) return;

  let activationStarted = false;

  const activate = async (): Promise<void> => {
    if (activationStarted) return;
    activationStarted = true;

    try {
      const config = readConfig(root);
      const ui = new OwnerEditorUI(root);
      ui.activate();
      ui.configureActions(config.pageKind, config.pagePath);

      if (!config.apiBase || !config.ownerLogin || !config.repository) {
        ui.showChecking();
        ui.setStatus("소유자 편집 설정이 완료되지 않았습니다.", "error");
        return;
      }

      let api: EditorApi | null = null;
      let editor: EditorController | null = null;
      let sessionExpiryTimer = 0;

      const clearSessionExpiryTimer = (): void => {
        window.clearTimeout(sessionExpiryTimer);
        sessionExpiryTimer = 0;
      };

      const expireSession = (): void => {
        clearSessionExpiryTimer();
        clearSessionId();
        api = null;
        editor = null;
        ui.closePanel();
        ui.showLoggedOut("편집 세션이 만료되었습니다. 다시 로그인하세요.");
      };

      const establishSession = async (sessionId: string): Promise<void> => {
        const nextApi = new EditorApi(config.apiBase, sessionId);
        const session = await nextApi.getSession();
        if (session.authenticated !== true) throw new ApiError(401, "편집 세션이 만료되었습니다.");

        const login = getSessionLogin(session);
        if (!ownerMatches(config.ownerLogin, login)) {
          try {
            await nextApi.deleteSession();
          } catch {
            // The local session is still cleared before reporting the account mismatch.
          } finally {
            clearSessionId();
          }
          throw new ApiError(403, "설정된 소유자 계정과 로그인 계정이 다릅니다.");
        }
        const expiresAt = Date.parse(session.expiresAt || "");
        if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
          throw new ApiError(401, "편집 세션이 만료되었습니다.");
        }

        api = nextApi;
        editor = new EditorController(nextApi, ui, config, expireSession);
        ui.showAuthenticated(login || config.ownerLogin);
        clearSessionExpiryTimer();
        sessionExpiryTimer = window.setTimeout(
          expireSession,
          Math.min(2_147_483_647, Math.max(0, expiresAt - Date.now())),
        );
      };

      const login = async (): Promise<void> => {
        ui.showChecking();
        try {
          const sessionId = await startLogin(config.apiBase);
          storeSessionId(sessionId);
          await establishSession(sessionId);
        } catch (error) {
          clearSessionId();
          const message =
            error instanceof AuthError || error instanceof ApiError
              ? error.message
              : "소유자 로그인을 완료하지 못했습니다.";
          ui.showLoggedOut(message);
        }
      };

      const logout = async (): Promise<void> => {
        try {
          if (api) await api.deleteSession();
        } catch {
          // The local opaque session is still discarded when the server cannot be reached.
        } finally {
          clearSessionExpiryTimer();
          clearSessionId();
          api = null;
          editor = null;
          ui.closePanel();
          ui.showLoggedOut("로그아웃했습니다.");
        }
      };

      ui.onLogin(login);
      ui.onAction(async (action: EditorAction) => {
        if (action === "logout") {
          await logout();
          return;
        }
        if (!editor) {
          ui.showLoggedOut("편집 세션이 없습니다. 먼저 로그인하세요.");
          return;
        }
        await editor.open(action);
      });
      ui.onSubmit(async (formData) => {
        if (!editor) {
          expireSession();
          return;
        }
        await editor.submit(formData);
      });

      const storedSession = readSessionId();
      if (!storedSession) {
        ui.showLoggedOut();
        return;
      }

      ui.showChecking();
      try {
        await establishSession(storedSession);
      } catch (error) {
        clearSessionId();
        const message =
          error instanceof ApiError && error.status === 403
            ? error.message
            : "저장된 편집 세션을 사용할 수 없습니다. 다시 로그인하세요.";
        ui.showLoggedOut(message);
      }
    } catch {
      initializationError(root, "소유자 편집 UI를 초기화하지 못했습니다.");
    }
  };

  document.addEventListener("keydown", (event) => {
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "e") {
      event.preventDefault();
      if (activationRequested() || earlyOwnerContext()?.active === true) void activate();
      else reloadIntoOwnerContext();
    }
  });

  if (activationRequested() || readSessionId()) void activate();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
else boot();
