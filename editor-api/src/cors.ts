const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "DELETE"]);
const ALLOWED_REQUEST_HEADERS = new Set(["accept", "authorization", "content-type"]);

export const BASE_SECURITY_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

export function isAllowedOrigin(origin: string | null, blogOrigin: string): boolean {
  if (!origin || !blogOrigin) return false;
  try {
    const configured = new URL(blogOrigin);
    if (configured.origin !== blogOrigin || configured.pathname !== "/") return false;
    return origin === configured.origin;
  } catch {
    return false;
  }
}

export function applySecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  Object.entries(BASE_SECURITY_HEADERS).forEach(([name, value]) => {
    if (!headers.has(name)) headers.set(name, value);
  });
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export function applyCors(response: Response, request: Request, blogOrigin: string): Response {
  const headers = new Headers(response.headers);
  const origin = request.headers.get("Origin");
  headers.append("Vary", "Origin");
  if (isAllowedOrigin(origin, blogOrigin)) {
    headers.set("Access-Control-Allow-Origin", origin!);
    headers.set("Access-Control-Expose-Headers", "X-Request-Id");
  }
  const secured = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
  return applySecurityHeaders(secured);
}

export function preflightResponse(request: Request, blogOrigin: string): Response {
  const origin = request.headers.get("Origin");
  const requestedMethod = request.headers.get("Access-Control-Request-Method")?.toUpperCase() || "";
  const requestedHeaders = (request.headers.get("Access-Control-Request-Headers") || "")
    .split(",")
    .map((header) => header.trim().toLowerCase())
    .filter(Boolean);

  if (
    !isAllowedOrigin(origin, blogOrigin) ||
    !ALLOWED_METHODS.has(requestedMethod) ||
    requestedHeaders.some((header) => !ALLOWED_REQUEST_HEADERS.has(header))
  ) {
    return applySecurityHeaders(
      new Response(JSON.stringify({ error: "cors_forbidden", message: "허용되지 않은 요청 출처입니다." }), {
        status: 403,
        headers: { "Content-Type": "application/json; charset=utf-8", Vary: "Origin" },
      }),
    );
  }

  const headers = new Headers({
    "Access-Control-Allow-Origin": origin!,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
    "Access-Control-Max-Age": "600",
    Vary: "Origin, Access-Control-Request-Method, Access-Control-Request-Headers",
  });
  return applySecurityHeaders(new Response(null, { status: 204, headers }));
}

export function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
