import type { Env } from "./session";

const GITHUB_API = "https://api.github.com";
const GITHUB_API_VERSION = "2026-03-10";

export class GitHubError extends Error {
  readonly status: number;
  readonly rateLimited: boolean;
  readonly retryAfterSeconds?: number;

  constructor(
    status: number,
    message: string,
    options: { rateLimited?: boolean; retryAfterSeconds?: number } = {},
  ) {
    super(message);
    this.name = "GitHubError";
    this.status = status;
    this.rateLimited = options.rateLimited === true;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

function encodeRepositoryPath(path: string): string {
  return path.split("/").map((segment) => encodeURIComponent(segment)).join("/");
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function rateLimitMetadata(response: Response, message: string): {
  rateLimited: boolean;
  retryAfterSeconds?: number;
} {
  const remaining = response.headers.get("X-RateLimit-Remaining");
  const retryAfter = response.headers.get("Retry-After") || "";
  const resetAt = response.headers.get("X-RateLimit-Reset") || "";
  const rateLimited =
    response.status === 429 ||
    (response.status === 403 && (remaining === "0" || Boolean(retryAfter) || /rate limit/i.test(message)));
  if (!rateLimited) return { rateLimited: false };

  let seconds = /^\d+$/.test(retryAfter) ? Number.parseInt(retryAfter, 10) : Number.NaN;
  if (!Number.isFinite(seconds) && /^\d+$/.test(resetAt)) {
    seconds = Math.ceil(Number.parseInt(resetAt, 10) - Date.now() / 1000);
  }
  return {
    rateLimited: true,
    retryAfterSeconds: Number.isFinite(seconds) ? Math.max(1, Math.min(3600, seconds)) : undefined,
  };
}

async function githubRequest<T>(
  accessToken: string,
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/vnd.github+json");
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("X-GitHub-Api-Version", GITHUB_API_VERSION);
  headers.set("User-Agent", "Daeho-AI-owner-editor");

  const response = await fetch(url, { ...init, headers });
  const payload = await parseJson(response);
  if (!response.ok) {
    const details = record(payload);
    const message = typeof details?.message === "string" ? details.message.slice(0, 240) : "GitHub API request failed";
    throw new GitHubError(response.status, message, rateLimitMetadata(response, message));
  }
  return payload as T;
}

export interface OAuthTokenResult {
  accessToken: string;
  expiresIn?: number;
}

export async function exchangeOAuthCode(
  env: Env,
  code: string,
  verifier: string,
  redirectUri: string,
): Promise<OAuthTokenResult> {
  const body = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    client_secret: env.GITHUB_CLIENT_SECRET,
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      "User-Agent": "Daeho-AI-owner-editor",
    },
    body,
  });
  const payload = record(await parseJson(response));
  const accessToken = typeof payload?.access_token === "string" ? payload.access_token : "";
  if (!response.ok || !accessToken) {
    const description = typeof payload?.error_description === "string" ? payload.error_description : "GitHub OAuth exchange failed";
    throw new GitHubError(response.status || 400, description.slice(0, 240));
  }
  return {
    accessToken,
    expiresIn: typeof payload?.expires_in === "number" ? payload.expires_in : undefined,
  };
}

interface GitHubUser {
  login?: string;
}

interface GitHubRepository {
  full_name?: string;
  permissions?: {
    push?: boolean;
  };
}

interface GitHubInstallation {
  id?: number;
  account?: {
    login?: string;
  };
  permissions?: {
    contents?: string;
  };
  suspended_at?: string | null;
}

interface GitHubInstallationList {
  installations?: GitHubInstallation[];
}

interface GitHubInstallationRepositories {
  repositories?: GitHubRepository[];
}

