import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getApiContext, unauthorized, notFound } from "@/lib/api/context";
import { analyzeFailureById } from "@/lib/ingestion/analyze-failure";

/** Re-runs AI analysis for a failure on demand — the `analyze_failure` MCP tool and SDK method call this. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getApiContext(request);
  if (!ctx) return unauthorized();
  const { id } = await params;

  const failure = await db.failure.findFirst({
    where: { id, workflowRun: { repository: { organizationId: ctx.organizationId } } },
  });
  if (!failure) return notFound("Failure");

  const result = await analyzeFailureById(id);
  if (!result) return notFound("Failure job data");

  return NextResponse.json({ analysis: result });
}
