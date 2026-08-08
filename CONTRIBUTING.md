# Contributing to BuildPilot

Thanks for considering a contribution. This project runs entirely on $0
tooling by default — no paid API keys or cloud accounts are required to
build, test, or run it locally.

## Getting started

```bash
git clone https://github.com/<org>/buildpilot.git
cd buildpilot
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open `http://localhost:3000/login` and click "Continue with demo workspace."
No account or credentials needed.

## Development workflow

```bash
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint
pnpm test        # vitest — unit, integration, security tests
pnpm test:e2e    # playwright — critical-path E2E (builds + starts the app first)
pnpm benchmark   # AI analysis accuracy/latency benchmark
pnpm build       # production build
```

Before opening a PR, all of the above should pass. CI runs the same checks
(`.github/workflows/ci.yml`) — see that file for the exact sequence.

## Project structure

- `src/app` — Next.js App Router: pages, API routes, webhook receiver
- `src/lib/providers/*` — the CI/Auth/AI/Queue provider abstractions —
  read `docs/ARCHITECTURE.md` before adding a new provider
- `src/lib/queries/*` — all data access; every function takes
  `organizationId` first (repository isolation — see `docs/SECURITY.md`)
- `src/lib/demo` — synthetic seed data generation
- `packages/sdk` — the TypeScript client (`@buildpilot/sdk`)
- `packages/mcp-server` — the MCP server (`@buildpilot/mcp-server`)
- `docs/` — architecture, security, AI safety, and per-feature documentation
- `e2e/` — Playwright tests; `src/**/*.test.ts` — Vitest tests

## Adding a CI provider

Implement the `CIProvider` interface (`src/lib/providers/ci/types.ts`):
signature verification, event-id extraction, payload normalization, log
fetching. Register it in `src/lib/providers/ci/registry.ts`. Look at
`github-actions.ts` for the reference implementation and its test file for
the expected test coverage (signature verification including tamper/spoof
cases, normalization of at least the "job failed" case, idempotency key
extraction).

## Adding a CI Optimizer check

Add a detection function to `src/lib/optimizer/analyze.ts` returning an
`OptimizerFinding`. Every finding must be traceable to a literal pattern in
the workflow YAML — see `docs/CI_OPTIMIZER.md` for what that means in
practice, and don't add a finding kind that can't produce a real diff.

## Growing the benchmark dataset

`docs/BENCHMARK.md` explains the current (small, hand-labeled) evaluation
set. If you have a real, anonymized CI failure log that exercises a
category the analyzer gets wrong, or a category it doesn't support yet,
adding it to `src/lib/demo/log-fixtures.ts` and `scripts/benchmark.ts` is a
high-value contribution — please strip anything identifying or secret
before submitting.

## Commit style

Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`,
`chore:`) — see `git log` for examples in this repo.

## Code review

We look for: does the change match what's described (`docs/` stays
accurate), is it tested, does it avoid scope creep (see "No Fake
Functionality" — don't add a UI control for something that doesn't work
yet; update `docs/ROADMAP.md` instead).

## Reporting bugs / requesting features

Use the GitHub issue templates. For security issues, see `SECURITY.md` —
please don't file those as public issues.
