import { NextResponse } from "next/server";
import { getApiContext, unauthorized, notFound } from "@/lib/api/context";
import { getBuildDetail } from "@/lib/queries/builds";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getApiContext(request);
  if (!ctx) return unauthorized();
  const { id } = await params;

  const run = await getBuildDetail(ctx.organizationId, id);
  if (!run) return notFound("Build");

  return NextResponse.json({
    id: run.id,
    repository: `${run.repository.owner}/${run.repository.name}`,
    workflow: run.workflow.name,
    branch: run.branch?.name ?? null,
    runNumber: run.runNumber,
    status: run.status,
    conclusion: run.conclusion,
    durationMs: run.durationMs,
    commit: run.commit ? { sha: run.commit.sha, message: run.commit.message } : null,
    jobs: run.jobs.map((j) => ({
      id: j.id,
      name: j.name,
      status: j.status,
      conclusion: j.conclusion,
      durationMs: j.durationMs,
      failure: j.failures[0]
        ? {
            id: j.failures[0].id,
            category: j.failures[0].category,
            analysis: j.failures[0].aiAnalyses[0]
              ? {
                  rootCause: j.failures[0].aiAnalyses[0].rootCause,
                  confidence: j.failures[0].aiAnalyses[0].confidence,
                  likelyFix: j.failures[0].aiAnalyses[0].likelyFix,
                }
              : null,
          }
        : null,
    })),
  });
}
