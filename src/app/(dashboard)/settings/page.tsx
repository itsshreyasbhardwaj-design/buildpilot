import { requireSession } from "@/lib/current-session";
import { getRepositories } from "@/lib/queries/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function SettingsPage() {
  const session = await requireSession();
  const repositories = await getRepositories(session.organizationId);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Connected repositories and webhook configuration.</p>
      </div>

      <Card className="gap-0 py-0">
        <CardHeader className="border-b border-border py-4">
          <CardTitle className="text-sm font-medium">Connected repositories</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border p-0">
          {repositories.map((repo) => (
            <div key={repo.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium">
                  {repo.owner}/{repo.name}
                </p>
                <p className="text-xs text-muted-foreground">{repo.provider} · {repo.private ? "private" : "public"}</p>
              </div>
              {repo.demo ? <Badge variant="secondary">Demo</Badge> : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <CardHeader className="border-b border-border py-4">
          <CardTitle className="text-sm font-medium">Connect a real repository</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4 text-sm text-muted-foreground">
          <p>
            This build ships with webhook receivers for GitHub Actions, GitLab CI, and CircleCI at{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">/api/webhooks/[provider]</code>, but
            doesn&apos;t yet include the GitHub App registration flow (that requires creating a GitHub App with your own
            account — see <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">docs/GITHUB_APP.md</code>).
          </p>
          <p>To point a real repository at this instance today:</p>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>
              Set <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">WEBHOOK_SECRET_GITHUB</code> (or{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">_GITLAB</code> /{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">_CIRCLECI</code>) in your environment.
            </li>
            <li>
              Insert a <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">Repository</code> row with
              the matching <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">provider</code> +{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">externalId</code> for your repo.
            </li>
            <li>
              Add a webhook in your repository settings pointing at{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">https://your-host/api/webhooks/github</code>{" "}
              with that same secret.
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
