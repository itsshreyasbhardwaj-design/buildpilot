import { createHmac } from "node:crypto";
import { describe, it, expect } from "vitest";
import { githubActionsProvider } from "./github-actions";

const SECRET = "test-secret";

function sign(payload: string, secret = SECRET): string {
  return "sha256=" + createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

describe("githubActionsProvider.verifyWebhookSignature", () => {
  it("accepts a correctly signed payload", () => {
    const payload = JSON.stringify({ hello: "world" });
    const result = githubActionsProvider.verifyWebhookSignature({
      payload,
      headers: { "x-hub-signature-256": sign(payload) },
      secret: SECRET,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a payload signed with the wrong secret (spoofing attempt)", () => {
    const payload = JSON.stringify({ hello: "world" });
    const result = githubActionsProvider.verifyWebhookSignature({
      payload,
      headers: { "x-hub-signature-256": sign(payload, "wrong-secret") },
      secret: SECRET,
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a tampered payload whose signature no longer matches", () => {
    const original = JSON.stringify({ amount: 10 });
    const tampered = JSON.stringify({ amount: 10000 });
    const result = githubActionsProvider.verifyWebhookSignature({
      payload: tampered,
      headers: { "x-hub-signature-256": sign(original) },
      secret: SECRET,
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a request with no signature header at all", () => {
    const result = githubActionsProvider.verifyWebhookSignature({
      payload: "{}",
      headers: {},
      secret: SECRET,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/missing/i);
  });

  it("rejects a signature of the wrong length without throwing", () => {
    const result = githubActionsProvider.verifyWebhookSignature({
      payload: "{}",
      headers: { "x-hub-signature-256": "sha256=short" },
      secret: SECRET,
    });
    expect(result.valid).toBe(false);
  });
});

describe("githubActionsProvider.getEventId", () => {
  it("extracts the X-GitHub-Delivery header as the idempotency key", () => {
    const id = githubActionsProvider.getEventId({ "x-github-delivery": "abc-123" }, {});
    expect(id).toBe("abc-123");
  });

  it("returns null when the header is absent", () => {
    expect(githubActionsProvider.getEventId({}, {})).toBeNull();
  });
});

describe("githubActionsProvider.normalizeWebhookPayload", () => {
  it("normalizes a workflow_run completed/failure event", () => {
    const event = githubActionsProvider.normalizeWebhookPayload("workflow_run", {
      repository: { id: 42 },
      workflow_run: {
        id: 100,
        workflow_id: 5,
        name: "CI",
        run_number: 7,
        status: "completed",
        conclusion: "failure",
        head_branch: "main",
        head_sha: "abc123",
        event: "push",
      },
    });
    expect(event).not.toBeNull();
    expect(event?.repositoryExternalId).toBe("42");
    expect(event?.run?.conclusion).toBe("failure");
    expect(event?.run?.runNumber).toBe(7);
  });

  it("returns null for a payload with no repository id (malformed/unroutable)", () => {
    const event = githubActionsProvider.normalizeWebhookPayload("workflow_run", { workflow_run: {} });
    expect(event).toBeNull();
  });

  it("returns null for event types it doesn't model, instead of throwing", () => {
    const event = githubActionsProvider.normalizeWebhookPayload("star", { repository: { id: 1 } });
    expect(event).toBeNull();
  });
});
