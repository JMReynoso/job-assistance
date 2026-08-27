import type { Job, JobContact, JobStatus } from "@/lib/job-assistance/types";
import type { JobDetail } from "./jobs";
import type { ApiContact, ApiJob, ApiStatus } from "./types";

/**
 * Translates between the API's shapes and the UI's. The two schemas diverge on
 * almost every field name, and this is the only place that knows about it.
 */

const STATUS_FROM_API: Record<ApiStatus, JobStatus> = {
  // 'not_applied' and 'Interested' aren't quite the same idea — the backend
  // describes the application, the UI describes intent — but they're the same
  // row state, so they map to each other.
  not_applied: "Interested",
  applied: "Applied",
  phone_screening: "Phone screen",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
  ghosted: "Ghosted",
};

/** Derived from the map above, so the two directions can't drift apart. */
export const STATUS_TO_API = Object.fromEntries(
  Object.entries(STATUS_FROM_API).map(([api, ui]) => [ui, api]),
) as Record<JobStatus, ApiStatus>;

/**
 * `status` is an unconstrained `text` column, so an unmapped value is possible.
 * The fallback isn't padding: JobTableRow reads STATUS_STYLES[status].bg, and
 * an undefined lookup there throws and unmounts the whole table.
 */
export function toJobStatus(status: string): JobStatus {
  return STATUS_FROM_API[status as ApiStatus] ?? "Interested";
}

/**
 * The backend id behind a row, or null for a row that only exists locally.
 * Doubles as the "has this been persisted?" test — a locally-added job opens
 * instantly with its local data instead of firing a request that can't resolve.
 */
export function toJobId(id: string): number | null {
  const parsed = Number(id);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function mapContact(api: ApiContact): JobContact {
  return {
    id: String(api.id),
    // Hunter often has one half of a name, or neither.
    name: [api.firstName, api.lastName].filter(Boolean).join(" "),
    role: api.position ?? "",
    email: api.email,
    linkedin: api.linkedin ?? "",
    confidence: api.confidence,
  };
}

/**
 * A job as the list knows it. The three by-job resources aren't part of
 * GET /jobs, so those fields start empty and are filled by mergeJobDetail when
 * the row is opened.
 *
 * Every string field coalesces away null: these bind to controlled inputs, and
 * a null value flips one to uncontrolled, at which point it silently stops
 * tracking state.
 */
export function mapJob(api: ApiJob): Job {
  return {
    id: String(api.id),
    companyName: api.companyName,
    status: toJobStatus(api.status),
    dateApplied: api.dateApplied,
    dateLastContacted: api.dateLastContacted,
    contacts: [],
    companyUrl: api.companyPage,
    jobPostingUrl: api.jobPostingURL,
    companyLinkedInUrl: api.companyLinkedIn,
    extraLinks: api.extraURLs ?? "",
    jobDescription: api.jobDescription ?? "",
    notes: "",
    recruiterMessage: "",
    followupMessage: "",
    jdMatchPercent: null,
    missingKeywords: [],
  };
}

/** Folds the three by-job reads onto the job they belong to. */
export function mergeJobDetail(detail: JobDetail): Job {
  return {
    ...mapJob(detail.job),
    contacts: detail.contacts.map(mapContact),
    notes: detail.research?.summary ?? "",
    recruiterMessage: detail.content?.outreachMessage ?? "",
    followupMessage: detail.content?.followupMessage ?? "",
    // Stays null rather than coalescing to "" — it drives a "not scored yet"
    // branch and never binds to a controlled input, so the usual ?? "" rule
    // doesn't apply here.
    jdMatchPercent: detail.content?.jdMatchPercent ?? null,
    missingKeywords: (detail.content?.missingKeywords ?? []).map((k) => ({
      keyword: k.keyword,
      include: k.include,
    })),
  };
}
