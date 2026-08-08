export interface Repository {
  id: string;
  owner: string;
  name: string;
  provider: string;
  defaultBranch: string;
  private: boolean;
  demo: boolean;
}

export interface RepositoryHealth {
  repository: { id: string; owner: string; name: string };
  windowDays: number;
  totalRuns: number;
  successRate: number | null;
  failureRate: number | null;
  avgDurationMs: number | null;
  flakyTestCount: number;
  openRecommendationCount: number;
  lastDeployment: { status: string; environment: string; startedAt: string | null } | null;
}

export interface BuildSummary {
  id: string;
  repository: string;
  workflow: string;
  branch: string | null;
  runNumber: number;
  status: string;
  conclusion: string | null;
  durationMs: number | null;
  commitSha: string | null;
  completedAt: string | null;
}

export interface BuildDetail {
  id: string;
  repository: string;
  workflow: string;
  branch: string | null;
  runNumber: number;
  status: string;
  conclusion: string | null;
  durationMs: number | null;
  commit: { sha: string; message: string } | null;
  jobs: {
    id: string;
    name: string;
    status: string;
    conclusion: string | null;
    durationMs: number | null;
    failure: { id: string; category: string | null; analysis: { rootCause: string; confidence: number; likelyFix: string } | null } | null;
  }[];
}

export interface FailureSummary {
  id: string;
  workflowRunId: string;
  repository: string;
  job: string | null;
  category: string | null;
  rootCause: string | null;
  confidence: number | null;
  createdAt: string;
}

export interface FailureAnalysis {
  provider: string;
  rootCause: string;
  whyItFailed: string;
  whatChanged: string | null;
  likelyFix: string;
  confidence: number;
  recommendedAction: string | null;
  relevantFiles: string[];
  evidence: { kind: string; file?: string; lineNumber?: number; excerpt: string; reason: string }[];
}

export interface FailureDetail {
  id: string;
  repository: string;
  workflow: string;
  job: string | null;
  category: string | null;
  createdAt: string;
  analysis: FailureAnalysis | null;
}

export interface FlakyTest {
  fullName: string;
  repository: string;
  score: number;
  totalRuns: number;
  failCount: number;
  transitionCount: number;
  avgDurationMs: number | null;
  lastFailureAt: string | null;
}

export interface Recommendation {
  id: string;
  repository: string;
  kind: string;
  title: string;
  description: string;
  diff: string | null;
  filePath: string | null;
  status: string;
  impactEstimate: unknown;
  createdAt: string;
}

export interface Deployment {
  id: string;
  repository: string;
  environment: string;
  status: string;
  version: string | null;
  isRollback: boolean;
  durationMs: number | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface OverviewStats {
  totalRuns: number;
  successRate: number;
  failureRate: number;
  avgDurationMs: number;
  avgQueueTimeMs: number;
  deploymentsPerDay: number;
  flakyTestCount: number;
  openRecommendationCount: number;
}
