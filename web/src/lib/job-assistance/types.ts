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
  role: string;
  email: string;
  linkedin: string;
}

export interface Job {
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
