# Authentication

## Local / demo (default)

`src/lib/providers/auth/local.ts` — a signed, `httpOnly` cookie set by
`POST /api/auth/demo-login`. The signature is HMAC-SHA256 over the session
payload using `AUTH_SECRET` (falls back to a fixed dev-only string outside
production — see `session-token.ts`; production requires `AUTH_SECRET` to be
set or the app throws at session-creation time). No password, no third-party
account, no signup — this is the "clone and immediately explore" path.

## Switching to Clerk

`src/lib/providers/auth/clerk.ts` is a documented placeholder — it throws a
clear error if `AUTH_PROVIDER=clerk` is set without the integration being
implemented, rather than silently falling back to local auth. To wire it up:

1. `pnpm add @clerk/nextjs`
2. Wrap the root layout in `<ClerkProvider>`
3. Set `CLERK_SECRET_KEY` / `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
4. Implement `getSession()` in `clerk.ts` using Clerk's `auth()` helper,
   mapping the Clerk org/user to BuildPilot's `Session` shape
   (`{ userId, organizationId, role }`)
5. Set `AUTH_PROVIDER=clerk`

## API tokens

Separately from cookie sessions, `src/lib/auth/api-token.ts` resolves static
bearer tokens from the `API_TOKENS` env var (`token:organizationId,...`) for
the REST API / SDK / MCP server. This is intentionally minimal for v0.1 — a
real per-organization token table (create/revoke/rotate) is on the roadmap.
