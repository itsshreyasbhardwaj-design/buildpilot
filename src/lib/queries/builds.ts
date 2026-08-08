import { db } from "@/lib/db";

export interface BuildFilters {
  repositoryId?: string;
  branch?: string;
  workflowId?: string;
  conclusion?: string;
}

export async function listBuilds(organizationId: string, filters: BuildFilters = {}, take = 50) {
  return db.workflowRun.findMany({
    where: {
      repository: { organizationId },
      ...(filters.repositoryId ? { repositoryId: filters.repositoryId } : {}),
      ...(filters.branch ? { branch: { name: filters.branch } } : {}),
      ...(filters.workflowId ? { workflowId: filters.workflowId } : {}),
      ...(filters.conclusion ? { conclusion: filters.conclusion } : {}),
    },
    orderBy: { completedAt: "desc" },
    take,
    include: { repository: true, workflow: true, branch: true, commit: true },
  });
}

export async function getBuildDetail(organizationId: string, runId: string) {
  const run = await db.workflowRun.findFirst({
    where: { id: runId, repository: { organizationId } },
    include: {
      repository: true,
      workflow: true,
      branch: true,
      commit: true,
      pullRequest: true,
      jobs: {
        include: {
          steps: { orderBy: { number: "asc" } },
          tests: { where: { status: "failed" } },
          failures: { include: { aiAnalyses: { orderBy: { createdAt: "desc" }, take: 1 } } },
        },
      },
    },
  });
  return run;
}
