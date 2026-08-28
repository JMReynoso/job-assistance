"use client";

import type { Job, JobKeyword } from "@/lib/job-assistance/types";
import type { DetailStatus, SaveStatus } from "@/hooks/useJobTracker";
import { OPEN_BUTTON_BG, OPEN_BUTTON_COLOR, STATUS_OPTIONS } from "@/lib/job-assistance/constants";
import { isStale } from "@/lib/job-assistance/date";
import ContactsTable from "./ContactsTable";
import FormField from "./FormField";
import MissingKeywords from "./MissingKeywords";
import SelectField from "./SelectField";
import TextAreaField from "./TextAreaField";

interface JobDetailModalProps {
  draft: Job;
  dirty: boolean;
  onFieldChange: <K extends keyof Job>(field: K, value: Job[K]) => void;
  onClose: () => void;
  onTrash: () => void;
  onSave: () => void;
  onGetResume: () => void;
  /** Defaults to "idle" so a job with nothing to fetch renders no chrome. */
  detailStatus?: DetailStatus;
  onRetryDetail?: () => void;
  /** Save is idle until the button is pressed; "error" shows a retry strip. */
  saveStatus?: SaveStatus;
  /** The generated resume's file name, or null when none exists yet. */
  resumeFileName?: string | null;
  /** 0-100, or null when the tailored resume hasn't been scored yet. */
  jdMatchPercent?: number | null;
  missingKeywords?: JobKeyword[];
  onToggleKeyword?: (keyword: string) => void;
  onRegenerate?: () => void;
  regenerating?: boolean;
}

