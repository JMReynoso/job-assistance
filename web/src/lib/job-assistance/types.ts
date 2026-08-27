export type JobStatus =
  | "Interested"
  | "Applied"
  | "Phone screen"
  | "Interviewing"
  | "Offer"
  | "Rejected"
  | "Ghosted";

/** One step of the "Add to tracker" generation pipeline. */
export type JobStageKey = "created" | "research" | "tailoring" | "contact" | "ready";

/** Status of a single pipeline stage, driven by the backend (200/201 → done). */
export type JobStageStatus = "pending" | "running" | "done" | "failed";

export interface JobStage {
  key: JobStageKey;
  status: JobStageStatus;
}

export interface JobContact {
  id: string;
  name: string;
  /** Free text — Hunter returns arbitrary job titles, not a fixed vocabulary. */
  role: string;
  email: string;
  linkedin: string;
  /** Hunter's 0–100 deliverability score; null for a contact added by hand. */
  confidence: number | null;
}

export interface JobKeyword {
  keyword: string;
  include: boolean;
}

/** Stages of the regenerate-resume pipeline. */
export type RegenerateStageKey = "keywords" | "rewriting" | "rendering" | "scoring";

export interface RegenerateStage {
  key: RegenerateStageKey;
  status: JobStageStatus;
}

export interface Job {
  /**
   * The backend row id as a string. A job that only exists locally (added but
   * not yet persisted) has a non-numeric id — see `toJobId` in lib/api/mappers.
   */
  id: string;
  companyName: string;
  status: JobStatus;
  dateApplied: string;
  dateLastContacted: string;
  contacts: JobContact[];
  companyUrl: string;
  jobPostingUrl: string;
  companyLinkedInUrl: string;
  extraLinks: string;
  /** The full job posting text — what the resume is tailored and scored against. */
  jobDescription: string;
  notes: string;
  recruiterMessage: string;
  followupMessage: string;
  /** 0-100, or null until the tailored resume has been scored. */
  jdMatchPercent: number | null;
  missingKeywords: JobKeyword[];
}

export interface HomeFormState {
  companyName: string;
  jobPosting: string;
  companyPage: string;
  companyLinkedIn: string;
  extraLinks: string;
  jobDescription: string;
}
