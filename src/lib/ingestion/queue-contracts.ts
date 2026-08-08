// Typed payload contracts for the background queues. Kept separate from the
// workers themselves so both the enqueue call sites and the worker
// registration can import the same type without a circular dependency.

export const INGEST_EVENT_QUEUE = "ingest-event";
export interface IngestEventPayload {
  eventId: string;
}

export const ANALYZE_FAILURE_QUEUE = "analyze-failure";
export interface AnalyzeFailurePayload {
  failureId: string;
  workflowRunId: string;
  jobId: string;
}

export const UPDATE_FLAKY_SCORES_QUEUE = "update-flaky-scores";
export interface UpdateFlakyScoresPayload {
  repositoryId: string;
  fullNames: string[];
}
