import { Sparkles, FileText, TestTube2, History, ScrollText } from "lucide-react";
import type { AIAnalysis } from "@/generated/prisma/client";
import { cn } from "@/lib/utils";

interface Evidence {
  kind: string;
  file?: string;
  lineNumber?: number;
  excerpt: string;
  reason: string;
}

const EVIDENCE_ICONS: Record<string, typeof FileText> = {
  "log-line": ScrollText,
  "changed-file": FileText,
  "test-failure": TestTube2,
  "previous-failure": History,
  "dependency-diff": FileText,
};

function confidenceLabel(confidence: number): { label: string; className: string } {
  if (confidence >= 0.7) return { label: "High confidence", className: "text-status-success" };
  if (confidence >= 0.4) return { label: "Moderate confidence", className: "text-status-flaky" };
  return { label: "Low confidence — insufficient evidence", className: "text-status-failure" };
}

export function FailureAnalysisCard({ analysis }: { analysis: AIAnalysis }) {
  const evidence: Evidence[] = JSON.parse(analysis.evidence || "[]");
  const relevantFiles: string[] = JSON.parse(analysis.relevantFiles || "[]");
  const confidence = confidenceLabel(analysis.confidence);

  return (
    <div className="rounded-lg border border-signal-foreground/20 bg-signal-muted">
      <div className="flex items-center justify-between border-b border-signal-foreground/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-signal-foreground" />
          <span className="text-sm font-medium">AI Analysis</span>
          <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{analysis.provider}</span>
        </div>
        <span className={cn("text-xs font-medium", confidence.className)}>
          {confidence.label} ({Math.round(analysis.confidence * 100)}%)
        </span>
      </div>

      <div className="space-y-3 px-4 py-4 text-sm">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Root cause</p>
          <p className="mt-0.5">{analysis.rootCause}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Why it failed</p>
          <p className="mt-0.5 text-foreground/90">{analysis.whyItFailed}</p>
        </div>
        {analysis.whatChanged ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">What changed</p>
            <p className="mt-0.5 text-foreground/90">{analysis.whatChanged}</p>
          </div>
        ) : null}
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Likely fix</p>
          <p className="mt-0.5 text-foreground/90">{analysis.likelyFix}</p>
        </div>
        {analysis.recommendedAction ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recommended action</p>
            <p className="mt-0.5 text-foreground/90">{analysis.recommendedAction}</p>
          </div>
        ) : null}

        {relevantFiles.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {relevantFiles.map((f) => (
              <span key={f} className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[11px]">
                {f}
              </span>
            ))}
          </div>
        ) : null}

        {evidence.length > 0 ? (
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Evidence</p>
            <ul className="space-y-1.5">
              {evidence.slice(0, 8).map((e, i) => {
                const Icon = EVIDENCE_ICONS[e.kind] ?? FileText;
                return (
                  <li key={i} className="flex items-start gap-2 rounded-md border border-border bg-background/60 px-2.5 py-1.5">
                    <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs">
                        {e.lineNumber ? <span className="text-muted-foreground">L{e.lineNumber}: </span> : null}
                        {e.excerpt}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{e.reason}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
