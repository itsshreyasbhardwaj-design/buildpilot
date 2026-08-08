import { db } from "@/lib/db";
import type { EnqueueOptions, JobHandler, QueueProvider } from "./types";

const POLL_INTERVAL_MS = 500;
const BATCH_SIZE = 5;

class LocalQueue implements QueueProvider {
  readonly id = "local-sqlite";
  private handlers = new Map<string, JobHandler<unknown>>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private processing = false;

  async enqueue<T>(queue: string, payload: T, options?: EnqueueOptions): Promise<string> {
    const availableAt = options?.delayMs ? new Date(Date.now() + options.delayMs) : new Date();
    const job = await db.queueJob.create({
      data: {
        queue,
        payload: payload as object,
        maxAttempts: options?.maxAttempts ?? 3,
        availableAt,
      },
    });
    return job.id;
  }

  registerWorker<T>(queue: string, handler: JobHandler<T>): void {
    this.handlers.set(queue, handler as JobHandler<unknown>);
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, POLL_INTERVAL_MS);
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    // Let an in-flight batch finish rather than tearing down mid-job.
    while (this.processing) await new Promise((r) => setTimeout(r, 25));
  }

  private async tick(): Promise<void> {
    if (this.processing || this.handlers.size === 0) return;
    this.processing = true;
    try {
      for (const [queue, handler] of this.handlers) {
        const jobs = await db.queueJob.findMany({
          where: { queue, status: "pending", availableAt: { lte: new Date() } },
          orderBy: { createdAt: "asc" },
          take: BATCH_SIZE,
        });

        for (const job of jobs) {
          // Optimistic claim: only proceed if this process is the one that
          // flipped pending -> processing. Guards against two ticks (or two
          // instances, if ever run concurrently) racing the same row.
          const claimed = await db.queueJob.updateMany({
            where: { id: job.id, status: "pending" },
            data: { status: "processing", lockedAt: new Date() },
          });
          if (claimed.count === 0) continue;

          try {
            await handler(job.payload);
            await db.queueJob.update({ where: { id: job.id }, data: { status: "completed" } });
          } catch (err) {
            const attempts = job.attempts + 1;
            const failed = attempts >= job.maxAttempts;
            await db.queueJob.update({
              where: { id: job.id },
              data: {
                attempts,
                status: failed ? "failed" : "pending",
                error: err instanceof Error ? err.message : String(err),
                // Exponential backoff before the next attempt.
                availableAt: failed ? job.availableAt : new Date(Date.now() + 2 ** attempts * 1000),
              },
            });
          }
        }
      }
    } finally {
      this.processing = false;
    }
  }
}

let instance: LocalQueue | null = null;

export function getLocalQueue(): LocalQueue {
  if (!instance) instance = new LocalQueue();
  return instance;
}
