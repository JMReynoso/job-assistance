"use client";

interface ConfirmCancelRegenerateModalProps {
  onConfirm: () => void;
  onDismiss: () => void;
}

export default function ConfirmCancelRegenerateModal({ onConfirm, onDismiss }: ConfirmCancelRegenerateModalProps) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(45,36,26,0.5)] p-5">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-cancel-regenerate-title"
        className="w-full max-w-[400px] rounded-[20px] bg-card p-[26px] shadow-[0_24px_70px_rgba(40,30,18,0.35)]"
      >
        <h3 id="confirm-cancel-regenerate-title" className="m-0 mb-2 font-heading text-[20px] font-semibold">
          Stop regenerating?
        </h3>
        <p className="mb-[22px] text-[14px] leading-[1.5] text-muted-2">
          Your current tailored resume and match score stay exactly as they are. The work already sent to Claude
          will still be billed.
        </p>
        <div className="flex gap-2.5">
          <button
            onClick={onDismiss}
            className="flex-1 rounded-xl bg-[#f2ede1] p-[11px] text-[14px] font-semibold text-muted-2 hover:bg-[#ebe4d5]"
          >
            Keep going
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-[#b8503b] p-[11px] text-[14px] font-semibold text-white hover:bg-[#a5462f]"
          >
            Stop
          </button>
        </div>
      </div>
    </div>
  );
}
