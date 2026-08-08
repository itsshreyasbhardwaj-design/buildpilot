# Changelog

All notable changes to this project are documented in this file. Format
loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [0.1.0] — Unreleased

Initial public release.

### Added

- Provider abstraction for CI systems (GitHub Actions, GitLab CI, CircleCI),
  auth (local + Clerk stub), AI analysis (local deterministic + OpenRouter),
  and background jobs (local SQLite-backed queue + BullMQ stub)
- Webhook receiver with signature verification, idempotency, and a
  webhook → event → ingestion → AI-analysis pipeline that never does
  long-running work inline
- Deterministic, evidence-based AI failure analysis engine covering
  dependency/test/timeout/oom/syntax/config/infra failure categories, with
  secret redaction before storage and before any AI provider call
- Flaky-test detection with an evidence-thresholded scoring algorithm
  (`docs/FLAKY_DETECTION.md`)
- CI Optimizer: static analysis of workflow YAML producing diff-backed,
  approve/reject recommendations (caching, parallelization, matrix)
- Dashboard: build health overview, builds list with filters, build detail
  with a failure-timeline visualization and AI analysis, failures history,
  flaky tests table, deployments, recommendations
- REST API (`/api/v1`), TypeScript SDK (`@buildpilot/sdk`), and MCP server
  (`@buildpilot/mcp-server`) exposing the same 7 tools: get_build,
  get_failed_jobs, analyze_failure, search_ci_history, get_flaky_tests,
  get_deployment_status, get_repository_health
- Demo mode: synthetic multi-repository dataset with real (not fabricated)
  AI analyses, generated via `pnpm db:seed` or automatically on first login
- 61 Vitest tests (unit/integration/security) + 2 Playwright E2E tests
- Small hand-labeled AI-analysis benchmark (`pnpm benchmark`,
  `docs/BENCHMARK.md`)

### Known limitations

See `docs/ROADMAP.md` — notably, no self-serve GitHub App installation flow
yet (manual setup documented in `docs/GITHUB_APP.md`), and real per-test
result ingestion from live CI providers is not wired up (webhook payloads
don't carry per-test data).
