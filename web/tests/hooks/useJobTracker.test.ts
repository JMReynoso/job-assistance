import { act, renderHook, waitFor } from "@testing-library/react";
import { useJobTracker } from "@/hooks/useJobTracker";
import { buildHomeForm } from "../mock/home-form.mock";
import {
  buildApiCompanyResearch,
  buildApiContact,
  buildApiGeneratedContent,
  buildApiJob,
  mockApi,
} from "../mock/api.mock";

const JOBS = [
  buildApiJob({ id: 1, companyName: "Willow & Oak", status: "applied" }),
  buildApiJob({ id: 2, companyName: "Maple Grove", status: "interviewing" }),
  buildApiJob({ id: 3, companyName: "Fern & Field", status: "not_applied" }),
];

/** Renders the hook and waits for the initial GET /jobs to settle. */
async function renderLoaded(options: Parameters<typeof mockApi>[0] = {}) {
  const fetchMock = mockApi({ jobs: JOBS, ...options });
  const view = renderHook(() => useJobTracker());
  await waitFor(() => expect(view.result.current.jobsStatus).not.toBe("loading"));
  return { ...view, fetchMock };
}

/** Opens a row and waits for its detail fetch to settle. */
async function openAndSettle(result: { current: ReturnType<typeof useJobTracker> }, id: string) {
  await act(async () => {
    await result.current.openRow(id);
  });
}

