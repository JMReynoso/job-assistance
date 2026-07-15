import { act, renderHook } from "@testing-library/react";
import { useJobTracker } from "@/hooks/useJobTracker";
import { buildHomeForm } from "../mock/home-form.mock";

describe("useJobTracker", () => {
  it("seeds the tracker with the initial jobs and an empty quick-add form", () => {
    const { result } = renderHook(() => useJobTracker());

    expect(result.current.jobs).toHaveLength(3);
    expect(result.current.home).toEqual(buildHomeForm());
    expect(result.current.openId).toBeNull();
    expect(result.current.dirty).toBe(false);
  });

  describe("quick-add form", () => {
    it("updates a single field without touching the others", () => {
      const { result } = renderHook(() => useJobTracker());

      act(() => result.current.setHomeField("companyName", "Acme Robotics"));

      expect(result.current.home).toEqual(buildHomeForm({ companyName: "Acme Robotics" }));
    });

    it("adds a new job to the front of the list, mapped from the form, and clears the form", () => {
      const { result } = renderHook(() => useJobTracker());

      act(() => {
        result.current.setHomeField("companyName", "Acme Robotics");
        result.current.setHomeField("jobPosting", "https://acme.example/careers/1");
        result.current.setHomeField("companyPage", "https://acme.example");
        result.current.setHomeField("companyLinkedIn", "https://linkedin.com/company/acme");
        result.current.setHomeField("extraLinks", "https://glassdoor.com/acme");
      });
      act(() => result.current.addToTracker());

      expect(result.current.jobs).toHaveLength(4);
      expect(result.current.jobs[0]).toMatchObject({
        companyName: "Acme Robotics",
        status: "Interested",
        jobPostingUrl: "https://acme.example/careers/1",
        companyUrl: "https://acme.example",
        companyLinkedInUrl: "https://linkedin.com/company/acme",
        extraLinks: "https://glassdoor.com/acme",
      });
      expect(result.current.home).toEqual(buildHomeForm());
    });

    it("falls back to 'Untitled role' when no company name is given", () => {
      const { result } = renderHook(() => useJobTracker());

      act(() => result.current.addToTracker());

      expect(result.current.jobs[0].companyName).toBe("Untitled role");
    });

    it("treats a whitespace-only company name as blank", () => {
      const { result } = renderHook(() => useJobTracker());

      act(() => result.current.setHomeField("companyName", "   "));
      act(() => result.current.addToTracker());

      expect(result.current.jobs[0].companyName).toBe("Untitled role");
    });
  });

  describe("row status", () => {
    it("updates only the targeted job's status", () => {
      const { result } = renderHook(() => useJobTracker());

      act(() => result.current.setRowStatus("seed-2", "Offer"));

      const [first, second, third] = result.current.jobs;
      expect(first.status).toBe("Applied"); // seed-1, unchanged
      expect(second.status).toBe("Offer"); // seed-2, updated
      expect(third.status).toBe("Interested"); // seed-3, unchanged
    });
  });

  describe("opening and editing a job", () => {
    it("loads a copy of the job into the draft, not the live object", () => {
      const { result } = renderHook(() => useJobTracker());

      act(() => result.current.openRow("seed-1"));

      const liveJob = result.current.jobs.find((job) => job.id === "seed-1");
      expect(result.current.openId).toBe("seed-1");
      expect(result.current.draft).toEqual(liveJob);
      expect(result.current.draft).not.toBe(liveJob);
      expect(result.current.dirty).toBe(false);
    });

    it("does nothing when opening an id that doesn't exist", () => {
      const { result } = renderHook(() => useJobTracker());

      act(() => result.current.openRow("does-not-exist"));

      expect(result.current.openId).toBeNull();
      expect(result.current.draft).toBeNull();
    });

    it("marks the draft dirty as soon as a field changes, without touching the saved job", () => {
      const { result } = renderHook(() => useJobTracker());
      act(() => result.current.openRow("seed-1"));

      act(() => result.current.setDraftField("notes", "Updated notes"));

      expect(result.current.draft?.notes).toBe("Updated notes");
      expect(result.current.dirty).toBe(true);
      expect(result.current.jobs.find((job) => job.id === "seed-1")?.notes).not.toBe("Updated notes");
    });

    it("writes the draft back into the job list on save and clears dirty", () => {
      const { result } = renderHook(() => useJobTracker());
      act(() => result.current.openRow("seed-1"));
      act(() => result.current.setDraftField("notes", "Updated notes"));

      act(() => result.current.saveDraft());

      expect(result.current.jobs.find((job) => job.id === "seed-1")?.notes).toBe("Updated notes");
      expect(result.current.dirty).toBe(false);
    });

    it("does nothing when saving with no draft open", () => {
      const { result } = renderHook(() => useJobTracker());
      const jobsBefore = result.current.jobs;

      act(() => result.current.saveDraft());

      expect(result.current.jobs).toBe(jobsBefore);
    });
  });

  describe("closing the detail window", () => {
    it("closes immediately when there are no unsaved changes", () => {
      const { result } = renderHook(() => useJobTracker());
      act(() => result.current.openRow("seed-1"));

      act(() => result.current.requestClose());

      expect(result.current.openId).toBeNull();
      expect(result.current.draft).toBeNull();
      expect(result.current.showCloseConfirm).toBe(false);
    });

    it("asks for confirmation instead of closing when there are unsaved changes", () => {
      const { result } = renderHook(() => useJobTracker());
      act(() => result.current.openRow("seed-1"));
      act(() => result.current.setDraftField("notes", "Updated notes"));

      act(() => result.current.requestClose());

      expect(result.current.showCloseConfirm).toBe(true);
      expect(result.current.openId).toBe("seed-1"); // still open, nothing discarded yet
    });

    it("cancelling the close-confirmation keeps the window open with edits intact", () => {
      const { result } = renderHook(() => useJobTracker());
      act(() => result.current.openRow("seed-1"));
      act(() => result.current.setDraftField("notes", "Updated notes"));
      act(() => result.current.requestClose());

      act(() => result.current.cancelClose());

      expect(result.current.showCloseConfirm).toBe(false);
      expect(result.current.openId).toBe("seed-1");
      expect(result.current.dirty).toBe(true);
    });

    it("'exit without saving' discards the draft", () => {
      const { result } = renderHook(() => useJobTracker());
      act(() => result.current.openRow("seed-1"));
      act(() => result.current.setDraftField("notes", "Updated notes"));

      act(() => result.current.exitWithoutSaving());

      expect(result.current.openId).toBeNull();
      expect(result.current.jobs.find((job) => job.id === "seed-1")?.notes).not.toBe("Updated notes");
    });

    it("'save & close' persists the draft before closing", () => {
      const { result } = renderHook(() => useJobTracker());
      act(() => result.current.openRow("seed-1"));
      act(() => result.current.setDraftField("notes", "Updated notes"));

      act(() => result.current.saveAndClose());

      expect(result.current.openId).toBeNull();
      expect(result.current.jobs.find((job) => job.id === "seed-1")?.notes).toBe("Updated notes");
    });
  });

  describe("deleting a job", () => {
    it("shows, then cancels, the delete confirmation without touching the job list", () => {
      const { result } = renderHook(() => useJobTracker());
      act(() => result.current.openRow("seed-1"));

      act(() => result.current.requestDelete());
      expect(result.current.showDeleteConfirm).toBe(true);

      act(() => result.current.cancelDelete());
      expect(result.current.showDeleteConfirm).toBe(false);
      expect(result.current.jobs).toHaveLength(3);
    });

    it("removes the open job and closes the window on confirm", () => {
      const { result } = renderHook(() => useJobTracker());
      act(() => result.current.openRow("seed-2"));

      act(() => result.current.confirmDelete());

      expect(result.current.jobs.find((job) => job.id === "seed-2")).toBeUndefined();
      expect(result.current.jobs).toHaveLength(2);
      expect(result.current.openId).toBeNull();
    });
  });

  describe("row hover", () => {
    it("tracks which row is currently hovered", () => {
      const { result } = renderHook(() => useJobTracker());

      act(() => result.current.setHoveredId("seed-1"));
      expect(result.current.hoveredId).toBe("seed-1");

      act(() => result.current.setHoveredId(null));
      expect(result.current.hoveredId).toBeNull();
    });
  });
});
