import { getQueueProvider } from "@/lib/providers/queue/registry";
import { ANALYZE_FAILURE_QUEUE, INGEST_EVENT_QUEUE } from "@/lib/ingestion/queue-contracts";
import type { AnalyzeFailurePayload, IngestEventPayload } from "@/lib/ingestion/queue-contracts";
import { handleIngestEvent } from "./workers/ingest-event";
import { handleAnalyzeFailure } from "./workers/analyze-failure";

let started = false;

/** Registers every background worker and starts the queue. Idempotent — safe to call from instrumentation.ts and hot-reloaded modules alike. */
export function bootstrapQueue(): void {
  if (started) return;
  started = true;

  const queue = getQueueProvider();
  queue.registerWorker<IngestEventPayload>(INGEST_EVENT_QUEUE, handleIngestEvent);
  queue.registerWorker<AnalyzeFailurePayload>(ANALYZE_FAILURE_QUEUE, handleAnalyzeFailure);
  queue.start();
}
