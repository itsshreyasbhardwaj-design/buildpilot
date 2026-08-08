import { NextResponse } from "next/server";
import { getAuthProvider } from "@/lib/providers/auth/registry";
import { resolveApiToken } from "@/lib/auth/api-token";

export interface ApiContext {
  organizationId: string;
}

/**
 * Every /api/v1 route resolves the caller's organization the same way:
 * either a browser session cookie (first-party dashboard use) or a Bearer
 * API token (SDK/MCP/external use). Whichever authenticates, the
 * organizationId returned is what scopes every subsequent query — this is
 * the repository-isolation boundary for the whole REST API.
 */
export async function getApiContext(request: Request): Promise<ApiContext | null> {
  const tokenAuth = resolveApiToken(request.headers.get("authorization"));
  if (tokenAuth) return { organizationId: tokenAuth.organizationId };

  const session = await getAuthProvider().getSession();
  if (session) return { organizationId: session.organizationId };

  return null;
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized — provide a session cookie or `Authorization: Bearer <token>`." }, { status: 401 });
}

export function notFound(resource: string) {
  return NextResponse.json({ error: `${resource} not found` }, { status: 404 });
}
