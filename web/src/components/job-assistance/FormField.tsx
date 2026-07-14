"use client";

import type { CSSProperties } from "react";

interface FormFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "date";
  placeholder?: string;
  className?: string;
  inputStyle?: CSSProperties;
}

export default function FormField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  className,
  inputStyle,
}: FormFieldProps) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-[12px] font-semibold text-muted">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
        className="w-full min-w-0 rounded-[11px] border border-input-border bg-white px-3 py-2.5 text-[14px] text-ink outline-none focus:border-sage"
      />
    </div>
  );
}
