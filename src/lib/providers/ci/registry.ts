import type { CIProvider, CIProviderId } from "./types";
import { githubActionsProvider } from "./github-actions";
import { gitlabCiProvider } from "./gitlab-ci";
import { circleciProvider } from "./circleci";

const providers: Record<CIProviderId, CIProvider> = {
  github: githubActionsProvider,
  gitlab: gitlabCiProvider,
  circleci: circleciProvider,
};

export function getCIProvider(id: CIProviderId): CIProvider {
  const provider = providers[id];
  if (!provider) throw new Error(`Unknown CI provider: ${id}`);
  return provider;
}

export function isCIProviderId(value: string): value is CIProviderId {
  return value in providers;
}

export * from "./types";
