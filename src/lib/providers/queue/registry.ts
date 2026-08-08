import type { QueueProvider } from "./types";
import { getLocalQueue } from "./local-queue";

/**
 * Defaults to the local SQLite-backed queue. A real deployment sets
 * QUEUE_PROVIDER=bullmq (+ REDIS_URL) or wires a Trigger.dev adapter here —
 * this function is the only place that decision is made.
 */
export function getQueueProvider(): QueueProvider {
  if (process.env.QUEUE_PROVIDER === "bullmq") {
    throw new Error(
      "QUEUE_PROVIDER=bullmq requires REDIS_URL and the bullmq package, neither of which are installed in " +
        "this $0/local setup. Implement src/lib/providers/queue/bullmq.ts and install bullmq/ioredis to enable it."
    );
  }
  return getLocalQueue();
}

export * from "./types";
