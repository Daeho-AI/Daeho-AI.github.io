import { openJson, randomToken, sealJson, sha256Base64Url } from "./crypto";

export interface Env {
  OAUTH_STATES: KVNamespace;
  EDITOR_SESSIONS: KVNamespace;
  BLOG_ORIGIN: string;
  OWNER_LOGIN: string;
  REPOSITORY: string;
  BRANCH: string;
  SESSION_TTL_SECONDS?: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  SESSION_ENCRYPTION_KEY: string;
}

export interface OAuthStateRecord {
  origin: string;
  verifier: string;
  redirectUri: string;
  createdAt: number;
}

export interface EditorSessionRecord {
  accessToken: string;
  login: string;
  expiresAt: number;
}

const OAUTH_STATE_TTL_SECONDS = 600;
const DEFAULT_SESSION_TTL_SECONDS = 3600;

function sessionTtl(env: Env): number {
  const value = Number.parseInt(env.SESSION_TTL_SECONDS || "", 10);
  if (!Number.isFinite(value)) return DEFAULT_SESSION_TTL_SECONDS;
  return Math.max(300, Math.min(DEFAULT_SESSION_TTL_SECONDS, value));
}

async function oauthStateKey(state: string): Promise<string> {
  return `oauth:${await sha256Base64Url(state)}`;
}

async function sessionKey(sessionId: string): Promise<string> {
  return `session:${await sha256Base64Url(sessionId)}`;
}

export async function storeOAuthState(
  env: Env,
  state: string,
  record: OAuthStateRecord,
): Promise<void> {
  const encrypted = await sealJson(record, env.SESSION_ENCRYPTION_KEY);
  await env.OAUTH_STATES.put(await oauthStateKey(state), encrypted, {
    expirationTtl: OAUTH_STATE_TTL_SECONDS,
  });
}

export async function consumeOAuthState(env: Env, state: string): Promise<OAuthStateRecord | null> {
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(state)) return null;
  const key = await oauthStateKey(state);
  const encrypted = await env.OAUTH_STATES.get(key);
  await env.OAUTH_STATES.delete(key);
  if (!encrypted) return null;

  try {
    const record = await openJson<OAuthStateRecord>(encrypted, env.SESSION_ENCRYPTION_KEY);
    if (
      typeof record.origin !== "string" ||
      typeof record.verifier !== "string" ||
      typeof record.redirectUri !== "string" ||
      typeof record.createdAt !== "number" ||
      Date.now() - record.createdAt > OAUTH_STATE_TTL_SECONDS * 1000
    ) {
      return null;
    }
    return record;
  } catch {
    return null;
  }
}

export async function createEditorSession(
  env: Env,
  accessToken: string,
  login: string,
): Promise<{ sessionId: string; expiresAt: number }> {
  const sessionId = randomToken(32);
  const ttl = sessionTtl(env);
  const expiresAt = Date.now() + ttl * 1000;
  const record: EditorSessionRecord = { accessToken, login, expiresAt };
  const encrypted = await sealJson(record, env.SESSION_ENCRYPTION_KEY);
  await env.EDITOR_SESSIONS.put(await sessionKey(sessionId), encrypted, { expirationTtl: ttl });
  return { sessionId, expiresAt };
}

export function bearerSessionId(request: Request): string | null {
  const authorization = request.headers.get("Authorization") || "";
  const match = authorization.match(/^Bearer ([A-Za-z0-9_-]{43})$/);
  return match?.[1] || null;
}

export async function loadEditorSession(
  env: Env,
  sessionId: string,
): Promise<EditorSessionRecord | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(sessionId)) return null;
  const key = await sessionKey(sessionId);
  const encrypted = await env.EDITOR_SESSIONS.get(key);
  if (!encrypted) return null;

  try {
    const record = await openJson<EditorSessionRecord>(encrypted, env.SESSION_ENCRYPTION_KEY);
    if (
      typeof record.accessToken !== "string" ||
      typeof record.login !== "string" ||
      typeof record.expiresAt !== "number" ||
      record.expiresAt <= Date.now()
    ) {
      await env.EDITOR_SESSIONS.delete(key);
      return null;
    }
    return record;
  } catch {
    await env.EDITOR_SESSIONS.delete(key);
    return null;
  }
}

export async function deleteEditorSession(env: Env, sessionId: string): Promise<void> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(sessionId)) return;
  await env.EDITOR_SESSIONS.delete(await sessionKey(sessionId));
}
