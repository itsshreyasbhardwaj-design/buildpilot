import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCIProvider, isCIProviderId } from "@/lib/providers/ci/registry";
import { getQueueProvider } from "@/lib/providers/queue/registry";
import { redact } from "@/lib/security/redact";
import { INGEST_EVENT_QUEUE, type IngestEventPayload } from "@/lib/ingestion/queue-contracts";

function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key] = value;
  });
  return record;
}

function webhookSecretFor(provider: string): string | undefined {
  const key = `WEBHOOK_SECRET_${provider.toUpperCase()}`;
  return process.env[key];
}

function eventTypeHeaderFor(provider: string, headers: Record<string, string>): string {
  if (provider === "github") return headers["x-github-event"] ?? "unknown";
  if (provider === "gitlab") return headers["x-gitlab-event"] ?? "unknown";
  return "unknown"; // CircleCI carries its event type in the payload body instead of a header.
}

/**
 * Single entry point for all CI provider webhooks. Verifies the signature,
 * dedupes by the provider's own delivery id, persists the raw event, and
 * enqueues async processing — this handler does no CI-domain work itself so
 * it stays fast regardless of payload size or provider. See
 * docs/ARCHITECTURE.md#event-pipeline and docs/SECURITY.md#webhook-verification.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  const { provider: providerParam } = await context.params;

  if (!isCIProviderId(providerParam)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  const secret = webhookSecretFor(providerParam);
  if (!secret) {
    // Fail closed: an unconfigured secret must never be treated as "skip verification."
    return NextResponse.json({ error: "Webhook receiver is not configured for this provider" }, { status: 503 });
  }

  const rawBody = await request.text();
  const headers = headersToRecord(request.headers);
  const provider = getCIProvider(providerParam);

  const verification = provider.verifyWebhookSignature({ payload: rawBody, headers, secret });
  if (!verification.valid) {
    return NextResponse.json({ error: "Invalid signature", reason: verification.reason }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const externalId = provider.getEventId(headers, payload);
  if (!externalId) {
    return NextResponse.json({ error: "Could not determine an idempotency key for this delivery" }, { status: 400 });
  }

  const eventType = eventTypeHeaderFor(providerParam, headers);

  // Defensively redact before persisting — commit messages and similar free-text
  // fields in a webhook payload can (accidentally) contain secrets. See docs/AI_SAFETY.md.
  const redactedPayload = JSON.parse(redact(JSON.stringify(payload)));

  try {
    const event = await db.event.create({
      data: {
        provider: providerParam,
        type: eventType,
        externalId,
        signatureValid: true,
        payload: redactedPayload,
      },
    });

    const queue = getQueueProvider();
    const enqueuePayload: IngestEventPayload = { eventId: event.id };
    await queue.enqueue(INGEST_EVENT_QUEUE, enqueuePayload);

    return NextResponse.json({ status: "accepted", eventId: event.id }, { status: 202 });
  } catch (err) {
    // Unique constraint on (provider, externalId) — this is a retried delivery.
    // Treat it as a successful no-op rather than an error, per at-least-once semantics.
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      return NextResponse.json({ status: "duplicate" }, { status: 200 });
    }
    throw err;
  }
}
