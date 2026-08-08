# Flaky Test Detection

`src/lib/scoring/flaky.ts` — `computeFlakyScore()`.

## The guardrail

> Do not falsely label a test flaky based on insufficient evidence.

A test that fails every run isn't flaky — it's broken. A test that passed
once after nine failures isn't flaky either — that could easily be noise.
Flakiness specifically means the outcome doesn't correlate with the code: it
flips between pass and fail across runs, which is why **transitions between
consecutive outcomes** are weighted far higher than raw fail rate.

## The algorithm

```
score = 0.7 × volatility + 0.3 × moderateness
```

- `volatility` = transitions ÷ (runs − 1) — how often consecutive runs
  disagree, normalized to the maximum possible.
- `moderateness` = `1 − |2 × failRate − 1|` — peaks at 1.0 when failRate is
  0.5 (maximally undecided), 0 at the extremes (always-passes or
  always-fails), so a test that fails 90% of the time scores as "broken",
  not "flaky", even with some volatility.

## Evidence thresholds (before scoring even runs)

- Fewer than 5 total runs → score `0`, not flaky (insufficient evidence).
- Fewer than 2 observations of *either* outcome → score `0` (a single fluke
  isn't enough to call something flaky, and a test that's never failed or
  never passed isn't flaky by definition — it's consistent).

`isFlaky` is `true` only when `score >= 0.35` *and* the evidence thresholds
above are met. See `flaky.test.ts` for the full case matrix, including a
head-to-head comparison proving an alternating pattern scores higher than a
clustered one at the same fail rate.

## Where scores come from

`FlakyTestScore` rows are recomputed from `TestResult` history — see the
seeding code in `src/lib/demo/seed-data.ts` for a worked example (it
generates real pass/fail sequences per test, then calls the actual
`computeFlakyScore()` function rather than seeding a plausible-looking
number). In a live deployment, this recomputation would run as part of test
ingestion (parsing JUnit/test-reporter output from CI artifacts) — the
webhook payloads GitHub/GitLab/CircleCI send do not include per-test
results, only job-level pass/fail, so populating `TestResult` from a real
repository requires either log-output parsing or an artifact-download step,
neither of which is wired up yet (see `docs/ROADMAP.md`).
