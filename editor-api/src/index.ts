import { finishAuthorization, startAuthorization } from "./auth";
import { applyCors, applySecurityHeaders, isAllowedOrigin, jsonResponse, preflightResponse } from "./cors";
import {
  getRepositoryContent,
  GitHubError,
  listRepositoryContent,
  putRepositoryContent,
  utf8ToBase64,
  verifyOwnerAccess,
} from "./github";
import { randomToken } from "./crypto";
import {
  bearerSessionId,
  deleteEditorSession,
  loadEditorSession,
  type EditorSessionRecord,
  type Env,
} from "./session";
import {
  buildUploadPath,
  bytesToBase64,
  HttpError,
  validateCommitMessage,
  validateContentPath,
  validateMediaInput,
  validateSha,
  validateTextContent,
} from "./validation";

const LOCKED_OWNER = "Daeho-AI";
const LOCKED_REPOSITORY = "Daeho-AI/Daeho-AI.github.io";
const LOCKED_BRANCH = "main";
const MAX_JSON_BODY_BYTES = 15 * 1024 * 1024;

function configurationValid(env: Env): boolean {
  return (
    env.OWNER_LOGIN === LOCKED_OWNER &&
    env.REPOSITORY === LOCKED_REPOSITORY &&
    env.BRANCH === LOCKED_BRANCH &&
    env.BLOG_ORIGIN === "https://daeho-ai.github.io" &&
    Boolean(env.GITHUB_CLIENT_ID) &&
    Boolean(env.GITHUB_CLIENT_SECRET) &&
    typeof env.SESSION_ENCRYPTION_KEY === "string" &&
    env.SESSION_ENCRYPTION_KEY.length >= 32
  );
}

function assertConfiguration(env: Env): void {
  if (!configurationValid(env)) {
    throw new HttpError(503, "not_configured", "소유자 편집 API 설정이 완료되지 않았습니다.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function jsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "unsupported_media_type", "JSON 요청만 허용됩니다.");
  }
  const declaredLength = Number.parseInt(request.headers.get("Content-Length") || "0", 10);
  if (declaredLength > MAX_JSON_BODY_BYTES) {
    throw new HttpError(413, "request_too_large", "요청 본문이 너무 큽니다.");
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_JSON_BODY_BYTES) {
    throw new HttpError(413, "request_too_large", "요청 본문이 너무 큽니다.");
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpError(400, "invalid_json", "JSON 요청 형식이 올바르지 않습니다.");
  }
}

async function authenticatedSession(
  request: Request,
  env: Env,
): Promise<{ sessionId: string; session: EditorSessionRecord; login: string }> {
  const sessionId = bearerSessionId(request);
  if (!sessionId) throw new HttpError(401, "authentication_required", "소유자 로그인이 필요합니다.");
  const session = await loadEditorSession(env, sessionId);
  if (!session) throw new HttpError(401, "session_expired", "편집 세션이 만료되었습니다.");
  try {
    const login = await verifyOwnerAccess(env, session.accessToken);
    if (login.toLocaleLowerCase("en-US") !== session.login.toLocaleLowerCase("en-US")) {
      await deleteEditorSession(env, sessionId);
      throw new HttpError(401, "session_identity_changed", "편집 세션 계정이 변경되었습니다.");
    }
    return { sessionId, session, login };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error instanceof GitHubError && error.rateLimited) throw error;
    if (error instanceof GitHubError && (error.status === 401 || error.status === 403 || error.status === 404)) {
      await deleteEditorSession(env, sessionId);
      throw new HttpError(
        error.status === 401 ? 401 : 403,
        error.status === 401 ? "session_expired" : "owner_access_denied",
        error.status === 401 ? "GitHub 편집 권한이 만료되었습니다." : "저장소 쓰기 권한을 확인할 수 없습니다.",
      );
    }
    throw error;
  }
}

async function putTextContent(
  request: Request,
  env: Env,
  session: EditorSessionRecord,
): Promise<Response> {
  const input = await jsonBody(request);
  if (!isRecord(input)) throw new HttpError(400, "invalid_request", "저장 요청이 올바르지 않습니다.");
  const path = validateContentPath(input.path);
  const content = validateTextContent(path, input.content);
  const message = validateCommitMessage(input.message, `owner-editor: update ${path}`);

  let existing: { sha: string } | null = null;
  try {
    existing = await getRepositoryContent(env, session.accessToken, path);
  } catch (error) {
    if (!(error instanceof GitHubError) || error.status !== 404) throw error;
  }

  let sha: string | undefined;
  if (existing) {
    sha = validateSha(input.sha, true);
    if (sha !== existing.sha.toLowerCase()) {
      throw new HttpError(409, "content_conflict", "파일이 다른 곳에서 변경되었습니다. 최신 내용을 다시 불러오세요.");
    }
  } else {
    sha = validateSha(input.sha, false);
    if (sha) {
      throw new HttpError(409, "content_conflict", "파일 상태가 변경되었습니다. 최신 내용을 다시 확인하세요.");
    }
  }

  const result = await putRepositoryContent(env, session.accessToken, {
    path,
    contentBase64: utf8ToBase64(content),
    message,
    sha,
  });
  return jsonResponse(result, 200);
}

