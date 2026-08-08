#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { BuildPilotClient, BuildPilotApiError } from "@buildpilot/sdk";

const baseUrl = process.env.BUILDPILOT_URL;
const apiToken = process.env.BUILDPILOT_API_TOKEN;

if (!baseUrl || !apiToken) {
  console.error(
    "buildpilot-mcp requires BUILDPILOT_URL and BUILDPILOT_API_TOKEN environment variables " +
      "(a running BuildPilot instance and an API token minted via its API_TOKENS env var)."
  );
  process.exit(1);
}

const client = new BuildPilotClient({ baseUrl, apiToken });

const server = new McpServer({ name: "buildpilot", version: "0.1.0" });

function textResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function errorResult(err: unknown) {
  const message = err instanceof BuildPilotApiError ? `${err.status}: ${err.message}` : err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
}

server.registerTool(
  "get_build",
  {
    title: "Get build",
    description: "Get full detail for one CI build/workflow run, including its jobs and any failure analysis.",
    inputSchema: { buildId: z.string().describe("The build/workflow run id") },
  },
  async ({ buildId }) => {
    try {
      return textResult(await client.getBuild(buildId));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "get_failed_jobs",
  {
    title: "Get failed jobs",
    description: "List the jobs that failed within one build, each with its root-cause category if analyzed.",
    inputSchema: { buildId: z.string().describe("The build/workflow run id") },
  },
  async ({ buildId }) => {
    try {
      return textResult(await client.getFailedJobs(buildId));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "analyze_failure",
  {
    title: "Analyze failure",
    description:
      "Re-run AI root-cause analysis for a specific failure and return the result: root cause, why it failed, what changed, likely fix, confidence, and cited evidence. Never fabricates a cause — low confidence means the evidence was insufficient.",
    inputSchema: { failureId: z.string().describe("The failure id (from get_build or search_ci_history)") },
  },
  async ({ failureId }) => {
    try {
      return textResult(await client.analyzeFailure(failureId));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "search_ci_history",
  {
    title: "Search CI history",
    description:
      "Search past failures by root cause, category, or job name — answers \"have we seen this error before?\" Case-sensitive substring match.",
    inputSchema: {
      query: z.string().describe("Text to search for, e.g. an error message fragment or job name"),
      limit: z.number().int().positive().max(200).optional(),
    },
  },
  async ({ query, limit }) => {
    try {
      return textResult(await client.searchCiHistory(query, limit ?? 50));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "get_flaky_tests",
  {
    title: "Get flaky tests",
    description: "List tests currently flagged as flaky, scored from pass/fail transition history — never guessed from a single failure.",
    inputSchema: {},
  },
  async () => {
    try {
      return textResult(await client.getFlakyTests());
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "get_deployment_status",
  {
    title: "Get deployment status",
    description: "List recent deployments, optionally filtered to one repository, including rollback history.",
    inputSchema: {
      repositoryId: z.string().optional().describe("Limit to one repository's deployments"),
      limit: z.number().int().positive().max(200).optional(),
    },
  },
  async ({ repositoryId, limit }) => {
    try {
      return textResult(await client.getDeployments(repositoryId, limit ?? 50));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "get_repository_health",
  {
    title: "Get repository health",
    description: "Get a repository's 30-day health snapshot: success/failure rate, avg build duration, flaky test count, open recommendations, last deployment.",
    inputSchema: { repositoryId: z.string() },
  },
  async ({ repositoryId }) => {
    try {
      return textResult(await client.getRepositoryHealth(repositoryId));
    } catch (err) {
      return errorResult(err);
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("buildpilot-mcp server running on stdio");
