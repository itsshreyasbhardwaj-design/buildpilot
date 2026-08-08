import { CheckCircle2, XCircle, CircleDashed, Ban, Clock, Shuffle } from "lucide-react";
import { cn } from "@/lib/utils";

export type BuildStatus = "success" | "failure" | "in_progress" | "queued" | "cancelled" | "timed_out" | "skipped" | "flaky";

const STYLES: Record<BuildStatus, { className: string; icon: typeof CheckCircle2; label: string }> = {
  success: { className: "bg-status-success/15 text-status-success", icon: CheckCircle2, label: "Passed" },
  failure: { className: "bg-status-failure/15 text-status-failure", icon: XCircle, label: "Failed" },
  in_progress: { className: "bg-status-running/15 text-status-running", icon: Clock, label: "Running" },
  queued: { className: "bg-status-queued/15 text-status-queued", icon: CircleDashed, label: "Queued" },
  cancelled: { className: "bg-status-queued/15 text-status-queued", icon: Ban, label: "Cancelled" },
  timed_out: { className: "bg-status-failure/15 text-status-failure", icon: Clock, label: "Timed out" },
  skipped: { className: "bg-status-queued/15 text-status-queued", icon: CircleDashed, label: "Skipped" },
  flaky: { className: "bg-status-flaky/15 text-status-flaky", icon: Shuffle, label: "Flaky" },
};

export function StatusBadge({ status, className }: { status: BuildStatus; className?: string }) {
  const style = STYLES[status] ?? STYLES.queued;
  const Icon = style.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", style.className, className)}>
      <Icon className="size-3" />
      {style.label}
    </span>
  );
}

export function statusFromRun(status: string, conclusion: string | null | undefined): BuildStatus {
  if (status !== "completed") return status === "queued" ? "queued" : "in_progress";
  if (conclusion === "success") return "success";
  if (conclusion === "failure") return "failure";
  if (conclusion === "cancelled") return "cancelled";
  if (conclusion === "timed_out") return "timed_out";
  if (conclusion === "skipped") return "skipped";
  return "queued";
}