export default function JobDetailModal({
  draft,
  dirty,
  onFieldChange,
  onClose,
  onTrash,
  onSave,
  onGetResume,
  detailStatus = "idle",
  onRetryDetail,
  saveStatus = "idle",
  resumeFileName = null,
  jdMatchPercent = null,
  missingKeywords = [],
  onToggleKeyword,
  onRegenerate,
  regenerating = false,
}: JobDetailModalProps) {
  const title = draft.companyName.trim() || "Job details";
  const contactStale = isStale(draft.dateLastContacted);
  const loading = detailStatus === "loading";
  const saving = saveStatus === "saving";
  const hasResume = Boolean(resumeFileName);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-[rgba(45,36,26,0.42)] px-5 py-10">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-detail-modal-title"
        className="w-full max-w-[780px] overflow-hidden rounded-3xl bg-card shadow-[0_24px_70px_rgba(40,30,18,0.32)]"
      >
        <div className="flex items-center justify-between border-b border-table-border bg-[#fbf8f1] px-6 py-5">
          <div id="job-detail-modal-title" className="font-heading text-[21px] font-semibold">
            {title}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onTrash}
              className="rounded-[10px] bg-[#f3ddd7] px-[15px] py-[7px] text-[13px] font-semibold text-[#a8503b] hover:bg-[#eecabf]"
            >
              Delete
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="h-[34px] w-[34px] rounded-[10px] bg-[#efe9db] text-[17px] leading-none text-muted-2 hover:bg-[#e6dfce]"
            >
              ✕
            </button>
          </div>
        </div>

        {loading && (
          <div className="mx-6 mt-5 flex items-center gap-2.5 rounded-xl bg-[#faf7f0] px-4 py-3 text-[13px] text-muted-2">
            <span
              aria-hidden
              className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-sage/30 border-t-sage"
            />
            <span aria-live="polite">Loading this job&rsquo;s details…</span>
          </div>
        )}

        {detailStatus === "error" && (
          <div className="mx-6 mt-5 flex items-center justify-between gap-2.5 rounded-xl bg-[#f8ddd5] px-4 py-3 text-[13px] text-[#a8503b]">
            <span aria-live="polite">Couldn&rsquo;t load this job&rsquo;s details.</span>
            <button
              onClick={onRetryDetail}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-maple px-3.5 py-1.5 text-[13px] font-semibold text-white hover:brightness-105"
            >
              <span aria-hidden className="text-[14px] leading-none">
                ↻
              </span>{" "}
              Try again
            </button>
          </div>
        )}

        {/* Disabled while loading so the user can't type edits that the
            arriving response would silently overwrite. A bare <fieldset> brings
            UA margin/padding/border and min-width:min-content, which would
            break the grid below — hence the reset classes. */}
        <fieldset disabled={loading || saving} className="m-0 min-w-0 border-0 p-0 disabled:opacity-60">
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Company name" value={draft.companyName} onChange={(v) => onFieldChange("companyName", v)} />
              <SelectField
                label="Status"
                value={draft.status}
                options={STATUS_OPTIONS}
                onChange={(v) => onFieldChange("status", v as Job["status"])}
              />
              <FormField
                label="Date applied"
                type="date"
                value={draft.dateApplied}
                onChange={(v) => onFieldChange("dateApplied", v)}
              />
              <FormField
                label="Date last contacted"
                type="date"
                value={draft.dateLastContacted}
                onChange={(v) => onFieldChange("dateLastContacted", v)}
                inputStyle={{
                  borderColor: contactStale ? "#d99a89" : "#e0d9c8",
                  background: contactStale ? "#f8ddd5" : "#fff",
                }}
              />
              <FormField
                label="Job posting URL"
                placeholder="https://boards.greenhouse.io/…"
                value={draft.jobPostingUrl}
                onChange={(v) => onFieldChange("jobPostingUrl", v)}
              />
              <FormField
                label="Company URL"
                placeholder="https://company.com"
                value={draft.companyUrl}
                onChange={(v) => onFieldChange("companyUrl", v)}
              />
            </div>

            <ContactsTable className="mt-5" contacts={draft.contacts} />

            <TextAreaField
              className="mt-5"
              label="Notes"
              value={draft.notes}
              onChange={(v) => onFieldChange("notes", v)}
              placeholder="Jot down anything — call recaps, next steps, questions to ask…"
              minHeight={150}
            />

            <TextAreaField
              className="mt-[18px]"
              label="Job description"
              value={draft.jobDescription}
              onChange={(v) => onFieldChange("jobDescription", v)}
              placeholder="Paste the full job posting text here — this is what the resume is tailored and scored against…"
              minHeight={150}
            />

            <TextAreaField
              className="mt-[18px]"
              label="Recruiter/HM message"
              value={draft.recruiterMessage}
              onChange={(v) => onFieldChange("recruiterMessage", v)}
              placeholder="Draft your outreach to the recruiter or hiring manager…"
              minHeight={110}
            />

            <TextAreaField
              className="mt-4"
              label="Follow-up message"
              value={draft.followupMessage}
              onChange={(v) => onFieldChange("followupMessage", v)}
              placeholder="Draft a follow-up to send after applying or interviewing…"
              minHeight={110}
            />

            <div className="mt-4 flex justify-start">
              <button
                onClick={onGetResume}
                disabled={!hasResume}
                title={hasResume ? undefined : "No tailored resume has been generated for this job yet"}
                style={
                  hasResume
                    ? { background: OPEN_BUTTON_BG, color: OPEN_BUTTON_COLOR, borderColor: `${OPEN_BUTTON_COLOR}22` }
                    : { background: "#f0ece2", color: "#b3aa98", borderColor: "transparent", cursor: "not-allowed" }
                }
                className="inline-flex items-center gap-[9px] rounded-xl border px-5 py-[11px] text-[14px] font-semibold enabled:hover:brightness-[0.97]"
              >
                <span className="text-[16px] leading-none">↓</span> Get Tailored Resume
              </button>
            </div>

            {jdMatchPercent !== null && (
              <div className="mt-4">
                <div className="text-[14px] font-semibold text-ink">
                  Job Description Match: {jdMatchPercent}%
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-table-border">
                  <div
                    className="h-full rounded-full bg-sage transition-all duration-500"
                    style={{ width: `${jdMatchPercent}%` }}
                  />
                </div>
              </div>
            )}

            {missingKeywords.length > 0 && (
              <MissingKeywords
                className="mt-4"
                keywords={missingKeywords}
                onToggle={(k) => onToggleKeyword?.(k)}
                disabled={regenerating}
              />
            )}

            {missingKeywords.length > 0 && (
              <div className="mt-4 flex justify-start">
                <button
                  onClick={onRegenerate}
                  disabled={regenerating || !missingKeywords.some((k) => k.include)}
                  title={
                    missingKeywords.some((k) => k.include)
                      ? undefined
                      : "Check at least one keyword to add to your resume"
                  }
                  className="inline-flex items-center gap-[9px] rounded-xl bg-sage px-5 py-[11px] text-[14px] font-semibold text-white enabled:hover:brightness-105 disabled:cursor-not-allowed disabled:bg-[#e6e0d1] disabled:text-[#b3aa98]"
                >
                  <span className="text-[16px] leading-none">↻</span> Regenerate Tailored Resume
                </button>
              </div>
            )}

            <div className="mt-4 flex items-center justify-end gap-3 border-t border-row-border pt-4">
              {saveStatus === "error" && (
                <span
                  aria-live="polite"
                  className="rounded-xl bg-[#f8ddd5] px-4 py-2 text-[13px] text-[#a8503b]"
                >
                  Couldn&rsquo;t save your changes.
                </span>
              )}
              <button
                onClick={onSave}
                disabled={!dirty || saving}
                style={{
                  background: dirty && !saving ? "var(--color-sage)" : "#e6e0d1",
                  color: dirty && !saving ? "#fff" : "#b3aa98",
                  cursor: dirty && !saving ? "pointer" : "not-allowed",
                }}
                className="rounded-xl px-[26px] py-[11px] text-[14px] font-semibold transition-colors duration-200"
              >
                {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
              </button>
            </div>
          </div>
        </fieldset>
      </div>
    </div>
  );
}
