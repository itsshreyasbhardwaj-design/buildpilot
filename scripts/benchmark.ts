// Evaluates the AI failure-analysis engine against a small, hand-labeled
// dataset of representative CI failures. See docs/BENCHMARK.md for
// methodology and honest limitations (this is a v0.1 seed dataset, not a
// large field-collected corpus).
//
// Run: pnpm benchmark

import { performance } from "node:perf_hooks";
import { localAnalyzer } from "../src/lib/providers/ai/local-analyzer";
import { FAILURE_FIXTURES } from "../src/lib/demo/log-fixtures";
import type { FailureAnalysisInput } from "../src/lib/providers/ai/types";

interface BenchmarkCase {
  name: string;
  expectedCategory: string;
  input: FailureAnalysisInput;
}

function baseInput(overrides: Partial<FailureAnalysisInput>): FailureAnalysisInput {
  return {
    workflowName: "CI",
    jobName: "build",
    logExcerpt: "",
    changedFiles: [],
    recentCommitMessages: [],
    relatedTestFailures: [],
    previousSimilarFailureCount: 0,
    ...overrides,
  };
}

const cases: BenchmarkCase[] = [
  ...FAILURE_FIXTURES.map((f) => ({
    name: `${f.category} — real fixture log`,
    expectedCategory: f.category,
    input: baseInput({ jobName: f.jobName, logExcerpt: f.log, changedFiles: f.changedFiles }),
  })),
  {
    // False-positive check: a log with no recognizable signature must not
    // be confidently mis-categorized.
    name: "novel/unrecognized failure — should report unknown, not guess",
    expectedCategory: "unknown",
    input: baseInput({ logExcerpt: "Reticulating splines... splines failed to reticulate. Exit 1." }),
  },
];

async function main() {
  const results: { name: string; expected: string; actual: string; correct: boolean; confidence: number; latencyMs: number }[] = [];

  for (const c of cases) {
    const start = performance.now();
    const result = await localAnalyzer.analyzeFailure(c.input);
    const latencyMs = performance.now() - start;
    results.push({
      name: c.name,
      expected: c.expectedCategory,
      actual: result.category,
      correct: result.category === c.expectedCategory,
      confidence: result.confidence,
      latencyMs,
    });
  }

  const correct = results.filter((r) => r.correct).length;
  const falsePositives = results.filter((r) => r.expected === "unknown" && r.actual !== "unknown").length;
  const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
  const avgLatencyMs = results.reduce((sum, r) => sum + r.latencyMs, 0) / results.length;

  console.log("BuildPilot AI Analysis Benchmark — local-deterministic provider\n");
  console.log("Case".padEnd(55), "Expected".padEnd(12), "Actual".padEnd(12), "Confidence", "Latency");
  for (const r of results) {
    console.log(
      r.name.padEnd(55),
      r.expected.padEnd(12),
      r.actual.padEnd(12),
      `${(r.confidence * 100).toFixed(0)}%`.padEnd(11),
      `${r.latencyMs.toFixed(2)}ms`
    );
  }

  console.log("\n--- Summary ---");
  console.log(`Root-cause classification accuracy: ${correct}/${results.length} (${((correct / results.length) * 100).toFixed(1)}%)`);
  console.log(`False positives (confident wrong category on unrecognized input): ${falsePositives}`);
  console.log(`Average confidence: ${(avgConfidence * 100).toFixed(1)}%`);
  console.log(`Average latency: ${avgLatencyMs.toFixed(2)}ms`);
}

main();
