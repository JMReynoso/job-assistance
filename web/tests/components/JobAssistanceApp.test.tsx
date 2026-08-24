import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import JobAssistanceApp from "@/components/job-assistance/JobAssistanceApp";

/**
 * The "open" button only becomes clickable once its row is hovered (an
 * opacity/pointer-events toggle driven by our own onMouseEnter prop, not
 * real CSS :hover) — fireEvent triggers that handler directly, sidestepping
 * userEvent's pointer-events guard, which is fussy in jsdom's zero-layout
 * environment where every element's bounding box collapses to the origin.
 */
async function openJob(user: ReturnType<typeof userEvent.setup>, companyName: string) {
  const row = screen.getByText(companyName).closest("tr")!;
  fireEvent.mouseEnter(row);
  await user.click(within(row).getByRole("button", { name: "open" }));
  return screen.getByRole("dialog");
}

describe("JobAssistanceApp", () => {
  it("adds a job through the quick-add form and lists it in the tracker", async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<JobAssistanceApp />);

    await user.type(screen.getByPlaceholderText("e.g. Willow & Oak"), "Acme Robotics");
    await user.click(screen.getByRole("button", { name: "Add to tracker" }));

    // Adding opens the setup-progress modal…
    expect(screen.getByRole("dialog", { name: /Acme Robotics/ })).toBeInTheDocument();

    // …and drops the row into the tracker table straight away.
    const newRow = within(screen.getByRole("table")).getByText("Acme Robotics").closest("tr")!;
    expect(within(newRow).getByRole("combobox")).toHaveValue("Interested");
    expect(screen.getByPlaceholderText("e.g. Willow & Oak")).toHaveValue("");

    jest.useRealTimers();
  });

  it("cancels setup from the progress modal, deleting the just-added job", async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<JobAssistanceApp />);

    await user.type(screen.getByPlaceholderText("e.g. Willow & Oak"), "Acme Robotics");
    await user.click(screen.getByRole("button", { name: "Add to tracker" }));

    const progressModal = screen.getByRole("dialog", { name: /Acme Robotics/ });
    await user.click(within(progressModal).getByRole("button", { name: "Close" }));

    const confirm = screen.getByRole("dialog", { name: "Cancel setup?" });
    await user.click(within(confirm).getByRole("button", { name: /Cancel & delete/ }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(within(screen.getByRole("table")).queryByText("Acme Robotics")).not.toBeInTheDocument();

    jest.useRealTimers();
  });

  it("recovers from a failed stage via retry, then finishes setup", async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<JobAssistanceApp />);

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
    expect(within(screen.getByRole("table")).getByText("Acme Robotics")).toBeInTheDocument();

    jest.useRealTimers();
  });

  it("changes a job's status directly from the table, with no window open", async () => {
    const user = userEvent.setup();
    render(<JobAssistanceApp />);

    const row = screen.getByText("Fern & Field").closest("tr")!;
    await user.selectOptions(within(row).getByRole("combobox"), "Applied");

    expect(within(row).getByRole("combobox")).toHaveValue("Applied");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens a job's details, edits a field, and saves the change", async () => {
    const user = userEvent.setup();
    render(<JobAssistanceApp />);

    const dialog = await openJob(user, "Willow & Oak");
    const notes = within(dialog).getByDisplayValue(/Reached out to Dana/);
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
    render(<JobAssistanceApp />);

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
    render(<JobAssistanceApp />);

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
    render(<JobAssistanceApp />);

    const dialog = await openJob(user, "Fern & Field");
    await user.click(within(dialog).getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("deletes a job after confirmation, but not after cancelling", async () => {
    const user = userEvent.setup();
    render(<JobAssistanceApp />);

    const dialog = await openJob(user, "Fern & Field");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    // The open job modal has its own contacts table, so scope to the main tracker table.
    const table = screen.getAllByRole("table").find((t) => !t.closest('[role="dialog"]'))!;
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
