import Link from "next/link";
import { requireSession } from "@/lib/current-session";
import { listBuilds } from "@/lib/queries/builds";
import { getRepositories } from "@/lib/queries/dashboard";
import { StatusBadge, statusFromRun } from "@/components/dashboard/status-badge";
import { formatDuration, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

function buildHref(params: Record<string, string | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  const s = qs.toString();
  return s ? `/builds?${s}` : "/builds";
}

export default async function BuildsPage({
  searchParams,
}: {
  searchParams: Promise<{ repo?: string; conclusion?: string }>;
}) {
  const session = await requireSession();
  const { repo, conclusion } = await searchParams;

  const [repositories, builds] = await Promise.all([
    getRepositories(session.organizationId),
    listBuilds(session.organizationId, { repositoryId: repo, conclusion }, 100),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Builds</h1>
        <p className="text-sm text-muted-foreground">Every workflow run across connected repositories.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-md border border-border bg-muted/30 p-1">
          {[
            { label: "All", value: undefined },
            { label: "Passed", value: "success" },
            { label: "Failed", value: "failure" },
          ].map((opt) => (
            <Link
              key={opt.label}
              href={buildHref({ repo, conclusion: opt.value })}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                (conclusion ?? undefined) === opt.value ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {opt.label}
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap gap-1">
          <Link
            href={buildHref({ conclusion })}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs transition-colors",
              !repo ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            All repos
          </Link>
          {repositories.map((r) => (
            <Link
              key={r.id}
              href={buildHref({ repo: r.id, conclusion })}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                repo === r.id ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {r.owner}/{r.name}
            </Link>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <ul className="divide-y divide-border">
          {builds.length === 0 ? (
            <li className="p-8 text-center text-sm text-muted-foreground">No builds match these filters.</li>
          ) : (
            builds.map((run) => (
              <li key={run.id}>
                <Link href={`/builds/${run.id}`} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/40">
                  <StatusBadge status={statusFromRun(run.status, run.conclusion)} />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{run.repository.owner}/{run.repository.name}</span>
                    <span className="text-muted-foreground"> · {run.workflow.name} · {run.branch?.name ?? "—"} · #{run.runNumber}</span>
                  </span>
                  <span className="hidden shrink-0 truncate text-xs text-muted-foreground sm:block max-w-64">
                    {run.commit?.message?.split("\n")[0]}
                  </span>
                  <span className="shrink-0 font-mono text-xs tabular text-muted-foreground">{formatDuration(run.durationMs)}</span>
                  <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">{formatRelativeTime(run.completedAt)}</span>
                </Link>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
