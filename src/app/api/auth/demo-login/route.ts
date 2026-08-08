import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ensureDemoData } from "@/lib/demo/seed-data";
import { encodeSession, COOKIE_NAME, MAX_AGE_SECONDS } from "@/lib/providers/auth/session-token";

/**
 * The entire "sign in" flow for local/demo mode: provision demo data if this
 * is a fresh clone (idempotent — see ensureDemoData), then set a signed
 * session cookie. No password, no third-party account — see docs/AUTH.md for
 * why, and for wiring a real provider.
 */
export async function POST() {
  const { organizationId, userId } = await ensureDemoData();

  const token = encodeSession({ userId, organizationId, role: "owner" });
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  });

  return NextResponse.json({ status: "ok" });
}
