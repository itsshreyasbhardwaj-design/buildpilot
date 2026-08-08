import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { POST } from "./route";
import { db } from "@/lib/db";
import { cleanDatabase, createTestOrgAndRepo } from "@/test/db-helpers";

const SECRET = "test-github-webhook-secret"; // matches vitest.config.ts test.env

function sign(payload: string): string {
  return "sha256=" + createHmac("sha256", SECRET).update(payload, "utf8").digest("hex");
}

function request(body: unknown, headers: Record<string, string>) {
  const payload = JSON.stringify(body);
  return new NextRequest("http://localhost/api/webhooks/github", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: payload,
  });
}

function workflowRunPayload(repoExternalId: number, deliveryId: string, overrides: Record<string, unknown> = {}) {
  return {
    repository: { id: repoExternalId },
    workflow_run: {
      id: 900,
      workflow_id: 1,
      name: "CI",
      run_number: 1,
      status: "completed",
      conclusion: "failure",
      head_branch: "main",
      head_sha: "abc123",
      event: "push",
      ...overrides,
    },
  };
}

describe("POST /api/webhooks/github", () => {
  beforeEach(cleanDatabase);
  afterEach(cleanDatabase);

  it("rejects an unknown provider with 404", async () => {
    const res = await POST(request({}, {}), { params: Promise.resolve({ provider: "bitbucket" }) });
    expect(res.status).toBe(404);
  });

  it("rejects a request with an invalid signature (spoofing attempt) with 401", async () => {
    const { repository } = await createTestOrgAndRepo({ repoExternalId: "42" });
    const body = workflowRunPayload(42, "delivery-1");
    const res = await POST(
      request(body, { "x-github-event": "workflow_run", "x-github-delivery": "delivery-1", "x-hub-signature-256": "sha256=deadbeef" }),
      { params: Promise.resolve({ provider: "github" }) }
    );
    expect(res.status).toBe(401);
    const events = await db.event.findMany({ where: { repositoryId: repository.id } });
    expect(events).toHaveLength(0);
  });

  it("accepts a validly signed request and records the event", async () => {
    await createTestOrgAndRepo({ repoExternalId: "42" });
    const body = workflowRunPayload(42, "delivery-2");
    const payload = JSON.stringify(body);
    const res = await POST(
      request(body, { "x-github-event": "workflow_run", "x-github-delivery": "delivery-2", "x-hub-signature-256": sign(payload) }),
      { params: Promise.resolve({ provider: "github" }) }
    );
    expect(res.status).toBe(202);

    const event = await db.event.findUnique({ where: { provider_externalId: { provider: "github", externalId: "delivery-2" } } });
    expect(event).not.toBeNull();
    expect(event?.signatureValid).toBe(true);

    // The route hands off to the queue rather than doing work inline.
    const queueJobs = await db.queueJob.findMany({ where: { queue: "ingest-event" } });
    expect(queueJobs).toHaveLength(1);
  });

  it("treats a retried delivery (same delivery id) as a no-op duplicate, not an error", async () => {
    await createTestOrgAndRepo({ repoExternalId: "42" });
    const body = workflowRunPayload(42, "delivery-3");
    const payload = JSON.stringify(body);
    const headers = { "x-github-event": "workflow_run", "x-github-delivery": "delivery-3", "x-hub-signature-256": sign(payload) };

    const first = await POST(request(body, headers), { params: Promise.resolve({ provider: "github" }) });
    const second = await POST(request(body, headers), { params: Promise.resolve({ provider: "github" }) });

    expect(first.status).toBe(202);
    expect(second.status).toBe(200);
    expect((await second.json()).status).toBe("duplicate");

    const events = await db.event.findMany({ where: { externalId: "delivery-3" } });
    expect(events).toHaveLength(1); // not double-recorded
  });

  it("fails closed (503) when no webhook secret is configured for the provider", async () => {
    const original = process.env.WEBHOOK_SECRET_GITHUB;
    delete process.env.WEBHOOK_SECRET_GITHUB;
    try {
      const res = await POST(request({}, { "x-github-event": "workflow_run" }), { params: Promise.resolve({ provider: "github" }) });
      expect(res.status).toBe(503);
    } finally {
      process.env.WEBHOOK_SECRET_GITHUB = original;
    }
  });

  it("redacts secrets embedded in webhook payload text before persisting", async () => {
    await createTestOrgAndRepo({ repoExternalId: "42" });
    const body = workflowRunPayload(42, "delivery-4", {}) as Record<string, unknown> & {
      head_commit?: unknown;
    };
    // Simulate a leaked secret accidentally committed into a commit message.
    (body.workflow_run as Record<string, unknown>).head_commit = {
      id: "abc123",
      message: "oops committed AKIAABCDEFGHIJKLMNOP by mistake",
      timestamp: new Date().toISOString(),
    };
    const payload = JSON.stringify(body);
    await POST(
      request(body, { "x-github-event": "workflow_run", "x-github-delivery": "delivery-4", "x-hub-signature-256": sign(payload) }),
      { params: Promise.resolve({ provider: "github" }) }
    );

    const event = await db.event.findUnique({ where: { provider_externalId: { provider: "github", externalId: "delivery-4" } } });
    expect(JSON.stringify(event?.payload)).not.toContain("AKIAABCDEFGHIJKLMNOP");
  });
});
