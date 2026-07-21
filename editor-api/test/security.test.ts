import { afterEach, describe, expect, it, vi } from "vitest";
import { finishAuthorization, startAuthorization } from "../src/auth";
import { isAllowedOrigin, preflightResponse } from "../src/cors";
import { verifyOwnerAccess } from "../src/github";
import worker from "../src/index";
import { createEditorSession, type Env } from "../src/session";

function environment(): {
  env: Env;
  oauthValues: Map<string, string>;
  sessionValues: Map<string, string>;
} {
  const oauthValues = new Map<string, string>();
  const sessionValues = new Map<string, string>();
  const kv = (values: Map<string, string>) =>
    ({
      get: async (key: string) => values.get(key) ?? null,
      put: async (key: string, value: string) => {
        values.set(key, value);
      },
      delete: async (key: string) => {
        values.delete(key);
      },
    }) as unknown as KVNamespace;
  return {
    env: {
      OAUTH_STATES: kv(oauthValues),
      EDITOR_SESSIONS: kv(sessionValues),
      BLOG_ORIGIN: "https://daeho-ai.github.io",
      OWNER_LOGIN: "Daeho-AI",
      REPOSITORY: "Daeho-AI/Daeho-AI.github.io",
      BRANCH: "main",
      SESSION_TTL_SECONDS: "3600",
      GITHUB_CLIENT_ID: "github-client-id",
      GITHUB_CLIENT_SECRET: "github-client-secret",
      SESSION_ENCRYPTION_KEY: "e".repeat(64),
    },
    oauthValues,
    sessionValues,
  };
}

