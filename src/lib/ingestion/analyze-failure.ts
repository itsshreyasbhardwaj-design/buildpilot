import { db } from "@/lib/db";
import { getAIProvider } from "@/lib/providers/ai/registry";
import type { FailureAnalysisInput, FailureAnalysisResult } from "@/lib/providers/ai/types";

/**
 * Runs AI failure analysis for one Failure row and persists the result.
 * Shared by the background queue worker (automatic analysis on ingestion)
 * and the on-demand REST/MCP `analyze_failure` entry point — both need the
 * exact same evidence-gathering and persistence logic, just triggered
 * differently.
 */
export async function analyzeFailureById(failureId: string): Promise<FailureAnalysisResult | null> {
  const failure = await db.failure.findUnique({
    where: { id: failureId },
    include: {
      job: { include: { steps: true, tests: { where: { status: "failed" } } } },
      workflowRun: { include: { workflow: true, commit: true } },
    },
  });
  if (!failure || !failure.job) return null;

  const failedStep = failure.job.steps.find((s) => s.conclusion === "failure") ?? failure.job.steps.at(-1);
  const logExcerpt = failedStep?.logExcerpt ?? "";

  const changedFiles: string[] = failure.workflowRun.commit
    ? (JSON.parse(failure.workflowRun.commit.changedFiles || "[]") as string[])
    : [];

  const recentCommits = await db.commit.findMany({
    where: { repositoryId: failure.workflowRun.repositoryId },
    orderBy: { committedAt: "desc" },
    take: 5,
  });

  const previousSimilarFailureCount = await db.failure.count({
    where: {
      workflowRun: { repositoryId: failure.workflowRun.repositoryId },
      job: { name: failure.job.name },
      id: { not: failure.id },
    },
  });

  const input: FailureAnalysisInput = {
    workflowName: failure.workflowRun.workflow.name,
    jobName: failure.job.name,
    logExcerpt,
    changedFiles,
    recentCommitMessages: recentCommits.map((c) => c.message),
    relatedTestFailures: failure.job.tests.map((t) => ({ name: t.fullName, message: t.message ?? undefined })),
    previousSimilarFailureCount,
  };

  const provider = getAIProvider();
  const result = await provider.analyzeFailure(input);

  await db.$transaction([
    db.failure.update({
      where: { id: failure.id },
      data: {
        category: result.category,
        errorMessage: result.rootCause,
        evidence: logExcerpt.slice(0, 4000),
      },
    }),
    db.aIAnalysis.create({
      data: {
        workflowRunId: failure.workflowRunId,
        failureId: failure.id,
        provider: result.provider,
        rootCause: result.rootCause,
        whyItFailed: result.whyItFailed,
        whatChanged: result.whatChanged,
        likelyFix: result.likelyFix,
        confidence: result.confidence,
        relevantFiles: JSON.stringify(result.relevantFiles),
        evidence: JSON.stringify(result.evidence),
        recommendedAction: result.recommendedAction,
      },
    }),
  ]);

  return result;
}
