import type { JobStage, JobStageKey } from "./types";

interface StageMeta {
  key: JobStageKey;
  /** Short label shown under the node. */
  label: string;
  /** Status line shown while this stage is running. */
  active: string;
  /** Caption shown once this stage finishes. */
  done: string;
}

/**
 * The ordered stages of the create-job pipeline, in the order the backend
 * runs (and pushes) them. The frontend renders one stepper node per stage;
 * each node's status comes straight from the server (a stage flips to "done"
 * when its API call returns 200/201).
 */
export const JOB_PROGRESS_STAGES: StageMeta[] = [
  { key: "created", label: "Job created", active: "Saving the job…", done: "Job created and saved" },
  {
    key: "research",
    label: "Company research",
    active: "Researching the company with Perplexity…",
    done: "Research finished and processed",
  },
  {
    key: "tailoring",
    label: "Application tailoring",
    active: "Tailoring your resume & messages with Claude…",
    done: "Resume & messages finished and processed",
  },
  {
    key: "contact",
    label: "Find hiring manager",
    active: "Finding the hiring manager with Hunter.io…",
    done: "Hiring manager finished and processed",
  },
  { key: "ready", label: "Saved & ready", active: "Finalizing and saving everything…", done: "Saved and ready to view" },
];

export const STAGE_META: Record<JobStageKey, StageMeta> = Object.fromEntries(
  JOB_PROGRESS_STAGES.map((s) => [s.key, s]),
) as Record<JobStageKey, StageMeta>;

/** A fresh pipeline with every stage still pending. */
export function initialStages(): JobStage[] {
  return JOB_PROGRESS_STAGES.map((s) => ({ key: s.key, status: "pending" }));
}

/** Fill fraction (0–100) for the connecting track: reaches the active node. */
export function progressPercent(stages: JobStage[]): number {
  if (stages.length <= 1) return 0;
  const done = stages.filter((s) => s.status === "done").length;
  return Math.min(100, (done / (stages.length - 1)) * 100);
}

export function isComplete(stages: JobStage[]): boolean {
  return stages.length > 0 && stages.every((s) => s.status === "done");
}

/** The stage currently in flight, if any. */
export function activeStage(stages: JobStage[]): JobStage | undefined {
  return stages.find((s) => s.status === "running");
}

export function failedStage(stages: JobStage[]): JobStage | undefined {
  return stages.find((s) => s.status === "failed");
}
