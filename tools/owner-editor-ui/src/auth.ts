import { makeApiUrl, normalizeApiBase } from "./api";

const SESSION_STORAGE_KEY = "daeho-owner-editor-session";
const AUTH_MESSAGE_SOURCE = "daeho-owner-editor";
const AUTH_TIMEOUT_MS = 120_000;

type AuthErrorCode =
  | "popup_blocked"
  | "popup_closed"
  | "auth_timeout"
  | "auth_denied"
  | "invalid_response";

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validSessionId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function readSessionId(): string {
  try {
    const value = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    return validSessionId(value) ? value : "";
  } catch {
    return "";
  }
}

export function storeSessionId(sessionId: string): void {
  if (!validSessionId(sessionId)) {
    throw new AuthError("invalid_response", "로그인 응답이 올바르지 않습니다.");
  }

  try {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  } catch {
    throw new AuthError("invalid_response", "브라우저가 편집 세션 저장을 허용하지 않습니다.");
  }
}

export function clearSessionId(): void {
  try {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in hardened browser modes. Nothing else is persisted.
  }
}

export function startLogin(apiBase: string): Promise<string> {
  const authUrl = makeApiUrl(apiBase, "auth/start");
  authUrl.searchParams.set("origin", window.location.origin);

  const expectedOrigin = new URL(normalizeApiBase(apiBase)).origin;
  const width = 560;
  const height = 720;
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
  const popup = window.open(
    authUrl.toString(),
    "daeho-owner-editor-auth",
    `popup=yes,width=${width},height=${height},left=${left},top=${top}`,
  );

  if (!popup) {
    return Promise.reject(
      new AuthError("popup_blocked", "로그인 팝업이 차단되었습니다. 팝업을 허용한 뒤 다시 시도하세요."),
    );
  }

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    let closedPollId = 0;
    let timeoutId = 0;

    const cleanup = (): void => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", handleMessage);
      window.clearInterval(closedPollId);
      window.clearTimeout(timeoutId);
    };

    const rejectAuth = (error: AuthError): void => {
      cleanup();
      if (!popup.closed) popup.close();
      reject(error);
    };

    const handleMessage = (event: MessageEvent<unknown>): void => {
      if (event.origin !== expectedOrigin || event.source !== popup || !isRecord(event.data)) {
        return;
      }

      if (event.data.source !== AUTH_MESSAGE_SOURCE) return;

      if (typeof event.data.error === "string" && event.data.error) {
        rejectAuth(new AuthError("auth_denied", "소유자 로그인이 완료되지 않았습니다."));
        return;
      }

      if (!validSessionId(event.data.sessionId)) {
        rejectAuth(new AuthError("invalid_response", "로그인 응답이 올바르지 않습니다."));
        return;
      }

      const sessionId = event.data.sessionId;
      cleanup();
      if (!popup.closed) popup.close();
      resolve(sessionId);
    };

    window.addEventListener("message", handleMessage);

    closedPollId = window.setInterval(() => {
      if (popup.closed) {
        rejectAuth(new AuthError("popup_closed", "로그인 창이 완료 전에 닫혔습니다."));
      }
    }, 500);

    timeoutId = window.setTimeout(() => {
      rejectAuth(new AuthError("auth_timeout", "로그인 대기 시간이 초과되었습니다."));
    }, AUTH_TIMEOUT_MS);
  });
}
