import type { AuthProvider } from "./types";
import { localAuthProvider } from "./local";
import { clerkAuthProvider } from "./clerk";

export function getAuthProvider(): AuthProvider {
  return process.env.AUTH_PROVIDER === "clerk" ? clerkAuthProvider : localAuthProvider;
}

export * from "./types";
