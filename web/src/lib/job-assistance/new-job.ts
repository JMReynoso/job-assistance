import type { HomeFormState } from "./types";

/**
 * What the quick-add form must have before setup can start, with the label
 * each one wears on screen.
 *
 * The first four are what CreateJobDto requires. The job description is our
 * own rule: `POST /generated-content` takes the posting *text*, and without it
 * the tailoring stage spends four Claude calls writing a resume tailored
 * against nothing and scores it against nothing.
 *
 * Blankness is the only thing checked. The API validates URLs with `@IsUrl()`,
 * which accepts a bare `acme.com`, so a stricter client-side check would
 * reject inputs the server is happy with.
 */
const REQUIRED_FIELDS: { key: keyof HomeFormState; label: string }[] = [
  { key: "companyName", label: "Company name" },
  { key: "jobPosting", label: "Job posting link" },
  { key: "companyPage", label: "Company page" },
  { key: "companyLinkedIn", label: "Company LinkedIn" },
  { key: "jobDescription", label: "Job description" },
];

/** Labels of the required fields still blank, in form order. Empty = ready. */
export function missingAddFields(home: HomeFormState): string[] {
  return REQUIRED_FIELDS.filter((field) => !home[field.key].trim()).map((field) => field.label);
}