describe("useJobTracker", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("loading the job list", () => {
    it("loads the jobs from the API on mount", async () => {
      const { result } = await renderLoaded();

      expect(result.current.jobsStatus).toBe("loaded");
      expect(result.current.jobs).toHaveLength(3);
      expect(result.current.jobs[0]).toMatchObject({ id: "1", companyName: "Willow & Oak" });
      expect(result.current.home).toEqual(buildHomeForm());
      expect(result.current.openId).toBeNull();
      expect(result.current.dirty).toBe(false);
    });

    it("reports an error state when the list can't be fetched", async () => {
      const { result } = await renderLoaded({ failOn: "/jobs" });

      expect(result.current.jobsStatus).toBe("error");
      expect(result.current.jobs).toEqual([]);
    });

    it("recovers when loadJobs is retried after a failure", async () => {
      const { result } = await renderLoaded({ failOn: "/jobs" });
      expect(result.current.jobsStatus).toBe("error");

      mockApi({ jobs: JOBS });
      await act(async () => {
        await result.current.loadJobs();
      });

      expect(result.current.jobsStatus).toBe("loaded");
      expect(result.current.jobs).toHaveLength(3);
    });

    it("puts the list back into its loading state while a retry is in flight", async () => {
      const { result } = await renderLoaded({ failOn: "/jobs" });
      expect(result.current.jobsStatus).toBe("error");

      mockApi({ jobs: JOBS });
      let retry: Promise<void>;
      act(() => {
        retry = result.current.loadJobs();
      });
      expect(result.current.jobsStatus).toBe("loading");

      await act(async () => {
        await retry;
      });
      expect(result.current.jobsStatus).toBe("loaded");
    });
  });

  describe("quick-add form", () => {
    it("updates a single field without touching the others", async () => {
      const { result } = await renderLoaded();

      act(() => result.current.setHomeField("companyName", "Acme Robotics"));

      expect(result.current.home).toEqual(buildHomeForm({ companyName: "Acme Robotics" }));
    });

    it("adds a new job to the front of the list, mapped from the form, and clears the form", async () => {
      const { result } = await renderLoaded();

      act(() => {
        result.current.setHomeField("companyName", "Acme Robotics");
        result.current.setHomeField("jobPosting", "https://acme.example/careers/1");
        result.current.setHomeField("companyPage", "https://acme.example");
        result.current.setHomeField("companyLinkedIn", "https://linkedin.com/company/acme");
        result.current.setHomeField("extraLinks", "https://glassdoor.com/acme");
      });
      act(() => {
        result.current.addToTracker();
      });

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

    it("dates a new job today", async () => {
      const { result } = await renderLoaded();

      act(() => {
        result.current.addToTracker();
      });

      const iso = new Date().toISOString().slice(0, 10);
      expect(result.current.jobs[0].dateApplied).toBe(iso);
      expect(result.current.jobs[0].dateLastContacted).toBe(iso);
    });

    it("falls back to 'Untitled role' when no company name is given", async () => {
      const { result } = await renderLoaded();

      act(() => {
        result.current.addToTracker();
      });

      expect(result.current.jobs[0].companyName).toBe("Untitled role");
    });

    it("treats a whitespace-only company name as blank", async () => {
      const { result } = await renderLoaded();

      act(() => result.current.setHomeField("companyName", "   "));
      act(() => {
        result.current.addToTracker();
      });

      expect(result.current.jobs[0].companyName).toBe("Untitled role");
    });
  });

  describe("row status", () => {
    it("updates only the targeted job's status", async () => {
      const { result } = await renderLoaded();

      act(() => result.current.setRowStatus("2", "Offer"));

      const [first, second, third] = result.current.jobs;
      expect(first.status).toBe("Applied");
      expect(second.status).toBe("Offer");
      expect(third.status).toBe("Interested");
    });
  });

  describe("opening a job", () => {
    it("populates the draft from the by-job endpoints", async () => {
      const { result } = await renderLoaded({
        contacts: [buildApiContact({ firstName: "Dana", lastName: "Reyes" })],
        research: buildApiCompanyResearch({ summary: "Founded 2011." }),
        content: buildApiGeneratedContent({
          outreachMessage: "Hi Dana",
          followupMessage: "Checking in",
          tailoredResume: "Jane_Willow_1.pdf",
        }),
      });

      await openAndSettle(result, "1");

      expect(result.current.detailStatus).toBe("loaded");
      expect(result.current.draft?.notes).toBe("Founded 2011.");
      expect(result.current.draft?.recruiterMessage).toBe("Hi Dana");
      expect(result.current.draft?.followupMessage).toBe("Checking in");
      expect(result.current.draft?.contacts[0].name).toBe("Dana Reyes");
      expect(result.current.resumeFileName).toBe("Jane_Willow_1.pdf");
      expect(result.current.dirty).toBe(false);
    });

    it("leaves the fields quietly empty when a job has no research or content", async () => {
      const { result } = await renderLoaded({ contacts: [], research: null, content: null });

      await openAndSettle(result, "1");

      // Absence is not an error — it's the normal state of a new job.
      expect(result.current.detailStatus).toBe("loaded");
      expect(result.current.draft?.notes).toBe("");
      expect(result.current.draft?.recruiterMessage).toBe("");
      expect(result.current.draft?.contacts).toEqual([]);
      expect(result.current.resumeFileName).toBeNull();
    });

    it("copies the job into the draft rather than aliasing it", async () => {
      const { result } = await renderLoaded();

      await openAndSettle(result, "1");

      const liveJob = result.current.jobs.find((job) => job.id === "1");
      expect(result.current.openId).toBe("1");
      expect(result.current.draft).not.toBe(liveJob);
      expect(result.current.draft?.contacts).not.toBe(liveJob?.contacts);
    });

    it("does nothing when opening an id that doesn't exist", async () => {
      const { result } = await renderLoaded();

      await openAndSettle(result, "does-not-exist");

      expect(result.current.openId).toBeNull();
      expect(result.current.draft).toBeNull();
    });

    it("skips the fetch entirely for a job that was never persisted", async () => {
      const { result, fetchMock } = await renderLoaded();
      act(() => {
        result.current.addToTracker();
      });
      const localId = result.current.jobs[0].id;
      fetchMock.mockClear();

      await openAndSettle(result, localId);

      expect(fetchMock).not.toHaveBeenCalled();
      expect(result.current.detailStatus).toBe("idle");
      expect(result.current.draft?.companyName).toBe("Untitled role");
    });

    it("reports an error when the detail fetch fails, and recovers on retry", async () => {
      const { result } = await renderLoaded({ failOn: "/contacts/by-job/" });

      await openAndSettle(result, "1");
      expect(result.current.detailStatus).toBe("error");

      mockApi({ jobs: JOBS });
      await act(async () => {
        result.current.retryDetail();
      });
      await waitFor(() => expect(result.current.detailStatus).toBe("loaded"));
    });

    it("keeps the second job's data when two rows are opened in quick succession", async () => {
      // Job 1's detail resolves *after* job 2's, so the stale response must be
      // dropped rather than overwriting the open draft.
      const deferred: Array<() => void> = [];
      global.fetch = jest.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        const respond = (body: unknown) =>
          ({ ok: true, status: 200, json: async () => body }) as Response;

        if (url.endsWith("/jobs")) return respond(JOBS);
        if (url.includes("/contacts/by-job/")) return respond([]);
        if (url.includes("/company-research/by-job/")) {
          const forJobOne = url.endsWith("/1");
          const summary = forJobOne ? "JOB ONE" : "JOB TWO";
          if (forJobOne) {
            // Hold job 1's response open until we release it.
            return new Promise<Response>((resolve) => {
              deferred.push(() => resolve(respond(buildApiCompanyResearch({ summary }))));
            });
          }
          return respond(buildApiCompanyResearch({ summary }));
        }
        if (url.includes("/generated-content/by-job/")) return respond(null);
        return respond(JOBS.find((j) => url.endsWith(`/${j.id}`)) ?? JOBS[0]);
      }) as unknown as typeof fetch;

      const { result } = renderHook(() => useJobTracker());
      await waitFor(() => expect(result.current.jobs).toHaveLength(3));

      // Open job 1 (its research hangs), then immediately open job 2.
      let openOne: Promise<void>;
      act(() => {
        openOne = result.current.openRow("1");
      });
      await openAndSettle(result, "2");
      expect(result.current.draft?.notes).toBe("JOB TWO");

      // Now let job 1's response land — it must be discarded.
      await act(async () => {
        deferred.forEach((release) => release());
        await openOne;
      });

      expect(result.current.openId).toBe("2");
      expect(result.current.draft?.notes).toBe("JOB TWO");
    });
  });

  describe("editing a job", () => {
    it("marks the draft dirty as soon as a field changes, without touching the saved job", async () => {
      const { result } = await renderLoaded();
      await openAndSettle(result, "1");

      act(() => result.current.setDraftField("notes", "Updated notes"));

      expect(result.current.draft?.notes).toBe("Updated notes");
      expect(result.current.dirty).toBe(true);
      expect(result.current.jobs.find((job) => job.id === "1")?.notes).not.toBe("Updated notes");
    });

    it("writes the draft back into the job list on save and clears dirty", async () => {
      const { result } = await renderLoaded();
      await openAndSettle(result, "1");
      act(() => result.current.setDraftField("notes", "Updated notes"));

      act(() => result.current.saveDraft());

      expect(result.current.jobs.find((job) => job.id === "1")?.notes).toBe("Updated notes");
      expect(result.current.dirty).toBe(false);
    });

    it("does nothing when saving with no draft open", async () => {
      const { result } = await renderLoaded();
      const jobsBefore = result.current.jobs;

      act(() => result.current.saveDraft());

      expect(result.current.jobs).toBe(jobsBefore);
    });
  });

  describe("closing the detail window", () => {
    it("closes immediately when there are no unsaved changes", async () => {
      const { result } = await renderLoaded();
      await openAndSettle(result, "1");

      act(() => result.current.requestClose());

      expect(result.current.openId).toBeNull();
      expect(result.current.draft).toBeNull();
      expect(result.current.showCloseConfirm).toBe(false);
      expect(result.current.detailStatus).toBe("idle");
    });

    it("asks for confirmation instead of closing when there are unsaved changes", async () => {
      const { result } = await renderLoaded();
      await openAndSettle(result, "1");
      act(() => result.current.setDraftField("notes", "Updated notes"));

      act(() => result.current.requestClose());

      expect(result.current.showCloseConfirm).toBe(true);
      expect(result.current.openId).toBe("1");
    });

    it("cancelling the close-confirmation keeps the window open with edits intact", async () => {
      const { result } = await renderLoaded();
      await openAndSettle(result, "1");
      act(() => result.current.setDraftField("notes", "Updated notes"));
      act(() => result.current.requestClose());

      act(() => result.current.cancelClose());

      expect(result.current.showCloseConfirm).toBe(false);
      expect(result.current.openId).toBe("1");
      expect(result.current.dirty).toBe(true);
    });

    it("'exit without saving' discards the draft", async () => {
      const { result } = await renderLoaded();
      await openAndSettle(result, "1");
      act(() => result.current.setDraftField("notes", "Updated notes"));

      act(() => result.current.exitWithoutSaving());

      expect(result.current.openId).toBeNull();
      expect(result.current.jobs.find((job) => job.id === "1")?.notes).not.toBe("Updated notes");
    });

    it("'save & close' persists the draft before closing", async () => {
      const { result } = await renderLoaded();
      await openAndSettle(result, "1");
      act(() => result.current.setDraftField("notes", "Updated notes"));

      act(() => result.current.saveAndClose());

      expect(result.current.openId).toBeNull();
      expect(result.current.jobs.find((job) => job.id === "1")?.notes).toBe("Updated notes");
    });
  });

  describe("deleting a job", () => {
    it("shows, then cancels, the delete confirmation without touching the job list", async () => {
      const { result } = await renderLoaded();
      await openAndSettle(result, "1");

      act(() => result.current.requestDelete());
      expect(result.current.showDeleteConfirm).toBe(true);

      act(() => result.current.cancelDelete());
      expect(result.current.showDeleteConfirm).toBe(false);
      expect(result.current.jobs).toHaveLength(3);
    });

    it("removes the open job and closes the window on confirm", async () => {
      const { result } = await renderLoaded();
      await openAndSettle(result, "2");

      act(() => result.current.confirmDelete());

      expect(result.current.jobs.find((job) => job.id === "2")).toBeUndefined();
      expect(result.current.jobs).toHaveLength(2);
      expect(result.current.openId).toBeNull();
    });
  });

  describe("row hover", () => {
    it("tracks which row is currently hovered", async () => {
      const { result } = await renderLoaded();

      act(() => result.current.setHoveredId("1"));
      expect(result.current.hoveredId).toBe("1");

      act(() => result.current.setHoveredId(null));
      expect(result.current.hoveredId).toBeNull();
    });
  });
});
