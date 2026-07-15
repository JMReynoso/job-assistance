"use client";

interface ConfirmCloseModalProps {
  title: string;
  onSaveAndClose: () => void;
  onExitWithoutSaving: () => void;
  onCancel: () => void;
}

export default function ConfirmCloseModal({
  title,
  onSaveAndClose,
  onExitWithoutSaving,
  onCancel,
}: ConfirmCloseModalProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(45,36,26,0.5)] p-5">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-close-modal-title"
        className="w-full max-w-[400px] rounded-[20px] bg-card p-[26px] shadow-[0_24px_70px_rgba(40,30,18,0.35)]"
      >
        <h3 id="confirm-close-modal-title" className="m-0 mb-2 font-heading text-[20px] font-semibold">
          Save your changes?
        </h3>
        <p className="mb-[22px] text-[14px] leading-[1.5] text-muted-2">
          {`You’ve made edits to ${title}. Want to keep them?`}
        </p>
        <div className="flex flex-col gap-2.5">
          <button
            onClick={onSaveAndClose}
            className="rounded-xl bg-sage p-[11px] text-[14px] font-semibold text-white hover:brightness-105"
          >
            Save &amp; close
          </button>
          <button
            onClick={onExitWithoutSaving}
            className="rounded-xl bg-[#f2ede1] p-[11px] text-[14px] font-semibold text-muted hover:bg-[#ebe4d5]"
          >
            Exit without saving
          </button>
          <button onClick={onCancel} className="rounded-lg bg-transparent p-1.5 text-[13px] font-semibold text-faint">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
