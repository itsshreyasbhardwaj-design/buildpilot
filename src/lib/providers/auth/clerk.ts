import type { AuthProvider } from "./types";

/**
 * Placeholder for a real Clerk-backed AuthProvider. Intentionally NOT wired
 * to @clerk/nextjs — that package isn't installed, per this project's
 * $0/mock-first default (see AGENT.md). This file exists so the provider
 * abstraction documents the intended integration point and so
 * AUTH_PROVIDER=clerk fails loudly with next steps instead of silently
 * falling back to local auth.
 *
 * To enable: `pnpm add @clerk/nextjs`, wrap the app in <ClerkProvider>, set
 * CLERK_SECRET_KEY/NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, then implement
 * getSession() here using Clerk's auth() helper. See docs/AUTH.md.
 */
export const clerkAuthProvider: AuthProvider = {
  id: "clerk",
  async getSession() {
    throw new Error(
      "AUTH_PROVIDER=clerk is set but the Clerk integration is not implemented in this build " +
        "(@clerk/nextjs is not installed). Follow docs/AUTH.md, or unset AUTH_PROVIDER to use local/demo auth."
    );
  },
};
