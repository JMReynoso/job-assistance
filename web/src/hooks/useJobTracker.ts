"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { HomeFormState, Job, JobKeyword, JobStatus } from "@/lib/job-assistance/types";
import { WARN_ON_CLOSE } from "@/lib/job-assistance/constants";
import { fetchJobDetail, fetchJobs, updateJobDetail } from "@/lib/api/jobs";
import { mapJob, mergeJobDetail, toJobDetailPatch, toJobId } from "@/lib/api/mappers";

const EMPTY_HOME_FORM: HomeFormState = {
  companyName: "",
  jobPosting: "",
  companyPage: "",
  companyLinkedIn: "",
  extraLinks: "",
  jobDescription: "",
};

/** Loading state for a fetch that has a retry affordance. */
export type LoadStatus = "loading" | "loaded" | "error";

/** As above, plus "idle" for a job that was never persisted and so never fetched. */
export type DetailStatus = "idle" | LoadStatus;

/** Save is idle until the button is pressed; "error" leaves the draft dirty. */
export type SaveStatus = "idle" | "saving" | "error";

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
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [resumeFileName, setResumeFileName] = useState<string | null>(null);
  const [missingKeywords, setMissingKeywords] = useState<JobKeyword[]>([]);
  const [jdMatchPercent, setJdMatchPercent] = useState<number | null>(null);
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
      jobDescription: home.jobDescription,
      notes: "",
      recruiterMessage: "",
      followupMessage: "",
      jdMatchPercent: null,
      missingKeywords: [],
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
    setSaveStatus("idle");
    setResumeFileName(null);
    setMissingKeywords([]);
    setJdMatchPercent(null);

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
      setMissingKeywords(
        (detail.content?.missingKeywords ?? []).map((k) => ({ keyword: k.keyword, include: k.include })),
      );
      setJdMatchPercent(detail.content?.jdMatchPercent ?? null);
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

  /**
   * Persists the draft. A locally-added job has no backend id, so it keeps the
   * old state-only behaviour; a persisted job goes through the one PATCH that
   * fans out across jobs, company_research and missing_keywords.
   *
   * The response is server truth for every field, so it replaces the draft
   * rather than the draft being trusted — a value the API rejected or
   * normalised shows up immediately instead of only after a reload.
   *
   * Returns false when the save failed, so callers can hold the window open.
   */
  async function saveDraft(): Promise<boolean> {
    if (!draft) return false;
    const id = draft.id;
    const jobId = toJobId(id);

    if (jobId === null) {
      setJobs((prev) => prev.map((j) => (j.id === id ? draft : j)));
      setDirty(false);
      return true;
    }

    // Take a ticket without bumping it: closing the window or opening another
    // row invalidates an in-flight save the same way it invalidates a fetch,
    // so a late response can't repopulate a window that has moved on.
    const request = detailRequest.current;
    setSaveStatus("saving");
    try {
      const included = missingKeywords.filter((k) => k.include).map((k) => k.keyword);
      const detail = await updateJobDetail(jobId, toJobDetailPatch(draft, included));
      if (detailRequest.current !== request) return false;

      const merged = mergeJobDetail(detail);
      setDraft((prev) => (prev && prev.id === id ? merged : prev));
      setJobs((prev) => prev.map((j) => (j.id === id ? merged : j)));
      setMissingKeywords(merged.missingKeywords);
      setJdMatchPercent(detail.content?.jdMatchPercent ?? null);
      setResumeFileName(detail.content?.tailoredResume ?? null);
      setDirty(false);
      setSaveStatus("idle");
      return true;
    } catch {
      if (detailRequest.current !== request) return false;
      // dirty stays true: the edits are still on screen and still unsaved.
      setSaveStatus("error");
      return false;
    }
  }

  /**
   * Flips one keyword's checkbox. Marks the draft dirty like any other edit:
   * the checked set is persisted to missing_keywords.include by Save, and is
   * also what a regenerate is run with.
   */
  function toggleKeyword(keyword: string) {
    setMissingKeywords((prev) =>
      prev.map((k) => (k.keyword === keyword ? { ...k, include: !k.include } : k)),
    );
    setDirty(true);
  }

  /**
   * Folds a successful regenerate response back into the open row. Leaves
   * missingKeywords untouched — the backend deliberately doesn't replace that
   * list on regenerate, so the user's checkbox state should survive too.
   */
  function applyRegeneratedContent(content: { tailoredResume: string | null; jdMatchPercent: number | null }) {
    setResumeFileName(content.tailoredResume ?? null);
    setJdMatchPercent(content.jdMatchPercent ?? null);
  }

  function closeNow() {
    // Invalidate any in-flight detail fetch so a late response can't
    // repopulate a modal that's already closed.
    detailRequest.current++;
    setOpenId(null);
    setDraft(null);
    setDirty(false);
    setDetailStatus("idle");
    setSaveStatus("idle");
    setResumeFileName(null);
    setMissingKeywords([]);
    setJdMatchPercent(null);
    setShowCloseConfirm(false);
    setShowDeleteConfirm(false);
  }

  function requestClose() {
    if (WARN_ON_CLOSE && dirty) setShowCloseConfirm(true);
    else closeNow();
  }

  async function saveAndClose() {
    if (await saveDraft()) closeNow();
    else setShowCloseConfirm(false);
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
    saveStatus,
    resumeFileName,
    missingKeywords,
    jdMatchPercent,
    toggleKeyword,
    applyRegeneratedContent,
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