describe("origin and OAuth security", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("matches only the exact production blog origin", () => {
    expect(isAllowedOrigin("https://daeho-ai.github.io", "https://daeho-ai.github.io")).toBe(true);
    expect(isAllowedOrigin("https://evil.example", "https://daeho-ai.github.io")).toBe(false);
    expect(isAllowedOrigin("https://daeho-ai.github.io.evil.example", "https://daeho-ai.github.io")).toBe(false);
    expect(isAllowedOrigin(null, "https://daeho-ai.github.io")).toBe(false);
  });

  it("rejects CORS preflight from any other origin", async () => {
    const rejected = preflightResponse(
      new Request("https://api.example/api/content", {
        method: "OPTIONS",
        headers: {
          Origin: "https://evil.example",
          "Access-Control-Request-Method": "PUT",
          "Access-Control-Request-Headers": "authorization,content-type",
        },
      }),
      "https://daeho-ai.github.io",
    );
    expect(rejected.status).toBe(403);
    expect(rejected.headers.get("Access-Control-Allow-Origin")).toBeNull();

    const allowed = preflightResponse(
      new Request("https://api.example/api/content", {
        method: "OPTIONS",
        headers: {
          Origin: "https://daeho-ai.github.io",
          "Access-Control-Request-Method": "PUT",
          "Access-Control-Request-Headers": "authorization,content-type",
        },
      }),
      "https://daeho-ai.github.io",
    );
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe("https://daeho-ai.github.io");
  });

  it("stores encrypted OAuth state with PKCE and posts only to the exact blog origin", async () => {
    const { env, oauthValues } = environment();
    const start = await startAuthorization(
      new Request("https://editor-api.example/auth/start?origin=https%3A%2F%2Fdaeho-ai.github.io"),
      env,
    );
    expect(start.status).toBe(302);
    const location = new URL(start.headers.get("Location")!);
    expect(location.origin).toBe("https://github.com");
    expect(location.searchParams.get("code_challenge_method")).toBe("S256");
    expect(location.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect([...oauthValues.values()].join("\n")).not.toContain("verifier");

    const callback = await finishAuthorization(
      new Request(
        `https://editor-api.example/auth/callback?state=${location.searchParams.get("state")}&error=access_denied`,
      ),
      env,
    );
    const html = await callback.text();
    const scriptNonce = html.match(/<script nonce="([A-Za-z0-9_-]+)">/)?.[1];
    expect(scriptNonce).toBeTruthy();
    expect(callback.headers.get("Content-Security-Policy")).toContain(`script-src 'nonce-${scriptNonce}'`);
    expect(callback.headers.get("Content-Security-Policy")).not.toContain("'unsafe-inline'");
    expect(html).toContain('https://daeho-ai.github.io');
    expect(html).not.toContain("github-client-secret");
    expect(oauthValues.size).toBe(0);
  });

  it("checks both direct repository push access and the locked App installation", async () => {
    const { env } = environment();
    const urls: string[] = [];
    const responses = [
      { login: "Daeho-AI" },
      { full_name: "Daeho-AI/Daeho-AI.github.io", permissions: { push: true } },
      {
        installations: [
          {
            id: 7,
            account: { login: "Daeho-AI" },
            permissions: { contents: "write" },
            suspended_at: null,
          },
        ],
      },
      {
        repositories: [
          { full_name: "Daeho-AI/Daeho-AI.github.io", permissions: { push: true } },
        ],
      },
    ];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      urls.push(String(input));
      const payload = responses.shift();
      if (!payload) throw new Error("Unexpected GitHub request");
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    await expect(verifyOwnerAccess(env, "github-user-token")).resolves.toBe("Daeho-AI");
    expect(urls).toEqual([
      "https://api.github.com/user",
      "https://api.github.com/repos/Daeho-AI/Daeho-AI.github.io",
      "https://api.github.com/user/installations?per_page=100",
      "https://api.github.com/user/installations/7/repositories?per_page=100",
    ]);
  });

  it("blocks API calls before session lookup when Origin is wrong", async () => {
    const { env } = environment();
    const response = await worker.fetch(
      new Request("https://editor-api.example/api/session", {
        headers: { Origin: "https://evil.example", Authorization: `Bearer ${"a".repeat(43)}` },
      }),
      env,
    );
    expect(response.status).toBe(403);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("requires a well-formed bearer session even for logout", async () => {
    const { env } = environment();
    for (const authorization of [undefined, "Bearer short"]) {
      const headers = new Headers({ Origin: "https://daeho-ai.github.io" });
      if (authorization) headers.set("Authorization", authorization);
      const response = await worker.fetch(
        new Request("https://editor-api.example/api/session", { method: "DELETE", headers }),
        env,
      );
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toMatchObject({ error: "authentication_required" });
    }
  });

  it("removes the editor session when locked repository access is revoked", async () => {
    const { env, sessionValues } = environment();
    const session = await createEditorSession(env, "github-user-token", "Daeho-AI");
    const responses = [
      new Response(JSON.stringify({ login: "Daeho-AI" }), { status: 200 }),
      new Response(JSON.stringify({ message: "Not Found" }), { status: 404 }),
    ];
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      const response = responses.shift();
      if (!response) throw new Error("Unexpected GitHub request");
      return response;
    });

    const response = await worker.fetch(
      new Request("https://editor-api.example/api/session", {
        headers: {
          Origin: "https://daeho-ai.github.io",
          Authorization: `Bearer ${session.sessionId}`,
        },
      }),
      env,
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: "owner_access_denied" });
    expect(sessionValues.size).toBe(0);
  });

  it("preserves the editor session when GitHub rate limits permission verification", async () => {
    const { env, sessionValues } = environment();
    const session = await createEditorSession(env, "github-user-token", "Daeho-AI");
    const responses = [
      new Response(JSON.stringify({ login: "Daeho-AI" }), { status: 200 }),
      new Response(JSON.stringify({ message: "API rate limit exceeded" }), {
        status: 403,
        headers: { "Retry-After": "60", "X-RateLimit-Remaining": "0" },
      }),
    ];
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      const response = responses.shift();
      if (!response) throw new Error("Unexpected GitHub request");
      return response;
    });

    const response = await worker.fetch(
      new Request("https://editor-api.example/api/session", {
        headers: {
          Origin: "https://daeho-ai.github.io",
          Authorization: `Bearer ${session.sessionId}`,
        },
      }),
      env,
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    await expect(response.json()).resolves.toMatchObject({ error: "github_rate_limited" });
    expect(sessionValues.size).toBe(1);
  });
});
