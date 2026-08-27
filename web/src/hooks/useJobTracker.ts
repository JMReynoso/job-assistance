"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { HomeFormState, Job, JobStatus } from "@/lib/job-assistance/types";
import { WARN_ON_CLOSE } from "@/lib/job-assistance/constants";
import { fetchJobDetail, fetchJobs } from "@/lib/api/jobs";
import { mapJob, mergeJobDetail, toJobId } from "@/lib/api/mappers";

const EMPTY_HOME_FORM: HomeFormState = {
  companyName: "",
  jobPosting: "",
  companyPage: "",
  companyLinkedIn: "",
  extraLinks: "",
};

/** Loading state for a fetch that has a retry affordance. */
export type LoadStatus = "loading" | "loaded" | "error";

/** As above, plus "idle" for a job that was never persisted and so never fetched. */
export type DetailStatus = "idle" | LoadStatus;

function createId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Today as 'YYYY-MM-DD' — the format both the date inputs and the API use. */
function today(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function useJobTracker() {
  const [home, setHome] = useState<HomeFormState>(EMPTY_HOME_FORM);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsStatus, setJobsStatus] = useState<LoadStatus>("loading");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Job | null>(null);
  const [dirty, setDirty] = useState(false);
  const [detailStatus, setDetailStatus] = useState<DetailStatus>("idle");
  const [resumeFileName, setResumeFileName] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  // Monotonic counter identifying the newest detail fetch. Anything that
  // supersedes one — opening another row, closing the modal — bumps it, and a
  // response whose id no longer matches is dropped on arrival.
  const detailRequest = useRef(0);

  /** Fetches the list and records the outcome. Also the retry affordance. */
  const loadJobs = useCallback(async () => {
    setJobsStatus("loading");
    try {
      const rows = await fetchJobs();
      setJobs(rows.map(mapJob));
      setJobsStatus("loaded");
    } catch {
      setJobsStatus("error");
    }
  }, []);

  useEffect(() => {
    // set-state-in-effect guards against cascading *render* loops, and flags
    // any function an effect calls that can reach setState. Fetching on mount
    // can't avoid that: the two outcome branches land after an await, and the
    // one synchronous set writes "loading" over the initial "loading", which
    // React bails out of without re-rendering. Nothing cascades.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadJobs();
  }, [loadJobs]);

  function setHomeField<K extends keyof HomeFormState>(field: K, value: HomeFormState[K]) {
    setHome((prev) => ({ ...prev, [field]: value }));
  }

  function addToTracker(): string {
    const name = home.companyName.trim() || "Untitled role";
    // Local-only until POST /jobs is wired: the id is deliberately non-numeric
    // so toJobId() reports it as unpersisted and no detail fetch is attempted.
    const newJob: Job = {
      id: createId(),
      companyName: name,
      status: "Interested",
      dateApplied: today(),
      dateLastContacted: today(),
      contacts: [],
      companyUrl: home.companyPage,
      jobPostingUrl: home.jobPosting,
      companyLinkedInUrl: home.companyLinkedIn,
      extraLinks: home.extraLinks,
      notes: "",
      recruiterMessage: "",
      followupMessage: "",
    };
    setJobs((prev) => [newJob, ...prev]);
    setHome(EMPTY_HOME_FORM);
    return newJob.id;
  }

  function removeJob(id: string) {
    setJobs((prev) => prev.filter((j) => j.id !== id));
  }

  function setRowStatus(id: string, status: JobStatus) {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status } : j)));
  }

  /**
   * Opens a row and loads its detail.
   *
   * The synchronous half runs before the first await, so the modal opens
   * immediately with whatever the list already has and fills in as the fetch
   * lands — never an empty dialog. Editing is blocked while `detailStatus` is
   * "loading" (see JobDetailModal's fieldset), which is what makes it safe to
   * overwrite the draft when the response arrives: `dirty` cannot be true yet.
   */
  async function openRow(id: string) {
    const row = jobs.find((j) => j.id === id);
    if (!row) return;

    setOpenId(id);
    // Copy the contacts too: a shallow spread would leave draft.contacts
    // aliasing the live row's array.
    setDraft({ ...row, contacts: row.contacts.map((c) => ({ ...c })) });
    setDirty(false);
    setResumeFileName(null);

    const jobId = toJobId(id);
    if (jobId === null) {
      setDetailStatus("idle");
      return;
    }

    const request = ++detailRequest.current;
    setDetailStatus("loading");
    try {
      const detail = await fetchJobDetail(jobId);
      if (detailRequest.current !== request) return;
      setDraft((prev) => (prev && prev.id === id ? mergeJobDetail(detail) : prev));
      setResumeFileName(detail.content?.tailoredResume ?? null);
      setDetailStatus("loaded");
    } catch {
      if (detailRequest.current !== request) return;
      setDetailStatus("error");
    }
  }

  function retryDetail() {
    if (openId) void openRow(openId);
  }

  function setDraftField<K extends keyof Job>(field: K, value: Job[K]) {
    setDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
    setDirty(true);
  }

  function saveDraft() {
    if (!draft) return;
    setJobs((prev) => prev.map((j) => (j.id === draft.id ? draft : j)));
    setDirty(false);
  }

  function closeNow() {
    // Invalidate any in-flight detail fetch so a late response can't
    // repopulate a modal that's already closed.
    detailRequest.current++;
    setOpenId(null);
    setDraft(null);
    setDirty(false);
    setDetailStatus("idle");
    setResumeFileName(null);
    setShowCloseConfirm(false);
    setShowDeleteConfirm(false);
  }

  function requestClose() {
    if (WARN_ON_CLOSE && dirty) setShowCloseConfirm(true);
    else closeNow();
  }

  function saveAndClose() {
    saveDraft();
    closeNow();
  }

  function confirmDelete() {
    setJobs((prev) => prev.filter((j) => j.id !== openId));
    closeNow();
  }

  return {
    home,
    setHomeField,
    addToTracker,

    jobs,
    jobsStatus,
    loadJobs,
    removeJob,
    setRowStatus,

    hoveredId,
    setHoveredId,

    openId,
    draft,
    dirty,
    detailStatus,
    resumeFileName,
    openRow,
    retryDetail,
    setDraftField,
    saveDraft,

    showDeleteConfirm,
    showCloseConfirm,
    requestDelete: () => setShowDeleteConfirm(true),
    cancelDelete: () => setShowDeleteConfirm(false),
    confirmDelete,
    requestClose,
    saveAndClose,
    exitWithoutSaving: closeNow,
    cancelClose: () => setShowCloseConfirm(false),
  };
}
