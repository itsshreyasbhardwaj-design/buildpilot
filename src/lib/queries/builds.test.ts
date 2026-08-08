import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { db } from "@/lib/db";
import { cleanDatabase, createTestOrgAndRepo } from "@/test/db-helpers";
import { getBuildDetail, listBuilds } from "./builds";

describe("repository isolation", () => {
  beforeEach(cleanDatabase);
  afterEach(cleanDatabase);

  it("never returns another organization's build in getBuildDetail", async () => {
    const { organization: orgA } = await createTestOrgAndRepo({ repoExternalId: "a" });
    const { repository: repoB } = await createTestOrgAndRepo({ repoExternalId: "b" });

    const workflow = await db.workflow.create({
      data: { repositoryId: repoB.id, provider: "github", externalId: "ci.yml", name: "CI" },
    });
    const run = await db.workflowRun.create({
      data: { repositoryId: repoB.id, workflowId: workflow.id, externalId: "run-1", runNumber: 1, status: "completed", conclusion: "success" },
    });

    // orgA must not be able to read orgB's run through the same query path.
    const result = await getBuildDetail(orgA.id, run.id);
    expect(result).toBeNull();
  });

  it("never lists another organization's builds", async () => {
    const { organization: orgA } = await createTestOrgAndRepo({ repoExternalId: "a" });
    const { repository: repoB } = await createTestOrgAndRepo({ repoExternalId: "b" });
    const workflow = await db.workflow.create({
      data: { repositoryId: repoB.id, provider: "github", externalId: "ci.yml", name: "CI" },
    });
    await db.workflowRun.create({
      data: { repositoryId: repoB.id, workflowId: workflow.id, externalId: "run-1", runNumber: 1, status: "completed", conclusion: "success" },
    });

    const builds = await listBuilds(orgA.id);
    expect(builds).toHaveLength(0);
  });
});
