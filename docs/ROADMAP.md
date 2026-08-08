# Roadmap

BuildPilot v0.1 implements the full pipeline (webhook → ingestion → AI
analysis → dashboard) end to end with real data, real tests, and a real
$0 local setup. This document lists what's deliberately out of scope for
v0.1 — either because it requires credentials/infrastructure this build
can't provision, or because it's genuinely a separate, larger effort.

## Near-term

- **Self-serve GitHub App installation flow** — OAuth/App install redirect,
  automatic `Repository` row creation, credential storage/rotation. See
  `docs/GITHUB_APP.md`. This is the single biggest gap to a deployable
  product.
- **Real TestResult ingestion** — webhook payloads from GitHub/GitLab/CircleCI
  don't include per-test results, only job-level pass/fail. Populating
  `TestResult` from a real repository needs either log-output parsing
  (JUnit/TAP-style output) or an artifact-download step. Flaky detection's
  scoring logic is real and tested; what's missing is the real-world data
  source feeding it.
- **Per-organization API tokens** — `src/lib/auth/api-token.ts` is
  static/env-configured today. A real token table (create, list, revoke,
  scope, rotate) is needed for multi-tenant production use.
- **Rate limiting** on webhook and API routes.
- **PR risk analysis as a dedicated engine** — pull request rows currently
  get a lightweight computed risk summary (test count, dependency-change
  detection) at seed time; a real implementation would run this on every
  PR-opened webhook and use the same evidence-based approach as failure
  analysis.
- **Recommendation application** — approving a CI Optimizer recommendation
  records the decision but doesn't open a PR with the diff. Needs write
  access via the GitHub App above.

## Optimizer coverage

CI Optimizer currently detects caching, parallelization, and matrix
opportunities (`docs/CI_OPTIMIZER.md`). Not yet implemented: dependency
right-sizing, test splitting, Docker build size, redundant workflow
detection.

## Historical intelligence / search

`search_ci_history` (SDK + MCP tool) and the failures list's `q` param do a
real case-sensitive substring search over root cause / category / job name
today. A richer "ask a question about your CI history" experience (the
spec's AI Assistant / AI Search sections) — semantic search, a
conversational interface with cited evidence — is not built.

## Build comparison

The data model supports it (two `WorkflowRun` ids, diff their jobs/tests/
duration), but there's no dedicated UI for it yet.

## Rollback assistant

Deployment rollback history is tracked (`Deployment.isRollback`,
`rolledBackFromId`) and shown in the dashboard, but there's no automated
"this deployment failed, here's the last good one, confirm rollback" flow —
and per the spec, that action should never be automatic even when built.

## Testing

- Unit, integration, and security tests exist for the core pipeline (61
  passing — webhook verification/spoofing, secret redaction, prompt-injection
  resilience, flaky scoring, repository isolation, AI classification). See
  `pnpm test`.
- One E2E test (Playwright) covers the critical path: demo login → dashboard
  → a failed build's AI analysis → recommendation approval. A fuller E2E
  suite (connecting a repository, webhook replay, more dashboard surfaces)
  is not built.
- GitLab CI and CircleCI providers have the same unit-test coverage as
  GitHub Actions for signature verification and payload normalization, but
  haven't been exercised against a real GitLab/CircleCI webhook delivery
  (only GitHub has been driven through the full pipeline integration test).

## Benchmark dataset

8 hand-labeled cases today (`docs/BENCHMARK.md`) — sized to cover every
category the analyzer supports, not to be statistically rigorous. Growing
this into a larger, ideally community-contributed dataset of real
(anonymized) CI failures is the highest-value benchmark improvement.

## Production queue backend

The default queue is SQLite-backed and explicitly not meant for
multi-instance deployment (see `docs/ARCHITECTURE.md`). A BullMQ/Redis
adapter is a one-file addition (`src/lib/providers/queue/bullmq.ts`) but
isn't implemented.
