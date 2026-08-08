# Security Policy

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Instead, use GitHub's private vulnerability reporting: go to the
**Security** tab of this repository → **Report a vulnerability**. This
opens a private advisory visible only to maintainers.

If that's unavailable, email the maintainers listed in the repository's
GitHub organization/profile with:

- A description of the vulnerability and its impact
- Steps to reproduce (a minimal example is ideal)
- Any relevant logs or screenshots (with secrets redacted)

We aim to acknowledge reports within 5 business days and will keep you
updated as we investigate and fix the issue. Please give us reasonable time
to address the issue before any public disclosure.

## Scope

In scope: the BuildPilot application (`src/`), the SDK (`packages/sdk`), the
MCP server (`packages/mcp-server`), and the demo/seed data generation.

Out of scope: vulnerabilities in third-party dependencies (report those
upstream — though we'd still appreciate a heads-up so we can update), and
issues that require an attacker to already have webhook-secret-level or
API-token-level access (that access itself is the trust boundary).

## What we consider a vulnerability here

- Webhook signature verification bypass
- Cross-organization data leakage (repository isolation failures)
- Secret redaction bypass (a way to get an unredacted secret into storage
  or an AI provider call)
- Prompt injection that causes the AI analysis engine to fabricate a cause,
  leak data, or execute unintended actions
- Authentication/session handling flaws
- SQL/NoSQL injection (we use Prisma's parameterized queries throughout —
  a bypass of that would be notable)

## Architecture reference

See `docs/SECURITY.md` for how the security model is implemented (webhook
verification, RBAC, repository isolation, secret handling), and
`docs/AI_SAFETY.md` for the AI-specific threat model.
