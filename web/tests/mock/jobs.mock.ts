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
    contacts: [
      {
        id: "job-1-c1",
        name: "Dana Reyes",
        role: "Recruiter",
        email: "dana@willowoak.co",
        linkedin: "linkedin.com/in/danareyes",
        confidence: 94,
      },
    ],
    companyUrl: "https://willowoak.co",
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
    contacts: [],
    companyUrl: "",
    notes: "",
    ...overrides,
  });
}
