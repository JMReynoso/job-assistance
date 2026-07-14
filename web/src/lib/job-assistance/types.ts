export type JobStatus =
  | "Interested"
  | "Applied"
  | "Phone screen"
  | "Interviewing"
  | "Offer"
  | "Rejected"
  | "Ghosted";

export type MessageStyle = "Friendly" | "Formal" | "Casual" | "Direct" | "Enthusiastic";

export interface Job {
  id: string;
  companyName: string;
  status: JobStatus;
  dateApplied: string;
  dateLastContacted: string;
  messageStyle: MessageStyle;
  contactName: string;
  contactEmail: string;
  contactLinkedIn: string;
  companyUrl: string;
  referralName: string;
  jobPostingUrl: string;
  companyLinkedInUrl: string;
  notes: string;
  recruiterMessage: string;
  followupMessage: string;
}

export interface HomeFormState {
  companyName: string;
  jobPosting: string;
  companyPage: string;
  companyLinkedIn: string;
}
