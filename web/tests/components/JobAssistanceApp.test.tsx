import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import JobAssistanceApp from "@/components/job-assistance/JobAssistanceApp";
import {
  buildApiCompanyResearch,
  buildApiContact,
  buildApiGeneratedContent,
  buildApiJob,
  mockApi,
} from "../mock/api.mock";

const JOBS = [
  buildApiJob({ id: 1, companyName: "Willow & Oak", status: "applied" }),
  buildApiJob({ id: 2, companyName: "Fern & Field", status: "not_applied" }),
];

/** Notes come from company research now, so each job needs its own summary. */
const RESEARCH_BY_JOB = (jobId: number) =>
  buildApiCompanyResearch({ jobId, summary: `Research notes for job ${jobId}.` });

function renderApp(options: Parameters<typeof mockApi>[0] = {}) {
  mockApi({ jobs: JOBS, research: RESEARCH_BY_JOB, ...options });
  return render(<JobAssistanceApp />);
}

/**
 * The "open" button only becomes clickable once its row is hovered (an
 * opacity/pointer-events toggle driven by our own onMouseEnter prop, not
 * real CSS :hover) — fireEvent triggers that handler directly, sidestepping
 * userEvent's pointer-events guard, which is fussy in jsdom's zero-layout
 * environment where every element's bounding box collapses to the origin.
 *
 * The table is populated by GET /jobs and the modal fills in from three more
 * requests, so both waits are real: findByText for the row, and the loading
 * strip clearing for the detail. Until it clears the form sits inside a
 * disabled <fieldset> and won't accept input.
 */
async function openJob(user: ReturnType<typeof userEvent.setup>, companyName: string) {
  const row = (await screen.findByText(companyName)).closest("tr")!;
  fireEvent.mouseEnter(row);
  await user.click(within(row).getByRole("button", { name: "open" }));

  const dialog = screen.getByRole("dialog");
  await waitFor(() =>
    expect(within(dialog).queryByText(/Loading this job’s details/)).not.toBeInTheDocument(),
  );
  return dialog;
}

/** The main tracker table — the open modal renders a contacts table of its own. */
function trackerTable() {
  return screen.getAllByRole("table").find((t) => !t.closest('[role="dialog"]'))!;
}

