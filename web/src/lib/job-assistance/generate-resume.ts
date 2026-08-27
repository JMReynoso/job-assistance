import type { Job } from "./types";

function slugify(name: string): string {
  return name.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "job";
}

/**
 * Placeholder export matching the prototype: no tailoring service exists yet,
 * this just packages the draft's contact info and notes into a text file.
 */
export function downloadTailoredResume(draft: Job) {
  const name = draft.companyName.trim() || "job";
  const primaryContact = draft.contacts[0];
  const lines = [
    "TAILORED RESUME",
    "================",
    `Target role: ${name}`,
    `Job posting: ${draft.jobPostingUrl || "—"}`,
    `Contact: ${primaryContact?.name || "—"}${primaryContact?.email ? ` <${primaryContact.email}>` : ""}`,
    "",
    "NOTES",
    "-----",
    draft.notes || "(none)",
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `resume-${slugify(name)}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
