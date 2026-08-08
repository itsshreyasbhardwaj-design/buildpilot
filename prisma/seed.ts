import { ensureDemoData } from "../src/lib/demo/seed-data";

// Idempotent — safe to run more than once against the same database (e.g.
// `pnpm test:e2e` runs this as an automatic npm pre-hook; running it twice
// in a row, or re-running `pnpm db:seed` on an already-seeded dev database,
// is a no-op rather than a unique-constraint crash). To force a full
// re-seed, reset the database first (`pnpm db:reset`).
ensureDemoData()
  .then(() => {
    console.log("Demo data ready.");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
