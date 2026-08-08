# Architecture

## Overview

```
CODE CHANGE → CI PIPELINE → WEBHOOK → EVENT PIPELINE → ANALYSIS → ROOT CAUSE → RECOMMENDED FIX
```

BuildPilot is a single Next.js App Router application (`src/app`) plus two
standalone workspace packages consumed by external tools: `packages/sdk`
(TypeScript client) and `packages/mcp-server` (MCP server for AI agents).
There is no separate "backend service" — API routes, the webhook receiver,
and the background worker all live in one deployable unit, with the worker
boundary enforced in code (see below), not by process separation.

## Provider abstraction

Every external integration point is an interface in `src/lib/providers/*`,
with a `registry.ts` that's the single place the concrete implementation is
chosen (usually via an env var):

- **CI providers** (`providers/ci`) — `CIProvider`: webhook signature
  verification, payload normalization, log fetching. Implementations:
  GitHub Actions, GitLab CI, CircleCI.
- **Auth** (`providers/auth`) — `AuthProvider`: session resolution.
  Implementations: local (signed cookie, $0), Clerk (documented, not wired).
- **AI** (`providers/ai`) — `AIProvider`: failure analysis. Implementations:
  local deterministic analyzer ($0, default), OpenRouter (opt-in, real cost).
- **Queue** (`providers/queue`) — `QueueProvider`: background job
  enqueue/process. Implementations: local SQLite-backed queue ($0, default),
  BullMQ (documented stub — install `bullmq`/`ioredis` to enable).

Adding a fifth CI provider, for example, means implementing `CIProvider` and
registering it in `providers/ci/registry.ts` — nothing else in the codebase
changes, because nothing else imports a provider-specific type.

## Event pipeline

```
Webhook request
  → signature verification (fail closed if no secret configured)
  → idempotency check (provider's own delivery id, unique constraint)
  → Event row persisted (payload redacted first)
  → enqueue "ingest-event" job
  → 202 response (webhook handler returns here — no CI-domain work happens inline)

ingest-event worker
  → normalize provider payload → Workflow/WorkflowRun/Job/Step upserts
  → on job failure: best-effort log fetch + redact + store
  → create Failure row
  → enqueue "analyze-failure" job

analyze-failure worker
  → gather evidence (log excerpt, changed files, recent commits, related test failures, prior failure count)
  → AIProvider.analyzeFailure()
  → persist AIAnalysis, update Failure.category
```

The webhook route never does CI-domain work itself — see
`src/app/api/webhooks/[provider]/route.ts`. This is what keeps the response
fast regardless of payload size, analysis cost, or queue backend, and it's
why the queue boundary exists as a real abstraction rather than a direct
function call.

## Local queue vs. production

This machine has no Docker, Homebrew, Postgres, or Redis, and the project's
run policy is $0/no-signup-required for local development. The default queue
(`providers/queue/local-queue.ts`) is a SQLite-table-backed poll loop —
durable across dev-server restarts, zero external dependencies. It is not
meant for multi-instance production deployment (no cross-process locking
beyond SQLite's own). Swapping to BullMQ+Redis for production is a
single-file change (`providers/queue/registry.ts`); see that file's comments.

## Data model

See `prisma/schema.prisma` — 19 models covering tenancy (Organization, User,
Membership), repository/CI data (Repository, Branch, Commit, PullRequest,
Workflow, WorkflowRun, Job, Step, TestResult, FlakyTestScore), failure
analysis (Failure, AIAnalysis, Recommendation), deployments, the event
pipeline (Event, QueueJob), and AuditLog. Types are kept Postgres-compatible
(string ids, ISO datetimes, JSON-string arrays instead of native array
columns) so the same schema ports to Postgres/Supabase by changing only the
`datasource` block and driver adapter — see `docs/DATABASE.md`.

## Frontend

Next.js 16 App Router, Server Components for all data fetching (no client-side
data-fetching library), Server Actions for mutations (recommendation
approve/reject). Design system in `src/app/globals.css` — see the file's
header comment for the palette rationale.
