import Link from "next/link";
import { CheckCircle2, XCircle, Timer, Rocket, Shuffle, Lightbulb, ArrowRight } from "lucide-react";
import { requireSession } from "@/lib/current-session";
import { getOverviewStats, getRecentRuns, getMostExpensiveJobs } from "@/lib/queries/dashboard";
import { StatTile } from "@/components/dashboard/stat-tile";
import { StatusBadge, statusFromRun } from "@/components/dashboard/status-badge";
import { formatDuration, formatPercent, formatRelativeTime } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const session = await requireSession();
  const [stats, recentRuns, expensiveJobs] = await Promise.all([
    getOverviewStats(session.organizationId),
    getRecentRuns(session.organizationId, 12),
    getMostExpensiveJobs(session.organizationId),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Build health across every connected repository, last 30 days.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Success rate" value={formatPercent(stats.successRate)} icon={CheckCircle2} tone="success" hint={`${stats.totalRuns} runs`} />
        <StatTile label="Failure rate" value={formatPercent(stats.failureRate)} icon={XCircle} tone="failure" />
        <StatTile label="Avg build duration" value={formatDuration(stats.avgDurationMs)} icon={Timer} />
        <StatTile label="Deployment frequency" value={`${stats.deploymentsPerDay.toFixed(1)}/day`} icon={Rocket} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 gap-0 py-0">
          <CardHeader className="flex-row items-center justify-between border-b border-border py-4">
            <CardTitle className="text-sm font-medium">Recent builds</CardTitle>
            <Link href="/builds" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              View all <ArrowRight className="size-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {recentRuns.length === 0 ? (
                <li className="p-6 text-center text-sm text-muted-foreground">
                  No builds yet. Connect a repository from Settings, or explore the seeded demo data.
                </li>
              ) : (
                recentRuns.map((run) => (
                  <li key={run.id}>
                    <Link href={`/builds/${run.id}`} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/40">
                      <StatusBadge status={statusFromRun(run.status, run.conclusion)} />
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-medium">{run.repository.owner}/{run.repository.name}</span>
                        <span className="text-muted-foreground"> · {run.workflow.name} · {run.branch?.name ?? "—"}</span>
                      </span>
                      <span className="hidden shrink-0 truncate text-xs text-muted-foreground sm:block max-w-48">
                        {run.commit?.message?.split("\n")[0]}
                      </span>
                      <span className="shrink-0 font-mono text-xs tabular text-muted-foreground">{formatDuration(run.durationMs)}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatRelativeTime(run.completedAt)}</span>
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="gap-0 py-0">
            <CardHeader className="border-b border-border py-4">
              <CardTitle className="text-sm font-medium">Most expensive jobs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4">
              {expensiveJobs.length === 0 ? (
                <p className="text-xs text-muted-foreground">No job data yet.</p>
              ) : (
                expensiveJobs.map((job) => (
                  <div key={job.name} className="flex items-center justify-between text-sm">
                    <span className="truncate">{job.name}</span>
                    <span className="font-mono text-xs tabular text-muted-foreground">{formatDuration(job.avgDurationMs)}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Link href="/flaky-tests" className="block rounded-lg border border-border bg-card p-4 transition-colors hover:border-status-flaky/40">
            <div className="flex items-center gap-2 text-status-flaky">
              <Shuffle className="size-4" />
              <span className="text-sm font-medium text-foreground">{stats.flakyTestCount} flaky test{stats.flakyTestCount === 1 ? "" : "s"}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Detected with evidence-based scoring, not guessed.</p>
          </Link>

          <Link href="/recommendations" className="block rounded-lg border border-border bg-card p-4 transition-colors hover:border-signal/60">
            <div className="flex items-center gap-2 text-signal-foreground">
              <Lightbulb className="size-4" />
              <span className="text-sm font-medium text-foreground">{stats.openRecommendationCount} open recommendation{stats.openRecommendationCount === 1 ? "" : "s"}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Proposed CI optimizations awaiting your review.</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
