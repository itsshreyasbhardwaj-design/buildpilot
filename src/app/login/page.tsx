"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, GitBranch, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function continueAsDemo() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/demo-login", { method: "POST" });
      if (!res.ok) throw new Error("Could not start the demo session.");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <GitBranch className="size-4" />
          </div>
          <span className="text-lg font-semibold tracking-tight">BuildPilot</span>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">Why did my build fail?</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          AI-powered CI/CD intelligence — root causes, not raw logs.
        </p>

        <div className="mt-8 space-y-3">
          <Button className="w-full justify-between" size="lg" onClick={continueAsDemo} disabled={loading}>
            <span>Continue with demo workspace</span>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
          </Button>
          <p className="text-xs leading-relaxed text-muted-foreground">
            No account, no credentials — this creates a local session and loads a seeded demo
            organization with three repositories and real (synthetic) build history. Connecting a
            real GitHub repository comes later, from Settings.
          </p>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
