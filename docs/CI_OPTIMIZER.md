# CI Optimizer

`src/lib/optimizer/analyze.ts` statically analyzes a workflow's stored YAML
(`Workflow.definition`) and returns findings — never applies anything
automatically. Every finding becomes a `Recommendation` row with a diff, a
plain-language description, and a `status` (`proposed | approved | applied |
rejected`) that only changes through explicit user action
(`src/lib/actions/recommendations.ts`, wired to Approve/Reject buttons on
`/recommendations`).

## What it checks today

- **Caching**: `actions/setup-node`/`actions/setup-python` present without a
  `cache:` parameter → proposes adding one, with a diff and an estimated
  install-time reduction.
- **Parallelization**: a strictly linear `needs:` chain across 3+ jobs →
  proposes removing an unnecessary dependency so independent jobs (e.g.
  lint and build) can run concurrently.
- **Matrix**: no `strategy: matrix:` block with a single pinned runtime
  version → suggests testing against multiple versions.

Each check is pattern-based, not a full YAML semantic analysis — the point
is that every recommendation is traceable to a literal substring or
structural pattern in the actual workflow file, not an opinion invented
about a hypothetical one. See `analyzeWorkflowYaml`'s doc comment.

## Extending it

Add a new finding kind to `OptimizerFinding["kind"]`, write a detection
function, push a finding when it matches. The `Recommendation.kind` field is
a plain string (`caching | parallelization | matrix | dependency |
test-split | config | docker`), matching the spec's CI Optimizer categories
— `dependency`, `test-split`, and `docker` findings aren't implemented yet
(see `docs/ROADMAP.md`).

## Applying an approved recommendation

Not implemented — approving a recommendation records the decision and an
audit log entry, but does not open a PR or write to the repository. That
requires a real GitHub App with write access, which this build doesn't
include (see `docs/GITHUB_APP.md`). This is a deliberate scope boundary, not
an oversight: automatically writing to a user's CI config is exactly the
kind of action that should require real credentials and explicit wiring,
not ship as a default.
