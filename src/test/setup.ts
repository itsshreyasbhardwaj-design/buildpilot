// Runs before every test file. Environment variables for the test run are
// set in vitest.config.ts's `test.env` (must be set before src/lib/db.ts is
// imported by any test, which setupFiles guarantees). This file exists for
// setup that needs actual code, not just env vars.
export {};
