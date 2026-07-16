export type JobStatus =
  | "Interested"
  | "Applied"
  | "Phone screen"
  | "Interviewing"
  | "Offer"
  | "Rejected"
  | "Ghosted";

export type MessageStyle = "Friendly" | "Formal" | "Casual" | "Direct" | "Enthusiastic";

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
  messageStyle: MessageStyle;
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
