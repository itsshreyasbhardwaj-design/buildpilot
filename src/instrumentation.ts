export async function register() {
  // Only the Node.js server runtime can run our SQLite-backed queue worker —
  // there's no edge-compatible equivalent, and none is needed here.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { bootstrapQueue } = await import("@/lib/queue/bootstrap");
    bootstrapQueue();
  }
}
