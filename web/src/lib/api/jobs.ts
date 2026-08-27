import { apiGet, apiPost } from "./client";
import type {
  ApiCompanyResearch,
  ApiContact,
  ApiGeneratedContent,
  ApiJob,
} from "./types";

/** Everything the detail modal needs for one job, as the API returns it. */
export interface JobDetail {
  job: ApiJob;
  contacts: ApiContact[];
  /** null when the job has never been researched. */
  research: ApiCompanyResearch | null;
  /** null when nothing has been generated for the job yet. */
  content: ApiGeneratedContent | null;
}

export function fetchJobs(): Promise<ApiJob[]> {
  return apiGet<ApiJob[]>("/jobs");
}

/**
 * All four reads for one job, in parallel.
 *
 * `Promise.all` rather than `allSettled` on purpose: the two resources a new
 * job legitimately lacks come back as `null` from a perfectly successful
 * request, so absence is already handled and anything that rejects here is a
 * real failure worth surfacing as one error with one retry. If these endpoints
 * ever diverge in reliability, `allSettled` is the upgrade path.
 *
 * Re-reading /jobs/:id when the list row already has those fields is one
 * redundant round-trip, kept because it's free (parallel) and means the modal
 * shows the truth even if the list is stale.
 */
export async function fetchJobDetail(jobId: number): Promise<JobDetail> {
  const [job, contacts, research, content] = await Promise.all([
    apiGet<ApiJob>(`/jobs/${jobId}`),
    apiGet<ApiContact[]>(`/contacts/by-job/${jobId}`),
    apiGet<ApiCompanyResearch | null>(`/company-research/by-job/${jobId}`),
    apiGet<ApiGeneratedContent | null>(`/generated-content/by-job/${jobId}`),
  ]);

  return { job, contacts, research, content };
}

/**
 * Rewrites the newest tailored resume for a job with the checked keywords
 * and re-scores it. Accepts an AbortSignal so the progress modal's cancel
 * button can abort the in-flight request.
 */
export function regenerateTailoredResume(
  jobId: number,
  keywords: string[],
  signal?: AbortSignal,
): Promise<ApiGeneratedContent> {
  return apiPost<ApiGeneratedContent>("/generated-content/regenerate", { jobId, keywords }, signal);
}
