"use client";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** What the switch controls — the accessible name, since it has no text. */
  label: string;
}

/** A labelled on/off switch, for the settings window's rows. */
export default function ToggleSwitch({ checked, onChange, label }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      style={{ background: checked ? "var(--color-sage)" : "#e6e0d1" }}
      className="relative h-[26px] w-[46px] shrink-0 rounded-full transition-colors duration-200"
    >
      <span
        aria-hidden
        style={{ left: checked ? "23px" : "3px" }}
        className="absolute top-[3px] h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(70,55,35,0.25)] transition-all duration-200"
      />
    </button>
  );
}
