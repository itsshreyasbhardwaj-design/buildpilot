import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { POST as webhookPost } from "@/app/api/webhooks/[provider]/route";
import { db } from "@/lib/db";
import { cleanDatabase, createTestOrgAndRepo } from "@/test/db-helpers";
import { handleIngestEvent } from "./workers/ingest-event";
import { handleAnalyzeFailure } from "./workers/analyze-failure";
import { FAILURE_FIXTURES } from "@/lib/demo/log-fixtures";
import type { IngestEventPayload, AnalyzeFailurePayload } from "@/lib/ingestion/queue-contracts";

const SECRET = "test-github-webhook-secret";

function sign(payload: string): string {
  return "sha256=" + createHmac("sha256", SECRET).update(payload, "utf8").digest("hex");
}

/**
 * Drives webhook -> event -> ingest -> job -> failure -> AI analysis by
 * calling the same worker functions the queue calls, without waiting on the
 * queue's polling interval. This is the full pipeline the spec asks for
 * ("Do not perform long-running analysis directly inside webhook requests"),
 * exercised end to end rather than mocked at the boundary.
 */
describe("webhook -> ingestion -> AI analysis pipeline", () => {
  beforeEach(cleanDatabase);
  afterEach(() => {
    cleanDatabase();
    vi.unstubAllGlobals();
  });

  it("classifies a real failure through the full pipeline, from webhook to AI analysis", async () => {
    const { repository } = await createTestOrgAndRepo({ repoExternalId: "42" });
    await db.repository.update({ where: { id: repository.id }, data: { installationId: "install-123" } });

    const fixture = FAILURE_FIXTURES.find((f) => f.category === "dependency")!;

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(fixture.log, { status: 200 }))
    );

    const body = {
      repository: { id: 42 },
      workflow_job: {
        id: 500,
        run_id: 999,
        workflow_name: "CI",
        name: fixture.jobName,
        status: "completed",
        conclusion: "failure",
        head_branch: "main",
        head_sha: "abc123",
        labels: ["ubuntu-latest"],
        steps: [
          { name: "checkout", number: 1, status: "completed", conclusion: "success" },
          { name: `run ${fixture.jobName}`, number: 2, status: "completed", conclusion: "failure" },
        ],
      },
    };
    const payload = JSON.stringify(body);
    const request = new NextRequest("http://localhost/api/webhooks/github", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-github-event": "workflow_job",
        "x-github-delivery": "delivery-pipeline-1",
        "x-hub-signature-256": sign(payload),
      },
      body: payload,
    });

    const webhookRes = await webhookPost(request, { params: Promise.resolve({ provider: "github" }) });
    expect(webhookRes.status).toBe(202);
    const { eventId } = await webhookRes.json();

    // Drive the queue worker directly instead of waiting on its poll interval.
    await handleIngestEvent({ eventId } satisfies IngestEventPayload);

    const workflowRun = await db.workflowRun.findFirst({ where: { repositoryId: repository.id }, include: { jobs: true } });
    expect(workflowRun).not.toBeNull();
    expect(workflowRun?.jobs).toHaveLength(1);
    expect(workflowRun?.jobs[0].conclusion).toBe("failure");

    const failure = await db.failure.findFirst({ where: { jobId: workflowRun?.jobs[0].id } });
    expect(failure).not.toBeNull();

    // The step's log should have been fetched (via our mocked fetch) and stored.
    const step = await db.step.findFirst({ where: { jobId: workflowRun?.jobs[0].id, conclusion: "failure" } });
    expect(step?.logExcerpt).toContain("npm ERR!");

    await handleAnalyzeFailure({
      failureId: failure!.id,
      workflowRunId: workflowRun!.id,
      jobId: workflowRun!.jobs[0].id,
    } satisfies AnalyzeFailurePayload);

    const analysis = await db.aIAnalysis.findFirst({ where: { failureId: failure!.id } });
    expect(analysis).not.toBeNull();
    expect(analysis?.provider).toBe("local-deterministic");

    const updatedFailure = await db.failure.findUnique({ where: { id: failure!.id } });
    expect(updatedFailure?.category).toBe("dependency");
  });

  it("marks an event as failed (not silently dropped) when its repository isn't connected", async () => {
    const body = { repository: { id: 999999 }, workflow_run: { id: 1, status: "completed", conclusion: "failure" } };
    const payload = JSON.stringify(body);
    const request = new NextRequest("http://localhost/api/webhooks/github", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-github-event": "workflow_run",
        "x-github-delivery": "delivery-unconnected",
        "x-hub-signature-256": sign(payload),
      },
      body: payload,
    });

    const res = await webhookPost(request, { params: Promise.resolve({ provider: "github" }) });
    const { eventId } = await res.json();
    await handleIngestEvent({ eventId } satisfies IngestEventPayload);

    const event = await db.event.findUnique({ where: { id: eventId } });
    expect(event?.status).toBe("failed");
    expect(event?.error).toMatch(/not connected/i);
  });
});
