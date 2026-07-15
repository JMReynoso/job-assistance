"use client";

import { useState } from "react";
import type { HomeFormState, Job, JobStatus } from "@/lib/job-assistance/types";
import { INITIAL_JOBS } from "@/lib/job-assistance/seed-data";
import { WARN_ON_CLOSE } from "@/lib/job-assistance/constants";

const EMPTY_HOME_FORM: HomeFormState = {
  companyName: "",
  jobPosting: "",
  companyPage: "",
  companyLinkedIn: "",
  extraLinks: "",
};

function createId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useJobTracker() {
  const [home, setHome] = useState<HomeFormState>(EMPTY_HOME_FORM);
  const [jobs, setJobs] = useState<Job[]>(INITIAL_JOBS);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Job | null>(null);
  const [dirty, setDirty] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  function setHomeField<K extends keyof HomeFormState>(field: K, value: HomeFormState[K]) {
    setHome((prev) => ({ ...prev, [field]: value }));
  }

  function addToTracker() {
    const name = home.companyName.trim() || "Untitled role";
    const newJob: Job = {
      id: createId(),
      companyName: name,
      status: "Interested",
      dateApplied: "",
      dateLastContacted: "",
      messageStyle: "Friendly",
      contactName: "",
      contactEmail: "",
      contactLinkedIn: "",
      companyUrl: home.companyPage,
      referralName: "",
      jobPostingUrl: home.jobPosting,
      companyLinkedInUrl: home.companyLinkedIn,
      extraLinks: home.extraLinks,
      notes: "",
      recruiterMessage: "",
      followupMessage: "",
    };
    setJobs((prev) => [newJob, ...prev]);
    setHome(EMPTY_HOME_FORM);
  }

  function setRowStatus(id: string, status: JobStatus) {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status } : j)));
  }

  function openRow(id: string) {
    const row = jobs.find((j) => j.id === id);
    if (!row) return;
    setOpenId(id);
    setDraft({ ...row });
    setDirty(false);
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
    setOpenId(null);
    setDraft(null);
    setDirty(false);
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
    setRowStatus,

    hoveredId,
    setHoveredId,

    openId,
    draft,
    dirty,
    openRow,
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
