// Flaky-test scoring. The spec's own guardrail is explicit: "Do not falsely
// label a test flaky based on insufficient evidence." A test that fails every
// run isn't flaky — it's broken. A test that passed once after nine failures
// isn't flaky either — that's noise. Flakiness specifically means the test's
// outcome doesn't correlate with the code: it flips between pass and fail
// across runs of the same (or unchanged) code, which is why transitions
// between consecutive outcomes are weighted far higher than raw fail rate.

export interface FlakyInput {
  totalRuns: number;
  failCount: number;
  passCount: number;
  transitionCount: number; // number of pass<->fail flips across consecutive runs
}

export interface FlakyScoreResult {
  score: number; // 0..1
  isFlaky: boolean;
  reason: string;
}

const MIN_RUNS_FOR_EVIDENCE = 5;
const MIN_OBSERVATIONS_OF_EACH_OUTCOME = 2;
const FLAKY_THRESHOLD = 0.35;

export function computeFlakyScore(input: FlakyInput): FlakyScoreResult {
  const { totalRuns, failCount, passCount, transitionCount } = input;

  if (totalRuns < MIN_RUNS_FOR_EVIDENCE) {
    return { score: 0, isFlaky: false, reason: `Only ${totalRuns} run(s) observed — need at least ${MIN_RUNS_FOR_EVIDENCE} before scoring.` };
  }
  if (failCount < MIN_OBSERVATIONS_OF_EACH_OUTCOME || passCount < MIN_OBSERVATIONS_OF_EACH_OUTCOME) {
    return {
      score: 0,
      isFlaky: false,
      reason:
        failCount === 0
          ? "Test has never failed — not flaky."
          : passCount === 0
            ? "Test has never passed — this is a consistent failure, not flakiness."
            : "Too few observations of one outcome to distinguish flakiness from noise.",
    };
  }

  const failRate = failCount / totalRuns;
  // How often consecutive runs disagree, normalized to the maximum possible
  // number of transitions for this many runs.
  const volatility = transitionCount / (totalRuns - 1);
  // Peaks at 1.0 when failRate is 0.5 (maximally undecided), 0 at the extremes —
  // a test that fails 90% of the time is more "broken" than "flaky".
  const moderateness = 1 - Math.abs(2 * failRate - 1);

  const score = Math.min(1, 0.7 * volatility + 0.3 * moderateness);
  const isFlaky = score >= FLAKY_THRESHOLD;

  return {
    score,
    isFlaky,
    reason: isFlaky
      ? `${transitionCount} pass/fail transitions across ${totalRuns} runs — outcome does not correlate with code changes.`
      : `Score ${score.toFixed(2)} is below the ${FLAKY_THRESHOLD} evidence threshold.`,
  };
}
