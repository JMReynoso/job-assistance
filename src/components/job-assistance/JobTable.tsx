"use client";

import type { Job, JobStatus } from "@/lib/job-assistance/types";
import { OPEN_BUTTON_BG, OPEN_BUTTON_COLOR, TABLE_STRIPED } from "@/lib/job-assistance/constants";
import JobTableRow from "./JobTableRow";

interface JobTableProps {
  jobs: Job[];
  hoveredId: string | null;
  onHoverChange: (id: string | null) => void;
  onOpen: (id: string) => void;
  onStatusChange: (id: string, status: JobStatus) => void;
}

const COLUMNS = ["Company", "Status", "Date applied", "Last contacted"];

export default function JobTable({ jobs, hoveredId, onHoverChange, onOpen, onStatusChange }: JobTableProps) {
  const rowCountLabel = jobs.length === 1 ? "1 job" : `${jobs.length} jobs`;

  return (
    <section className="overflow-hidden rounded-[22px] border border-card-border bg-card shadow-[0_1px_3px_rgba(70,55,35,0.04)]">
      <div className="flex items-baseline justify-between px-6 pb-3 pt-5">
        <h2 className="m-0 font-heading text-[22px] font-semibold">Job tracker</h2>
        <span className="text-[13px] text-faint">{rowCountLabel}</span>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {COLUMNS.map((heading, i) => (
              <th
                key={heading}
                className={`border-b border-table-border py-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-faint ${
                  i === 0 || i === 3 ? "px-6" : "px-5"
                }`}
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {jobs.map((job, i) => (
            <JobTableRow
              key={job.id}
              job={job}
              index={i}
              hovered={hoveredId === job.id}
              striped={TABLE_STRIPED}
              openButtonBg={OPEN_BUTTON_BG}
              openButtonColor={OPEN_BUTTON_COLOR}
              onHoverChange={onHoverChange}
              onOpen={onOpen}
              onStatusChange={onStatusChange}
            />
          ))}
        </tbody>
      </table>
      {jobs.length === 0 && (
        <div className="px-6 py-[34px] text-center text-[14px] text-placeholder">
          No jobs yet — add one above to get started.
        </div>
      )}
    </section>
  );
}
