"use client";

import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/job-assistance/date";

interface NavBarProps {
  onOpenSettings: () => void;
}

export default function NavBar({ onOpenSettings }: NavBarProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="sticky top-0 z-20 flex items-center justify-between border-b border-[#e3dccb] bg-[#fbf8f1]/90 px-[30px] py-[15px] backdrop-blur-[8px]">
      <div className="flex items-center gap-[9px]">
        <div className="h-[22px] w-[22px] rounded-[7px] bg-sage" />
        <div className="font-heading text-[20px] font-semibold tracking-[0.01em] text-ink">job assistance</div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-[14px] font-semibold tracking-[0.01em] text-muted" suppressHydrationWarning>
          {formatDateTime(now)}
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Settings"
          title="Settings"
          className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-[#efe9db] text-[16px] leading-none text-muted-2 hover:bg-[#e6dfce]"
        >
          <span aria-hidden>⚙</span>
        </button>
      </div>
    </div>
  );
}
