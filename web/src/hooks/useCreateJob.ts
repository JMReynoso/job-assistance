"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import type { JobDetail } from "@/lib/api/jobs";
import {
  createCompanyResearch,
  createGeneratedContent,
  createJob,
  deleteCompanyResearch,
  deleteContact,
  deleteGeneratedContent,
  deleteJob,
  fetchJobDetail,
  findContacts,
} from "@/lib/api/jobs";
import {
  toCreateCompanyResearch,
  toCreateGeneratedContent,
  toCreateJob,
  toFindContacts,
} from "@/lib/api/mappers";
import type { ApiJob } from "@/lib/api/types";
import type { HomeFormState, JobStage } from "@/lib/job-assistance/types";
import { JOB_STAGE_KEYS, initialStages } from "@/lib/job-assistance/job-progress";

interface CreateJobCallbacks {
  /** The `jobs` row exists — put it in the tracker and empty the form. */
  onCreated: (job: ApiJob) => void;
  /** The pipeline finished; a fresh read of all four tables for the new job. */
  onFinished: (detail: JobDetail) => void;
  /** The run was cancelled and its rows deleted — drop it from the tracker. */
  onDiscarded: (jobId: number) => void;
}

/** Ids of every row one run has created, so cancelling can delete them again. */
interface CreatedRows {
  jobId: number | null;
  researchId: number | null;
  contentId: number | null;
  contactIds: number[];
}

function nothingCreated(): CreatedRows {
  return { jobId: null, researchId: null, contentId: null, contactIds: [] };
}

/** The API's own explanation when it sent one — a bare "failed (400)" helps nobody. */
function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.detail ?? error.message;
  return error instanceof Error ? error.message : "Something went wrong.";
}

/**
 * Drives the "Add to tracker" setup pipeline and the progress modal above it.
 *
 * Five stages, run strictly in sequence, because they depend on each other:
 * every call after the first needs the id `POST /jobs` returned, and
 * `POST /generated-content` 404s unless `POST /company-research` has already
 * landed for that job. Unlike useRegenerateResume, nothing here is paced on a
 * timer — each node flips to done the moment its request resolves, so the
 * stepper is a real status report.
 */
export function useCreateJob({ onCreated, onFinished, onDiscarded }: CreateJobCallbacks) {
  const [stages, setStages] = useState<JobStage[]>([]);
  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const stagesRef = useRef<JobStage[]>([]);
  const formRef = useRef<HomeFormState | null>(null);
  const createdRef = useRef<CreatedRows>(nothingCreated());
  const controllerRef = useRef<AbortController | null>(null);
  // Bumped by start()/retry()/cancel()/reset(). A step whose id no longer
  // matches was superseded and must neither touch state nor keep walking.
  const runId = useRef(0);

  function setStage(index: number, status: JobStage["status"]) {
    setStages((prev) => {
      const next = prev.map((s, i) => (i === index ? { ...s, status } : s));
      stagesRef.current = next;
      return next;
    });
  }

  /** One stage's actual work. Throws on failure; runFrom turns that into UI. */
  async function runStep(index: number, home: HomeFormState, signal: AbortSignal): Promise<void> {
    if (index === 0) {
      const job = await createJob(toCreateJob(home), signal);
      createdRef.current = { ...createdRef.current, jobId: job.id };
      onCreated(job);
      return;
    }

    // Every later stage writes against the row stage 0 created.
    const jobId = createdRef.current.jobId;
    if (jobId === null) throw new Error("The job was never created — start setup again.");

    switch (JOB_STAGE_KEYS[index]) {
      case "research": {
        const research = await createCompanyResearch(toCreateCompanyResearch(jobId, home), signal);
        createdRef.current = { ...createdRef.current, researchId: research.id };
        return;
      }
      case "tailoring": {
        const content = await createGeneratedContent(toCreateGeneratedContent(jobId, home), signal);
        createdRef.current = { ...createdRef.current, contentId: content.id };
        return;
      }
      case "contact": {
        const contacts = await findContacts(toFindContacts(jobId, home), signal);
        createdRef.current = { ...createdRef.current, contactIds: contacts.map((c) => c.id) };
        return;
      }
      default: {
        // "ready" writes nothing — it reads the finished job back so the
        // tracker row carries its research, messages and match score without
        // waiting for the detail window to be opened.
        onFinished(await fetchJobDetail(jobId));
      }
    }
  }

  /**
   * Walks the pipeline from `fromIndex` to the end, stopping at the first
   * failure. Retrying re-enters here at the failed stage rather than at 0 —
   * re-running a stage that already succeeded means paying Perplexity or
   * Claude for it twice.
   */
  async function runFrom(fromIndex: number, id: number) {
    const home = formRef.current;
    if (!home) return;

    const controller = new AbortController();
    controllerRef.current = controller;

    for (let index = fromIndex; index < JOB_STAGE_KEYS.length; index++) {
      if (runId.current !== id) return;
      setStage(index, "running");

      try {
        await runStep(index, home, controller.signal);
      } catch (err) {
        if (runId.current !== id) return;
        // A cancel already tore the run down and owns the state now.
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(describeError(err));
        setStage(index, "failed");
        return;
      }

      if (runId.current !== id) return;
      setStage(index, "done");
    }
  }

  function start(home: HomeFormState) {
    const id = ++runId.current;
    const base = initialStages();
    stagesRef.current = base;
    setStages(base);
    // Snapshotted, not read live: the form is cleared the moment the job row
    // exists, but the later stages still need what the user typed.
    formRef.current = home;
    createdRef.current = nothingCreated();
    setCompanyName(home.companyName.trim());
    setError(null);
    void runFrom(0, id);
  }

  function retry() {
    const failedIndex = stagesRef.current.findIndex((s) => s.status === "failed");
    if (failedIndex === -1) return;
    setError(null);
    void runFrom(failedIndex, ++runId.current);
  }

  function reset() {
    runId.current++;
    controllerRef.current = null;
    formRef.current = null;
    createdRef.current = nothingCreated();
    stagesRef.current = [];
    setStages([]);
    setCompanyName("");
    setError(null);
  }

  /**
   * Aborts whatever is in flight, then deletes every row this run created.
   * The confirm dialog promises "everything generated so far" goes away, and
   * nothing in the schema delivers that: `jobId` carries no foreign key, so
   * deleting the job alone would strand its research, content and contacts.
   *
   * Best-effort, via allSettled — a failed sub-delete isn't worth a second
   * error dialog on top of the one the user just confirmed, and the row is
   * gone from the tracker either way. Aborting doesn't reach the server: calls
   * already in flight there run to completion, which is exactly why their ids
   * are worth deleting afterwards.
   */
  async function cancel() {
    controllerRef.current?.abort();
    const { jobId, researchId, contentId, contactIds } = createdRef.current;
    reset(); // bumps runId, closing the modal and orphaning the running loop
    if (jobId !== null) onDiscarded(jobId);

    await Promise.allSettled([
      ...contactIds.map((id) => deleteContact(id)),
      ...(contentId === null ? [] : [deleteGeneratedContent(contentId)]),
      ...(researchId === null ? [] : [deleteCompanyResearch(researchId)]),
      ...(jobId === null ? [] : [deleteJob(jobId)]),
    ]);
  }

  function abortRun() {
    runId.current++;
    controllerRef.current?.abort();
  }

  // Nothing is in flight at mount, so this only ever fires for a real unmount
  // mid-run — at which point the response has nowhere to land.
  useEffect(() => abortRun, []);

  return { stages, active: stages.length > 0, companyName, error, start, retry, cancel, reset };
}
