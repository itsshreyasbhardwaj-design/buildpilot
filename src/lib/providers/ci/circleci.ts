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
  if (status === "running") return "in_progress";
  if (typeof status === "string" && ["success", "failed", "error", "canceled", "not_run"].includes(status)) {
    return "completed";
  }
  return "queued";
}

function mapConclusion(
  status: unknown
): "success" | "failure" | "cancelled" | "timed_out" | "skipped" | undefined {
  switch (status) {
    case "success":
      return "success";
    case "failed":
    case "error":
      return "failure";
    case "canceled":
      return "cancelled";
    case "not_run":
      return "skipped";
    default:
      return undefined;
  }
}

/**
 * CircleCI signs each delivery with HMAC-SHA256 over the raw body, sent as
 * `circleci-signature: v1=<hex>` (comma-separated on key rotation — every
 * candidate must be checked). The webhook payload itself carries a top-level
 * `id`, which is the idempotency key CircleCI recommends deduping on.
 */
export const circleciProvider: CIProvider = {
  id: "circleci",

  verifyWebhookSignature({ payload, headers, secret }): WebhookVerificationResult {
    const header = headers["circleci-signature"];
    const raw = Array.isArray(header) ? header[0] : header;
    if (!raw) return { valid: false, reason: "missing circleci-signature header" };

    const expected = createHmac("sha256", secret).update(payload, "utf8").digest("hex");
    const candidates = raw
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.startsWith("v1="))
      .map((part) => part.slice(3));

    if (candidates.length === 0) return { valid: false, reason: "no v1 signature present" };

    const expectedBuf = Buffer.from(expected);
    for (const candidate of candidates) {
      const candidateBuf = Buffer.from(candidate);
      if (candidateBuf.length === expectedBuf.length && timingSafeEqual(candidateBuf, expectedBuf)) {
        return { valid: true };
      }
    }
    return { valid: false, reason: "signature mismatch" };
  },

  getEventId(_headers, payload): string | null {
    const body = asRecord(payload);
    return typeof body.id === "string" ? body.id : null;
  },

  normalizeWebhookPayload(eventType, payload): NormalizedWebhookEvent | null {
    const body = asRecord(payload);
    const project = asRecord(body.project);
    const repositoryExternalId = typeof project.slug === "string" ? project.slug : "";
    if (!repositoryExternalId) return null;

    const type = typeof body.type === "string" ? body.type : eventType;
    if (type !== "workflow-completed" && type !== "job-completed" && type !== "workflow-started") {
      return null;
    }

    const pipeline = asRecord(body.pipeline);
    const workflow = asRecord(body.workflow);
    const vcs = asRecord(pipeline.vcs);
    const commitInfo = asRecord(vcs.commit);
    const job = asRecord(body.job);

    const run: NormalizedRun = {
      externalId: String(workflow.id ?? pipeline.id ?? ""),
      workflowExternalId: String(workflow.id ?? ""),
      workflowName: String(workflow.name ?? "unknown"),
      runNumber: Number(pipeline.number ?? 0),
      status: mapStatus(workflow.status),
      conclusion: mapConclusion(workflow.status),
      branch: typeof vcs.branch === "string" ? vcs.branch : undefined,
      commitSha: typeof vcs.revision === "string" ? vcs.revision : undefined,
      event: type,
      startedAt: toDate(workflow.created_at),
      completedAt: toDate(workflow.stopped_at),
      jobs:
        type === "job-completed" && job.id
          ? [
              {
                externalId: String(job.id),
                name: String(job.name ?? "unknown"),
                status: mapStatus(job.status),
                conclusion: mapConclusion(job.status),
                startedAt: toDate(job.started_at),
                completedAt: toDate(job.stopped_at),
                steps: [],
              },
            ]
          : [],
    };

    const commit: NormalizedCommit | undefined = vcs.revision
      ? {
          sha: String(vcs.revision),
          message: typeof commitInfo.subject === "string" ? commitInfo.subject : "",
          changedFiles: [],
          committedAt: toDate(pipeline.created_at) ?? new Date(),
        }
      : undefined;

    return {
      provider: "circleci",
      type,
      externalId: typeof body.id === "string" ? body.id : String(workflow.id ?? pipeline.id ?? ""),
      repositoryExternalId,
      run,
      commit,
    };
  },

  async fetchJobLogs({ repositoryExternalId, jobExternalId }): Promise<string> {
    const token = process.env.CIRCLECI_API_TOKEN;
    if (!token) {
      throw new Error(
        "CIRCLECI_API_TOKEN is not configured — real log fetching requires a CircleCI API token. " +
          "In demo mode, logs are served from seeded data instead of this method."
      );
    }
    // CircleCI serves step output via per-step "output_url" links returned from
    // the job detail endpoint; fetch the job, then its action outputs.
    const jobRes = await fetch(`https://circleci.com/api/v2/project/${repositoryExternalId}/job/${jobExternalId}`, {
      headers: { "Circle-Token": token },
    });
    if (!jobRes.ok) throw new Error(`CircleCI job fetch failed: ${jobRes.status} ${jobRes.statusText}`);
    const job = await jobRes.json();
    return JSON.stringify(job);
  },
};
