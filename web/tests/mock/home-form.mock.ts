import type { HomeFormState } from "@/lib/job-assistance/types";

export function buildHomeForm(overrides: Partial<HomeFormState> = {}): HomeFormState {
  return {
    companyName: "",
    jobPosting: "",
    companyPage: "",
    companyLinkedIn: "",
    extraLinks: "",
    jobDescription: "",
    ...overrides,
  };
}
