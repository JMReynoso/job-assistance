import { apiDelete, apiGet, apiPatch, apiPost } from "./client";
import type {
  ApiCompanyResearch,
  ApiContact,
  ApiCreateCompanyResearch,
  ApiCreateGeneratedContent,
  ApiCreateJob,
  ApiFindContacts,
  ApiGeneratedContent,
  ApiJob,
  ApiJobDetailPatch,
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

/**
 * Saves the job detail window in one call. The response is a full JobDetail
 * — the same four pieces fetchJobDetail returns — so the caller can feed it
 * straight to mergeJobDetail and show server truth rather than its own draft.
 */
export function updateJobDetail(
  jobId: number,
  patch: ApiJobDetailPatch,
): Promise<JobDetail> {
  return apiPatch<JobDetail>(`/jobs/${jobId}/detail`, patch);
}

/**
 * The four writes behind "Add to tracker", in the order the setup pipeline
 * runs them. Each takes the AbortSignal the progress modal's cancel button
 * fires, so a cancelled run stops paying for calls it no longer wants.
 */

export function createJob(body: ApiCreateJob, signal?: AbortSignal): Promise<ApiJob> {
  return apiPost<ApiJob>("/jobs", body, signal);
}

/** Runs two live Perplexity searches. Seconds, not milliseconds. */
export function createCompanyResearch(
  body: ApiCreateCompanyResearch,
  signal?: AbortSignal,
): Promise<ApiCompanyResearch> {
  return apiPost<ApiCompanyResearch>("/company-research", body, signal);
}

/**
 * Four Claude calls and a PDF render — the slowest endpoint in the app. 404s
 * unless the job already has a company_research row, which is why the caller
 * must await createCompanyResearch first.
 */
export function createGeneratedContent(
  body: ApiCreateGeneratedContent,
  signal?: AbortSignal,
): Promise<ApiGeneratedContent> {
  return apiPost<ApiGeneratedContent>("/generated-content", body, signal);
}

/** Runs a Hunter domain search. Returns *every* contact on the job, not just new ones. */
export function findContacts(body: ApiFindContacts, signal?: AbortSignal): Promise<ApiContact[]> {
  return apiPost<ApiContact[]>("/contacts", body, signal);
}

/**
 * Undo for a cancelled setup run. Four separate deletes because the schema has
 * no cascade to lean on: `jobId` is a bare integer with no foreign key, so
 * deleting the job leaves its research, content and contacts pointing at
 * nothing. (`DELETE /generated-content/:id` does clean up its own
 * missing_keywords — that FK is the schema's only one.)
 */
export function deleteJob(jobId: number): Promise<void> {
  return apiDelete(`/jobs/${jobId}`);
}

export function deleteCompanyResearch(id: number): Promise<void> {
  return apiDelete(`/company-research/${id}`);
}

export function deleteGeneratedContent(id: number): Promise<void> {
  return apiDelete(`/generated-content/${id}`);
}

export function deleteContact(id: number): Promise<void> {
  return apiDelete(`/contacts/${id}`);
}
