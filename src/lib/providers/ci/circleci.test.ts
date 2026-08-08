import { createHmac } from "node:crypto";
import { describe, it, expect } from "vitest";
import { circleciProvider } from "./circleci";

const SECRET = "test-circleci-secret";

function sign(payload: string, secret = SECRET): string {
  return "v1=" + createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

describe("circleciProvider.verifyWebhookSignature", () => {
  it("accepts a correctly signed payload", () => {
    const payload = JSON.stringify({ id: "evt-1" });
    const result = circleciProvider.verifyWebhookSignature({
      payload,
      headers: { "circleci-signature": sign(payload) },
      secret: SECRET,
    });
    expect(result.valid).toBe(true);
  });

  it("checks every candidate signature when multiple are present (key rotation)", () => {
    const payload = JSON.stringify({ id: "evt-1" });
    const header = `v1=deadbeef, ${sign(payload)}`;
    const result = circleciProvider.verifyWebhookSignature({ payload, headers: { "circleci-signature": header }, secret: SECRET });
    expect(result.valid).toBe(true);
  });

  it("rejects when no candidate matches (spoofing attempt)", () => {
    const payload = JSON.stringify({ id: "evt-1" });
    const result = circleciProvider.verifyWebhookSignature({
      payload,
      headers: { "circleci-signature": sign(payload, "wrong-secret") },
      secret: SECRET,
    });
    expect(result.valid).toBe(false);
  });
});

describe("circleciProvider.normalizeWebhookPayload", () => {
  it("normalizes a workflow-completed event", () => {
    const event = circleciProvider.normalizeWebhookPayload("workflow-completed", {
      id: "evt-1",
      type: "workflow-completed",
      pipeline: { number: 12, vcs: { revision: "abc", branch: "main" } },
      workflow: { id: "wf-1", name: "build-test", status: "failed" },
      project: { slug: "gh/acme/repo" },
    });
    expect(event?.repositoryExternalId).toBe("gh/acme/repo");
    expect(event?.run?.conclusion).toBe("failure");
  });

  it("returns null for unmodeled event types", () => {
    const event = circleciProvider.normalizeWebhookPayload("ping", { project: { slug: "gh/acme/repo" }, type: "ping" });
    expect(event).toBeNull();
  });
});

describe("circleciProvider.getEventId", () => {
  it("uses the payload's own id as the idempotency key", () => {
    expect(circleciProvider.getEventId({}, { id: "evt-1" })).toBe("evt-1");
  });
});
