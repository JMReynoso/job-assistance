"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiAiProvider } from "@/lib/api/types";
import type { AppSettings } from "@/lib/job-assistance/settings";
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, parseSettings } from "@/lib/job-assistance/settings";

/**
 * App-wide preferences, persisted to localStorage, plus the open/closed state
 * of the window that edits them.
 *
 * Starts at DEFAULT_SETTINGS and loads the stored value in an effect rather
 * than in the state initializer: localStorage doesn't exist during the server
 * render, so reading it inline would make the first client render disagree
 * with the server's and break hydration.
 */
export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      // set-state-in-effect flags this because it's a synchronous setState in
      // an effect body — normally a smell, but it's the point here: state has
      // to start at DEFAULT_SETTINGS (localStorage doesn't exist on the
      // server) and sync to the stored value only after mount, so the first
      // client render still matches the server's. One extra render on mount,
      // never a loop.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSettings(parseSettings(window.localStorage.getItem(SETTINGS_STORAGE_KEY)));
    } catch {
      // Private browsing, or storage disabled. The defaults are fine.
    }
  }, []);

  const setProvider = useCallback((provider: ApiAiProvider) => {
    setSettings((prev) => {
      const next = { ...prev, provider };
      try {
        window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Not persisting is survivable; this session still honours the change.
      }
      return next;
    });
  }, []);

  return {
    settings,
    setProvider,
    open,
    openSettings: () => setOpen(true),
    closeSettings: () => setOpen(false),
  };
}
