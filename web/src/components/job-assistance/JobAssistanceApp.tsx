"use client";

import { useJobTracker } from "@/hooks/useJobTracker";
import { useCreateJob } from "@/hooks/useCreateJob";
import { useRegenerateResume } from "@/hooks/useRegenerateResume";
import { toJobId } from "@/lib/api/mappers";
import { downloadTailoredResume } from "@/lib/job-assistance/generate-resume";
import NavBar from "./NavBar";
import AddJobForm from "./AddJobForm";
import JobTable from "./JobTable";
import JobDetailModal from "./JobDetailModal";
import JobProgressModal from "./JobProgressModal";
import RegenerateProgressModal from "./RegenerateProgressModal";
import ConfirmCloseModal from "./ConfirmCloseModal";
import ConfirmDeleteModal from "./ConfirmDeleteModal";

export default function JobAssistanceApp() {
  const tracker = useJobTracker();
  const setup = useCreateJob({
    onCreated: tracker.addCreatedJob,
    onFinished: tracker.applyJobDetail,
    onDiscarded: (jobId) => tracker.removeJob(String(jobId)),
  });
  const regen = useRegenerateResume((content) => tracker.applyRegeneratedContent(content));
  const draftTitle = tracker.draft?.companyName.trim() || "Job details";

  function handleRegenerate() {
    if (!tracker.draft) return;
    const jobId = toJobId(tracker.draft.id);
    if (jobId === null) return;
    const keywords = tracker.missingKeywords.filter((k) => k.include).map((k) => k.keyword);
    if (keywords.length === 0) return;
    regen.start(jobId, keywords);
  }

  // "Add to tracker" runs the whole setup pipeline: POST /jobs, then the
  // Perplexity research, then the tailored resume, then the Hunter lookup —
  // in that order, because each step reads what the one before it wrote.
  function handleAddJob() {
    setup.start(tracker.home);
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
          loading={tracker.jobsStatus === "loading"}
          error={tracker.jobsStatus === "error"}
          onRetry={tracker.loadJobs}
        />
      </main>

      {setup.active && (
        <JobProgressModal
          companyName={setup.companyName}
          stages={setup.stages}
          error={setup.error}
          onCancel={() => void setup.cancel()}
          onRetry={setup.retry}
          onDone={setup.reset}
        />
      )}

      {tracker.draft && (
        <JobDetailModal
          draft={tracker.draft}
          dirty={tracker.dirty}
          onFieldChange={tracker.setDraftField}
          onClose={tracker.requestClose}
          onTrash={tracker.requestDelete}
          onSave={() => void tracker.saveDraft()}
          onGetResume={() => tracker.draft && downloadTailoredResume(tracker.draft)}
          detailStatus={tracker.detailStatus}
          onRetryDetail={tracker.retryDetail}
          saveStatus={tracker.saveStatus}
          resumeFileName={tracker.resumeFileName}
          jdMatchPercent={tracker.jdMatchPercent}
          missingKeywords={tracker.missingKeywords}
          onToggleKeyword={tracker.toggleKeyword}
          onRegenerate={handleRegenerate}
          regenerating={regen.active}
        />
      )}

      {regen.active && (
        <RegenerateProgressModal
          companyName={tracker.draft?.companyName ?? ""}
          stages={regen.stages}
          matchPercent={regen.matchPercent}
          onCancel={regen.cancel}
          onRetry={regen.retry}
          onDone={regen.reset}
        />
      )}

      {tracker.showCloseConfirm && (
        <ConfirmCloseModal
          title={draftTitle}
          onSaveAndClose={() => void tracker.saveAndClose()}
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
