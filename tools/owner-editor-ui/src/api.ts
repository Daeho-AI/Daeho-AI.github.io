export interface SessionResponse {
  authenticated?: boolean;
  login?: string;
  expiresAt?: string;
  user?: {
    login?: string;
  };
}

export interface ContentResponse {
  path: string;
  content: string;
  sha?: string;
}

export interface ContentListItem {
  path: string;
  title?: string;
  sha?: string;
}

export interface ContentListResponse {
  items: ContentListItem[];
}

export interface CommitResponse {
  sha?: string;
  commitSha?: string;
  commitUrl?: string;
  htmlUrl?: string;
  contentSha?: string;
  path?: string;
  commit?: {
    sha?: string;
    url?: string;
  };
}

export interface MediaUploadRequest {
  filename: string;
  contentBase64: string;
  contentType: string;
}

export interface MediaUploadResponse extends CommitResponse {
  markdown?: string;
  markdownPath?: string;
  url?: string;
}

interface ErrorPayload {
  error?: string;
  message?: string;
  code?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function normalizeApiBase(apiBase: string): string {
  const url = new URL(apiBase, window.location.href);
  const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";

  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocalhost)) {
    throw new Error("편집 API는 HTTPS 주소를 사용해야 합니다.");
  }

  url.hash = "";
  url.search = "";
  return url.toString().replace(/\/$/, "");
}

export function makeApiUrl(apiBase: string, relativePath: string): URL {
  const base = `${normalizeApiBase(apiBase)}/`;
  return new URL(relativePath.replace(/^\/+/, ""), base);
}

function fallbackErrorMessage(status: number): string {
  if (status === 401) return "편집 세션이 만료되었습니다.";
  if (status === 403) return "이 작업을 수행할 권한이 없습니다.";
  if (status === 404) return "요청한 파일을 찾을 수 없습니다.";
  if (status === 409) return "다른 변경과 충돌했습니다.";
  if (status >= 500) return "편집 서버에서 오류가 발생했습니다.";
  return "요청을 처리하지 못했습니다.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;

  const text = await response.text();
  if (!text) return undefined;

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return undefined;
    }
  }

  return text;
}

export class EditorApi {
  private readonly apiBase: string;
  private readonly sessionId: string;

  constructor(apiBase: string, sessionId: string) {
    this.apiBase = normalizeApiBase(apiBase);
    this.sessionId = sessionId;
  }

  private async request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    body?: unknown,
    query?: Record<string, string>,
  ): Promise<T> {
    const url = makeApiUrl(this.apiBase, path);
    Object.entries(query || {}).forEach(([key, value]) => url.searchParams.set(key, value));

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 30_000);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.sessionId}`,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        signal: controller.signal,
      });

      const payload = await parseResponseBody(response);
      if (!response.ok) {
        const errorPayload = isRecord(payload) ? (payload as ErrorPayload) : undefined;
        const message =
          errorPayload?.message || errorPayload?.error || fallbackErrorMessage(response.status);
        throw new ApiError(response.status, message, errorPayload?.code || errorPayload?.error);
      }

      return payload as T;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new ApiError(0, "편집 서버 응답 시간이 초과되었습니다.", "timeout");
      }
      if (error instanceof ApiError) throw error;
      throw new ApiError(0, "편집 서버에 연결할 수 없습니다.", "network_error");
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  getSession(): Promise<SessionResponse> {
    return this.request<SessionResponse>("GET", "api/session");
  }

  getContent(path: string): Promise<ContentResponse> {
    return this.request<ContentResponse>("GET", "api/content", undefined, { path });
  }

  listContent(kind: string): Promise<ContentListResponse> {
    return this.request<ContentListResponse>("GET", "api/list", undefined, { kind });
  }

  putContent(input: {
    path: string;
    content: string;
    sha?: string;
    message: string;
  }): Promise<CommitResponse> {
    return this.request<CommitResponse>("PUT", "api/content", input);
  }

  uploadMedia(input: MediaUploadRequest): Promise<MediaUploadResponse> {
    return this.request<MediaUploadResponse>("POST", "api/media", input);
  }

  deleteSession(): Promise<void> {
    return this.request<void>("DELETE", "api/session");
  }
}

export function getSessionLogin(session: SessionResponse): string {
  return session.login || session.user?.login || "";
}

export function getCommitDetails(result: CommitResponse): {
  sha: string;
  url: string;
} {
  return {
    sha: result.commitSha || result.commit?.sha || result.sha || "",
    url: result.commitUrl || result.commit?.url || result.htmlUrl || "",
  };
}
