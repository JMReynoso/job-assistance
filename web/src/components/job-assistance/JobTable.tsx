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
  /** Optional so tests that only care about rows can keep passing jobs alone. */
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}

const COLUMNS = ["Company", "Status", "Date applied", "Last contacted"];

export default function JobTable({
  jobs,
  hoveredId,
  onHoverChange,
  onOpen,
  onStatusChange,
  loading = false,
  error = false,
  onRetry,
}: JobTableProps) {
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
        <div className="px-6 py-[34px] text-center text-[14px]">
          {loading ? (
            <span className="inline-flex items-center gap-2.5 text-muted-2" aria-live="polite">
              <span
                aria-hidden
                className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-sage/30 border-t-sage"
              />
              Loading your jobs…
            </span>
          ) : error ? (
            <span className="inline-flex items-center gap-3 text-[#a8503b]" aria-live="polite">
              Couldn&rsquo;t load your jobs.
              <button
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 rounded-lg bg-maple px-3.5 py-1.5 text-[13px] font-semibold text-white hover:brightness-105"
              >
                <span aria-hidden className="text-[14px] leading-none">
                  ↻
                </span>{" "}
                Try again
              </button>
            </span>
          ) : (
            <span className="text-placeholder">No jobs yet — add one above to get started.</span>
          )}
        </div>
      )}
    </section>
  );
}