export async function verifyOwnerAccess(env: Env, accessToken: string): Promise<string> {
  const user = await githubRequest<GitHubUser>(accessToken, `${GITHUB_API}/user`);
  const login = typeof user.login === "string" ? user.login : "";
  if (!login || login.toLocaleLowerCase("en-US") !== env.OWNER_LOGIN.toLocaleLowerCase("en-US")) {
    throw new GitHubError(403, "Authenticated GitHub account is not the configured owner");
  }

  const directRepository = await githubRequest<GitHubRepository>(
    accessToken,
    `${GITHUB_API}/repos/${encodeRepositoryPath(env.REPOSITORY)}`,
  );
  if (
    directRepository.full_name?.toLocaleLowerCase("en-US") !== env.REPOSITORY.toLocaleLowerCase("en-US") ||
    directRepository.permissions?.push !== true
  ) {
    throw new GitHubError(403, "Authenticated GitHub account does not have push access to the locked repository");
  }

  const installations = await githubRequest<GitHubInstallationList>(
    accessToken,
    `${GITHUB_API}/user/installations?per_page=100`,
  );
  const candidates = (installations.installations || []).filter(
    (installation) =>
      typeof installation.id === "number" &&
      installation.account?.login?.toLocaleLowerCase("en-US") === env.OWNER_LOGIN.toLocaleLowerCase("en-US") &&
      installation.permissions?.contents === "write" &&
      !installation.suspended_at,
  );

  for (const installation of candidates) {
    const repositories = await githubRequest<GitHubInstallationRepositories>(
      accessToken,
      `${GITHUB_API}/user/installations/${installation.id}/repositories?per_page=100`,
    );
    const repository = (repositories.repositories || []).find(
      (item) => item.full_name?.toLocaleLowerCase("en-US") === env.REPOSITORY.toLocaleLowerCase("en-US"),
    );
    if (repository?.permissions?.push === true) return login;
  }
  throw new GitHubError(403, "The GitHub App installation does not have Contents write access to the locked repository");
}

interface GitHubContentFile {
  type?: string;
  path?: string;
  name?: string;
  sha?: string;
  size?: number;
  encoding?: string;
  content?: string;
}

function decodeUtf8Base64(content: string): string {
  const binary = atob(content.replace(/\s+/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new GitHubError(422, "Repository file is not valid UTF-8 text");
  }
}

export async function getRepositoryContent(
  env: Env,
  accessToken: string,
  path: string,
): Promise<{ path: string; content: string; sha: string }> {
  const query = new URLSearchParams({ ref: env.BRANCH });
  const result = await githubRequest<GitHubContentFile>(
    accessToken,
    `${GITHUB_API}/repos/${encodeRepositoryPath(env.REPOSITORY)}/contents/${encodeRepositoryPath(path)}?${query}`,
  );
  if (result.type !== "file" || typeof result.sha !== "string" || typeof result.content !== "string" || result.encoding !== "base64") {
    throw new GitHubError(422, "Repository path is not an editable UTF-8 file");
  }
  return { path: result.path || path, content: decodeUtf8Base64(result.content), sha: result.sha };
}

export async function listRepositoryContent(
  env: Env,
  accessToken: string,
  kind: "posts" | "projects",
): Promise<Array<{ path: string; title: string; sha: string }>> {
  const directory = kind === "posts" ? "_posts" : "_projects";
  const query = new URLSearchParams({ ref: env.BRANCH });
  const result = await githubRequest<GitHubContentFile[]>(
    accessToken,
    `${GITHUB_API}/repos/${encodeRepositoryPath(env.REPOSITORY)}/contents/${directory}?${query}`,
  );
  if (!Array.isArray(result)) throw new GitHubError(422, "Repository directory listing is unavailable");
  return result
    .filter((item) => item.type === "file" && typeof item.path === "string" && typeof item.sha === "string" && item.name?.endsWith(".md"))
    .map((item) => ({
      path: item.path!,
      title: item.name!.replace(/\.md$/i, ""),
      sha: item.sha!,
    }))
    .sort((a, b) => b.path.localeCompare(a.path));
}

interface GitHubPutResponse {
  content?: {
    path?: string;
    sha?: string;
  };
  commit?: {
    sha?: string;
    html_url?: string;
  };
}

export async function putRepositoryContent(
  env: Env,
  accessToken: string,
  input: { path: string; contentBase64: string; message: string; sha?: string },
): Promise<{ path: string; contentSha: string; commitSha: string; commitUrl: string }> {
  const body: Record<string, unknown> = {
    message: input.message,
    content: input.contentBase64,
    branch: env.BRANCH,
  };
  if (input.sha) body.sha = input.sha;
  const result = await githubRequest<GitHubPutResponse>(
    accessToken,
    `${GITHUB_API}/repos/${encodeRepositoryPath(env.REPOSITORY)}/contents/${encodeRepositoryPath(input.path)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
    },
  );
  const commitSha = result.commit?.sha || "";
  const contentSha = result.content?.sha || "";
  if (!commitSha || !contentSha) throw new GitHubError(502, "GitHub did not return the created commit");
  return {
    path: result.content?.path || input.path,
    contentSha,
    commitSha,
    commitUrl: result.commit?.html_url || `https://github.com/${env.REPOSITORY}/commit/${commitSha}`,
  };
}

export function utf8ToBase64(content: string): string {
  const bytes = new TextEncoder().encode(content);
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}
