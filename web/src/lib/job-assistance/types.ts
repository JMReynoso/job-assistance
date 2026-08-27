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
  notes: string;
  recruiterMessage: string;
  followupMessage: string;
}

export interface HomeFormState {
  companyName: string;
  jobPosting: string;
  companyPage: string;
  companyLinkedIn: string;
  extraLinks: string;
}
