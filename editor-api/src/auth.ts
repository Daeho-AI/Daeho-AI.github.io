import { isAllowedOrigin } from "./cors";
import { createPkceChallenge, createPkceVerifier, randomToken } from "./crypto";
import { exchangeOAuthCode, verifyOwnerAccess } from "./github";
import {
  consumeOAuthState,
  createEditorSession,
  storeOAuthState,
  type Env,
  type OAuthStateRecord,
} from "./session";
import { HttpError } from "./validation";

function callbackUri(request: Request): string {
  return new URL("/auth/callback", new URL(request.url).origin).toString();
}

export async function startAuthorization(request: Request, env: Env): Promise<Response> {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.searchParams.get("origin");
  if (!isAllowedOrigin(origin, env.BLOG_ORIGIN)) {
    throw new HttpError(403, "invalid_origin", "허용되지 않은 로그인 요청 출처입니다.");
  }
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.SESSION_ENCRYPTION_KEY) {
    throw new HttpError(503, "not_configured", "소유자 로그인 API 설정이 완료되지 않았습니다.");
  }

  const state = randomToken(32);
  const verifier = createPkceVerifier();
  const redirectUri = callbackUri(request);
  const stateRecord: OAuthStateRecord = {
    origin: origin!,
    verifier,
    redirectUri,
    createdAt: Date.now(),
  };
  await storeOAuthState(env, state, stateRecord);

  const githubUrl = new URL("https://github.com/login/oauth/authorize");
  githubUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  githubUrl.searchParams.set("redirect_uri", redirectUri);
  githubUrl.searchParams.set("state", state);
  githubUrl.searchParams.set("code_challenge", await createPkceChallenge(verifier));
  githubUrl.searchParams.set("code_challenge_method", "S256");
  githubUrl.searchParams.set("allow_signup", "false");

  return new Response(null, {
    status: 302,
    headers: {
      Location: githubUrl.toString(),
      "Cache-Control": "no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    },
  });
}

function escapedJson(value: unknown): string {
  return JSON.stringify(value).replace(/[<>&]/g, (character) => {
    const code = character.charCodeAt(0).toString(16).padStart(4, "0");
    return `\\u${code}`;
  });
}

function callbackPage(
  targetOrigin: string,
  payload: { source: "daeho-owner-editor"; sessionId?: string; error?: string },
  success: boolean,
): Response {
  const title = success ? "소유자 로그인 완료" : "소유자 로그인 실패";
  const message = success
    ? "인증이 완료되었습니다. 이 창은 자동으로 닫힙니다."
    : "인증을 완료하지 못했습니다. 블로그로 돌아가 다시 시도하세요.";
  const nonce = randomToken(16);
  const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <style nonce="${nonce}">body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f8fafc;color:#172033;font:16px/1.6 system-ui,sans-serif}.card{max-width:30rem;margin:1rem;padding:2rem;border:1px solid #dce3ec;border-radius:12px;background:#fff;box-shadow:0 12px 30px #0f172a12}h1{font-size:1.35rem;margin:0 0 .5rem}p{margin:0;color:#526277}</style>
</head>
<body>
  <main class="card"><h1>${title}</h1><p>${message}</p></main>
  <script nonce="${nonce}">
    (() => {
      const payload = ${escapedJson(payload)};
      const targetOrigin = ${escapedJson(targetOrigin)};
      if (window.opener && !window.opener.closed) window.opener.postMessage(payload, targetOrigin);
      window.setTimeout(() => window.close(), 250);
    })();
  </script>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`,
      "Cross-Origin-Opener-Policy": "unsafe-none",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    },
  });
}

function invalidStatePage(): Response {
  const html = "<!doctype html><html lang=\"ko\"><meta charset=\"utf-8\"><title>인증 요청 만료</title><body><h1>인증 요청이 만료되었습니다.</h1><p>블로그에서 소유자 로그인을 다시 시작하세요.</p></body></html>";
  return new Response(html, {
    status: 400,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    },
  });
}

export async function finishAuthorization(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const state = url.searchParams.get("state") || "";
  const stateRecord = await consumeOAuthState(env, state);
  if (!stateRecord || !isAllowedOrigin(stateRecord.origin, env.BLOG_ORIGIN)) return invalidStatePage();
  if (stateRecord.redirectUri !== callbackUri(request)) return invalidStatePage();

  if (url.searchParams.has("error")) {
    return callbackPage(
      stateRecord.origin,
      { source: "daeho-owner-editor", error: "authorization_denied" },
      false,
    );
  }
  const code = url.searchParams.get("code") || "";
  if (!/^[A-Za-z0-9_-]{6,256}$/.test(code)) {
    return callbackPage(
      stateRecord.origin,
      { source: "daeho-owner-editor", error: "invalid_code" },
      false,
    );
  }

  try {
    const token = await exchangeOAuthCode(env, code, stateRecord.verifier, stateRecord.redirectUri);
    const login = await verifyOwnerAccess(env, token.accessToken);
    const session = await createEditorSession(env, token.accessToken, login);
    return callbackPage(
      stateRecord.origin,
      { source: "daeho-owner-editor", sessionId: session.sessionId },
      true,
    );
  } catch {
    return callbackPage(
      stateRecord.origin,
      { source: "daeho-owner-editor", error: "owner_verification_failed" },
      false,
    );
  }
}
