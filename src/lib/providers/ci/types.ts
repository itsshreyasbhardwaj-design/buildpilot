// The CI provider abstraction. Every provider (GitHub Actions, GitLab CI,
// CircleCI, ...) implements this interface; nothing outside src/lib/providers/ci
// is allowed to import a provider-specific SDK or assume a provider's payload
// shape. New providers are added by implementing CIProvider and registering in
// registry.ts — nothing else in the codebase changes.

export type CIProviderId = "github" | "gitlab" | "circleci";

export interface NormalizedRun {
  externalId: string;
  workflowExternalId: string;
  workflowName: string;
  workflowPath?: string;
  runNumber: number;
  status: "queued" | "in_progress" | "completed";
  conclusion?: "success" | "failure" | "cancelled" | "timed_out" | "skipped";
  branch?: string;
  commitSha?: string;
  pullRequestNumber?: number;
  triggeredBy?: string;
  event?: string;
  queuedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  jobs: NormalizedJob[];
}

export interface NormalizedJob {
  externalId: string;
  name: string;
  status: "queued" | "in_progress" | "completed";
  conclusion?: "success" | "failure" | "cancelled" | "timed_out" | "skipped";
  runnerLabel?: string;
  startedAt?: Date;
  completedAt?: Date;
  steps: NormalizedStep[];
}

export interface NormalizedStep {
  name: string;
  number: number;
  status: "queued" | "in_progress" | "completed";
  conclusion?: "success" | "failure" | "cancelled" | "timed_out" | "skipped";
  startedAt?: Date;
  completedAt?: Date;
}

export interface NormalizedCommit {
  sha: string;
  message: string;
  authorName?: string;
  authorEmail?: string;
  changedFiles: string[];
  committedAt: Date;
}

export interface NormalizedWebhookEvent {
  provider: CIProviderId;
  type: string;
  externalId: string;
  repositoryExternalId: string;
  run?: NormalizedRun;
  commit?: NormalizedCommit;
}

export interface WebhookVerificationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Everything a CI provider adapter must supply. Adapters only ever produce
 * normalized types above — the rest of the system never sees provider-native
 * shapes, which is what lets the event pipeline, dashboard, and AI analysis
 * stay provider-agnostic.
 */
export interface CIProvider {
  readonly id: CIProviderId;

  /** Verify a webhook delivery's signature against the configured secret. */
  verifyWebhookSignature(args: {
    payload: string;
    headers: Record<string, string | string[] | undefined>;
    secret: string;
  }): WebhookVerificationResult;

  /** Extract the provider's own idempotency key for a webhook delivery. */
  getEventId(headers: Record<string, string | string[] | undefined>, payload: unknown): string | null;

  /** Convert a provider-native webhook payload into normalized domain events. */
  normalizeWebhookPayload(eventType: string, payload: unknown): NormalizedWebhookEvent | null;

  /** Fetch raw logs for a job, for AI analysis. Secrets are redacted by the caller, not here. */
  fetchJobLogs(args: { installationRef: string; repositoryExternalId: string; jobExternalId: string }): Promise<string>;
}
