import { analyzeFailureById } from "@/lib/ingestion/analyze-failure";
import type { AnalyzeFailurePayload } from "@/lib/ingestion/queue-contracts";

export async function handleAnalyzeFailure(payload: AnalyzeFailurePayload): Promise<void> {
  await analyzeFailureById(payload.failureId);
}
