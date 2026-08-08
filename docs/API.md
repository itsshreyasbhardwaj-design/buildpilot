# REST API (v1)

Base path: `/api/v1`. Every endpoint accepts either a browser session
cookie (first-party dashboard use) or `Authorization: Bearer <token>` (see
`docs/AUTH.md#api-tokens`). All responses scope to the caller's organization
— see `docs/SECURITY.md#repository-isolation`.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/repositories` | List connected repositories |
| GET | `/repositories/:id/health` | 30-day health snapshot for one repository |
| GET | `/builds?repositoryId=&branch=&conclusion=&limit=` | List builds, filterable |
| GET | `/builds/:id` | Full build detail: jobs, failures, analyses |
| GET | `/failures?q=&limit=` | List failures; `q` is a case-sensitive substring search over root cause / category / job name |
| GET | `/failures/:id` | One failure with its latest AI analysis |
| POST | `/failures/:id/analyze` | Re-run AI analysis on demand, returns the fresh result |
| GET | `/flaky-tests` | Tests currently flagged as flaky |
| GET | `/recommendations?status=` | CI Optimizer recommendations |
| GET | `/deployments?repositoryId=&limit=` | Deployment history |
| GET | `/analytics/overview` | Org-wide 30-day stats (the dashboard's own numbers) |

All list responses are `{ <resourceName>: [...] }`; single-resource
responses are the resource object directly. Errors are `{ error: string }`
with a matching HTTP status (`401` unauthenticated, `404` not found).

## Example

```bash
curl -H "Authorization: Bearer $BUILDPILOT_API_TOKEN" \
  https://your-host/api/v1/failures?limit=5
```

## TypeScript SDK

`packages/sdk` wraps every endpoint above in a typed client:

```ts
import { BuildPilotClient } from "@buildpilot/sdk";

const client = new BuildPilotClient({
  baseUrl: "https://your-host",
  apiToken: process.env.BUILDPILOT_API_TOKEN!,
});

const failures = await client.listFailures();
const analysis = await client.analyzeFailure(failures[0].id);
const health = await client.getRepositoryHealth(repositoryId);
```

## What's not here yet

Write endpoints (create/connect a repository, mutate a workflow) beyond
recommendation approve/reject (currently a Server Action, not a REST
endpoint) are not implemented — see `docs/ROADMAP.md`.
