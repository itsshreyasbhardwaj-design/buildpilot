import { cookies } from "next/headers";
import type { AuthProvider, Session } from "./types";
import { COOKIE_NAME, decodeSession } from "./session-token";

/**
 * Local/demo auth: a signed, httpOnly cookie set by the demo "continue as"
 * flow (src/app/(auth)/login) — no password, no third-party account, $0.
 * Not for production use; see docs/AUTH.md for wiring the Clerk adapter.
 */
export const localAuthProvider: AuthProvider = {
  id: "local",

  async getSession(): Promise<Session | null> {
    const jar = await cookies();
    return decodeSession(jar.get(COOKIE_NAME)?.value);
  },
};
