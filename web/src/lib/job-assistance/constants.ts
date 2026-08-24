import type { JobContact, JobStatus } from "./types";

/** The fixed set of roles a contact can have. */
export const CONTACT_ROLE_OPTIONS = ["Recruiter", "Hiring Manager", "Referral"] as const;

/** Editable columns of the contacts table in the job detail modal. */
export const CONTACT_COLUMNS: {
  key: keyof Omit<JobContact, "id">;
  label: string;
  type?: "text" | "email" | "select";
  placeholder?: string;
  options?: readonly string[];
}[] = [
  { key: "name", label: "Contact name", placeholder: "Jane Doe" },
  { key: "role", label: "Contact role", type: "select", options: CONTACT_ROLE_OPTIONS, placeholder: "Role…" },
  { key: "email", label: "Contact email", type: "email", placeholder: "name@company.com" },
  { key: "linkedin", label: "Contact LinkedIn", placeholder: "linkedin.com/in/…" },
];

/** A fresh, empty contact row (id assigned by the caller). */
export function emptyContact(id: string): JobContact {
  return { id, name: "", role: "", email: "", linkedin: "" };
}

export const STATUS_OPTIONS: JobStatus[] = [
  "Interested",
  "Applied",
  "Phone screen",
  "Interviewing",
  "Offer",
  "Rejected",
  "Ghosted",
];

export const STATUS_STYLES: Record<JobStatus, { bg: string; color: string }> = {
  Interested: { bg: "#e7eef7", color: "#4a6b8a" },
  Applied: { bg: "#e8efd9", color: "#5f7a3a" },
  "Phone screen": { bg: "#f4ecd6", color: "#8a6a2c" },
  Interviewing: { bg: "#f3e3d0", color: "#a5622a" },
  Offer: { bg: "#dcefdc", color: "#3f7a4a" },
  Rejected: { bg: "#f3ddd7", color: "#a8503b" },
  Ghosted: { bg: "#ece7dd", color: "#7a7266" },
};

// The prototype exposed these as design-tool preview knobs (accent theme,
// striped rows, close-warning). The chat never asked for user-facing
// settings, so they're fixed to the prototype's defaults here.
export const ACCENT_COLOR = "#7f9d55";
export const OPEN_BUTTON_BG = "#e8efd9";
export const OPEN_BUTTON_COLOR = "#5f7a3a";
export const TABLE_STRIPED = true;
export const WARN_ON_CLOSE = true;
export const STALE_THRESHOLD_DAYS = 5;
