"use client";

import { useJobTracker } from "@/hooks/useJobTracker";
import { downloadTailoredResume } from "@/lib/job-assistance/generate-resume";
import NavBar from "./NavBar";
import AddJobForm from "./AddJobForm";
import JobTable from "./JobTable";
import JobDetailModal from "./JobDetailModal";
import ConfirmCloseModal from "./ConfirmCloseModal";
import ConfirmDeleteModal from "./ConfirmDeleteModal";

export default function JobAssistanceApp() {
  const tracker = useJobTracker();
  const draftTitle = tracker.draft?.companyName.trim() || "Job details";

  return (
    <div className="min-h-screen bg-cream text-ink">
      <NavBar />

      <main className="mx-auto max-w-[1040px] px-6 pb-[72px] pt-8">
        <AddJobForm home={tracker.home} onFieldChange={tracker.setHomeField} onAdd={tracker.addToTracker} />
        <JobTable
          jobs={tracker.jobs}
          hoveredId={tracker.hoveredId}
          onHoverChange={tracker.setHoveredId}
          onOpen={tracker.openRow}
          onStatusChange={tracker.setRowStatus}
        />
      </main>

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