describe("JobAssistanceApp", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("loading the tracker", () => {
    it("fills the table from the API", async () => {
      renderApp();

      expect(await screen.findByText("Willow & Oak")).toBeInTheDocument();
      expect(screen.getByText("Fern & Field")).toBeInTheDocument();
      expect(screen.getByText("2 jobs")).toBeInTheDocument();
    });

    it("offers a retry when the list can't be loaded, and recovers", async () => {
      renderApp({ failOn: "/jobs" });

      expect(await screen.findByText(/Couldn’t load your jobs/)).toBeInTheDocument();
      expect(screen.queryByText("Willow & Oak")).not.toBeInTheDocument();

      const user = userEvent.setup();
      mockApi({ jobs: JOBS, research: RESEARCH_BY_JOB });
      await user.click(screen.getByRole("button", { name: /Try again/ }));

      expect(await screen.findByText("Willow & Oak")).toBeInTheDocument();
    });
  });

  describe("adding a job", () => {
    it("adds a job through the quick-add form and lists it in the tracker", async () => {
      renderApp();
      await screen.findByText("Willow & Oak");

      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      await user.type(screen.getByPlaceholderText("e.g. Willow & Oak"), "Acme Robotics");
      await user.click(screen.getByRole("button", { name: "Add to tracker" }));

      // Adding opens the setup-progress modal…
      expect(screen.getByRole("dialog", { name: /Acme Robotics/ })).toBeInTheDocument();

      // …and drops the row into the tracker table straight away.
      const newRow = within(trackerTable()).getByText("Acme Robotics").closest("tr")!;
      expect(within(newRow).getByRole("combobox")).toHaveValue("Interested");
      expect(screen.getByPlaceholderText("e.g. Willow & Oak")).toHaveValue("");

      jest.useRealTimers();
    });

    it("cancels setup from the progress modal, deleting the just-added job", async () => {
      renderApp();
      await screen.findByText("Willow & Oak");

      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      await user.type(screen.getByPlaceholderText("e.g. Willow & Oak"), "Acme Robotics");
      await user.click(screen.getByRole("button", { name: "Add to tracker" }));

      const progressModal = screen.getByRole("dialog", { name: /Acme Robotics/ });
      await user.click(within(progressModal).getByRole("button", { name: "Close" }));

      const confirm = screen.getByRole("dialog", { name: "Cancel setup?" });
      await user.click(within(confirm).getByRole("button", { name: /Cancel & delete/ }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(within(trackerTable()).queryByText("Acme Robotics")).not.toBeInTheDocument();

      jest.useRealTimers();
    });

    it("recovers from a failed stage via retry, then finishes setup", async () => {
      renderApp();
      await screen.findByText("Willow & Oak");

      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      await user.type(screen.getByPlaceholderText("e.g. Willow & Oak"), "Acme Robotics");
      await user.click(screen.getByRole("button", { name: "Add to tracker" }));

      // Run until the (demo) contact-lookup stage fails.
      act(() => {
        jest.advanceTimersByTime(6 * 1400);
      });
      const progressModal = screen.getByRole("dialog", { name: /Acme Robotics/ });
      expect(within(progressModal).getByText(/Find hiring manager failed/)).toBeInTheDocument();

      // Retry re-runs from the failed stage through to completion.
      await user.click(within(progressModal).getByRole("button", { name: /Try again/ }));
      act(() => {
        jest.advanceTimersByTime(3 * 1400);
      });

      await user.click(within(progressModal).getByRole("button", { name: "Done" }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(within(trackerTable()).getByText("Acme Robotics")).toBeInTheDocument();

      jest.useRealTimers();
    });

  });

  describe("the job list", () => {
    it("changes a job's status directly from the table, with no window open", async () => {
      const user = userEvent.setup();
      renderApp();

      const row = (await screen.findByText("Fern & Field")).closest("tr")!;
      await user.selectOptions(within(row).getByRole("combobox"), "Applied");

      expect(within(row).getByRole("combobox")).toHaveValue("Applied");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("the detail window", () => {
    it("fills the window from the by-job endpoints", async () => {
      const user = userEvent.setup();
      renderApp({
        contacts: [buildApiContact({ firstName: "Dana", lastName: "Reyes", confidence: 94 })],
        content: buildApiGeneratedContent({ outreachMessage: "Hi Dana, following up" }),
      });

      const dialog = await openJob(user, "Willow & Oak");

      expect(within(dialog).getByDisplayValue("Willow & Oak")).toBeInTheDocument();
      expect(within(dialog).getByDisplayValue("Research notes for job 1.")).toBeInTheDocument();
      expect(within(dialog).getByDisplayValue("Hi Dana, following up")).toBeInTheDocument();
      expect(within(dialog).getByText("Dana Reyes")).toBeInTheDocument();
      expect(within(dialog).getByText("94%")).toBeInTheDocument();
    });

    it("opens the row it was asked for, not the first one", async () => {
      const user = userEvent.setup();
      renderApp();

      const dialog = await openJob(user, "Fern & Field");

      expect(within(dialog).getByDisplayValue("Fern & Field")).toBeInTheDocument();
      expect(within(dialog).getByDisplayValue("Research notes for job 2.")).toBeInTheDocument();
    });

    it("stays quietly empty for a job with no research or contacts", async () => {
      const user = userEvent.setup();
      renderApp({ contacts: [], research: null, content: null });

      const dialog = await openJob(user, "Willow & Oak");

      expect(within(dialog).getByText("No contacts found for this job yet.")).toBeInTheDocument();
      expect(within(dialog).queryByText(/Couldn’t load/)).not.toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: /Get Tailored Resume/ })).toBeDisabled();
    });

    it("shows an error strip with a working retry when the detail fetch fails", async () => {
      const user = userEvent.setup();
      renderApp({ failOn: "/contacts/by-job/" });

      const dialog = await openJob(user, "Willow & Oak");
      expect(within(dialog).getByText(/Couldn’t load this job’s details/)).toBeInTheDocument();

      mockApi({ jobs: JOBS, research: RESEARCH_BY_JOB });
      await user.click(within(dialog).getByRole("button", { name: /Try again/ }));

      expect(
        await within(dialog).findByDisplayValue("Research notes for job 1."),
      ).toBeInTheDocument();
    });

    it("opens a job's details, edits a field, and saves the change", async () => {
      const user = userEvent.setup();
      renderApp();

      const dialog = await openJob(user, "Willow & Oak");
      const notes = within(dialog).getByDisplayValue("Research notes for job 1.");
      expect(within(dialog).getByRole("button", { name: "Saved" })).toBeDisabled();

      await user.clear(notes);
      await user.type(notes, "Called and left a voicemail.");
      expect(within(dialog).getByRole("button", { name: "Save changes" })).toBeEnabled();

      await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

      expect(within(dialog).getByRole("button", { name: "Saved" })).toBeDisabled();
      expect(within(dialog).getByDisplayValue("Called and left a voicemail.")).toBeInTheDocument();
    });

    it("warns before closing with unsaved changes, and Cancel keeps editing", async () => {
      const user = userEvent.setup();
      renderApp();

      const dialog = await openJob(user, "Willow & Oak");
      await user.type(within(dialog).getByDisplayValue("Willow & Oak"), " Ltd");
      await user.click(within(dialog).getByRole("button", { name: "Close" }));

      const confirm = screen.getByRole("dialog", { name: "Save your changes?" });
      expect(confirm).toHaveTextContent("Willow & Oak Ltd");
      await user.click(within(confirm).getByRole("button", { name: "Cancel" }));

      expect(screen.getByRole("dialog", { name: "Willow & Oak Ltd" })).toBeInTheDocument();
      expect(screen.getByDisplayValue("Willow & Oak Ltd")).toBeInTheDocument();
    });

    it("discards edits when the user exits without saving", async () => {
      const user = userEvent.setup();
      renderApp();

      const dialog = await openJob(user, "Willow & Oak");
      await user.type(within(dialog).getByDisplayValue("Willow & Oak"), " Ltd");
      await user.click(within(dialog).getByRole("button", { name: "Close" }));
      await user.click(screen.getByRole("button", { name: "Exit without saving" }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      const reopened = await openJob(user, "Willow & Oak");
      expect(within(reopened).getByDisplayValue("Willow & Oak")).toBeInTheDocument();
    });

    it("closes immediately when there are no unsaved changes", async () => {
      const user = userEvent.setup();
      renderApp();

      const dialog = await openJob(user, "Fern & Field");
      await user.click(within(dialog).getByRole("button", { name: "Close" }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("deletes a job after confirmation, but not after cancelling", async () => {
      const user = userEvent.setup();
      renderApp();

      const dialog = await openJob(user, "Fern & Field");
      const table = trackerTable();

      await user.click(within(dialog).getByRole("button", { name: "Delete" }));
      let confirmDelete = screen.getByRole("dialog", { name: "Delete this job?" });
      await user.click(within(confirmDelete).getByRole("button", { name: "Cancel" }));
      expect(within(table).getByText("Fern & Field")).toBeInTheDocument();

      await user.click(within(dialog).getByRole("button", { name: "Delete" }));
      confirmDelete = screen.getByRole("dialog", { name: "Delete this job?" });
      await user.click(within(confirmDelete).getByRole("button", { name: "Delete" }));

      expect(within(table).queryByText("Fern & Field")).not.toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
