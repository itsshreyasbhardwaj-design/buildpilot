import { db } from "@/lib/db";

const WINDOW_DAYS = 30;

export interface OverviewStats {
  totalRuns: number;
  successRate: number;
  failureRate: number;
  avgDurationMs: number;
  avgQueueTimeMs: number;
  deploymentsPerDay: number;
  flakyTestCount: number;
  openRecommendationCount: number;
}

export async function getOverviewStats(organizationId: string): Promise<OverviewStats> {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const where = { repository: { organizationId }, completedAt: { gte: since } } as const;

  const [total, succeeded, failed, durationAgg, deployCount, flakyCount, recCount] = await Promise.all([
    db.workflowRun.count({ where }),
    db.workflowRun.count({ where: { ...where, conclusion: "success" } }),
    db.workflowRun.count({ where: { ...where, conclusion: "failure" } }),
    db.workflowRun.aggregate({ where, _avg: { durationMs: true, queueTimeMs: true } }),
    db.deployment.count({ where: { repository: { organizationId }, startedAt: { gte: since } } }),
    db.flakyTestScore.count({ where: { repository: { organizationId }, isFlaky: true } }),
    db.recommendation.count({ where: { repository: { organizationId }, status: "proposed" } }),
  ]);

  return {
    totalRuns: total,
    successRate: total > 0 ? succeeded / total : 0,
    failureRate: total > 0 ? failed / total : 0,
    avgDurationMs: durationAgg._avg.durationMs ?? 0,
    avgQueueTimeMs: durationAgg._avg.queueTimeMs ?? 0,
    deploymentsPerDay: deployCount / WINDOW_DAYS,
    flakyTestCount: flakyCount,
    openRecommendationCount: recCount,
  };
}

export async function getRecentRuns(organizationId: string, limit = 20) {
  return db.workflowRun.findMany({
    where: { repository: { organizationId } },
    orderBy: { completedAt: "desc" },
    take: limit,
    include: {
      repository: true,
      workflow: true,
      branch: true,
      commit: true,
      jobs: { select: { id: true, name: true, conclusion: true } },
    },
  });
}

export async function getRepositories(organizationId: string) {
  return db.repository.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
  });
}

export async function getMostExpensiveJobs(organizationId: string, limit = 5) {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const jobs = await db.job.groupBy({
    by: ["name"],
    where: { workflowRun: { repository: { organizationId }, completedAt: { gte: since } } },
    _avg: { durationMs: true },
    _count: { _all: true },
    orderBy: { _avg: { durationMs: "desc" } },
    take: limit,
  });
  return jobs.map((j) => ({ name: j.name, avgDurationMs: j._avg.durationMs ?? 0, runCount: j._count._all }));
}

export async function getFailureTrend(organizationId: string, days = 14) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const runs = await db.workflowRun.findMany({
    where: { repository: { organizationId }, completedAt: { gte: since } },
    select: { completedAt: true, conclusion: true },
  });

  const byDay = new Map<string, { total: number; failed: number }>();
  for (const run of runs) {
    if (!run.completedAt) continue;
    const key = run.completedAt.toISOString().slice(0, 10);
    const entry = byDay.get(key) ?? { total: 0, failed: 0 };
    entry.total += 1;
    if (run.conclusion === "failure") entry.failed += 1;
    byDay.set(key, entry);
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, total: v.total, failed: v.failed, failureRate: v.total > 0 ? v.failed / v.total : 0 }));
}
