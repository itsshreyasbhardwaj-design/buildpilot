import { createHash, timingSafeEqual } from "node:crypto";
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
  if (status === "running" || status === "pending") return "in_progress";
  if (["success", "failed", "canceled", "cancelled", "skipped"].includes(String(status))) return "completed";
  return "queued";
}

function mapConclusion(
  status: unknown
): "success" | "failure" | "cancelled" | "timed_out" | "skipped" | undefined {
  switch (status) {
    case "success":
      return "success";
    case "failed":
      return "failure";
    case "canceled":
    case "cancelled":
      return "cancelled";
    case "skipped":
      return "skipped";
    default:
      return undefined;
  }
}

/**
 * GitLab does not sign webhooks with HMAC by default — it sends a static
 * secret token in `X-Gitlab-Token` that must equal the value configured when
 * the webhook was created. There is also no standard delivery-id header, so
 * we derive an idempotency key from the pipeline id + its `updated_at`
 * timestamp (falling back to a payload hash), matching GitLab's own retry
 * semantics of re-sending the same pipeline state.
 */
export const gitlabCiProvider: CIProvider = {
  id: "gitlab",

  verifyWebhookSignature({ payload, headers, secret }): WebhookVerificationResult {
    const header = headers["x-gitlab-token"];
    const token = Array.isArray(header) ? header[0] : header;
    if (!token) return { valid: false, reason: "missing X-Gitlab-Token header" };

    const a = Buffer.from(token);
    const b = Buffer.from(secret);
    if (a.length !== b.length) return { valid: false, reason: "token length mismatch" };
    const valid = timingSafeEqual(a, b);
    void payload; // GitLab's token check does not cover the body itself.
    return valid ? { valid: true } : { valid: false, reason: "token mismatch" };
  },

  getEventId(_headers, payload): string | null {
    const body = asRecord(payload);
    const attrs = asRecord(body.object_attributes);
    if (attrs.id != null) {
      return `pipeline:${attrs.id}:${attrs.updated_at ?? attrs.status ?? ""}`;
    }
    // No stable id in the payload (e.g. Job Hook) — hash the body as a
    // last-resort idempotency key so duplicate deliveries still collapse.
    return "hash:" + createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  },

  normalizeWebhookPayload(eventType, payload): NormalizedWebhookEvent | null {
    const body = asRecord(payload);
    const project = asRecord(body.project);
    const repositoryExternalId = project.id != null ? String(project.id) : "";
    if (!repositoryExternalId) return null;

    if (eventType === "Pipeline Hook" || body.object_kind === "pipeline") {
      const attrs = asRecord(body.object_attributes);
      const commitRaw = asRecord(body.commit);
      const builds = Array.isArray(body.builds) ? body.builds : [];

      const run: NormalizedRun = {
        externalId: String(attrs.id ?? ""),
        workflowExternalId: "gitlab-ci-pipeline",
        workflowName: ".gitlab-ci.yml",
        runNumber: Number(attrs.iid ?? attrs.id ?? 0),
        status: mapStatus(attrs.status),
        conclusion: mapConclusion(attrs.status),
        branch: typeof attrs.ref === "string" ? attrs.ref : undefined,
        commitSha: typeof attrs.sha === "string" ? attrs.sha : undefined,
        triggeredBy: typeof asRecord(body.user).username === "string" ? String(asRecord(body.user).username) : undefined,
        event: typeof attrs.source === "string" ? attrs.source : undefined,
        queuedAt: toDate(attrs.created_at),
        startedAt: toDate(attrs.created_at),
        completedAt: toDate(attrs.finished_at),
        jobs: builds.map((b: unknown) => {
          const build = asRecord(b);
          return {
            externalId: String(build.id ?? ""),
            name: String(build.name ?? "unknown"),
            status: mapStatus(build.status),
            conclusion: mapConclusion(build.status),
            runnerLabel: typeof asRecord(build.runner).description === "string" ? String(asRecord(build.runner).description) : undefined,
            startedAt: toDate(build.started_at),
            completedAt: toDate(build.finished_at),
            steps: [],
          };
        }),
      };

      const commit: NormalizedCommit | undefined =
        typeof commitRaw.id === "string"
          ? {
              sha: commitRaw.id,
              message: typeof commitRaw.message === "string" ? commitRaw.message : "",
              authorName: typeof asRecord(commitRaw.author).name === "string" ? String(asRecord(commitRaw.author).name) : undefined,
              authorEmail: typeof asRecord(commitRaw.author).email === "string" ? String(asRecord(commitRaw.author).email) : undefined,
              changedFiles: [],
              committedAt: toDate(commitRaw.timestamp) ?? new Date(),
            }
          : undefined;

      return {
        provider: "gitlab",
        type: "pipeline",
        externalId: String(attrs.id ?? ""),
        repositoryExternalId,
        run,
        commit,
      };
    }

    return null;
  },

  async fetchJobLogs({ repositoryExternalId, jobExternalId }): Promise<string> {
    const token = process.env.GITLAB_ACCESS_TOKEN;
    if (!token) {
      throw new Error(
        "GITLAB_ACCESS_TOKEN is not configured — real log fetching requires a GitLab access token. " +
          "In demo mode, logs are served from seeded data instead of this method."
      );
    }
    const url = `https://gitlab.com/api/v4/projects/${encodeURIComponent(repositoryExternalId)}/jobs/${jobExternalId}/trace`;
    const res = await fetch(url, { headers: { "PRIVATE-TOKEN": token } });
    if (!res.ok) throw new Error(`GitLab log fetch failed: ${res.status} ${res.statusText}`);
    return res.text();
  },
};
