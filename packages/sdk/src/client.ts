import type {
  Repository,
  RepositoryHealth,
  BuildSummary,
  BuildDetail,
  FailureSummary,
  FailureDetail,
  FailureAnalysis,
  FlakyTest,
  Recommendation,
  Deployment,
  OverviewStats,
} from "./types.js";

export interface BuildPilotClientOptions {
  /** Base URL of a running BuildPilot instance, e.g. "https://buildpilot.example.com". */
  baseUrl: string;
  /** API token, minted via the API_TOKENS env var on the server — see docs/API.md. */
  apiToken: string;
  /** Override fetch (e.g. for testing). Defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

export class BuildPilotApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "BuildPilotApiError";
  }
}

/**
 * TypeScript client for the BuildPilot REST API (src/app/api/v1 in the main
 * repo). Every method is a thin wrapper over one endpoint — no client-side
 * caching or retries, so behavior always matches the API directly.
 */
export class BuildPilotClient {
  private readonly baseUrl: string;
  private readonly apiToken: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: BuildPilotClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiToken = options.apiToken;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl}/api/v1${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new BuildPilotApiError(res.status, body.error ?? `Request failed with ${res.status}`);
    }
    return res.json() as Promise<T>;
  }

  async listRepositories(): Promise<Repository[]> {
    const { repositories } = await this.request<{ repositories: Repository[] }>("/repositories");
    return repositories;
  }

  async getRepositoryHealth(repositoryId: string): Promise<RepositoryHealth> {
    return this.request<RepositoryHealth>(`/repositories/${repositoryId}/health`);
  }

  async listBuilds(filters: { repositoryId?: string; branch?: string; conclusion?: string; limit?: number } = {}): Promise<BuildSummary[]> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value != null) params.set(key, String(value));
    const qs = params.toString();
    const { builds } = await this.request<{ builds: BuildSummary[] }>(`/builds${qs ? `?${qs}` : ""}`);
    return builds;
  }

  async getBuild(buildId: string): Promise<BuildDetail> {
    return this.request<BuildDetail>(`/builds/${buildId}`);
  }

  async getFailedJobs(buildId: string): Promise<BuildDetail["jobs"]> {
    const build = await this.getBuild(buildId);
    return build.jobs.filter((j) => j.conclusion === "failure");
  }

  async listFailures(limit = 50): Promise<FailureSummary[]> {
    const { failures } = await this.request<{ failures: FailureSummary[] }>(`/failures?limit=${limit}`);
    return failures;
  }

  /** Case-sensitive substring search over root cause, category, and job name — "have we seen this error before?" */
  async searchCiHistory(query: string, limit = 50): Promise<FailureSummary[]> {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    const { failures } = await this.request<{ failures: FailureSummary[] }>(`/failures?${params.toString()}`);
    return failures;
  }

  async getFailure(failureId: string): Promise<FailureDetail> {
    return this.request<FailureDetail>(`/failures/${failureId}`);
  }

  /** Re-runs AI analysis for a failure on demand. */
  async analyzeFailure(failureId: string): Promise<FailureAnalysis> {
    const { analysis } = await this.request<{ analysis: FailureAnalysis }>(`/failures/${failureId}/analyze`, { method: "POST" });
    return analysis;
  }

  async getFlakyTests(): Promise<FlakyTest[]> {
    const { flakyTests } = await this.request<{ flakyTests: FlakyTest[] }>("/flaky-tests");
    return flakyTests;
  }

  async getRecommendations(status?: string): Promise<Recommendation[]> {
    const { recommendations } = await this.request<{ recommendations: Recommendation[] }>(
      `/recommendations${status ? `?status=${status}` : ""}`
    );
    return recommendations;
  }

  async getDeployments(repositoryId?: string, limit = 50): Promise<Deployment[]> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (repositoryId) params.set("repositoryId", repositoryId);
    const { deployments } = await this.request<{ deployments: Deployment[] }>(`/deployments?${params.toString()}`);
    return deployments;
  }

  async getOverview(): Promise<OverviewStats> {
    return this.request<OverviewStats>("/analytics/overview");
  }
}
