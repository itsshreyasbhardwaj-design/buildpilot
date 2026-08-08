# Benchmark Methodology

Run: `pnpm benchmark` (also runnable in CI — see `.github/workflows/ci.yml`).

## Dataset

`src/lib/demo/log-fixtures.ts` — 7 hand-authored, representative CI failure
log excerpts, one per category the local deterministic analyzer recognizes
(`oom`, `timeout`, `dependency`, `syntax`, `config`, `infra`, `test`), plus
one adversarial case with no recognizable signature (used to measure false
positives). Each fixture is a realistic excerpt modeled on real tool output
(npm, TypeScript, GitHub Actions runner messages, Jest) rather than
synthetic filler text.

**Honest limitation**: this is a small, hand-labeled v0.1 seed dataset (8
cases), not a large field-collected corpus. It's sized to exercise every
category the current analyzer supports and to catch regressions, not to be
a statistically rigorous accuracy benchmark. Growing it into a larger public
dataset (ideally sourced from real, anonymized CI failures) is tracked in
`docs/ROADMAP.md` — contributions welcome, see `CONTRIBUTING.md`.

## Metrics

- **Root-cause classification accuracy**: does `result.category` match the
  case's labeled ground truth?
- **False-positive rate**: for the one case with no real signal, does the
  analyzer confidently (wrongly) pick a category, or correctly report
  `unknown` with low confidence? This is the metric that matters most for
  trust — see `docs/AI_SAFETY.md#1-never-fabricate-a-cause`.
- **Confidence**: reported per case and averaged; a well-calibrated analyzer
  should show *lower* confidence on the adversarial case than on real
  matches, which the current results demonstrate (15% vs. 50-80%).
- **AI latency**: wall-clock time per `analyzeFailure()` call. The
  deterministic analyzer runs in well under a millisecond (no network call);
  the optional OpenRouter provider's latency depends entirely on the
  upstream model and is not covered by this local benchmark.

## Current results (local-deterministic provider)

Regenerate with `pnpm benchmark` — do not hand-edit results here; if this
table goes stale, delete it rather than let it drift from reality.

| Metric | Value |
| --- | --- |
| Root-cause classification accuracy | 8/8 (100%) |
| False positives | 0 |
| Average confidence | ~52% |
| Average latency | <1ms |

## Recommendation usefulness

Not yet benchmarked quantitatively — the CI Optimizer (`docs/CI_OPTIMIZER.md`)
produces pattern-matched, diff-backed recommendations, but there's no
labeled "was this recommendation actually useful" dataset yet. Tracked in
`docs/ROADMAP.md`.
