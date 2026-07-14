import { STALE_THRESHOLD_DAYS } from "./constants";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function formatShortDate(iso: string): string {
  if (!iso) return "—";
  const parts = iso.split("-").map(Number);
  if (parts.length < 3) return iso;
  const [, month, day] = parts;
  return `${MONTH_NAMES[month - 1]} ${day}`;
}

export function formatDateTime(d: Date): string {
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = String(d.getSeconds()).padStart(2, "0");
  const meridiem = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${DAY_NAMES[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()} · ${hours}:${minutes}:${seconds} ${meridiem}`;
}

export function daysSince(iso: string): number | null {
  if (!iso) return null;
  const parts = iso.split("-").map(Number);
  if (parts.length < 3) return null;
  const [year, month, day] = parts;
  const then = new Date(year, month - 1, day);
  const now = new Date();
  const t0 = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  const n0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((n0.getTime() - t0.getTime()) / 86400000);
}

export function isStale(iso: string): boolean {
  const days = daysSince(iso);
  return days != null && days >= STALE_THRESHOLD_DAYS;
}
