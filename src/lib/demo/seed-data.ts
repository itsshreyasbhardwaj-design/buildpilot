import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { redact } from "@/lib/security/redact";
import { localAnalyzer } from "@/lib/providers/ai/local-analyzer";
import { computeFlakyScore } from "@/lib/scoring/flaky";
import { analyzeWorkflowYaml } from "@/lib/optimizer/analyze";
import { WEB_APP_CI_YAML, API_SERVICE_CI_YAML, DATA_PIPELINE_CI_YAML } from "@/lib/optimizer/workflow-fixtures";
import { FAILURE_FIXTURES, PASSING_LOG, type FailureFixture } from "./log-fixtures";

const DAY_MS = 24 * 60 * 60 * 1000;
const COMMIT_COUNT = 30;

interface RepoSeedConfig {
  owner: string;
  name: string;
  externalId: string;
  jobNames: string[];
  testPool: string[];
  flakyTests: string[];
  brokenTest: string | null;
  commitFilePool: string[];
  commitMessages: string[];
  ciYaml: string;
}

const REPOS: RepoSeedConfig[] = [
  {
    owner: "acme",
    name: "web-app",
    externalId: "demo-100001",
    jobNames: ["lint", "build", "test"],
    testPool: [
      "BuildCard renders status badge",
      "Dashboard fetches build metrics",
      "FailureTimeline renders evidence nodes",
      "CommandPalette opens on cmd+k",
      "ThemeToggle switches between light and dark",
      "RepoSwitcher lists connected repositories",
      "FlakyTestTable sorts by score",
      "RecommendationCard renders diff",
      "BuildCard renders failure badge when conclusion is failure",
      "Sidebar highlights active route",
      "StatTile formats duration",
      "LoginPage starts a demo session",
    ],
    flakyTests: ["FailureTimeline renders evidence nodes", "CommandPalette opens on cmd+k"],
    brokenTest: "BuildCard renders failure badge when conclusion is failure",
    commitFilePool: ["src/app/dashboard/page.tsx", "src/components/BuildCard.tsx", "src/lib/hooks/use-builds.ts", "src/app/globals.css"],
    commitMessages: [
      "feat: add failure timeline evidence panel",
      "fix: correct build duration formatting",
      "chore: bump dependencies",
      "refactor: extract StatTile component",
      "feat: command palette repo switcher",
      "fix: dark mode contrast on badges",
      "test: cover BuildCard status variants",
      "perf: memoize dashboard queries",
    ],
    ciYaml: WEB_APP_CI_YAML,
  },
  {
    owner: "acme",
    name: "api-service",
    externalId: "demo-100002",
    jobNames: ["build", "test"],
    testPool: [
      "POST /webhooks/github verifies signature",
      "GET /api/builds paginates results",
      "Queue retries failed jobs with backoff",
      "Rate limiter resets after window",
      "Event ingestion is idempotent on retry",
      "Failure analysis redacts secrets before storage",
      "Flaky score requires minimum evidence",
      "Auth middleware rejects expired sessions",
      "Recommendation approval writes audit log",
      "Webhook route rejects invalid signatures",
    ],
    flakyTests: ["Queue retries failed jobs with backoff", "Rate limiter resets after window"],
    brokenTest: null,
    commitFilePool: ["src/routes/webhooks.ts", "src/queue/worker.ts", "src/db/schema.ts", "package.json"],
    commitMessages: [
      "feat: add CircleCI webhook route",
      "fix: dedupe events by delivery id",
      "chore: upgrade prisma to v7",
      "perf: batch job status updates",
      "fix: correct backoff exponent",
      "test: add idempotency regression test",
      "refactor: split queue worker into handlers",
    ],
    ciYaml: API_SERVICE_CI_YAML,
  },
  {
    owner: "acme",
    name: "data-pipeline",
    externalId: "demo-100003",
    jobNames: ["build", "test"],
    testPool: [
      "test_dedupe_events",
      "test_flaky_score_threshold",
      "test_redact_secrets",
      "test_partition_rebalance",
      "test_upstream_api_backoff",
      "test_schema_migration_forward",
      "test_commit_diff_parser",
      "test_aggregate_daily_rollup",
    ],
    flakyTests: ["test_upstream_api_backoff", "test_partition_rebalance"],
    brokenTest: null,
    commitFilePool: ["pipeline/ingest.py", "pipeline/transform.py", "requirements.txt", "pipeline/schema.py"],
    commitMessages: [
      "feat: add daily rollup aggregation job",
      "fix: handle upstream 429 with backoff",
      "chore: pin pandas version",
      "refactor: split transform into stages",
      "test: cover partition rebalance edge case",
      "fix: schema migration ordering",
    ],
    ciYaml: DATA_PIPELINE_CI_YAML,
  },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickFixtureForJobs(jobNames: string[]): FailureFixture {
  const candidates = FAILURE_FIXTURES.filter((f) => jobNames.includes(f.jobName));
  return pick(candidates.length > 0 ? candidates : FAILURE_FIXTURES);
}

async function seedRepo(organizationId: string, config: RepoSeedConfig) {
  const repository = await db.repository.create({
    data: {
      organizationId,
      provider: "github",
      externalId: config.externalId,
      owner: config.owner,
      name: config.name,
      defaultBranch: "main",
      private: false,
      demo: true,
      analysis: { packageManager: config.name === "data-pipeline" ? "pip" : "pnpm", ciConfigPath: `.github/workflows/ci.yml` },
    },
  });

  const mainBranch = await db.branch.create({ data: { repositoryId: repository.id, name: "main", isDefault: true } });
  const ciWorkflow = await db.workflow.create({
    data: {
      repositoryId: repository.id,
      provider: "github",
      externalId: "ci.yml",
      name: "CI",
      path: ".github/workflows/ci.yml",
      definition: config.ciYaml,
    },
  });
  const deployWorkflow = await db.workflow.create({
    data: { repositoryId: repository.id, provider: "github", externalId: "deploy.yml", name: "Deploy", path: ".github/workflows/deploy.yml" },
  });

  // Real static analysis over the workflow YAML, not seeded numbers — same
  // analyzeWorkflowYaml() the Recommendations page would call on a real repo.
  const optimizerFindings = analyzeWorkflowYaml(config.ciYaml, ".github/workflows/ci.yml");
  for (const finding of optimizerFindings) {
    await db.recommendation.create({
      data: {
        repositoryId: repository.id,
        kind: finding.kind,
        title: finding.title,
        description: finding.description,
        diff: finding.diff,
        filePath: finding.filePath,
        impactEstimate: finding.impactEstimate ?? undefined,
      },
    });
  }

  // testHistory[fullName] = chronological outcomes, used to compute real flaky scores afterward.
  const testHistory = new Map<string, ("passed" | "failed")[]>();
  const testDurations = new Map<string, number[]>();
  for (const name of config.testPool) {
    testHistory.set(name, []);
    testDurations.set(name, []);
  }

  const commitMessages: string[] = [];
  const jobFailureCounts: Record<string, number> = {};
  let successfulRunCount = 0;
  let lastDeployment: { id: string } | null = null;

  const now = Date.now();
  for (let i = 0; i < COMMIT_COUNT; i++) {
    const committedAt = new Date(now - (COMMIT_COUNT - i) * DAY_MS + Math.floor(Math.random() * DAY_MS * 0.6));
    const message = pick(config.commitMessages) + (Math.random() < 0.3 ? ` (#${100 + i})` : "");
    commitMessages.unshift(message);
    const changedFiles = [pick(config.commitFilePool), ...(Math.random() < 0.3 ? [pick(config.commitFilePool)] : [])];

    const commit = await db.commit.create({
      data: {
        repositoryId: repository.id,
        sha: randomBytes(20).toString("hex"),
        message: redact(message),
        authorName: pick(["Ada Chen", "Marcus Reed", "Priya Nair", "Sam Okafor"]),
        authorEmail: "eng@acme-demo.dev",
        changedFiles: JSON.stringify(changedFiles),
        committedAt,
      },
    });

    const willFail = Math.random() < 0.18;
    const fixture = willFail ? pickFixtureForJobs(config.jobNames) : null;
    const startedAt = new Date(committedAt.getTime() + 20_000);
    const durationMs = (willFail ? 60 : 90) * 1000 + Math.floor(Math.random() * 180_000);
    const completedAt = new Date(startedAt.getTime() + durationMs);

    const run = await db.workflowRun.create({
      data: {
        repositoryId: repository.id,
        workflowId: ciWorkflow.id,
        branchId: mainBranch.id,
        commitId: commit.id,
        externalId: `run-${config.externalId}-${i}`,
        runNumber: i + 1,
        status: "completed",
        conclusion: willFail ? "failure" : "success",
        triggeredBy: pick(["ada", "marcus", "priya", "sam"]),
        event: "push",
        queuedAt: committedAt,
        startedAt,
        completedAt,
        durationMs,
      },
    });

    for (const jobName of config.jobNames) {
      const jobFails = willFail && fixture!.jobName === jobName;
      const jobStart = new Date(startedAt.getTime() + config.jobNames.indexOf(jobName) * 5000);
      const jobDuration = Math.floor(durationMs / config.jobNames.length);
      const jobEnd = new Date(jobStart.getTime() + jobDuration);

      const job = await db.job.create({
        data: {
          workflowRunId: run.id,
          externalId: `${run.externalId}-${jobName}`,
          name: jobName,
          status: "completed",
          conclusion: jobFails ? "failure" : "success",
          startedAt: jobStart,
          completedAt: jobEnd,
          durationMs: jobDuration,
          runnerLabel: "ubuntu-latest",
        },
      });

      const steps = ["checkout", "install dependencies", `run ${jobName}`];
      for (let s = 0; s < steps.length; s++) {
        const isLastStep = s === steps.length - 1;
        await db.step.create({
          data: {
            jobId: job.id,
            name: steps[s],
            number: s + 1,
            status: "completed",
            conclusion: isLastStep && jobFails ? "failure" : "success",
            startedAt: jobStart,
            completedAt: jobEnd,
            logExcerpt: isLastStep ? redact(jobFails ? fixture!.log : PASSING_LOG) : null,
          },
        });
      }

      if (jobName === "test") {
        for (const name of config.testPool) {
          let status: "passed" | "failed" = "passed";
          if (config.brokenTest === name && jobFails && fixture!.category === "test") {
            status = "failed";
          } else if (config.flakyTests.includes(name)) {
            status = Math.random() < 0.32 ? "failed" : "passed";
          }
          const durationMs = 20 + Math.floor(Math.random() * 400);
          testHistory.get(name)!.push(status);
          testDurations.get(name)!.push(durationMs);
          await db.testResult.create({
            data: {
              jobId: job.id,
              suite: config.name,
              name,
              fullName: name,
              status,
              durationMs,
              message: status === "failed" ? "AssertionError: expected 'success' to equal 'failure'" : null,
              ranAt: jobEnd,
            },
          });
        }
      }

      if (jobFails) {
        const failure = await db.failure.create({ data: { workflowRunId: run.id, jobId: job.id } });
        const previousSimilarFailureCount = jobFailureCounts[jobName] ?? 0;
        jobFailureCounts[jobName] = previousSimilarFailureCount + 1;

        const analysis = await localAnalyzer.analyzeFailure({
          workflowName: ciWorkflow.name,
          jobName,
          logExcerpt: fixture!.log,
          changedFiles: fixture!.changedFiles,
          recentCommitMessages: commitMessages.slice(0, 5),
          relatedTestFailures:
            fixture!.category === "test" && config.brokenTest
              ? [{ name: config.brokenTest, message: "AssertionError: expected 'success' to equal 'failure'" }]
              : [],
          previousSimilarFailureCount,
        });

        await db.failure.update({
          where: { id: failure.id },
          data: { category: analysis.category, errorMessage: analysis.rootCause, evidence: fixture!.log.slice(0, 4000) },
        });
        await db.aIAnalysis.create({
          data: {
            workflowRunId: run.id,
            failureId: failure.id,
            provider: analysis.provider,
            rootCause: analysis.rootCause,
            whyItFailed: analysis.whyItFailed,
            whatChanged: analysis.whatChanged,
            likelyFix: analysis.likelyFix,
            confidence: analysis.confidence,
            relevantFiles: JSON.stringify(analysis.relevantFiles),
            evidence: JSON.stringify(analysis.evidence),
            recommendedAction: analysis.recommendedAction,
          },
        });
      }
    }

    if (!willFail) {
      successfulRunCount += 1;
      if (successfulRunCount % 4 === 0) {
        const deployRun = await db.workflowRun.create({
          data: {
            repositoryId: repository.id,
            workflowId: deployWorkflow.id,
            branchId: mainBranch.id,
            commitId: commit.id,
            externalId: `deploy-${config.externalId}-${i}`,
            runNumber: Math.floor(successfulRunCount / 4),
            status: "completed",
            conclusion: "success",
            event: "workflow_run",
            startedAt: completedAt,
            completedAt: new Date(completedAt.getTime() + 90_000),
            durationMs: 90_000,
          },
        });
        const deployFails = Math.random() < 0.08;
        const deployment = await db.deployment.create({
          data: {
            repositoryId: repository.id,
            workflowRunId: deployRun.id,
            environment: "production",
            status: deployFails ? "failure" : "success",
            version: commit.sha.slice(0, 7),
            startedAt: completedAt,
            completedAt: new Date(completedAt.getTime() + 90_000),
            durationMs: 90_000,
          },
        });
        if (deployFails && lastDeployment) {
          await db.deployment.create({
            data: {
              repositoryId: repository.id,
              environment: "production",
              status: "success",
              version: `rollback-to-${lastDeployment.id.slice(0, 6)}`,
              isRollback: true,
              rolledBackFromId: deployment.id,
              startedAt: new Date(completedAt.getTime() + 91_000),
              completedAt: new Date(completedAt.getTime() + 150_000),
              durationMs: 59_000,
            },
          });
        } else {
          lastDeployment = deployment;
        }
      }
    }
  }

  // Compute real flaky scores from the outcome history we just generated —
  // same computeFlakyScore() the flaky-tests dashboard uses, not seeded numbers.
  for (const [fullName, outcomes] of testHistory) {
    const totalRuns = outcomes.length;
    const failCount = outcomes.filter((o) => o === "failed").length;
    const passCount = totalRuns - failCount;
    let transitionCount = 0;
    for (let i = 1; i < outcomes.length; i++) if (outcomes[i] !== outcomes[i - 1]) transitionCount++;

    const result = computeFlakyScore({ totalRuns, failCount, passCount, transitionCount });
    const durations = testDurations.get(fullName) ?? [];
    const avgDurationMs = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;
    await db.flakyTestScore.create({
      data: {
        repositoryId: repository.id,
        fullName,
        totalRuns,
        failCount,
        passCount,
        transitionCount,
        score: result.score,
        isFlaky: result.isFlaky,
        lastFailureAt: failCount > 0 ? new Date() : null,
        avgDurationMs,
        affectedBranches: JSON.stringify(["main"]),
      },
    });
  }

  // A handful of pull requests with a lightweight, real (not fabricated) risk summary.
  for (let p = 0; p < 4; p++) {
    const changedFiles = [pick(config.commitFilePool), pick(config.commitFilePool)];
    const testsAffected = Math.floor(Math.random() * 6);
    const riskLevel = testsAffected > 3 ? "high" : testsAffected > 1 ? "medium" : "low";
    await db.pullRequest.create({
      data: {
        repositoryId: repository.id,
        number: 200 + p,
        title: pick(config.commitMessages),
        authorLogin: pick(["ada", "marcus", "priya", "sam"]),
        state: p === 0 ? "open" : "merged",
        baseBranch: "main",
        headBranch: `feature/${config.name}-${200 + p}`,
        riskSummary: {
          ciImpact: riskLevel === "high" ? "Likely to affect multiple CI jobs" : "Localized to a single job",
          testsAffected,
          riskLevel,
          dependencyChanges: changedFiles.some((f) => f.includes("package.json") || f.includes("requirements.txt")),
          notes: `${changedFiles.length} file(s) changed across ${new Set(changedFiles).size} area(s).`,
        },
      },
    });
  }

  return repository;
}

export async function seedDemoData(): Promise<void> {
  const organization = await db.organization.create({
    data: { name: "Acme Corp (Demo)", slug: "demo", demo: true },
  });
  const user = await db.user.create({
    data: { email: "demo@buildpilot.dev", name: "Demo User" },
  });
  await db.membership.create({ data: { organizationId: organization.id, userId: user.id, role: "owner" } });

  for (const repoConfig of REPOS) {
    await seedRepo(organization.id, repoConfig);
  }

  await db.auditLog.create({
    data: {
      organizationId: organization.id,
      userId: user.id,
      action: "demo.seeded",
      metadata: { repos: REPOS.length, commitsPerRepo: COMMIT_COUNT },
    },
  });
}

export async function ensureDemoData(): Promise<{ organizationId: string; userId: string }> {
  const existing = await db.organization.findFirst({ where: { demo: true }, include: { members: true } });
  if (existing && existing.members[0]) {
    return { organizationId: existing.id, userId: existing.members[0].userId };
  }
  await seedDemoData();
  const org = await db.organization.findFirstOrThrow({ where: { demo: true }, include: { members: true } });
  return { organizationId: org.id, userId: org.members[0].userId };
}
