import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getApiContext, unauthorized, notFound } from "@/lib/api/context";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getApiContext(request);
  if (!ctx) return unauthorized();
  const { id } = await params;

  const failure = await db.failure.findFirst({
    where: { id, workflowRun: { repository: { organizationId: ctx.organizationId } } },
    include: {
      job: true,
      workflowRun: { include: { repository: true, workflow: true } },
      aiAnalyses: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!failure) return notFound("Failure");

  const analysis = failure.aiAnalyses[0];
  return NextResponse.json({
    id: failure.id,
    repository: `${failure.workflowRun.repository.owner}/${failure.workflowRun.repository.name}`,
    workflow: failure.workflowRun.workflow.name,
    job: failure.job?.name ?? null,
    category: failure.category,
    createdAt: failure.createdAt,
    analysis: analysis
      ? {
          provider: analysis.provider,
          rootCause: analysis.rootCause,
          whyItFailed: analysis.whyItFailed,
          whatChanged: analysis.whatChanged,
          likelyFix: analysis.likelyFix,
          confidence: analysis.confidence,
          recommendedAction: analysis.recommendedAction,
          relevantFiles: JSON.parse(analysis.relevantFiles || "[]"),
          evidence: JSON.parse(analysis.evidence || "[]"),
        }
      : null,
  });
}
