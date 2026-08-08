// Realistic, hand-crafted log excerpts, one per failure category recognized
// by the local deterministic AI analyzer (src/lib/providers/ai/local-analyzer.ts).
// Demo seeding runs these through the REAL analyzer — not canned JSON — so
// what you see in the dashboard is the same engine that runs in production,
// just fed synthetic input. See docs/DEMO_MODE.md.

export interface FailureFixture {
  category: "oom" | "timeout" | "dependency" | "syntax" | "config" | "infra" | "test";
  jobName: string;
  log: string;
  changedFiles: string[];
}

export const FAILURE_FIXTURES: FailureFixture[] = [
  {
    category: "oom",
    jobName: "test",
    changedFiles: ["src/lib/analytics/aggregate.ts", "src/lib/analytics/rollup.test.ts"],
    log: [
      "Running test suite (jest --maxWorkers=8)...",
      "<--- Last few GCs --->",
      "[12345:0x104800000]    52012 ms: Scavenge 2040.0 (2050.7) -> 2038.2 (2051.7) MB",
      "[12345:0x104800000]    53877 ms: Mark-sweep 2048.9 (2059.4) -> 2046.1 (2060.9) MB",
      "",
      "<--- JS stacktrace --->",
      "FATAL ERROR: JavaScript heap out of memory",
      " 1: 0xb01ff0 node::Abort() [node]",
      " 2: 0xa2118c node::FatalError(char const*, char const*) [node]",
      "Error: Process completed with exit code 134.",
    ].join("\n"),
  },
  {
    category: "timeout",
    jobName: "test",
    changedFiles: ["src/server/db/pool.ts"],
    log: [
      "Running integration tests against the staging database...",
      "  ✓ creates a workflow run (212 ms)",
      "  ✓ lists jobs for a run (98 ms)",
      "Timeout of 30000 ms exceeded waiting for the database connection.",
      "##[error]The job running on runner ubuntu-latest-4-core has timed out after 30 minutes.",
    ].join("\n"),
  },
  {
    category: "dependency",
    jobName: "build",
    changedFiles: ["package.json", "pnpm-lock.yaml"],
    log: [
      "Installing dependencies with pnpm...",
      "npm ERR! code ERESOLVE",
      "npm ERR! ERESOLVE unable to resolve dependency tree",
      "npm ERR!",
      "npm ERR! While resolving: web-app@0.4.2",
      "npm ERR! Found: react@18.3.1",
      "npm ERR! node_modules/react",
      "npm ERR!   peer react@^19.0.0 from @radix-ui/react-slot@1.3.3",
      "npm ERR! Could not resolve dependency:",
      "npm ERR! peer react@\"^19.0.0\" from @radix-ui/react-slot@1.3.3",
    ].join("\n"),
  },
  {
    category: "syntax",
    jobName: "build",
    changedFiles: ["src/components/BuildCard.tsx"],
    log: [
      "Compiling TypeScript (tsc --noEmit)...",
      "src/components/BuildCard.tsx(42,18): error TS2304: Cannot find name 'workflowRunn'.",
      "src/components/BuildCard.tsx(58,3): error TS1005: ';' expected.",
      "SyntaxError: Unexpected token ')'",
      "Build failed with 2 errors.",
    ].join("\n"),
  },
  {
    category: "config",
    jobName: "build",
    changedFiles: [".github/workflows/ci.yml"],
    log: [
      "Evaluating workflow file...",
      "##[error]Invalid workflow file: .github/workflows/ci.yml#L14",
      "The workflow is not valid. .github/workflows/ci.yml (Line: 14, Col: 5): Unrecognized named-value: 'secretss'. Located at position 1 within expression: secretss.NPM_TOKEN",
    ].join("\n"),
  },
  {
    category: "infra",
    jobName: "build",
    changedFiles: ["src/index.ts"],
    log: [
      "Cloning repository...",
      "fatal: unable to access 'https://github.com/acme/web-app.git/': Could not resolve host: github.com",
      "Retrying dependency install...",
      "Error: connection refused while fetching from registry.npmjs.org",
      "getaddrinfo ENOTFOUND registry.npmjs.org",
    ].join("\n"),
  },
  {
    category: "test",
    jobName: "test",
    changedFiles: ["src/components/BuildCard.tsx", "src/components/BuildCard.test.tsx"],
    log: [
      "PASS src/components/StatTile.test.tsx",
      "FAIL src/components/BuildCard.test.tsx",
      "  BuildCard",
      "    ✕ renders failure badge when conclusion is failure (14 ms)",
      "",
      "  ● BuildCard › renders failure badge when conclusion is failure",
      "",
      "    AssertionError: expected 'success' to equal 'failure'",
      "",
      "Tests: 1 failed, 42 passed, 43 total",
    ].join("\n"),
  },
];

export const PASSING_LOG = ["Installing dependencies...", "Running build...", "Running tests...", "All checks passed."].join("\n");
