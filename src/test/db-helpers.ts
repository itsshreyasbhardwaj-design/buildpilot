import { db } from "@/lib/db";

/** Deletes all rows in FK-safe (children-first) order. Test isolation for the shared test.db. */
export async function cleanDatabase(): Promise<void> {
  await db.queueJob.deleteMany();
  await db.auditLog.deleteMany();
  await db.event.deleteMany();
  await db.recommendation.deleteMany();
  await db.aIAnalysis.deleteMany();
  await db.failure.deleteMany();
  await db.testResult.deleteMany();
  await db.step.deleteMany();
  await db.job.deleteMany();
  await db.workflowRun.deleteMany();
  await db.pullRequest.deleteMany();
  await db.commit.deleteMany();
  await db.branch.deleteMany();
  await db.workflow.deleteMany();
  await db.deployment.deleteMany();
  await db.flakyTestScore.deleteMany();
  await db.repository.deleteMany();
  await db.membership.deleteMany();
  await db.user.deleteMany();
  await db.organization.deleteMany();
}

export async function createTestOrgAndRepo(overrides: { repoExternalId?: string; provider?: string } = {}) {
  const organization = await db.organization.create({ data: { name: "Test Org", slug: `test-${Date.now()}-${Math.random()}`, demo: true } });
  const repository = await db.repository.create({
    data: {
      organizationId: organization.id,
      provider: overrides.provider ?? "github",
      externalId: overrides.repoExternalId ?? "1",
      owner: "acme",
      name: "repo",
    },
  });
  return { organization, repository };
}
