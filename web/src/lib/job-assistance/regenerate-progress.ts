import type { RegenerateStage, RegenerateStageKey } from "./types";

interface RegenerateStageMeta {
  key: RegenerateStageKey;
  /** Short label shown under the node. */
  label: string;
  /** Status line shown while this stage is running. */
  active: string;
}

/**
 * The ordered stages of the regenerate-resume pipeline. Mirrors
 * JOB_PROGRESS_STAGES in job-progress.ts, but for one POST instead of four —
 * see useRegenerateResume's doc comment for why the timing is cosmetic.
 */
export const REGENERATE_STAGES: RegenerateStageMeta[] = [
  { key: "keywords", label: "Keywords", active: "Saving your keyword selection…" },
  { key: "rewriting", label: "Rewriting", active: "Working the keywords into your resume with Claude…" },
  { key: "rendering", label: "New PDF", active: "Rendering the updated resume…" },
  { key: "scoring", label: "Re-scoring", active: "Re-scoring the match against the job description…" },
];

export const REGENERATE_STAGE_META: Record<RegenerateStageKey, RegenerateStageMeta> = Object.fromEntries(
  REGENERATE_STAGES.map((s) => [s.key, s]),
) as Record<RegenerateStageKey, RegenerateStageMeta>;

/** A fresh regenerate pipeline with every stage still pending. */
export function initialRegenerateStages(): RegenerateStage[] {
  return REGENERATE_STAGES.map((s) => ({ key: s.key, status: "pending" }));
}
