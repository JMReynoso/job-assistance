"use client";

import type { Job, JobStatus } from "@/lib/job-assistance/types";
import { STATUS_OPTIONS, STATUS_STYLES } from "@/lib/job-assistance/constants";
import { formatShortDate, isStale } from "@/lib/job-assistance/date";

interface JobTableRowProps {
  job: Job;
  index: number;
  hovered: boolean;
  striped: boolean;
  openButtonBg: string;
  openButtonColor: string;
  onHoverChange: (id: string | null) => void;
  onOpen: (id: string) => void;
  onStatusChange: (id: string, status: JobStatus) => void;
}

export default function JobTableRow({
  job,
  index,
  hovered,
  striped,
  openButtonBg,
  openButtonColor,
  onHoverChange,
  onOpen,
  onStatusChange,
}: JobTableRowProps) {
  const statusStyle = STATUS_STYLES[job.status];
  const rowBg = striped && index % 2 === 1 ? "#f8f4ea" : "transparent";
  const stale = isStale(job.dateLastContacted);

  return (
    <tr onMouseEnter={() => onHoverChange(job.id)} onMouseLeave={() => onHoverChange(null)} style={{ background: rowBg }}>
      <td className="border-b border-row-border px-6 py-[13px] text-[14px]">
        <div className="flex items-center gap-2.5">
          <span className="font-semibold">{job.companyName || "Untitled role"}</span>
          <button
            onClick={() => onOpen(job.id)}
            style={{
              background: openButtonBg,
              color: openButtonColor,
              opacity: hovered ? 1 : 0,
              pointerEvents: hovered ? "auto" : "none",
            }}
            className="rounded-full px-[13px] py-[3px] text-[12px] font-semibold transition-opacity duration-150"
          >
            open
          </button>
        </div>
      </td>
      <td className="border-b border-row-border px-5 py-[13px]">
        <select
          value={job.status}
          onChange={(e) => onStatusChange(job.id, e.target.value as JobStatus)}
          style={{ background: statusStyle.bg, color: statusStyle.color }}
          className="cursor-pointer rounded-full border-none px-3.5 py-[5px] text-[13px] font-semibold outline-none"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </td>
      <td className="border-b border-row-border px-5 py-[13px] text-[14px] text-muted-2">
        {formatShortDate(job.dateApplied)}
      </td>
      <td className="border-b border-row-border px-6 py-[13px] text-[14px]">
        {stale ? (
          <span className="inline-block rounded-full bg-[#f5d3ca] px-[11px] py-[3px] font-semibold text-[#a8503b]">
            {formatShortDate(job.dateLastContacted)}
          </span>
        ) : (
          <span className="text-muted-2">{formatShortDate(job.dateLastContacted)}</span>
        )}
      </td>
    </tr>
  );
}
