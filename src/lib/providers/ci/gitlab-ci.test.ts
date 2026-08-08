import { describe, it, expect } from "vitest";
import { gitlabCiProvider } from "./gitlab-ci";

const SECRET = "test-gitlab-secret";

describe("gitlabCiProvider.verifyWebhookSignature", () => {
  it("accepts a request whose token matches the configured secret", () => {
    const result = gitlabCiProvider.verifyWebhookSignature({
      payload: "{}",
      headers: { "x-gitlab-token": SECRET },
      secret: SECRET,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a request with the wrong token (spoofing attempt)", () => {
    const result = gitlabCiProvider.verifyWebhookSignature({
      payload: "{}",
      headers: { "x-gitlab-token": "wrong-token" },
      secret: SECRET,
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a request with no token header", () => {
    const result = gitlabCiProvider.verifyWebhookSignature({ payload: "{}", headers: {}, secret: SECRET });
    expect(result.valid).toBe(false);
  });
});

describe("gitlabCiProvider.normalizeWebhookPayload", () => {
  it("normalizes a pipeline event into a run", () => {
    const event = gitlabCiProvider.normalizeWebhookPayload("Pipeline Hook", {
      object_kind: "pipeline",
      object_attributes: { id: 55, status: "failed", ref: "main", sha: "deadbeef", source: "push" },
      project: { id: 9 },
      builds: [{ id: 1, name: "test", status: "failed" }],
    });
    expect(event?.repositoryExternalId).toBe("9");
    expect(event?.run?.conclusion).toBe("failure");
    expect(event?.run?.jobs).toHaveLength(1);
  });

  it("returns null when there is no project id", () => {
    const event = gitlabCiProvider.normalizeWebhookPayload("Pipeline Hook", { object_kind: "pipeline" });
    expect(event).toBeNull();
  });
});

describe("gitlabCiProvider.getEventId", () => {
  it("derives an idempotency key from pipeline id + status when no delivery header exists", () => {
    const id = gitlabCiProvider.getEventId({}, { object_attributes: { id: 55, status: "failed" } });
    expect(id).toBe("pipeline:55:failed");
  });

  it("falls back to a payload hash when there is no pipeline id at all", () => {
    const id = gitlabCiProvider.getEventId({}, { some: "payload" });
    expect(id).toMatch(/^hash:/);
  });
});
