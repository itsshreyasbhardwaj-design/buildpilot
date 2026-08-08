import { db } from "@/lib/db";

export async function listFailures(organizationId: string, take = 50, query?: string) {
  return db.failure.findMany({
    where: {
      workflowRun: { repository: { organizationId } },
      ...(query
        ? { OR: [{ errorMessage: { contains: query } }, { category: { contains: query } }, { job: { name: { contains: query } } }] }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      workflowRun: { include: { repository: true, workflow: true, branch: true } },
      job: true,
      aiAnalyses: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
}

export async function listFlakyTests(organizationId: string) {
  return db.flakyTestScore.findMany({
    where: { repository: { organizationId }, isFlaky: true },
    orderBy: { score: "desc" },
    include: { repository: true },
  });
}

export async function listDeployments(organizationId: string, take = 50, repositoryId?: string) {
  return db.deployment.findMany({
    where: { repository: { organizationId, ...(repositoryId ? { id: repositoryId } : {}) } },
    orderBy: { startedAt: "desc" },
    take,
    include: { repository: true },
  });
}

export async function listRecommendations(organizationId: string, status?: string) {
  return db.recommendation.findMany({
    where: { repository: { organizationId }, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    include: { repository: true },
  });
}
