"use client";

import type { ApiAiProvider } from "@/lib/api/types";
import type { AppSettings } from "@/lib/job-assistance/settings";
import ToggleSwitch from "./ToggleSwitch";

interface SettingsModalProps {
  settings: AppSettings;
  onProviderChange: (provider: ApiAiProvider) => void;
  onClose: () => void;
}

export default function SettingsModal({ settings, onProviderChange, onClose }: SettingsModalProps) {
  const usingClaude = settings.provider === "claude";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-[rgba(45,36,26,0.42)] px-5 py-10">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        className="w-full max-w-[520px] overflow-hidden rounded-3xl bg-card shadow-[0_24px_70px_rgba(40,30,18,0.32)]"
      >
        <div className="flex items-start justify-between border-b border-table-border bg-[#fbf8f1] px-6 py-5">
          <div>
            <div id="settings-modal-title" className="font-heading text-[21px] font-semibold">
              Settings
            </div>
            <div className="mt-0.5 text-[13px] text-muted">Saved on this device.</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="h-[34px] w-[34px] shrink-0 rounded-[10px] bg-[#efe9db] text-[17px] leading-none text-muted-2 hover:bg-[#e6dfce]"
          >
            ✕
          </button>
        </div>

        <div className="p-6">
          <div className="flex items-start justify-between gap-5 rounded-xl bg-[#faf7f0] px-4 py-3.5">
            <div>
              <div className="text-[14px] font-semibold text-ink">Use Claude instead of local AI</div>
              <p className="mt-1 text-[12px] leading-[1.5] text-muted">
                {usingClaude
                  ? "Claude writes your resume and messages. Best quality, a few cents per job."
                  : "Ollama runs on your own machine. Free, but tailoring takes minutes rather than seconds."}
              </p>
            </div>
            <ToggleSwitch
              checked={usingClaude}
              onChange={(checked) => onProviderChange(checked ? "claude" : "ollama")}
              label="Use Claude instead of local AI"
            />
          </div>

          <p className="mt-4 text-[12px] leading-[1.5] text-faint">
            Applies to new jobs you add. Regenerating a resume always reuses the engine that wrote it.
          </p>
        </div>
      </div>
    </div>
  );
}
