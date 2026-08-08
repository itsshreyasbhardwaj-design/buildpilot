import { NextResponse } from "next/server";
import { getApiContext, unauthorized } from "@/lib/api/context";
import { listFlakyTests } from "@/lib/queries/failures";

export async function GET(request: Request) {
  const ctx = await getApiContext(request);
  if (!ctx) return unauthorized();

  const flakyTests = await listFlakyTests(ctx.organizationId);
  return NextResponse.json({
    flakyTests: flakyTests.map((t) => ({
      fullName: t.fullName,
      repository: `${t.repository.owner}/${t.repository.name}`,
      score: t.score,
      totalRuns: t.totalRuns,
      failCount: t.failCount,
      transitionCount: t.transitionCount,
      avgDurationMs: t.avgDurationMs,
      lastFailureAt: t.lastFailureAt,
    })),
  });
}
