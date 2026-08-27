import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RegenerateProgressModal from "@/components/job-assistance/RegenerateProgressModal";
import type { RegenerateStage, RegenerateStageKey, JobStageStatus } from "@/lib/job-assistance/types";

const ALL_KEYS: RegenerateStageKey[] = ["keywords", "rewriting", "rendering", "scoring"];

function stagesWith(overrides: Partial<Record<RegenerateStageKey, JobStageStatus>> = {}): RegenerateStage[] {
  return ALL_KEYS.map((key) => ({ key, status: overrides[key] ?? "pending" }));
}

function renderModal(
  stages: RegenerateStage[],
  props: Partial<React.ComponentProps<typeof RegenerateProgressModal>> = {},
) {
  return render(
    <RegenerateProgressModal
      companyName="Acme Robotics"
      stages={stages}
      matchPercent={props.matchPercent ?? null}
      onCancel={props.onCancel ?? jest.fn()}
      onRetry={props.onRetry ?? jest.fn()}
      onDone={props.onDone ?? jest.fn()}
    />,
  );
}

describe("RegenerateProgressModal", () => {
  it("renders a node for every regenerate stage, keyed by data-stage/data-status", () => {
    renderModal(stagesWith({ keywords: "done", rewriting: "running" }));

    expect(screen.getByText("Keywords")).toBeInTheDocument();
    expect(screen.getByText("Rewriting")).toBeInTheDocument();
    expect(screen.getByText("New PDF")).toBeInTheDocument();
    expect(screen.getByText("Re-scoring")).toBeInTheDocument();

    const [keywords, rewriting] = ["keywords", "rewriting"].map(
      (key) => document.querySelector(`[data-stage="${key}"]`)!,
    );
    expect(keywords).toHaveAttribute("data-status", "done");
    expect(rewriting).toHaveAttribute("data-status", "running");
  });

  it("shows the running stage's status line", () => {
    renderModal(stagesWith({ keywords: "done", rewriting: "running" }));

    expect(screen.getByText(/Working the keywords into your resume with Claude/)).toBeInTheDocument();
  });

  it("opens a cancel confirmation instead of closing while still running", async () => {
    const user = userEvent.setup();
    const onCancel = jest.fn();
    renderModal(stagesWith({ keywords: "done", rewriting: "running" }), { onCancel });

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.getByRole("dialog", { name: "Stop regenerating?" })).toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("cancels when the confirmation is confirmed", async () => {
    const user = userEvent.setup();
    const onCancel = jest.fn();
    renderModal(stagesWith({ keywords: "done", rewriting: "running" }), { onCancel });

    await user.click(screen.getByRole("button", { name: "Close" }));
    const confirm = screen.getByRole("dialog", { name: "Stop regenerating?" });
    await user.click(within(confirm).getByRole("button", { name: "Stop" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("dismisses the cancel confirmation with 'Keep going' without cancelling", async () => {
    const user = userEvent.setup();
    const onCancel = jest.fn();
    renderModal(stagesWith({ keywords: "done", rewriting: "running" }), { onCancel });

    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Keep going" }));

    expect(screen.queryByRole("dialog", { name: "Stop regenerating?" })).not.toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("surfaces a failed stage with a retry hint and a Try again button", async () => {
    const user = userEvent.setup();
    const onRetry = jest.fn();
    renderModal(stagesWith({ keywords: "done", rewriting: "failed" }), { onRetry });

    expect(screen.getByText(/Rewriting failed/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Try again/ }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows the match line and a Done button once every stage is complete", async () => {
    const user = userEvent.setup();
    const onDone = jest.fn();
    const allDone = stagesWith({ keywords: "done", rewriting: "done", rendering: "done", scoring: "done" });
    renderModal(allDone, { onDone, matchPercent: 88 });

    expect(screen.getByText("Job Description Match: 88%")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("omits the match line when complete but no score has landed yet", () => {
    const allDone = stagesWith({ keywords: "done", rewriting: "done", rendering: "done", scoring: "done" });
    renderModal(allDone, { matchPercent: null });

    expect(screen.queryByText(/Job Description Match/)).not.toBeInTheDocument();
  });

  it("closes without confirmation once every stage is done", async () => {
    const user = userEvent.setup();
    const onDone = jest.fn();
    const allDone = stagesWith({ keywords: "done", rewriting: "done", rendering: "done", scoring: "done" });
    renderModal(allDone, { onDone });

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog", { name: "Stop regenerating?" })).not.toBeInTheDocument();
  });
});