async function uploadMedia(
  request: Request,
  env: Env,
  session: EditorSessionRecord,
): Promise<Response> {
  const input = await jsonBody(request);
  const media = validateMediaInput(input);
  const path = buildUploadPath(media, randomToken(16));
  const result = await putRepositoryContent(env, session.accessToken, {
    path,
    contentBase64: bytesToBase64(media.bytes),
    message: `owner-editor: upload ${path}`,
  });
  return jsonResponse({ ...result, markdownPath: `/${path}` }, 201);
}

async function handleApi(request: Request, env: Env, pathname: string): Promise<Response> {
  if (request.method === "DELETE" && pathname === "/api/session") {
    const sessionId = bearerSessionId(request);
    if (!sessionId) {
      throw new HttpError(401, "authentication_required", "유효한 편집 세션이 필요합니다.");
    }
    await deleteEditorSession(env, sessionId);
    return new Response(null, { status: 204 });
  }

  const { session, login } = await authenticatedSession(request, env);

  if (request.method === "GET" && pathname === "/api/session") {
    return jsonResponse({ authenticated: true, login, expiresAt: new Date(session.expiresAt).toISOString() });
  }

  if (request.method === "GET" && pathname === "/api/content") {
    const path = validateContentPath(new URL(request.url).searchParams.get("path"));
    return jsonResponse(await getRepositoryContent(env, session.accessToken, path));
  }

  if (request.method === "GET" && pathname === "/api/list") {
    const kind = new URL(request.url).searchParams.get("kind");
    if (kind !== "posts" && kind !== "projects") {
      throw new HttpError(400, "invalid_list_kind", "목록 종류는 posts 또는 projects여야 합니다.");
    }
    return jsonResponse({ items: await listRepositoryContent(env, session.accessToken, kind) });
  }

  if (request.method === "PUT" && pathname === "/api/content") {
    return putTextContent(request, env, session);
  }

  if (request.method === "POST" && pathname === "/api/media") {
    return uploadMedia(request, env, session);
  }

  throw new HttpError(404, "not_found", "요청한 API 경로를 찾을 수 없습니다.");
}

function errorResponse(error: unknown, requestId: string): Response {
  if (error instanceof HttpError) {
    return jsonResponse({ error: error.code, message: error.message, requestId }, error.status);
  }
  if (error instanceof GitHubError) {
    if (error.rateLimited) {
      const response = jsonResponse(
        {
          error: "github_rate_limited",
          message: "GitHub API 요청 한도에 도달했습니다. 잠시 후 다시 시도하세요.",
          requestId,
        },
        429,
      );
      if (!error.retryAfterSeconds) return response;
      const headers = new Headers(response.headers);
      headers.set("Retry-After", String(error.retryAfterSeconds));
      return new Response(response.body, { status: response.status, headers });
    }
    if (error.status === 404) return jsonResponse({ error: "github_not_found", message: "저장소 파일을 찾을 수 없습니다.", requestId }, 404);
    if (error.status === 409 || error.status === 422) {
      return jsonResponse({ error: "github_conflict", message: "GitHub에서 변경 충돌을 감지했습니다. 최신 내용을 다시 불러오세요.", requestId }, 409);
    }
    if (error.status === 401 || error.status === 403) {
      return jsonResponse({ error: "github_access_denied", message: "GitHub 저장 권한을 확인할 수 없습니다.", requestId }, error.status);
    }
    return jsonResponse({ error: "github_error", message: "GitHub API 요청을 완료하지 못했습니다.", requestId }, 502);
  }
  console.error("owner-editor request failed", { requestId, type: error instanceof Error ? error.name : typeof error });
  return jsonResponse({ error: "internal_error", message: "편집 API에서 오류가 발생했습니다.", requestId }, 500);
}

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, "") || "/";

  if (request.method === "GET" && pathname === "/health") {
    const ready = configurationValid(env);
    return jsonResponse({ ok: ready, service: "daeho-owner-editor-api", configured: ready }, ready ? 200 : 503);
  }

  assertConfiguration(env);

  if (request.method === "GET" && pathname === "/auth/start") return startAuthorization(request, env);
  if (request.method === "GET" && pathname === "/auth/callback") return finishAuthorization(request, env);

  if (pathname.startsWith("/api/")) {
    if (request.method === "OPTIONS") return preflightResponse(request, env.BLOG_ORIGIN);
    if (!isAllowedOrigin(request.headers.get("Origin"), env.BLOG_ORIGIN)) {
      throw new HttpError(403, "cors_forbidden", "허용되지 않은 요청 출처입니다.");
    }
    return handleApi(request, env, pathname);
  }

  throw new HttpError(404, "not_found", "요청한 경로를 찾을 수 없습니다.");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestId = crypto.randomUUID();
    let response: Response;
    try {
      response = await route(request, env);
    } catch (error) {
      response = errorResponse(error, requestId);
    }
    const headers = new Headers(response.headers);
    headers.set("X-Request-Id", requestId);
    response = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
    const pathname = new URL(request.url).pathname;
    if (pathname.startsWith("/api/")) return applyCors(response, request, env.BLOG_ORIGIN);
    return applySecurityHeaders(response);
  },
};
