// Background job queue abstraction. The spec calls for Trigger.dev/Redis;
// this machine has neither available and the $0/mock-first policy rules out
// signing up for a hosted queue just to run BuildPilot locally. The local
// implementation is durable (SQLite-backed, survives dev-server restarts) and
// satisfies the same interface a real BullMQ/Trigger.dev adapter would, so
// swapping in a real backend later is a one-file change.
//
// This is also *why* webhook routes must never do long-running work inline
// (see docs/ARCHITECTURE.md#event-pipeline): the queue boundary is what keeps
// a webhook response fast regardless of which backend is behind it.

export interface EnqueueOptions {
  maxAttempts?: number;
  /** Delay before the job becomes eligible to run, in milliseconds. */
  delayMs?: number;
}

export type JobHandler<T = unknown> = (payload: T) => Promise<void>;

export interface QueueProvider {
  readonly id: string;
  enqueue<T>(queue: string, payload: T, options?: EnqueueOptions): Promise<string>;
  registerWorker<T>(queue: string, handler: JobHandler<T>): void;
  /** Start processing registered workers. No-op for request/response-driven backends. */
  start(): void;
  stop(): Promise<void>;
}
