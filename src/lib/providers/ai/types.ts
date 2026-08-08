// AI provider abstraction. The default implementation (local-analyzer.ts) is a
// deterministic, evidence-based classifier — no LLM, no API key, $0 to run.
// A real LLM-backed provider (openrouter.ts) can be swapped in behind an env
// var, but every implementation must satisfy the same contract: never invent
// a root cause that isn't backed by a citation into the actual log/diff.

export interface FailureEvidence {
  kind: "log-line" | "changed-file" | "dependency-diff" | "previous-failure" | "test-failure";
  file?: string;
  lineNumber?: number;
  excerpt: string;
  reason: string;
}

export interface FailureAnalysisInput {
  workflowName: string;
  jobName: string;
  /** Already secret-redacted. */
  logExcerpt: string;
  changedFiles: string[];
  recentCommitMessages: string[];
  relatedTestFailures: { name: string; message?: string }[];
  previousSimilarFailureCount: number;
}

export interface FailureAnalysisResult {
  provider: string;
  category: "dependency" | "test" | "timeout" | "oom" | "syntax" | "config" | "infra" | "flaky" | "unknown";
  rootCause: string;
  whyItFailed: string;
  whatChanged: string | null;
  likelyFix: string;
  confidence: number; // 0..1 — see docs/AI_SAFETY.md#confidence-calibration
  relevantFiles: string[];
  evidence: FailureEvidence[];
  recommendedAction: string;
}

export interface AIProvider {
  readonly id: string;
  analyzeFailure(input: FailureAnalysisInput): Promise<FailureAnalysisResult>;
}
