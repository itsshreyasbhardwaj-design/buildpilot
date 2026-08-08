# @buildpilot/mcp-server

MCP server exposing [BuildPilot](https://github.com/itsshreyasbhardwaj-design/buildpilot)'s
build/failure/flaky-test data to any MCP-compatible AI agent.

```bash
pnpm add -g @buildpilot/mcp-server
BUILDPILOT_URL=https://your-instance BUILDPILOT_API_TOKEN=... buildpilot-mcp
```

## Tools

| Tool | Description |
| --- | --- |
| `get_build` | Full detail for one build, including jobs and failure analysis |
| `get_failed_jobs` | Jobs that failed within one build |
| `analyze_failure` | Re-run AI root-cause analysis for a failure on demand |
| `search_ci_history` | "Have we seen this error before?" — search past failures |
| `get_flaky_tests` | Tests currently flagged as flaky, with evidence |
| `get_deployment_status` | Recent deployments, including rollback history |
| `get_repository_health` | 30-day health snapshot for a repository |

## Client config example

```json
{
  "mcpServers": {
    "buildpilot": {
      "command": "buildpilot-mcp",
      "env": { "BUILDPILOT_URL": "https://your-instance", "BUILDPILOT_API_TOKEN": "..." }
    }
  }
}
```

Built on `@buildpilot/sdk`. MIT licensed.
