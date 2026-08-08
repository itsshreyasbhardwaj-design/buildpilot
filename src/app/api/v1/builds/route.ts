import { NextResponse } from "next/server";
import { getApiContext, unauthorized } from "@/lib/api/context";
import { listBuilds } from "@/lib/queries/builds";

export async function GET(request: Request) {
  const ctx = await getApiContext(request);
  if (!ctx) return unauthorized();

  const url = new URL(request.url);
  const repositoryId = url.searchParams.get("repositoryId") ?? undefined;
  const branch = url.searchParams.get("branch") ?? undefined;
  const conclusion = url.searchParams.get("conclusion") ?? undefined;
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

  const builds = await listBuilds(ctx.organizationId, { repositoryId, branch, conclusion }, limit);
  return NextResponse.json({
    builds: builds.map((b) => ({
      id: b.id,
      repository: `${b.repository.owner}/${b.repository.name}`,
      workflow: b.workflow.name,
      branch: b.branch?.name ?? null,
      runNumber: b.runNumber,
      status: b.status,
      conclusion: b.conclusion,
      durationMs: b.durationMs,
      commitSha: b.commit?.sha ?? null,
      completedAt: b.completedAt,
    })),
  });
}
