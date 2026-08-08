import { NextResponse } from "next/server";
import { getApiContext, unauthorized } from "@/lib/api/context";
import { listRecommendations } from "@/lib/queries/failures";

export async function GET(request: Request) {
  const ctx = await getApiContext(request);
  if (!ctx) return unauthorized();

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? undefined;

  const recommendations = await listRecommendations(ctx.organizationId, status);
  return NextResponse.json({
    recommendations: recommendations.map((r) => ({
      id: r.id,
      repository: `${r.repository.owner}/${r.repository.name}`,
      kind: r.kind,
      title: r.title,
      description: r.description,
      diff: r.diff,
      filePath: r.filePath,
      status: r.status,
      impactEstimate: r.impactEstimate,
      createdAt: r.createdAt,
    })),
  });
}
