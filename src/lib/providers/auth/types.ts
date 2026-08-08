export interface Session {
  userId: string;
  organizationId: string;
  role: "owner" | "admin" | "member" | "viewer";
}

export interface AuthProvider {
  readonly id: string;
  /** Read the current request's session, if any. Must be called within a request scope (Server Component/Route Handler). */
  getSession(): Promise<Session | null>;
}
