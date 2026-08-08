# Connecting a Real GitHub Repository

This build ships a working webhook receiver and a real GitHub Actions
provider (signature verification, payload normalization, log fetching) —
what it does *not* ship is the GitHub App registration/installation UI flow,
because that requires creating a GitHub App under your own GitHub account
(an action only you can take; this project can't do it on your behalf).

## Manual setup (today)

1. **Create a GitHub App** at `https://github.com/settings/apps/new`:
   - Webhook URL: `https://<your-host>/api/webhooks/github`
   - Webhook secret: generate one, set it as `WEBHOOK_SECRET_GITHUB` in your
     environment
   - Permissions (least privilege): Actions (read), Contents (read),
     Metadata (read), Pull requests (read)
   - Subscribe to events: `workflow_run`, `workflow_job`, `push`,
     `pull_request`
2. **Install the app** on the repository you want to connect.
3. **Insert a `Repository` row** with `provider: "github"`, `externalId`
   matching the repository's numeric GitHub id (not the slug), and
   `installationId` set to the GitHub App installation id.
4. **Generate an installation access token** (GitHub App JWT → installation
   token exchange) and set it as `GITHUB_APP_TOKEN` — used by
   `githubActionsProvider.fetchJobLogs()` to pull raw logs after a job
   fails. In a real deployment this token should be short-lived and
   refreshed automatically, not a static env var; the current
   implementation reads a static token for simplicity and is not
   production-ready credential handling (tracked in `docs/ROADMAP.md`).

## GitLab CI / CircleCI

Same shape: create a webhook pointed at
`/api/webhooks/gitlab`/`/api/webhooks/circleci` with the matching
`WEBHOOK_SECRET_*` env var, and a `Repository` row with the matching
`provider` + `externalId` (GitLab: numeric project id; CircleCI: project
slug, e.g. `gh/acme/repo`).

## What's missing for a self-serve "Connect repository" flow

- OAuth/App installation UI (the actual GitHub App installation redirect
  flow)
- Automatic `Repository` row creation on installation webhook
- Credential storage/rotation (see `docs/SECURITY.md`)
- Repository structure analysis on connect (package manager, test framework
  detection — `Repository.analysis` exists in the schema but nothing
  populates it from a real repo yet)

This is the single largest gap between this build and a deployable SaaS
product — see `docs/ROADMAP.md`.
