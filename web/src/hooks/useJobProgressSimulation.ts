"use client";

import { useEffect, useRef, useState } from "react";
import type { JobStage } from "@/lib/job-assistance/types";
import { initialStages } from "@/lib/job-assistance/job-progress";

const STEP_MS = 1400; // wall-clock time budget per stage

/**
 * Prototype driver for the setup progress modal. It walks the pipeline stages
 * pending → running → done on a timer, imitating the events the backend will
 * push, and (for demo purposes) fails one stage on the first run so the
 * failed + retry UI is reachable.
 *
 * ── BACKEND WIRING ────────────────────────────────────────────────────────
 * Replace the timers below with a live SSE subscription once the API exists —
 * no polling, the server pushes one event per stage as its call returns:
 *
 *   function start(jobId: string) {
 *     const es = new EventSource(`/api/jobs/${jobId}/events`);      // <- connect here
 *     es.onmessage = (e) => setStages(JSON.parse(e.data).stages);  // {stages:[{key,status}]}
 *     es.addEventListener("done", () => es.close());
 *     esRef.current = es;
 *   }
 *   function retry(jobId: string, stage: JobStageKey) {
 *     fetch(`/api/jobs/${jobId}/stages/${stage}/retry`, { method: "POST" }); // <- retry call
 *     // the same SSE stream then pushes running → done (or failed) for that stage
 *   }
 *   function reset() { esRef.current?.close(); }   // also close on unmount
 *
 * The modal itself is transport-agnostic — it only ever reads `stages`.
 */
export function useJobProgressSimulation() {
  const [stages, setStages] = useState<JobStage[]>([]);
  const stagesRef = useRef<JobStage[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const armFailureRef = useRef(true); // demo: fail the first pipeline once

  function apply(updater: (prev: JobStage[]) => JobStage[]) {
    setStages((prev) => {
      const next = updater(prev);
      stagesRef.current = next;
      return next;
    });
  }

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  function setStage(index: number, status: JobStage["status"]) {
    apply((prev) => prev.map((s, i) => (i === index ? { ...s, status } : s)));
  }

  // Runs stages sequentially from `fromIndex`; stops after `failIndex` fails.
  // Each stage runs for one STEP and the next starts the instant it finishes,
  // so there's always exactly one stage in flight (like back-to-back events).
  function schedule(fromIndex: number, failIndex: number) {
    const total = stagesRef.current.length;
    for (let i = fromIndex; i < total; i++) {
      const step = i - fromIndex;
      timers.current.push(setTimeout(() => setStage(i, "running"), step * STEP_MS + 100));
      if (i === failIndex) {
        timers.current.push(setTimeout(() => setStage(i, "failed"), (step + 1) * STEP_MS + 100));
        break;
      }
      timers.current.push(setTimeout(() => setStage(i, "done"), (step + 1) * STEP_MS + 100));
    }
  }

  function start() {
    clearTimers();
    const base = initialStages();
    stagesRef.current = base;
    setStages(base);
    // DEMO ONLY: fail the Hunter.io contact lookup on the first run to exercise
    // the failed + retry UI. Delete this once the backend drives real statuses.
    const failIndex = armFailureRef.current ? base.findIndex((s) => s.key === "contact") : -1;
    armFailureRef.current = false;
    schedule(0, failIndex);
  }

  function retry() {
    clearTimers();
    const failedIndex = stagesRef.current.findIndex((s) => s.status === "failed");
    if (failedIndex === -1) return;
    schedule(failedIndex, -1); // re-run from the failed stage, this time to completion
  }

  function reset() {
    clearTimers();
    stagesRef.current = [];
    setStages([]);
  }

  useEffect(() => clearTimers, []);

  return { stages, active: stages.length > 0, start, retry, reset };
}
