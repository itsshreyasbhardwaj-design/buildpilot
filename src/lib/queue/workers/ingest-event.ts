import { db } from "@/lib/db";
import { getCIProvider, isCIProviderId } from "@/lib/providers/ci/registry";
import { ingestNormalizedEvent } from "@/lib/ingestion/normalize";
import type { IngestEventPayload } from "@/lib/ingestion/queue-contracts";

export async function handleIngestEvent(payload: IngestEventPayload): Promise<void> {
  const event = await db.event.findUnique({ where: { id: payload.eventId } });
  if (!event) return; // already gone (shouldn't happen, but idempotent by design)

  await db.event.update({ where: { id: event.id }, data: { status: "processing" } });

  try {
    if (!isCIProviderId(event.provider)) {
      throw new Error(`Unknown provider on event ${event.id}: ${event.provider}`);
    }
    const provider = getCIProvider(event.provider);
    const normalized = provider.normalizeWebhookPayload(event.type, event.payload);

    if (!normalized) {
      await db.event.update({ where: { id: event.id }, data: { status: "processed", processedAt: new Date() } });
      return;
    }

    const repository = await db.repository.findUnique({
      where: { provider_externalId: { provider: event.provider, externalId: normalized.repositoryExternalId } },
    });

    if (!repository) {
      await db.event.update({
        where: { id: event.id },
        data: { status: "failed", error: "Repository is not connected to any organization.", processedAt: new Date() },
      });
      return;
    }

    await ingestNormalizedEvent(repository.id, normalized);
    await db.event.update({
      where: { id: event.id },
      data: { status: "processed", processedAt: new Date(), repositoryId: repository.id },
    });
  } catch (err) {
    await db.event.update({
      where: { id: event.id },
      data: { status: "failed", error: err instanceof Error ? err.message : String(err), processedAt: new Date() },
    });
    throw err; // let the queue's retry/backoff policy handle it
  }
}
