import { NextResponse } from "next/server";
import { getApiContext, unauthorized } from "@/lib/api/context";
import { listFailures } from "@/lib/queries/failures";

export async function GET(request: Request) {
  const ctx = await getApiContext(request);
  if (!ctx) return unauthorized();

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
  const query = url.searchParams.get("q") ?? undefined;

  const failures = await listFailures(ctx.organizationId, limit, query);
  return NextResponse.json({
    failures: failures.map((f) => ({
      id: f.id,
      workflowRunId: f.workflowRunId,
      repository: `${f.workflowRun.repository.owner}/${f.workflowRun.repository.name}`,
      job: f.job?.name ?? null,
      category: f.category,
      rootCause: f.aiAnalyses[0]?.rootCause ?? null,
      confidence: f.aiAnalyses[0]?.confidence ?? null,
      createdAt: f.createdAt,
    })),
  });
}
