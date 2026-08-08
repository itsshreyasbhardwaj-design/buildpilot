import type { LucideIcon } from "lucide-react";
import { GitCommitHorizontal, FileDiff, Workflow, Box, ListTree, XOctagon, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TimelineStage {
  key: string;
  label: string;
  sublabel?: string;
  tone: "neutral" | "failure" | "signal";
  icon: LucideIcon;
}

/**
 * The signature visual of BuildPilot: a failed build isn't a wall of log
 * text, it's a traceable chain from commit to root cause. Every stage here
 * corresponds to a real, queryable row (Commit, Job, Step, Failure,
 * AIAnalysis) — nothing here is decorative, it's the actual evidence path.
 */
export function FailureTimeline({ stages }: { stages: TimelineStage[] }) {
  return (
    <div className="overflow-x-auto">
      <ol className="flex min-w-max items-stretch gap-0">
        {stages.map((stage, i) => {
          const Icon = stage.icon;
          const isLast = i === stages.length - 1;
          return (
            <li key={stage.key} className="flex items-stretch">
              <div className="flex w-36 flex-col items-center gap-2 px-1 text-center">
                <div
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full border-2",
                    stage.tone === "failure" && "border-status-failure bg-status-failure/10 text-status-failure",
                    stage.tone === "signal" && "border-signal-foreground bg-signal text-signal-foreground",
                    stage.tone === "neutral" && "border-border bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="size-4" />
                </div>
                <div>
                  <p className="text-xs font-medium leading-tight">{stage.label}</p>
                  {stage.sublabel ? (
                    <p className="mt-0.5 truncate font-mono text-[10px] leading-tight text-muted-foreground">{stage.sublabel}</p>
                  ) : null}
                </div>
              </div>
              {!isLast ? (
                <div className="flex w-8 items-center pb-8">
                  <div className="h-px w-full bg-border" />
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export const timelineIcons = {
  commit: GitCommitHorizontal,
  changedFiles: FileDiff,
  workflow: Workflow,
  job: Box,
  step: ListTree,
  error: XOctagon,
  rootCause: Sparkles,
};
