import type { AIProvider } from "./types";
import { localAnalyzer } from "./local-analyzer";
import { createOpenRouterProvider } from "./openrouter";

let cached: AIProvider | null = null;

/**
 * Defaults to the local deterministic analyzer — no API key, no cost, no
 * network call. Set AI_PROVIDER=openrouter (and OPENROUTER_API_KEY) to opt
 * into real LLM analysis. This function is the ONLY place that decision is
 * made, so it can't drift between call sites.
 */
export function getAIProvider(): AIProvider {
  if (cached) return cached;
  cached = process.env.AI_PROVIDER === "openrouter" ? createOpenRouterProvider() : localAnalyzer;
  return cached;
}

export * from "./types";
