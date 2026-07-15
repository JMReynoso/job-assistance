import { daysSince, formatDateTime, formatShortDate, isStale } from "@/lib/job-assistance/date";
import { FROZEN_NOW, ISO_4_DAYS_AGO, ISO_5_DAYS_AGO, ISO_6_DAYS_AGO, ISO_TODAY } from "../mock/dates.mock";

describe("formatShortDate", () => {
  it("renders an em dash for an empty date", () => {
    expect(formatShortDate("")).toBe("—");
  });

  it("renders an ISO date as an abbreviated month and day", () => {
    expect(formatShortDate("2026-07-03")).toBe("Jul 3");
  });

  it("returns the raw input when it isn't a full year-month-day string", () => {
    expect(formatShortDate("2026-07")).toBe("2026-07");
  });
});

describe("formatDateTime", () => {
  it("formats weekday, month, day, and a 12-hour clock with seconds", () => {
    const afternoon = new Date("2026-07-15T15:04:05.000Z");
    expect(formatDateTime(afternoon)).toBe("Wed, Jul 15 · 3:04:05 PM");
  });

  it("shows noon as 12 PM, not 0 PM", () => {
    const noon = new Date("2026-07-15T12:00:00.000Z");
    expect(formatDateTime(noon)).toBe("Wed, Jul 15 · 12:00:00 PM");
  });

  it("shows midnight as 12 AM, not 0 AM", () => {
    const midnight = new Date("2026-07-15T00:00:00.000Z");
    expect(formatDateTime(midnight)).toBe("Wed, Jul 15 · 12:00:00 AM");
  });
});

describe("daysSince", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(FROZEN_NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns null for an empty date", () => {
    expect(daysSince("")).toBeNull();
  });

  it("returns null when the date has fewer than three segments", () => {
    expect(daysSince("2026-07")).toBeNull();
  });

  it("returns 0 for today", () => {
    expect(daysSince(ISO_TODAY)).toBe(0);
  });

  it("counts whole days between the date and now", () => {
    expect(daysSince(ISO_4_DAYS_AGO)).toBe(4);
    expect(daysSince(ISO_6_DAYS_AGO)).toBe(6);
  });
});

describe("isStale", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(FROZEN_NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("is not stale with no contact date", () => {
    expect(isStale("")).toBe(false);
  });

  it("is not stale just under the threshold", () => {
    expect(isStale(ISO_4_DAYS_AGO)).toBe(false);
  });

  it("is stale exactly at the threshold", () => {
    expect(isStale(ISO_5_DAYS_AGO)).toBe(true);
  });

  it("is stale past the threshold", () => {
    expect(isStale(ISO_6_DAYS_AGO)).toBe(true);
  });
});
