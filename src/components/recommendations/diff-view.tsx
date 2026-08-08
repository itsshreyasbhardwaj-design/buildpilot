import { cn } from "@/lib/utils";

export function DiffView({ diff }: { diff: string }) {
  return (
    <pre className="overflow-x-auto rounded-md border border-border bg-muted/30 p-3 font-mono text-xs leading-relaxed">
      {diff.split("\n").map((line, i) => (
        <div
          key={i}
          className={cn(
            line.startsWith("+") && "bg-status-success/10 text-status-success",
            line.startsWith("-") && "bg-status-failure/10 text-status-failure"
          )}
        >
          {line || " "}
        </div>
      ))}
    </pre>
  );
}
