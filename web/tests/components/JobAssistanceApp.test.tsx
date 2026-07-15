import { fireEvent, render, screen, within } from "@testing-library/react";
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
    const user = userEvent.setup();
    render(<JobAssistanceApp />);

    await user.type(screen.getByPlaceholderText("e.g. Willow & Oak"), "Acme Robotics");
    await user.click(screen.getByRole("button", { name: "Add to tracker" }));

    const newRow = screen.getByText("Acme Robotics").closest("tr")!;
    expect(within(newRow).getByRole("combobox")).toHaveValue("Interested");
    expect(screen.getByPlaceholderText("e.g. Willow & Oak")).toHaveValue("");
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
    await user.type(within(dialog).getByDisplayValue("Dana Reyes"), " Jr.");
    await user.click(within(dialog).getByRole("button", { name: "Close" }));

    const confirm = screen.getByRole("dialog", { name: "Save your changes?" });
    expect(confirm).toHaveTextContent("Willow & Oak");
    await user.click(within(confirm).getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("dialog", { name: "Willow & Oak" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Dana Reyes Jr.")).toBeInTheDocument();
  });

  it("discards edits when the user exits without saving", async () => {
    const user = userEvent.setup();
    render(<JobAssistanceApp />);

    const dialog = await openJob(user, "Willow & Oak");
    await user.type(within(dialog).getByDisplayValue("Dana Reyes"), " Jr.");
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Exit without saving" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const reopened = await openJob(user, "Willow & Oak");
    expect(within(reopened).getByDisplayValue("Dana Reyes")).toBeInTheDocument();
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

    const table = screen.getByRole("table");
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
