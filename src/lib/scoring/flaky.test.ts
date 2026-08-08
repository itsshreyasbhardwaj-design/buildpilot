import { describe, it, expect } from "vitest";
import { computeFlakyScore } from "./flaky";

describe("computeFlakyScore", () => {
  it("requires a minimum number of runs before scoring at all", () => {
    const result = computeFlakyScore({ totalRuns: 3, failCount: 1, passCount: 2, transitionCount: 1 });
    expect(result.score).toBe(0);
    expect(result.isFlaky).toBe(false);
  });

  it("does not label a test that has never failed as flaky", () => {
    const result = computeFlakyScore({ totalRuns: 20, failCount: 0, passCount: 20, transitionCount: 0 });
    expect(result.isFlaky).toBe(false);
    expect(result.reason).toMatch(/never failed/);
  });

  it("does not label a consistently-failing (broken, not flaky) test as flaky", () => {
    const result = computeFlakyScore({ totalRuns: 20, failCount: 20, passCount: 0, transitionCount: 0 });
    expect(result.isFlaky).toBe(false);
    expect(result.reason).toMatch(/never passed/);
  });

  it("does not label a single fluke (one failure in a long streak) as flaky", () => {
    const result = computeFlakyScore({ totalRuns: 20, failCount: 1, passCount: 19, transitionCount: 2 });
    // Only one observed failure — insufficient evidence per MIN_OBSERVATIONS_OF_EACH_OUTCOME.
    expect(result.isFlaky).toBe(false);
  });

  it("labels a test with many pass/fail transitions as flaky", () => {
    const result = computeFlakyScore({ totalRuns: 20, failCount: 9, passCount: 11, transitionCount: 14 });
    expect(result.isFlaky).toBe(true);
    expect(result.score).toBeGreaterThan(0.35);
  });

  it("scores a test that alternates on every single run higher than one with the same fail rate but no alternation pattern", () => {
    // Same 10/20 fail rate, but very different transition counts.
    const alternating = computeFlakyScore({ totalRuns: 20, failCount: 10, passCount: 10, transitionCount: 19 });
    const clustered = computeFlakyScore({ totalRuns: 20, failCount: 10, passCount: 10, transitionCount: 2 });
    expect(alternating.score).toBeGreaterThan(clustered.score);
  });

  it("produces a score between 0 and 1 inclusive for arbitrary evidence-sufficient input", () => {
    for (const transitionCount of [0, 5, 10, 19]) {
      const result = computeFlakyScore({ totalRuns: 20, failCount: 10, passCount: 10, transitionCount });
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    }
  });
});
