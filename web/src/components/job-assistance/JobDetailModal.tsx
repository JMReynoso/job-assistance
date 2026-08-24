"use client";

import type { Job } from "@/lib/job-assistance/types";
import { OPEN_BUTTON_BG, OPEN_BUTTON_COLOR, STATUS_OPTIONS } from "@/lib/job-assistance/constants";
import { isStale } from "@/lib/job-assistance/date";
import ContactsTable from "./ContactsTable";
import FormField from "./FormField";
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
}

export default function JobDetailModal({
  draft,
  dirty,
  onFieldChange,
  onClose,
  onTrash,
  onSave,
  onGetResume,
}: JobDetailModalProps) {
  const title = draft.companyName.trim() || "Job details";
  const contactStale = isStale(draft.dateLastContacted);

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
              style={{ background: OPEN_BUTTON_BG, color: OPEN_BUTTON_COLOR, borderColor: `${OPEN_BUTTON_COLOR}22` }}
              className="inline-flex items-center gap-[9px] rounded-xl border px-5 py-[11px] text-[14px] font-semibold hover:brightness-[0.97]"
            >
              <span className="text-[16px] leading-none">↓</span> Get Tailored Resume
            </button>
          </div>

          <div className="mt-4 flex justify-end border-t border-row-border pt-4">
            <button
              onClick={onSave}
              disabled={!dirty}
              style={{
                background: dirty ? "var(--color-sage)" : "#e6e0d1",
                color: dirty ? "#fff" : "#b3aa98",
                cursor: dirty ? "pointer" : "not-allowed",
              }}
              className="rounded-xl px-[26px] py-[11px] text-[14px] font-semibold transition-colors duration-200"
            >
              {dirty ? "Save changes" : "Saved"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
