import { describe, expect, it } from "vitest";
import { createPkceChallenge, openJson, sealJson } from "../src/crypto";
import {
  bearerSessionId,
  createEditorSession,
  loadEditorSession,
  type Env,
} from "../src/session";

function memoryKv(): { kv: KVNamespace; values: Map<string, string> } {
  const values = new Map<string, string>();
  const kv = {
    get: async (key: string) => values.get(key) ?? null,
    put: async (key: string, value: string) => {
      values.set(key, value);
    },
    delete: async (key: string) => {
      values.delete(key);
    },
  } as unknown as KVNamespace;
  return { kv, values };
}

function environment(): { env: Env; sessions: Map<string, string> } {
  const oauth = memoryKv();
  const sessions = memoryKv();
  return {
    env: {
      OAUTH_STATES: oauth.kv,
      EDITOR_SESSIONS: sessions.kv,
      BLOG_ORIGIN: "https://daeho-ai.github.io",
      OWNER_LOGIN: "Daeho-AI",
      REPOSITORY: "Daeho-AI/Daeho-AI.github.io",
      BRANCH: "main",
      SESSION_TTL_SECONDS: "3600",
      GITHUB_CLIENT_ID: "client-id",
      GITHUB_CLIENT_SECRET: "client-secret",
      SESSION_ENCRYPTION_KEY: "s".repeat(64),
    },
    sessions: sessions.values,
  };
}

describe("OAuth and encrypted sessions", () => {
  it("creates the RFC 7636 S256 PKCE challenge", async () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    await expect(createPkceChallenge(verifier)).resolves.toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("encrypts JSON with authenticated encryption", async () => {
    const secret = "k".repeat(64);
    const sealed = await sealJson({ token: "github-secret-token" }, secret);
    expect(sealed).toMatch(/^v1\./);
    expect(sealed).not.toContain("github-secret-token");
    await expect(openJson<{ token: string }>(sealed, secret)).resolves.toEqual({ token: "github-secret-token" });
    await expect(openJson(sealed.slice(0, -1) + "A", secret)).rejects.toThrow();
  });

  it("stores only an encrypted GitHub token and loads it through an opaque bearer id", async () => {
    const { env, sessions } = environment();
    const created = await createEditorSession(env, "ghu_private-token", "Daeho-AI");
    expect(created.sessionId).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect([...sessions.values()].join("\n")).not.toContain("ghu_private-token");
    await expect(loadEditorSession(env, created.sessionId)).resolves.toMatchObject({
      accessToken: "ghu_private-token",
      login: "Daeho-AI",
    });

    const request = new Request("https://api.example/api/session", {
      headers: { Authorization: `Bearer ${created.sessionId}` },
    });
    expect(bearerSessionId(request)).toBe(created.sessionId);
    expect(bearerSessionId(new Request("https://api.example", { headers: { Authorization: "Bearer short" } }))).toBeNull();
  });
});
