import { requireSession } from "@/lib/current-session";
import { listRecommendations } from "@/lib/queries/failures";
import { decideRecommendation } from "@/lib/actions/recommendations";
import { DiffView } from "@/components/recommendations/diff-view";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<string, string> = {
  caching: "Caching",
  parallelization: "Parallelization",
  matrix: "Matrix",
  dependency: "Dependency",
  "test-split": "Test splitting",
  config: "Config",
  docker: "Docker",
};

const STATUS_STYLE: Record<string, string> = {
  proposed: "bg-signal text-signal-foreground",
  approved: "bg-status-success/15 text-status-success",
  applied: "bg-status-running/15 text-status-running",
  rejected: "bg-status-queued/15 text-status-queued",
};

export default async function RecommendationsPage() {
  const session = await requireSession();
  const recommendations = await listRecommendations(session.organizationId);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Recommendations</h1>
        <p className="text-sm text-muted-foreground">
          Proposed CI configuration improvements from static analysis of your workflow files. Nothing is
          applied automatically — review the diff and approve or reject.
        </p>
      </div>

      <div className="space-y-3">
        {recommendations.length === 0 ? (
          <p className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
            No recommendations yet.
          </p>
        ) : (
          recommendations.map((rec) => (
            <div key={rec.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {KIND_LABEL[rec.kind] ?? rec.kind}
                    </span>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLE[rec.status])}>{rec.status}</span>
                  </div>
                  <h3 className="mt-1.5 font-medium">{rec.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {rec.repository.owner}/{rec.repository.name} · {rec.filePath}
                  </p>
                </div>
              </div>

              <p className="mt-3 text-sm text-foreground/90">{rec.description}</p>

              {rec.diff ? (
                <div className="mt-3">
                  <DiffView diff={rec.diff} />
                </div>
              ) : null}

              {rec.status === "proposed" ? (
                <div className="mt-3 flex gap-2">
                  <form action={decideRecommendation.bind(null, rec.id, "approved")}>
                    <Button size="sm" variant="outline">
                      Approve
                    </Button>
                  </form>
                  <form action={decideRecommendation.bind(null, rec.id, "rejected")}>
                    <Button size="sm" variant="ghost">
                      Reject
                    </Button>
                  </form>
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">
                  {rec.status === "approved" ? "Approved" : "Rejected"} {rec.decidedAt ? new Date(rec.decidedAt).toLocaleString() : ""}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
