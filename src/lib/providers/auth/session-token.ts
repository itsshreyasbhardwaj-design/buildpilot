import { createHmac, timingSafeEqual } from "node:crypto";
import type { Session } from "./types";

const COOKIE_NAME = "buildpilot_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET must be set in production — see docs/AUTH.md.");
    }
    // Local/demo only: a fixed dev secret so `pnpm dev` works with zero setup.
    // Never reachable in production because of the throw above.
    return "buildpilot-local-dev-secret-do-not-use-in-production";
  }
  return secret;
}

function sign(value: string): string {
  return createHmac("sha256", getSecret()).update(value).digest("hex");
}

export function encodeSession(session: Session): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export function decodeSession(token: string | undefined | null): Session | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (
      typeof parsed?.userId === "string" &&
      typeof parsed?.organizationId === "string" &&
      typeof parsed?.role === "string"
    ) {
      return parsed as Session;
    }
    return null;
  } catch {
    return null;
  }
}

export { COOKIE_NAME, MAX_AGE_SECONDS };
