"use client";

import { useState } from "react";
import type { JobStageStatus, RegenerateStage } from "@/lib/job-assistance/types";
import { activeStage, failedStage, isComplete, progressPercent } from "@/lib/job-assistance/job-progress";
import { REGENERATE_STAGE_META } from "@/lib/job-assistance/regenerate-progress";
import ConfirmCancelRegenerateModal from "./ConfirmCancelRegenerateModal";

interface RegenerateProgressModalProps {
  companyName: string;
  stages: RegenerateStage[];
  /** The new score, once scoring lands. */
  matchPercent: number | null;
  onCancel: () => void;
  onRetry: () => void;
  onDone: () => void;
}

const STATUS_CAPTION: Record<JobStageStatus, string> = {
  pending: "Waiting",
  running: "In progress",
  done: "Done",
  failed: "Failed",
};

function nodeClasses(status: JobStageStatus): string {
  const base = "flex h-9 w-9 items-center justify-center rounded-full border text-[15px] font-bold leading-none";
  switch (status) {
    case "done":
      return `${base} border-sage bg-sage text-white`;
    case "running":
      return `${base} border-sage bg-sage text-white`;
    case "failed":
      return `${base} border-[#b8503b] bg-[#b8503b] text-white`;
    default:
      return `${base} border-input-border bg-white text-faint`;
  }
}

function NodeIcon({ status }: { status: JobStageStatus }) {
  if (status === "done") return <span aria-hidden>✓</span>;
  if (status === "failed") return <span aria-hidden>✕</span>;
  if (status === "running")
    return <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />;
  return <span aria-hidden>–</span>;
}

export default function RegenerateProgressModal({
  companyName,
  stages,
  matchPercent,
  onCancel,
  onRetry,
  onDone,
}: RegenerateProgressModalProps) {
  const [confirming, setConfirming] = useState(false);

  const complete = isComplete(stages);
  const failed = failedStage(stages);
  const running = activeStage(stages);
  const percent = progressPercent(stages);
  const trackInset = stages.length > 0 ? 50 / stages.length : 50;

  const statusLine = complete
    ? "All set — your tailored resume has been updated."
    : failed
      ? `${REGENERATE_STAGE_META[failed.key].label} failed. You can retry just this step.`
      : running
        ? REGENERATE_STAGE_META[running.key].active
        : "Starting up…";

  function handleClose() {
    if (complete) onDone();
    else setConfirming(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-[rgba(45,36,26,0.42)] px-5 py-10">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="regenerate-progress-modal-title"
        className="w-full max-w-[620px] overflow-hidden rounded-3xl bg-card shadow-[0_24px_70px_rgba(40,30,18,0.32)]"
      >
        <div className="flex items-start justify-between border-b border-table-border bg-[#fbf8f1] px-6 py-5">
          <div>
            <div id="regenerate-progress-modal-title" className="font-heading text-[21px] font-semibold">
              Regenerating resume
            </div>
            <div className="mt-0.5 text-[13px] text-muted">{companyName}</div>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close"
            className="h-[34px] w-[34px] shrink-0 rounded-[10px] bg-[#efe9db] text-[17px] leading-none text-muted-2 hover:bg-[#e6dfce]"
          >
            ✕
          </button>
        </div>

        <div className="p-6">
          {/* Stepper */}
          <div className="relative mb-5 mt-2">
            <div
              className="absolute top-[18px] h-[3px] -translate-y-1/2 rounded bg-table-border"
              style={{ left: `${trackInset}%`, right: `${trackInset}%` }}
            >
              <div className="h-full rounded bg-sage transition-all duration-500" style={{ width: `${percent}%` }} />
            </div>
            <div className="relative flex">
              {stages.map((stage) => {
                const meta = REGENERATE_STAGE_META[stage.key];
                return (
                  <div
                    key={stage.key}
                    data-stage={stage.key}
                    data-status={stage.status}
                    className="flex flex-1 flex-col items-center px-1 text-center"
                  >
                    <div className={nodeClasses(stage.status)}>
                      <NodeIcon status={stage.status} />
                    </div>
                    <div
                      className={`mt-2 text-[12px] font-semibold leading-tight ${
                        stage.status === "pending" ? "text-muted" : "text-ink"
                      }`}
                    >
                      {meta.label}
                    </div>
                    <div className="mt-0.5 text-[11px] text-faint">{STATUS_CAPTION[stage.status]}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Current status line */}
          <div
            className={`flex items-center gap-2.5 rounded-xl px-4 py-3 text-[13px] ${
              failed ? "bg-[#f8ddd5] text-[#a8503b]" : "bg-[#faf7f0] text-muted-2"
            }`}
          >
            {!complete && !failed && (
              <span
                aria-hidden
                className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-sage/30 border-t-sage"
              />
            )}
            <span aria-live="polite">{statusLine}</span>
          </div>

          {complete && matchPercent !== null && (
            <div className="mt-5 text-[14px] font-semibold text-ink">Job Description Match: {matchPercent}%</div>
          )}

          {(complete || failed) && (
            <div className="mt-5 flex justify-end">
              {complete ? (
                <button
                  onClick={onDone}
                  className="rounded-xl bg-sage px-6 py-[11px] text-[14px] font-semibold text-white hover:brightness-105"
                >
                  Done
                </button>
              ) : (
                <button
                  onClick={onRetry}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-maple px-6 py-[11px] text-[14px] font-semibold text-white hover:brightness-105"
                >
                  <span aria-hidden className="text-[15px] leading-none">
                    ↻
                  </span>
                  Try again
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {confirming && (
        <ConfirmCancelRegenerateModal onConfirm={onCancel} onDismiss={() => setConfirming(false)} />
      )}
    </div>
  );
}
