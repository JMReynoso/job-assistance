import {
  activeStage,
  failedStage,
  initialStages,
  isComplete,
  progressPercent,
} from "@/lib/job-assistance/job-progress";

describe("job-progress helpers", () => {
  it("starts every stage pending", () => {
    const stages = initialStages();
    expect(stages).toHaveLength(5);
    expect(stages.every((s) => s.status === "pending")).toBe(true);
  });

  it("reports 0% and not-complete for an empty pipeline", () => {
    expect(progressPercent([])).toBe(0);
    expect(isComplete([])).toBe(false);
  });

  it("fills the track toward the active node", () => {
    const stages = initialStages();
    stages[0].status = "done";
    stages[1].status = "done";
    expect(progressPercent(stages)).toBeCloseTo((2 / 4) * 100);
    expect(isComplete(stages)).toBe(false);
  });

  it("caps at 100% and reports complete when all stages are done", () => {
    const stages = initialStages().map((s) => ({ ...s, status: "done" as const }));
    expect(progressPercent(stages)).toBe(100);
    expect(isComplete(stages)).toBe(true);
  });

  it("finds the running and failed stages", () => {
    const stages = initialStages();
    stages[1].status = "running";
    expect(activeStage(stages)?.key).toBe("research");
    expect(failedStage(stages)).toBeUndefined();

    stages[1].status = "failed";
    expect(failedStage(stages)?.key).toBe("research");
    expect(activeStage(stages)).toBeUndefined();
  });
});
