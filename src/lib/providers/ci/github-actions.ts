import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  CIProvider,
  NormalizedCommit,
  NormalizedRun,
  NormalizedWebhookEvent,
  WebhookVerificationResult,
} from "./types";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null ? (value as JsonRecord) : {};
}

function toDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function mapStatus(status: unknown): "queued" | "in_progress" | "completed" {
  if (status === "in_progress") return "in_progress";
  if (status === "completed") return "completed";
  return "queued";
}

function mapConclusion(
  conclusion: unknown
): "success" | "failure" | "cancelled" | "timed_out" | "skipped" | undefined {
  const allowed = ["success", "failure", "cancelled", "timed_out", "skipped"] as const;
  return typeof conclusion === "string" && (allowed as readonly string[]).includes(conclusion)
    ? (conclusion as (typeof allowed)[number])
    : undefined;
}

/**
 * Reference CI provider implementation. GitHub signs webhooks with
 * HMAC-SHA256 over the raw request body (`X-Hub-Signature-256`) and the
 * `X-GitHub-Delivery` header is the idempotency key for a delivery — GitHub
 * retries deliveries with the same id, which is what makes at-least-once
 * ingestion safe. See docs/SECURITY.md#webhook-verification.
 */
export const githubActionsProvider: CIProvider = {
  id: "github",

  verifyWebhookSignature({ payload, headers, secret }): WebhookVerificationResult {
    const header = headers["x-hub-signature-256"];
    const signature = Array.isArray(header) ? header[0] : header;
    if (!signature) return { valid: false, reason: "missing X-Hub-Signature-256 header" };

    const expected = "sha256=" + createHmac("sha256", secret).update(payload, "utf8").digest("hex");

    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    // Signatures are fixed-length hex digests; a length mismatch means "invalid",
    // never treated as an early-exit that could be timed against.
    if (a.length !== b.length) return { valid: false, reason: "signature length mismatch" };
    const valid = timingSafeEqual(a, b);
    return valid ? { valid: true } : { valid: false, reason: "signature mismatch" };
  },

  getEventId(headers): string | null {
    const header = headers["x-github-delivery"];
    const id = Array.isArray(header) ? header[0] : header;
    return id ?? null;
  },

  normalizeWebhookPayload(eventType, payload): NormalizedWebhookEvent | null {
    const body = asRecord(payload);
    const repo = asRecord(body.repository);
    const repositoryExternalId = repo.id != null ? String(repo.id) : "";
    if (!repositoryExternalId) return null;

    if (eventType === "workflow_run") {
      const wr = asRecord(body.workflow_run);
      const headCommit = asRecord(wr.head_commit);
      const run: NormalizedRun = {
        externalId: String(wr.id ?? ""),
        workflowExternalId: String(wr.workflow_id ?? ""),
        workflowName: String(wr.name ?? "unknown"),
        workflowPath: typeof wr.path === "string" ? wr.path : undefined,
        runNumber: Number(wr.run_number ?? 0),
        status: mapStatus(wr.status),
        conclusion: mapConclusion(wr.conclusion),
        branch: typeof wr.head_branch === "string" ? wr.head_branch : undefined,
        commitSha: typeof wr.head_sha === "string" ? wr.head_sha : undefined,
        pullRequestNumber: Array.isArray(wr.pull_requests) && wr.pull_requests.length > 0
          ? Number(asRecord(wr.pull_requests[0]).number ?? undefined) || undefined
          : undefined,
        triggeredBy: typeof asRecord(wr.triggering_actor).login === "string"
          ? String(asRecord(wr.triggering_actor).login)
          : undefined,
        event: typeof wr.event === "string" ? wr.event : undefined,
        startedAt: toDate(wr.run_started_at),
        completedAt: toDate(wr.updated_at) && wr.status === "completed" ? toDate(wr.updated_at) : undefined,
        jobs: [],
      };

      const commit: NormalizedCommit | undefined =
        typeof headCommit.id === "string"
          ? {
              sha: headCommit.id,
              message: typeof headCommit.message === "string" ? headCommit.message : "",
              authorName: typeof asRecord(headCommit.author).name === "string" ? String(asRecord(headCommit.author).name) : undefined,
              authorEmail: typeof asRecord(headCommit.author).email === "string" ? String(asRecord(headCommit.author).email) : undefined,
              changedFiles: [],
              committedAt: toDate(headCommit.timestamp) ?? new Date(),
            }
          : undefined;

      return {
        provider: "github",
        type: eventType,
        externalId: String(wr.id ?? ""),
        repositoryExternalId,
        run,
        commit,
      };
    }

    if (eventType === "workflow_job") {
      const wj = asRecord(body.workflow_job);
      return {
        provider: "github",
        type: eventType,
        externalId: String(wj.id ?? ""),
        repositoryExternalId,
        run: {
          externalId: String(wj.run_id ?? ""),
          workflowExternalId: String(wj.workflow_name ?? ""),
          workflowName: String(wj.workflow_name ?? "unknown"),
          runNumber: 0,
          status: mapStatus(wj.status),
          conclusion: mapConclusion(wj.conclusion),
          branch: typeof wj.head_branch === "string" ? wj.head_branch : undefined,
          commitSha: typeof wj.head_sha === "string" ? wj.head_sha : undefined,
          jobs: [
            {
              externalId: String(wj.id ?? ""),
              name: String(wj.name ?? "unknown"),
              status: mapStatus(wj.status),
              conclusion: mapConclusion(wj.conclusion),
              runnerLabel: Array.isArray(wj.labels) ? wj.labels.join(",") : undefined,
              startedAt: toDate(wj.started_at),
              completedAt: toDate(wj.completed_at),
              steps: Array.isArray(wj.steps)
                ? wj.steps.map((s: unknown, i: number) => {
                    const step = asRecord(s);
                    return {
                      name: String(step.name ?? `step-${i}`),
                      number: Number(step.number ?? i),
                      status: mapStatus(step.status),
                      conclusion: mapConclusion(step.conclusion),
                      startedAt: toDate(step.started_at),
                      completedAt: toDate(step.completed_at),
                    };
                  })
                : [],
            },
          ],
        },
      };
    }

    if (eventType === "push") {
      const headCommitRaw = asRecord(body.head_commit);
      if (!headCommitRaw.id) return null;
      return {
        provider: "github",
        type: eventType,
        externalId: `push:${String(headCommitRaw.id)}`,
        repositoryExternalId,
        commit: {
          sha: String(headCommitRaw.id),
          message: typeof headCommitRaw.message === "string" ? headCommitRaw.message : "",
          authorName: typeof asRecord(headCommitRaw.author).name === "string" ? String(asRecord(headCommitRaw.author).name) : undefined,
          authorEmail: typeof asRecord(headCommitRaw.author).email === "string" ? String(asRecord(headCommitRaw.author).email) : undefined,
          changedFiles: [
            ...(Array.isArray(headCommitRaw.added) ? (headCommitRaw.added as string[]) : []),
            ...(Array.isArray(headCommitRaw.modified) ? (headCommitRaw.modified as string[]) : []),
            ...(Array.isArray(headCommitRaw.removed) ? (headCommitRaw.removed as string[]) : []),
          ],
          committedAt: toDate(headCommitRaw.timestamp) ?? new Date(),
        },
      };
    }

    // Unrecognized event types are ignored, not errored — GitHub sends many
    // event types we don't model yet (releases, issues, ...).
    return null;
  },

  async fetchJobLogs({ installationRef, repositoryExternalId, jobExternalId }): Promise<string> {
    const token = process.env.GITHUB_APP_TOKEN;
    if (!token) {
      throw new Error(
        "GITHUB_APP_TOKEN is not configured — real log fetching requires a GitHub App installation token. " +
          "In demo mode, logs are served from seeded data instead of this method."
      );
    }
    const url = `https://api.github.com/repos/${repositoryExternalId}/actions/jobs/${jobExternalId}/logs`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!res.ok) {
      throw new Error(`GitHub log fetch failed for installation ${installationRef}: ${res.status} ${res.statusText}`);
    }
    return res.text();
  },
};
