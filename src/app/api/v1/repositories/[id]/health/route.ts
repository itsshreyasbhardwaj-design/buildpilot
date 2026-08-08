import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getApiContext, unauthorized, notFound } from "@/lib/api/context";

const WINDOW_DAYS = 30;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getApiContext(request);
  if (!ctx) return unauthorized();
  const { id } = await params;

  const repository = await db.repository.findFirst({ where: { id, organizationId: ctx.organizationId } });
  if (!repository) return notFound("Repository");

  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const where = { repositoryId: id, completedAt: { gte: since } } as const;

  const [total, succeeded, failed, durationAgg, flakyCount, openRecommendations, latestDeployment] = await Promise.all([
    db.workflowRun.count({ where }),
    db.workflowRun.count({ where: { ...where, conclusion: "success" } }),
    db.workflowRun.count({ where: { ...where, conclusion: "failure" } }),
    db.workflowRun.aggregate({ where, _avg: { durationMs: true } }),
    db.flakyTestScore.count({ where: { repositoryId: id, isFlaky: true } }),
    db.recommendation.count({ where: { repositoryId: id, status: "proposed" } }),
    db.deployment.findFirst({ where: { repositoryId: id }, orderBy: { startedAt: "desc" } }),
  ]);

  return NextResponse.json({
    repository: { id: repository.id, owner: repository.owner, name: repository.name },
    windowDays: WINDOW_DAYS,
    totalRuns: total,
    successRate: total > 0 ? succeeded / total : null,
    failureRate: total > 0 ? failed / total : null,
    avgDurationMs: durationAgg._avg.durationMs,
    flakyTestCount: flakyCount,
    openRecommendationCount: openRecommendations,
    lastDeployment: latestDeployment
      ? { status: latestDeployment.status, environment: latestDeployment.environment, startedAt: latestDeployment.startedAt }
      : null,
  });
}
