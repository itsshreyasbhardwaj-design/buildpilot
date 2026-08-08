import { NextResponse } from "next/server";
import { getApiContext, unauthorized } from "@/lib/api/context";
import { listDeployments } from "@/lib/queries/failures";

export async function GET(request: Request) {
  const ctx = await getApiContext(request);
  if (!ctx) return unauthorized();

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
  const repositoryId = url.searchParams.get("repositoryId") ?? undefined;

  const deployments = await listDeployments(ctx.organizationId, limit, repositoryId);
  return NextResponse.json({
    deployments: deployments.map((d) => ({
      id: d.id,
      repository: `${d.repository.owner}/${d.repository.name}`,
      environment: d.environment,
      status: d.status,
      version: d.version,
      isRollback: d.isRollback,
      durationMs: d.durationMs,
      startedAt: d.startedAt,
      completedAt: d.completedAt,
    })),
  });
}
