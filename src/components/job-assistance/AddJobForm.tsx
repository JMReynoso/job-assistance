"use client";

import type { HomeFormState } from "@/lib/job-assistance/types";
import FormField from "./FormField";

interface AddJobFormProps {
  home: HomeFormState;
  onFieldChange: (field: keyof HomeFormState, value: string) => void;
  onAdd: () => void;
}

const FIELDS: { key: keyof HomeFormState; label: string; placeholder: string }[] = [
  { key: "companyName", label: "Company name", placeholder: "e.g. Willow & Oak" },
  { key: "jobPosting", label: "Job posting URL", placeholder: "https://…/careers/role" },
  { key: "companyPage", label: "Company page", placeholder: "https://company.com" },
  { key: "companyLinkedIn", label: "Company LinkedIn", placeholder: "https://linkedin.com/company/…" },
];

export default function AddJobForm({ home, onFieldChange, onAdd }: AddJobFormProps) {
  return (
    <section className="mb-7 rounded-[22px] border border-card-border bg-card px-7 py-[26px] shadow-[0_1px_3px_rgba(70,55,35,0.04)]">
      <h2 className="m-0 mb-[3px] font-heading text-[23px] font-semibold">Start tracking a job</h2>
      <p className="mb-5 text-[14px] text-muted">Paste the links, give it a name, and it lands in your tracker below.</p>

      <div className="mb-5 grid grid-cols-2 gap-4">
        {FIELDS.map((field) => (
          <FormField
            key={field.key}
            label={field.label}
            placeholder={field.placeholder}
            value={home[field.key]}
            onChange={(value) => onFieldChange(field.key, value)}
          />
        ))}
      </div>

      <div className="flex justify-end">
        <button
          onClick={onAdd}
          className="rounded-xl bg-sage px-6 py-[11px] text-[14px] font-semibold text-white shadow-[0_2px_6px_rgba(90,70,40,0.12)] hover:brightness-105"
        >
          Add to tracker
        </button>
      </div>
    </section>
  );
}
