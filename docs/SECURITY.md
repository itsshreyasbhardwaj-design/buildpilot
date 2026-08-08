# Security Model

Also see `SECURITY.md` at the repo root for the vulnerability disclosure
process. This document covers the security *architecture*.

## Webhook verification

Every webhook request is verified before anything is persisted or
processed — see `src/app/api/webhooks/[provider]/route.ts` and each
provider's `verifyWebhookSignature`:

- **GitHub Actions**: HMAC-SHA256 over the raw body (`X-Hub-Signature-256`),
  compared with `crypto.timingSafeEqual` (not `===`, to avoid timing attacks).
- **GitLab CI**: static token comparison (`X-Gitlab-Token`) — GitLab does not
  HMAC-sign webhooks, so this is what GitLab itself supports.
- **CircleCI**: HMAC-SHA256 (`circleci-signature: v1=<hex>`), with support
  for multiple comma-separated candidates during key rotation.

If no secret is configured for a provider, the receiver returns `503`
rather than accepting unverified payloads — see "fail closed" in the route
handler. A missing secret is a misconfiguration, not an invitation to skip
verification.

## Idempotency & duplicate handling

Each provider's own delivery id is the idempotency key, enforced by a unique
constraint on `(provider, externalId)` in the `Event` table (webhooks are
at-least-once delivery; providers retry on timeout/5xx). A retried delivery
returns `200 duplicate` rather than reprocessing.

## Least-privilege repository access

`Repository.installationId`/`credentialRef` point at wherever credentials are
actually stored (a GitHub App installation token, a secrets manager
reference) — raw tokens are never stored in the `Repository` row itself.
See `docs/GITHUB_APP.md` for the intended real-world credential flow (not
yet wired in this build).

## RBAC

`Membership.role` (`owner | admin | member | viewer`) scopes what a user can
do within an organization. Every query in `src/lib/queries/*` and
`src/app/api/v1/*` filters by `organizationId` derived from the
authenticated session/token — see "Repository isolation" below.

## Repository isolation

Every data-access function takes `organizationId` as its first parameter and
uses it in the `where` clause — there is no code path that returns another
organization's data by accident. This is tested directly:
`src/lib/queries/builds.test.ts` asserts that a build belonging to
organization B is invisible to organization A's queries. See
`docs/ARCHITECTURE.md` for how this composes with the provider abstraction.

## Rate limiting & input validation

Webhook payload size is bounded by the platform's request body limit; the
route parses JSON defensively (`try { JSON.parse }` → 400 on failure) before
touching the database. A dedicated rate limiter (e.g. per-IP or per-token
sliding window) is not yet implemented — tracked in `docs/ROADMAP.md`.

## Audit logs

`AuditLog` records who did what: recommendation approvals/rejections today
(`src/lib/actions/recommendations.ts`), with `targetType`/`targetId`/`metadata`
generic enough to extend to other actions.

## Secrets

See `docs/AI_SAFETY.md` for secret redaction (applied before storage, and
again defensively before any AI provider call). CI secrets are never sent to
an AI provider — the redaction pass runs unconditionally, not just when a
paid provider is configured.

## What's not yet built

- Per-organization API token management (currently static, env-configured — see `src/lib/auth/api-token.ts`)
- Rate limiting middleware
- SSO/enterprise auth beyond the Clerk integration point
- Encrypted-at-rest credential storage for real GitHub App installations

Tracked in `docs/ROADMAP.md`.
