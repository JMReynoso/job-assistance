import type { ApiAiProvider } from "@/lib/api/types";

/** What the settings window controls. One switch today; built to grow. */
export interface AppSettings {
  /** Which engine generates content for newly added jobs. */
  provider: ApiAiProvider;
}

export const DEFAULT_SETTINGS: AppSettings = {
  // Free by default: spending money should be a deliberate act.
  provider: "ollama",
};

export const SETTINGS_STORAGE_KEY = "job-assistance:settings";

/**
 * Stored settings, falling back to defaults on anything unexpected. Validated
 * field by field rather than trusted: this JSON came from a browser store a
 * previous version of the app wrote, and may not match today's shape.
 */
export function parseSettings(raw: string | null): AppSettings {
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return { provider: parsed.provider === "claude" ? "claude" : "ollama" };
  } catch {
    return DEFAULT_SETTINGS;
  }
}
