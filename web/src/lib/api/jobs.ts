import { apiDelete, apiGet, apiPatch, apiPost } from "./client";
import type {
  ApiAiProvider,
  ApiCompanyResearch,
  ApiContact,
  ApiCreateCompanyResearch,
  ApiCreateGeneratedContent,
  ApiCreateJob,
  ApiFindContacts,
  ApiGeneratedContent,
  ApiJob,
  ApiJobDetail,
  ApiJobDetailPatch,
} from "./types";

export function fetchJobs(): Promise<ApiJob[]> {
  return apiGet<ApiJob[]>("/jobs");
}

/**
 * The whole Job Detail for one job — the job and its satellites — in one
 * request. A job that exists but has no satellites yet is a normal 200 (`[]`
 * and `null`); only a job that doesn't exist rejects, with a 404.
 */
export function fetchJobDetail(jobId: number): Promise<ApiJobDetail> {
  return apiGet<ApiJobDetail>(`/jobs/${jobId}/detail`);
}

/**
 * Rewrites the newest tailored resume for a job with the checked keywords
 * and re-scores it. Accepts an AbortSignal so the progress modal's cancel
 * button can abort the in-flight request.
 */
export function regenerateTailoredResume(
  jobId: number,
  keywords: string[],
  provider: ApiAiProvider | null,
  signal?: AbortSignal,
): Promise<ApiGeneratedContent> {
  return apiPost<ApiGeneratedContent>(
    "/generated-content/regenerate",
    // null means the row predates the provider column — let the server apply
    // its own default rather than asserting an engine we don't actually know.
    { jobId, keywords, ...(provider ? { provider } : {}) },
    signal,
  );
}

/**
 * Saves the job detail window in one call. The response is a full ApiJobDetail
 * — the same four pieces fetchJobDetail returns — so the caller can feed it
 * straight to mergeJobDetail and show server truth rather than its own draft.
 */
export function updateJobDetail(
  jobId: number,
  patch: ApiJobDetailPatch,
): Promise<ApiJobDetail> {
  return apiPatch<ApiJobDetail>(`/jobs/${jobId}/detail`, patch);
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
 * Four AI calls and a PDF render — the slowest endpoint in the app, and far
 * slower still on the local engine. 404s unless the job already has a
 * company_research row, which is why the caller must await
 * createCompanyResearch first.
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
