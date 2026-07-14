"use client";

import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/job-assistance/date";

export default function NavBar() {
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
      <div className="text-[14px] font-semibold tracking-[0.01em] text-muted" suppressHydrationWarning>
        {formatDateTime(now)}
      </div>
    </div>
  );
}
