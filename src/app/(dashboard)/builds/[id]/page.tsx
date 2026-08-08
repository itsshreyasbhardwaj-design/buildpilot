import { notFound } from "next/navigation";
import { GitCommitHorizontal } from "lucide-react";
import { requireSession } from "@/lib/current-session";
import { getBuildDetail } from "@/lib/queries/builds";
import { StatusBadge, statusFromRun } from "@/components/dashboard/status-badge";
import { formatDuration, formatRelativeTime } from "@/lib/format";
import { FailureAnalysisCard } from "@/components/builds/failure-analysis-card";
import { FailureTimeline, timelineIcons } from "@/components/builds/failure-timeline";

export default async function BuildDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const run = await getBuildDetail(session.organizationId, id);
  if (!run) notFound();

  const failedJobs = run.jobs.filter((j) => j.conclusion === "failure");

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <p className="text-sm text-muted-foreground">
          {run.repository.owner}/{run.repository.name} · {run.workflow.name} · #{run.runNumber}
        </p>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">{run.branch?.name ?? "unknown branch"}</h1>
          <StatusBadge status={statusFromRun(run.status, run.conclusion)} />
        </div>
        {run.commit ? (
          <p className="mt-1.5 flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
            <GitCommitHorizontal className="size-3.5" />
            {run.commit.sha.slice(0, 7)} · {run.commit.message.split("\n")[0]}
          </p>
        ) : null}
        <p className="mt-1 text-xs text-muted-foreground">
          {formatDuration(run.durationMs)} · triggered by {run.triggeredBy ?? "unknown"} · {formatRelativeTime(run.completedAt)}
        </p>
      </div>

      {failedJobs.length > 0 ? (
        <div className="space-y-8">
          {failedJobs.map((job) => {
            const failure = job.failures[0];
            const analysis = failure?.aiAnalyses[0];
            const failedStep = job.steps.find((s) => s.conclusion === "failure");
            const changedFiles: string[] = analysis ? JSON.parse(analysis.relevantFiles || "[]") : [];

            return (
              <section key={job.id} className="space-y-4">
                <FailureTimeline
                  stages={[
                    { key: "commit", label: "Commit", sublabel: run.commit?.sha.slice(0, 7), tone: "neutral", icon: timelineIcons.commit },
                    {
                      key: "changed",
                      label: "Changed files",
                      sublabel: changedFiles[0] ?? "—",
                      tone: changedFiles.length > 0 ? "signal" : "neutral",
                      icon: timelineIcons.changedFiles,
                    },
                    { key: "workflow", label: "Workflow", sublabel: run.workflow.name, tone: "neutral", icon: timelineIcons.workflow },
                    { key: "job", label: "Job", sublabel: job.name, tone: "failure", icon: timelineIcons.job },
                    { key: "step", label: "Step", sublabel: failedStep?.name, tone: "failure", icon: timelineIcons.step },
                    { key: "error", label: "Error", sublabel: failure?.category ?? "unknown", tone: "failure", icon: timelineIcons.error },
                    { key: "cause", label: "Root cause", sublabel: analysis ? `${Math.round(analysis.confidence * 100)}% confidence` : undefined, tone: "signal", icon: timelineIcons.rootCause },
                  ]}
                />

                {analysis ? <FailureAnalysisCard analysis={analysis} /> : (
                  <p className="text-sm text-muted-foreground">Analysis is queued and will appear shortly.</p>
                )}

                {failedStep?.logExcerpt ? (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">Log — {failedStep.name}</p>
                    <pre className="max-h-80 overflow-auto rounded-lg border border-border bg-muted/30 p-3 font-mono text-xs leading-relaxed">
                      {failedStep.logExcerpt}
                    </pre>
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      ) : null}

      <div>
        <h2 className="mb-2 text-sm font-medium">Jobs</h2>
        <div className="overflow-hidden rounded-lg border border-border">
          <ul className="divide-y divide-border">
            {run.jobs.map((job) => (
              <li key={job.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <StatusBadge status={statusFromRun(job.status, job.conclusion)} />
                <span className="flex-1">{job.name}</span>
                <span className="font-mono text-xs tabular text-muted-foreground">{formatDuration(job.durationMs)}</span>
                {job.runnerLabel ? <span className="text-xs text-muted-foreground">{job.runnerLabel}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
