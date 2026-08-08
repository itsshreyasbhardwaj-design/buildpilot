import { db } from "@/lib/db";
import { redact, redactSecrets } from "@/lib/security/redact";
import { getCIProvider } from "@/lib/providers/ci/registry";
import type { CIProviderId, NormalizedWebhookEvent, NormalizedRun } from "@/lib/providers/ci/types";
import { getQueueProvider } from "@/lib/providers/queue/registry";
import { ANALYZE_FAILURE_QUEUE, type AnalyzeFailurePayload } from "./queue-contracts";

/**
 * Best-effort: fetches raw job logs from the provider's API (only possible
 * once a real installation token is configured — see docs/GITHUB_APP.md) and
 * stores a redacted excerpt for the AI analyzer to read. In demo mode, or
 * before a provider credential is configured, this is a no-op and the
 * analyzer correctly reports low confidence instead of fabricating a cause.
 */
async function tryFetchAndStoreJobLogs(
  providerId: CIProviderId,
  repositoryId: string,
  jobId: string,
  jobExternalId: string
): Promise<void> {
  const repository = await db.repository.findUnique({ where: { id: repositoryId } });
  if (!repository?.installationId) return;

  try {
    const provider = getCIProvider(providerId);
    const rawLog = await provider.fetchJobLogs({
      installationRef: repository.installationId,
      repositoryExternalId: repository.externalId,
      jobExternalId,
    });
    const { text } = redactSecrets(rawLog);
    const lastStep = await db.step.findFirst({ where: { jobId }, orderBy: { number: "desc" } });
    if (lastStep) {
      await db.step.update({ where: { id: lastStep.id }, data: { logExcerpt: text.slice(-8000) } });
    }
  } catch {
    // Logged at the caller's discretion; log fetching is opportunistic and
    // must never block ingestion of the run/job/failure records themselves.
  }
}

async function upsertBranchAndCommit(repositoryId: string, run: NormalizedRun | undefined, commit: NormalizedWebhookEvent["commit"]) {
  let branchId: string | undefined;
  let commitId: string | undefined;

  if (run?.branch) {
    const branch = await db.branch.upsert({
      where: { repositoryId_name: { repositoryId, name: run.branch } },
      create: { repositoryId, name: run.branch },
      update: {},
    });
    branchId = branch.id;
  }

  if (commit) {
    const row = await db.commit.upsert({
      where: { repositoryId_sha: { repositoryId, sha: commit.sha } },
      create: {
        repositoryId,
        sha: commit.sha,
        message: redact(commit.message),
        authorName: commit.authorName,
        authorEmail: commit.authorEmail,
        changedFiles: JSON.stringify(commit.changedFiles),
        committedAt: commit.committedAt,
      },
      update: {
        // A push event may arrive with more file detail than a later
        // workflow_run event for the same sha — keep the richer changedFiles.
        changedFiles: commit.changedFiles.length > 0 ? JSON.stringify(commit.changedFiles) : undefined,
      },
    });
    commitId = row.id;
  } else if (run?.commitSha) {
    const existing = await db.commit.findUnique({ where: { repositoryId_sha: { repositoryId, sha: run.commitSha } } });
    commitId = existing?.id;
  }

  return { branchId, commitId };
}

/**
 * Applies one normalized webhook event to the domain model: upserts the
 * workflow/run/job/step rows, records a Failure when a job concluded with
 * failure, and enqueues AI analysis for it. This is the single place that
 * translates provider-agnostic events into BuildPilot's schema — see
 * docs/ARCHITECTURE.md#event-pipeline.
 */
export async function ingestNormalizedEvent(repositoryId: string, event: NormalizedWebhookEvent): Promise<void> {
  const { branchId, commitId } = await upsertBranchAndCommit(repositoryId, event.run, event.commit);

  if (!event.run) return; // push-only events (no run) just update commit/branch history.

  const run = event.run;
  const workflow = await db.workflow.upsert({
    where: {
      repositoryId_provider_externalId: {
        repositoryId,
        provider: event.provider,
        externalId: run.workflowExternalId || run.workflowName,
      },
    },
    create: {
      repositoryId,
      provider: event.provider,
      externalId: run.workflowExternalId || run.workflowName,
      name: run.workflowName,
      path: run.workflowPath,
    },
    update: { name: run.workflowName },
  });

  const workflowRun = await db.workflowRun.upsert({
    where: { repositoryId_workflowId_externalId: { repositoryId, workflowId: workflow.id, externalId: run.externalId } },
    create: {
      repositoryId,
      workflowId: workflow.id,
      branchId,
      commitId,
      externalId: run.externalId,
      runNumber: run.runNumber,
      status: run.status,
      conclusion: run.conclusion,
      triggeredBy: run.triggeredBy,
      event: run.event,
      queuedAt: run.queuedAt,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      durationMs:
        run.startedAt && run.completedAt ? run.completedAt.getTime() - run.startedAt.getTime() : undefined,
    },
    update: {
      status: run.status,
      conclusion: run.conclusion,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      durationMs:
        run.startedAt && run.completedAt ? run.completedAt.getTime() - run.startedAt.getTime() : undefined,
      branchId,
      commitId,
    },
  });

  for (const jobInput of run.jobs) {
    const job = await db.job.upsert({
      where: { workflowRunId_externalId: { workflowRunId: workflowRun.id, externalId: jobInput.externalId } },
      create: {
        workflowRunId: workflowRun.id,
        externalId: jobInput.externalId,
        name: jobInput.name,
        status: jobInput.status,
        conclusion: jobInput.conclusion,
        startedAt: jobInput.startedAt,
        completedAt: jobInput.completedAt,
        runnerLabel: jobInput.runnerLabel,
        durationMs:
          jobInput.startedAt && jobInput.completedAt
            ? jobInput.completedAt.getTime() - jobInput.startedAt.getTime()
            : undefined,
      },
      update: {
        status: jobInput.status,
        conclusion: jobInput.conclusion,
        startedAt: jobInput.startedAt,
        completedAt: jobInput.completedAt,
        durationMs:
          jobInput.startedAt && jobInput.completedAt
            ? jobInput.completedAt.getTime() - jobInput.startedAt.getTime()
            : undefined,
      },
    });

    for (const step of jobInput.steps) {
      await db.step.upsert({
        where: { jobId_number: { jobId: job.id, number: step.number } },
        create: {
          jobId: job.id,
          name: step.name,
          number: step.number,
          status: step.status,
          conclusion: step.conclusion,
          startedAt: step.startedAt,
          completedAt: step.completedAt,
        },
        update: {
          status: step.status,
          conclusion: step.conclusion,
          startedAt: step.startedAt,
          completedAt: step.completedAt,
        },
      });
    }

    if (jobInput.conclusion === "failure") {
      await tryFetchAndStoreJobLogs(event.provider, repositoryId, job.id, jobInput.externalId);

      const failure = await db.failure.create({
        data: {
          workflowRunId: workflowRun.id,
          jobId: job.id,
        },
      });

      const queue = getQueueProvider();
      const payload: AnalyzeFailurePayload = { failureId: failure.id, workflowRunId: workflowRun.id, jobId: job.id };
      await queue.enqueue(ANALYZE_FAILURE_QUEUE, payload);
    }
  }
}
