// Static, env-configured API tokens for the REST API (src/app/api/v1) and
// anything built on the SDK/MCP server. Format: API_TOKENS="token1:orgId1,token2:orgId2".
//
// This is intentionally minimal for a v0.1: a real per-organization token
// table (create/revoke/rotate/scopes) is on the roadmap — see
// docs/ROADMAP.md. What's here is genuinely enforced (wrong or missing
// token is rejected), just not yet self-service.

import { createHash, timingSafeEqual } from "node:crypto";

/** Constant-time string compare (hash first so length itself can't leak). */
function safeCompare(a: string, b: string): boolean {
  const bufA = createHash("sha256").update(a).digest();
  const bufB = createHash("sha256").update(b).digest();
  return timingSafeEqual(bufA, bufB);
}

interface TokenEntry {
  token: string;
  organizationId: string;
}

function parseTokens(): TokenEntry[] {
  const raw = process.env.API_TOKENS ?? "";
  return raw
    .split(",")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const [token, organizationId] = pair.split(":");
      return { token, organizationId };
    })
    .filter((e) => e.token && e.organizationId);
}

export function resolveApiToken(authorizationHeader: string | null): { organizationId: string } | null {
  if (!authorizationHeader?.startsWith("Bearer ")) return null;
  const token = authorizationHeader.slice("Bearer ".length).trim();
  if (!token) return null;

  const entry = parseTokens().find((e) => safeCompare(e.token, token));
  return entry ? { organizationId: entry.organizationId } : null;
}
