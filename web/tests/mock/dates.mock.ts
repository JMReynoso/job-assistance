/**
 * Fixed reference time for tests that depend on "now" (staleness checks,
 * the nav bar clock). Noon UTC keeps the local calendar date stable across
 * whatever timezone the test runner happens to be in.
 */
export const FROZEN_NOW = new Date("2026-07-15T12:00:00.000Z");

// ISO date strings expressed as "days before FROZEN_NOW", for tests that
// exercise the staleness threshold (STALE_THRESHOLD_DAYS = 5).
export const ISO_TODAY = "2026-07-15";
export const ISO_4_DAYS_AGO = "2026-07-11"; // inside the threshold -> fresh
export const ISO_5_DAYS_AGO = "2026-07-10"; // exactly at the threshold -> stale
export const ISO_6_DAYS_AGO = "2026-07-09"; // past the threshold -> stale
