"use client";

import { useJobTracker } from "@/hooks/useJobTracker";
import { useCreateJob } from "@/hooks/useCreateJob";
import { useRegenerateResume } from "@/hooks/useRegenerateResume";
import { useSettings } from "@/hooks/useSettings";
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
import SettingsModal from "./SettingsModal";

export default function JobAssistanceApp() {
  const tracker = useJobTracker();
  const prefs = useSettings();
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
    // The engine that wrote the row rewrites it — see useRegenerateResume.
    regen.start(jobId, keywords, tracker.draft.provider);
  }

  // "Add to tracker" runs the whole setup pipeline: POST /jobs, then the
  // Perplexity research, then the tailored resume, then the Hunter lookup —
  // in that order, because each step reads what the one before it wrote.
  function handleAddJob() {
    setup.start(tracker.home, prefs.settings.provider);
  }

  return (
    <div className="min-h-screen bg-cream text-ink">
      <NavBar onOpenSettings={prefs.openSettings} />

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
          engineLabel={setup.provider === "claude" ? "Claude" : "Ollama (local)"}
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
          engineLabel={tracker.draft?.provider === "claude" ? "Claude" : "Ollama (local)"}
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

      {prefs.open && (
        <SettingsModal
          settings={prefs.settings}
          onProviderChange={prefs.setProvider}
          onClose={prefs.closeSettings}
        />
      )}
    </div>
  );
}
