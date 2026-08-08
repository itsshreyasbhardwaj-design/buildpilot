import Link from "next/link";
import { requireSession } from "@/lib/current-session";
import { listFailures } from "@/lib/queries/failures";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const CATEGORY_LABEL: Record<string, string> = {
  dependency: "Dependency",
  test: "Test",
  timeout: "Timeout",
  oom: "Out of memory",
  syntax: "Syntax",
  config: "Config",
  infra: "Infrastructure",
  flaky: "Flaky",
  unknown: "Unknown",
};

export default async function FailuresPage() {
  const session = await requireSession();
  const failures = await listFailures(session.organizationId, 100);

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Failures</h1>
        <p className="text-sm text-muted-foreground">
          Searchable history of every CI failure — has this error appeared before?
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <ul className="divide-y divide-border">
          {failures.length === 0 ? (
            <li className="p-8 text-center text-sm text-muted-foreground">No failures recorded yet.</li>
          ) : (
            failures.map((f) => {
              const analysis = f.aiAnalyses[0];
              return (
                <li key={f.id}>
                  <Link href={`/builds/${f.workflowRunId}`} className="block px-4 py-3 hover:bg-muted/40">
                    <div className="flex items-center gap-2 text-sm">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          f.category ? "bg-status-failure/15 text-status-failure" : "bg-muted text-muted-foreground"
                        )}
                      >
                        {CATEGORY_LABEL[f.category ?? "unknown"] ?? f.category}
                      </span>
                      <span className="font-medium">
                        {f.workflowRun.repository.owner}/{f.workflowRun.repository.name}
                      </span>
                      <span className="text-muted-foreground">
                        · {f.workflowRun.workflow.name} · {f.job?.name} · {f.workflowRun.branch?.name}
                      </span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">{formatRelativeTime(f.createdAt)}</span>
                    </div>
                    {analysis ? <p className="mt-1 truncate text-xs text-muted-foreground">{analysis.rootCause}</p> : null}
                  </Link>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
