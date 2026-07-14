"use client";

interface ConfirmDeleteModalProps {
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDeleteModal({ title, onConfirm, onCancel }: ConfirmDeleteModalProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(45,36,26,0.5)] p-5">
      <div className="w-full max-w-[400px] rounded-[20px] bg-card p-[26px] shadow-[0_24px_70px_rgba(40,30,18,0.35)]">
        <h3 className="m-0 mb-2 font-heading text-[20px] font-semibold">Delete this job?</h3>
        <p className="mb-[22px] text-[14px] leading-[1.5] text-muted-2">
          {`This removes ${title} from your tracker. This can’t be undone.`}
        </p>
        <div className="flex gap-2.5">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl bg-[#f2ede1] p-[11px] text-[14px] font-semibold text-muted-2 hover:bg-[#ebe4d5]"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-[#b8503b] p-[11px] text-[14px] font-semibold text-white hover:bg-[#a5462f]"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
