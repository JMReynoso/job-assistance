"use client";

import { useState } from "react";
import { useJobTracker } from "@/hooks/useJobTracker";
import { useJobProgressSimulation } from "@/hooks/useJobProgressSimulation";
import { downloadTailoredResume } from "@/lib/job-assistance/generate-resume";
import NavBar from "./NavBar";
import AddJobForm from "./AddJobForm";
import JobTable from "./JobTable";
import JobDetailModal from "./JobDetailModal";
import JobProgressModal from "./JobProgressModal";
import ConfirmCloseModal from "./ConfirmCloseModal";
import ConfirmDeleteModal from "./ConfirmDeleteModal";

export default function JobAssistanceApp() {
  const tracker = useJobTracker();
  const progress = useJobProgressSimulation();
  const [setupJobId, setSetupJobId] = useState<string | null>(null);
  const draftTitle = tracker.draft?.companyName.trim() || "Job details";
  const setupJob = tracker.jobs.find((j) => j.id === setupJobId) ?? null;

  // "Add to tracker" creates the row immediately, then kicks off the
  // generation pipeline (research → tailoring → contact lookup) whose
  // progress is shown in the modal below.
  function handleAddJob() {
    // BACKEND: POST /api/jobs to create the row + enqueue the pipeline, then
    // open the SSE stream with the returned id: progress.start(newJob.id).
    const id = tracker.addToTracker();
    setSetupJobId(id);
    progress.start();
  }

  function finishSetup() {
    progress.reset(); // BACKEND: close the EventSource
    setSetupJobId(null);
  }

  function cancelSetup() {
    // BACKEND: DELETE /api/jobs/:id — which should also abort any in-flight
    // stage calls so a cancelled job stops burning Perplexity/Claude/Hunter credits.
    if (setupJobId) tracker.removeJob(setupJobId);
    finishSetup();
  }

  function retrySetup() {
    // BACKEND: POST /api/jobs/:id/stages/:stage/retry — the SSE stream then
    // resumes pushing running → done for the retried stage onward.
    progress.retry();
  }

  return (
    <div className="min-h-screen bg-cream text-ink">
      <NavBar />

      <main className="mx-auto max-w-[1040px] px-6 pb-[72px] pt-8">
        <AddJobForm home={tracker.home} onFieldChange={tracker.setHomeField} onAdd={handleAddJob} />
        <JobTable
          jobs={tracker.jobs}
          hoveredId={tracker.hoveredId}
          onHoverChange={tracker.setHoveredId}
          onOpen={tracker.openRow}
          onStatusChange={tracker.setRowStatus}
        />
      </main>

      {setupJobId && (
        <JobProgressModal
          companyName={setupJob?.companyName ?? ""}
          stages={progress.stages}
          onCancel={cancelSetup}
          onRetry={retrySetup}
          onDone={finishSetup}
        />
      )}

      {tracker.draft && (
        <JobDetailModal
          draft={tracker.draft}
          dirty={tracker.dirty}
          onFieldChange={tracker.setDraftField}
          onClose={tracker.requestClose}
          onTrash={tracker.requestDelete}
          onSave={tracker.saveDraft}
          onGetResume={() => tracker.draft && downloadTailoredResume(tracker.draft)}
        />
      )}

      {tracker.showCloseConfirm && (
        <ConfirmCloseModal
          title={draftTitle}
          onSaveAndClose={tracker.saveAndClose}
          onExitWithoutSaving={tracker.exitWithoutSaving}
          onCancel={tracker.cancelClose}
        />
      )}

      {tracker.showDeleteConfirm && (
        <ConfirmDeleteModal title={draftTitle} onConfirm={tracker.confirmDelete} onCancel={tracker.cancelDelete} />
      )}
    </div>
  );
}
