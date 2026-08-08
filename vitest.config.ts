import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Test files share one SQLite file (prisma/test.db); running them
    // concurrently lets one file's cleanup delete rows another file just
    // created mid-test. Sequential execution trades some speed for
    // correctness here rather than sharding the DB per file.
    fileParallelism: false,
    setupFiles: ["./src/test/setup.ts"],
    env: {
      DATABASE_URL: "file:./prisma/test.db",
      AUTH_SECRET: "test-secret-do-not-use-in-production",
      WEBHOOK_SECRET_GITHUB: "test-github-webhook-secret",
      WEBHOOK_SECRET_GITLAB: "test-gitlab-webhook-secret",
      WEBHOOK_SECRET_CIRCLECI: "test-circleci-webhook-secret",
      GITHUB_APP_TOKEN: "test-github-app-token",
    },
  },
});
