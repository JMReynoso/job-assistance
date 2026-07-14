"use client";

interface TextAreaFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight: number;
  className?: string;
}

export default function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  minHeight,
  className,
}: TextAreaFieldProps) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-[12px] font-semibold text-muted">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ minHeight }}
        className="w-full resize-y rounded-[13px] border border-input-border bg-white px-3.5 py-[13px] text-[14px] leading-[1.55] text-ink outline-none focus:border-sage"
      />
    </div>
  );
}
