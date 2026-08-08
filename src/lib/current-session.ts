import { redirect } from "next/navigation";
import { getAuthProvider } from "@/lib/providers/auth/registry";
import type { Session } from "@/lib/providers/auth/types";

/** Server-only. Redirects to /login when there's no session — use at the top of any protected layout/page. */
export async function requireSession(): Promise<Session> {
  const session = await getAuthProvider().getSession();
  if (!session) redirect("/login");
  return session;
}
