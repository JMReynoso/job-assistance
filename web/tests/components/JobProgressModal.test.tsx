import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import JobProgressModal from "@/components/job-assistance/JobProgressModal";
import type { JobStage, JobStageKey, JobStageStatus } from "@/lib/job-assistance/types";

const ALL_KEYS: JobStageKey[] = ["created", "research", "tailoring", "contact", "ready"];

function stagesWith(overrides: Partial<Record<JobStageKey, JobStageStatus>> = {}): JobStage[] {
  return ALL_KEYS.map((key) => ({ key, status: overrides[key] ?? "pending" }));
}

function renderModal(stages: JobStage[], props: Partial<React.ComponentProps<typeof JobProgressModal>> = {}) {
  return render(
    <JobProgressModal
      companyName="Acme Robotics"
      stages={stages}
      onCancel={props.onCancel ?? jest.fn()}
      onRetry={props.onRetry ?? jest.fn()}
      onDone={props.onDone ?? jest.fn()}
    />,
  );
}

describe("JobProgressModal", () => {
  it("renders a node for every pipeline stage and starts in a waiting state", () => {
    renderModal(stagesWith());

    expect(screen.getByText("Job created")).toBeInTheDocument();
    expect(screen.getByText("Company research")).toBeInTheDocument();
    expect(screen.getByText("Application tailoring")).toBeInTheDocument();
    expect(screen.getByText("Find hiring manager")).toBeInTheDocument();
    expect(screen.getByText("Saved & ready")).toBeInTheDocument();
    expect(screen.getAllByText("Waiting")).toHaveLength(5);
    expect(screen.getByText("Starting up…")).toBeInTheDocument();
  });

  it("shows the running stage's status line", () => {
    renderModal(stagesWith({ created: "done", research: "running" }));

    expect(screen.getByText(/Researching the company with Perplexity/)).toBeInTheDocument();
  });

  it("surfaces a failed stage with a retry hint", () => {
    renderModal(stagesWith({ created: "done", research: "failed" }));

    expect(screen.getByText(/Company research failed/)).toBeInTheDocument();
  });

  it("offers a Try again button on a failed stage and calls onRetry", async () => {
    const user = userEvent.setup();
    const onRetry = jest.fn();
    renderModal(stagesWith({ created: "done", research: "failed" }), { onRetry });

    await user.click(screen.getByRole("button", { name: /Try again/ }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("confirms before cancelling while still running, then cancels on confirm", async () => {
    const user = userEvent.setup();
    const onCancel = jest.fn();
    renderModal(stagesWith({ created: "done", research: "running" }), { onCancel });

    await user.click(screen.getByRole("button", { name: "Close" }));
    const confirm = screen.getByRole("dialog", { name: "Cancel setup?" });
    await user.click(within(confirm).getByRole("button", { name: /Cancel & delete/ }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("dismisses the cancel confirmation with 'Keep going' without cancelling", async () => {
    const user = userEvent.setup();
    const onCancel = jest.fn();
    renderModal(stagesWith({ created: "done", research: "running" }), { onCancel });

    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Keep going" }));

    expect(screen.queryByRole("dialog", { name: "Cancel setup?" })).not.toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("closes without confirmation once every stage is done", async () => {
    const user = userEvent.setup();
    const onDone = jest.fn();
    const allDone = stagesWith({
      created: "done",
      research: "done",
      tailoring: "done",
      contact: "done",
      ready: "done",
    });
    renderModal(allDone, { onDone });

    expect(screen.getByText(/your tailored application is saved/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(onDone).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("dialog", { name: "Cancel setup?" })).not.toBeInTheDocument();
  });
});
