import { requireSession } from "@/lib/current-session";
import { listDeployments } from "@/lib/queries/failures";
import { formatDuration, formatRelativeTime } from "@/lib/format";
import { CheckCircle2, XCircle, RotateCcw, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<string, { icon: typeof CheckCircle2; className: string }> = {
  success: { icon: CheckCircle2, className: "text-status-success" },
  failure: { icon: XCircle, className: "text-status-failure" },
  pending: { icon: Clock, className: "text-status-queued" },
  in_progress: { icon: Clock, className: "text-status-running" },
  rolled_back: { icon: RotateCcw, className: "text-status-flaky" },
};

export default async function DeploymentsPage() {
  const session = await requireSession();
  const deployments = await listDeployments(session.organizationId, 100);

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Deployments</h1>
        <p className="text-sm text-muted-foreground">Deployment frequency, duration, and rollback history.</p>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <ul className="divide-y divide-border">
          {deployments.length === 0 ? (
            <li className="p-8 text-center text-sm text-muted-foreground">No deployments recorded yet.</li>
          ) : (
            deployments.map((d) => {
              const style = STATUS_STYLE[d.status] ?? STATUS_STYLE.pending;
              const Icon = style.icon;
              return (
                <li key={d.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <Icon className={cn("size-4 shrink-0", style.className)} />
                  <span className="font-medium">
                    {d.repository.owner}/{d.repository.name}
                  </span>
                  <span className="text-muted-foreground">· {d.environment}</span>
                  {d.isRollback ? (
                    <span className="rounded-full bg-status-flaky/15 px-2 py-0.5 text-xs text-status-flaky">rollback</span>
                  ) : null}
                  <span className="font-mono text-xs text-muted-foreground">{d.version}</span>
                  <span className="ml-auto font-mono text-xs tabular text-muted-foreground">{formatDuration(d.durationMs)}</span>
                  <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">{formatRelativeTime(d.startedAt)}</span>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
