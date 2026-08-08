import type { AIProvider, FailureAnalysisInput, FailureAnalysisResult, FailureEvidence } from "./types";

interface Signature {
  category: FailureAnalysisResult["category"];
  patterns: RegExp[];
  rootCause: (m: string) => string;
  whyItFailed: string;
  likelyFix: string;
  recommendedAction: string;
  /** File-extension/name hints that raise confidence when they appear in changedFiles. */
  correlatingFilePatterns?: RegExp[];
}

function findLines(log: string, pattern: RegExp): { lineNumber: number; text: string }[] {
  const lines = log.split("\n");
  const hits: { lineNumber: number; text: string }[] = [];
  lines.forEach((text, i) => {
    // Reset lastIndex for global regexes reused across lines.
    pattern.lastIndex = 0;
    if (pattern.test(text)) hits.push({ lineNumber: i + 1, text: text.trim().slice(0, 300) });
  });
  return hits;
}

// Ordered most-specific-first: a log can technically match several signatures
// (e.g. a timeout inside a dependency install), so earlier entries win.
const SIGNATURES: Signature[] = [
  {
    category: "oom",
    patterns: [
      /JavaScript heap out of memory/i,
      /Killed\s*$/i,
      /OOMKilled/,
      /std::bad_alloc/,
      /Cannot allocate memory/i,
      /exit code 137/i,
    ],
    rootCause: () => "The job process was killed after exceeding available memory (out-of-memory).",
    whyItFailed:
      "The runner's memory limit was exceeded, either by the process itself (a memory leak or an oversized build/test operation) or by too many parallel workers competing for the same memory budget.",
    likelyFix:
      "Reduce parallelism (e.g. lower test-runner worker count or matrix concurrency), increase the runner's memory tier, or profile the process for a leak if this is new behavior.",
    recommendedAction: "Re-run with reduced parallelism to confirm memory pressure is the cause, then right-size the runner or the workload.",
  },
  {
    category: "timeout",
    patterns: [
      /ETIMEDOUT/,
      /Timeout of \d+ ?ms exceeded/i,
      /context deadline exceeded/i,
      /job running on runner has timed out/i,
      /Async callback was not invoked/i,
      /canceled the job because it exceeded/i,
    ],
    rootCause: () => "A step or the overall job exceeded its configured timeout.",
    whyItFailed:
      "Either the operation genuinely takes longer than the configured timeout (a slow test, a hung network call, a deadlock), or an external dependency the job talks to was slow/unresponsive.",
    likelyFix:
      "If this is new, check for a hung network call or newly-added slow operation. If it's pre-existing, raise the step/job timeout or split the work.",
    recommendedAction: "Compare this run's per-step duration against the historical baseline for this job to isolate which step regressed.",
  },
  {
    category: "dependency",
    patterns: [
      /npm ERR!/,
      /ERESOLVE/,
      /Could not resolve dependency/i,
      /Cannot find module ['"]/,
      /ModuleNotFoundError/,
      /No matching version found for/i,
      /404 Not Found.*registry/i,
      /Could not find a version that satisfies the requirement/i,
      /error: failed to select a version/i,
    ],
    rootCause: (m) => `Dependency resolution or installation failed (matched: "${m}").`,
    whyItFailed:
      "A package version constraint could not be satisfied, a package was removed/unpublished from the registry, or a lockfile is out of sync with the manifest.",
    likelyFix:
      "Regenerate the lockfile locally and commit it, or pin the offending dependency to a known-good version.",
    recommendedAction: "Diff the lockfile against the previous passing run's lockfile to find the version that changed.",
    correlatingFilePatterns: [/package\.json$/, /package-lock\.json$/, /pnpm-lock\.yaml$/, /yarn\.lock$/, /requirements.*\.txt$/, /Cargo\.lock$/, /go\.sum$/],
  },
  {
    category: "syntax",
    patterns: [/SyntaxError/, /Unexpected token/, /error TS\d+:/, /Parse error/i, /ParserError/],
    rootCause: (m) => `A syntax or type error prevented compilation (matched: "${m}").`,
    whyItFailed: "Source code introduced in the changed files is not valid for the language/compiler version in use.",
    likelyFix: "Fix the reported syntax/type error at the cited line; run the compiler/linter locally before pushing.",
    recommendedAction: "Open the file and line cited in evidence — this category has the highest reliability of this analyzer.",
  },
  {
    category: "config",
    patterns: [
      /Invalid workflow file/i,
      /yaml: line \d+/i,
      /Unrecognized named-value/i,
      /Error: Input required and not supplied/i,
      /mapping values are not allowed here/i,
      /workflow is not valid/i,
    ],
    rootCause: () => "The CI workflow/pipeline configuration itself is invalid.",
    whyItFailed: "A recent edit to the workflow YAML introduced invalid syntax, an unknown key, or a missing required input.",
    likelyFix: "Validate the workflow file locally (e.g. `actionlint` for GitHub Actions, `gitlab-ci-lint` for GitLab) and fix the reported line.",
    recommendedAction: "Review the diff to the workflow file in this commit — config errors are almost always in what just changed.",
    correlatingFilePatterns: [/\.github\/workflows\/.*\.ya?ml$/, /\.gitlab-ci\.ya?ml$/, /\.circleci\/config\.ya?ml$/],
  },
  {
    category: "infra",
    patterns: [
      /connection refused/i,
      /ENOTFOUND/,
      /503 Service Unavailable/,
      /runner went offline/i,
      /lost communication with the server/i,
      /EAI_AGAIN/,
      /getaddrinfo/i,
    ],
    rootCause: () => "The failure originated outside the job's own code — a network or infrastructure dependency was unreachable.",
    whyItFailed: "A third-party service, registry, or the CI runner's networking was unavailable during the run.",
    likelyFix: "Usually transient — re-run the job. If it recurs, check the status page of the dependency being reached.",
    recommendedAction: "Re-run once to confirm transience before investigating further; escalate only if it repeats across runs.",
  },
  {
    category: "test",
    patterns: [/^\s*✕/, /AssertionError/, /expect\(received\)/, /\d+ failing/, /FAIL\s+\S+\.(test|spec)\./],
    rootCause: (m) => `One or more test assertions failed (matched: "${m}").`,
    whyItFailed: "A test's expected behavior no longer matches actual behavior — either the code regressed or the test needs updating for an intentional change.",
    likelyFix: "Inspect the failing assertion's expected vs. actual values and the code path it exercises.",
    recommendedAction: "Cross-check the failing test name against the flaky-test dashboard before assuming a real regression.",
  },
];

function correlateChangedFiles(sig: Signature, changedFiles: string[]): string[] {
  if (!sig.correlatingFilePatterns) return [];
  return changedFiles.filter((f) => sig.correlatingFilePatterns!.some((p) => p.test(f)));
}

export const localAnalyzer: AIProvider = {
  id: "local-deterministic",

  async analyzeFailure(input: FailureAnalysisInput): Promise<FailureAnalysisResult> {
    const evidence: FailureEvidence[] = [];

    for (const sig of SIGNATURES) {
      for (const pattern of sig.patterns) {
        const hits = findLines(input.logExcerpt, pattern);
        if (hits.length === 0) continue;

        const matchedText = hits[0].text;
        const correlated = correlateChangedFiles(sig, input.changedFiles);

        for (const hit of hits.slice(0, 3)) {
          evidence.push({
            kind: "log-line",
            lineNumber: hit.lineNumber,
            excerpt: hit.text,
            reason: `Matches known ${sig.category} failure signature`,
          });
        }
        for (const file of correlated) {
          evidence.push({
            kind: "changed-file",
            file,
            excerpt: file,
            reason: `File changed in this commit that plausibly caused a ${sig.category} failure`,
          });
        }
        if (sig.category === "test" && input.relatedTestFailures.length > 0) {
          for (const t of input.relatedTestFailures.slice(0, 5)) {
            evidence.push({
              kind: "test-failure",
              excerpt: t.name + (t.message ? `: ${t.message}` : ""),
              reason: "Test reported as failed in this run",
            });
          }
        }
        if (input.previousSimilarFailureCount > 0) {
          evidence.push({
            kind: "previous-failure",
            excerpt: `${input.previousSimilarFailureCount} prior run(s) failed with a similar signature`,
            reason: "Historical recurrence increases confidence this is a real, reproducible failure mode",
          });
        }

        // Confidence: base signal + correlation boosts, capped below 1.0 —
        // this analyzer never claims certainty, only evidence-weighted likelihood.
        let confidence = 0.5;
        confidence += Math.min(hits.length - 1, 2) * 0.05;
        confidence += correlated.length > 0 ? 0.2 : 0;
        confidence += input.previousSimilarFailureCount > 0 ? 0.1 : 0;
        confidence = Math.min(confidence, 0.92);

        return {
          provider: "local-deterministic",
          category: sig.category,
          rootCause: sig.rootCause(matchedText),
          whyItFailed: sig.whyItFailed,
          whatChanged: correlated.length > 0 ? `Changed files implicated: ${correlated.join(", ")}` : null,
          likelyFix: sig.likelyFix,
          confidence,
          relevantFiles: correlated,
          evidence,
          recommendedAction: sig.recommendedAction,
        };
      }
    }

    // No known signature matched — report low confidence rather than guessing.
    // Evidence-from-nothing would violate "never fabricate a cause."
    const tailLines = input.logExcerpt
      .split("\n")
      .filter((l) => l.trim().length > 0)
      .slice(-5)
      .map((text, i, arr) => ({ lineNumber: undefined, excerpt: text.trim().slice(0, 300), kind: "log-line" as const, reason: i === arr.length - 1 ? "Last non-empty line of the captured log excerpt" : "Log tail, for context" }));

    return {
      provider: "local-deterministic",
      category: "unknown",
      rootCause: "No known failure signature was found in the captured log excerpt.",
      whyItFailed:
        "This analyzer matches against a fixed library of known CI failure patterns (dependency, timeout, OOM, syntax, config, infra, test). None matched, which means either the excerpt didn't capture the actual error, or this is a failure mode not yet in the pattern library.",
      whatChanged: null,
      likelyFix: "Open the full job log manually. Consider filing the pattern you find so it can be added to the classifier.",
      confidence: 0.15,
      relevantFiles: [],
      evidence: tailLines,
      recommendedAction: "Read the full (non-truncated) log for this job — the excerpt available to this analyzer did not contain a recognized signature.",
    };
  },
};
