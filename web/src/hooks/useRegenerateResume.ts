"use client";

import { useEffect, useRef, useState } from "react";
import type { ApiGeneratedContent } from "@/lib/api/types";
import { regenerateTailoredResume } from "@/lib/api/jobs";
import type { RegenerateStage } from "@/lib/job-assistance/types";
import { initialRegenerateStages } from "@/lib/job-assistance/regenerate-progress";

const STEP_MS = 1400; // wall-clock time budget per stage, matches useJobProgressSimulation

/**
 * Drives the regenerate-resume progress modal. Unlike the job-setup pipeline,
 * the backend here is a single POST with no event stream, so there's nothing
 * real to report mid-flight: the stepper paces stages 0..n-2 on a timer and
 * then holds at the last stage until the actual response lands, at which
 * point every stage flips to done together. The timing is cosmetic, not a
 * status report — same precedent as useJobProgressSimulation's "BACKEND
 * WIRING" note.
 */
export function useRegenerateResume(onSuccess: (content: ApiGeneratedContent) => void) {
  const [stages, setStages] = useState<RegenerateStage[]>([]);
  const [matchPercent, setMatchPercent] = useState<number | null>(null);
  const stagesRef = useRef<RegenerateStage[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const controllerRef = useRef<AbortController | null>(null);
  const argsRef = useRef<{ jobId: number; keywords: string[] } | null>(null);
  // Bumped by every start()/retry()/reset(); an in-flight call whose id no
  // longer matches was superseded (cancelled, retried, or unmounted) and
  // must not touch state on arrival.
  const runId = useRef(0);

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  function setStage(index: number, status: RegenerateStage["status"]) {
    setStages((prev) => {
      const next = prev.map((s, i) => (i === index ? { ...s, status } : s));
      stagesRef.current = next;
      return next;
    });
  }

  // Walks stages 0..n-2 to "done" on a timer; the last stage is left
  // "running" indefinitely — it only flips to "done" once the real response
  // lands, in run() below.
  function paceToLastStage(id: number) {
    const total = stagesRef.current.length;
    for (let i = 0; i < total; i++) {
      timers.current.push(
        setTimeout(() => {
          if (runId.current === id) setStage(i, "running");
        }, i * STEP_MS + 100),
      );
      if (i < total - 1) {
        timers.current.push(
          setTimeout(() => {
            if (runId.current === id) setStage(i, "done");
          }, (i + 1) * STEP_MS + 100),
        );
      }
    }
  }

  function reset() {
    clearTimers();
    runId.current++; // invalidate any in-flight run
    controllerRef.current = null;
    stagesRef.current = [];
    setStages([]);
    setMatchPercent(null);
  }

  async function run(jobId: number, keywords: string[]) {
    clearTimers();
    const id = ++runId.current;
    const base = initialRegenerateStages();
    stagesRef.current = base;
    setStages(base);
    setMatchPercent(null);
    argsRef.current = { jobId, keywords };

    const controller = new AbortController();
    controllerRef.current = controller;
    paceToLastStage(id);

    try {
      const content = await regenerateTailoredResume(jobId, keywords, controller.signal);
      if (runId.current !== id) return; // superseded — a newer run or a reset owns the state now
      clearTimers();
      const done = stagesRef.current.map((s) => ({ ...s, status: "done" as const }));
      stagesRef.current = done;
      setStages(done);
      setMatchPercent(content.jdMatchPercent);
      onSuccess(content);
    } catch (error) {
      if (runId.current !== id) return;
      clearTimers();
      if (error instanceof DOMException && error.name === "AbortError") {
        reset();
        return;
      }
      const runningIndex = stagesRef.current.findIndex((s) => s.status === "running");
      setStage(runningIndex === -1 ? stagesRef.current.length - 1 : runningIndex, "failed");
    }
  }

  function start(jobId: number, keywords: string[]) {
    void run(jobId, keywords);
  }

  function retry() {
    if (!argsRef.current) return;
    void run(argsRef.current.jobId, argsRef.current.keywords);
  }

  function cancel() {
    controllerRef.current?.abort();
  }

  useEffect(() => clearTimers, []);

  return { stages, active: stages.length > 0, matchPercent, start, retry, cancel, reset };
}
