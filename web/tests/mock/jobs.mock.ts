import type { Job } from "@/lib/job-assistance/types";
import { ISO_5_DAYS_AGO } from "./dates.mock";

/**
 * Builds a fully-populated Job for tests, with any field overridable.
 * Keeping one canonical builder (instead of ad-hoc literals per test)
 * means a field rename only needs to be fixed in one place.
 */
export function buildJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    companyName: "Willow & Oak",
    status: "Applied",
    dateApplied: "2026-07-03",
    dateLastContacted: ISO_5_DAYS_AGO,
    messageStyle: "Friendly",
    contactName: "Dana Reyes",
    contactEmail: "dana@willowoak.co",
    contactLinkedIn: "linkedin.com/in/danareyes",
    companyUrl: "https://willowoak.co",
    referralName: "",
    jobPostingUrl: "",
    companyLinkedInUrl: "",
    extraLinks: "",
    notes: "Reached out after the info session.",
    recruiterMessage: "",
    followupMessage: "",
    ...overrides,
  };
}

/** A freshly-added job, as it looks right after "Add to tracker" — mostly blank. */
export function buildBlankJob(overrides: Partial<Job> = {}): Job {
  return buildJob({
    companyName: "Untitled role",
    status: "Interested",
    dateApplied: "",
    dateLastContacted: "",
    messageStyle: "Friendly",
    contactName: "",
    contactEmail: "",
    contactLinkedIn: "",
    companyUrl: "",
    referralName: "",
    notes: "",
    ...overrides,
  });
}
