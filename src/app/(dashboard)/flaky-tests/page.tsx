import { requireSession } from "@/lib/current-session";
import { listFlakyTests } from "@/lib/queries/failures";
import { formatDuration, formatRelativeTime } from "@/lib/format";
import { Shuffle } from "lucide-react";

export default async function FlakyTestsPage() {
  const session = await requireSession();
  const flakyTests = await listFlakyTests(session.organizationId);

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Flaky tests</h1>
        <p className="text-sm text-muted-foreground">
          Tests whose outcome flips independently of code changes — scored from pass/fail transition history, not guessed. A test only appears here with at least 5 runs and 2+ observations of both outcomes.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Test</th>
              <th className="px-4 py-2.5 font-medium">Repository</th>
              <th className="px-4 py-2.5 font-medium text-right">Score</th>
              <th className="px-4 py-2.5 font-medium text-right">Fail / Total</th>
              <th className="px-4 py-2.5 font-medium text-right">Transitions</th>
              <th className="px-4 py-2.5 font-medium text-right">Avg duration</th>
              <th className="px-4 py-2.5 font-medium text-right">Last failure</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {flakyTests.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">
                  No flaky tests detected — either everything is stable, or there isn&apos;t enough run history yet.
                </td>
              </tr>
            ) : (
              flakyTests.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Shuffle className="size-3.5 shrink-0 text-status-flaky" />
                      <span className="font-mono text-xs">{t.fullName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {t.repository.owner}/{t.repository.name}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular">{(t.score * 100).toFixed(0)}%</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular text-muted-foreground">
                    {t.failCount} / {t.totalRuns}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular text-muted-foreground">{t.transitionCount}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular text-muted-foreground">{formatDuration(t.avgDurationMs)}</td>
                  <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">{formatRelativeTime(t.lastFailureAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
