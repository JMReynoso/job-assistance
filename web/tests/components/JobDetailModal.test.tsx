import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import JobDetailModal from "@/components/job-assistance/JobDetailModal";
import { buildJob } from "../mock/jobs.mock";
import { FROZEN_NOW, ISO_4_DAYS_AGO, ISO_6_DAYS_AGO } from "../mock/dates.mock";

// <input type="date"> has no accessible textbox role, so we find it via its
// label's sibling instead of screen.getByRole.
function dateInputNear(labelText: string): HTMLInputElement {
  const label = screen.getByText(labelText);
  return label.parentElement!.querySelector("input[type='date']") as HTMLInputElement;
}

describe("JobDetailModal", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(FROZEN_NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("titles the window after the company, falling back when blank", () => {
    const { rerender } = render(
      <JobDetailModal
        draft={buildJob({ companyName: "Willow & Oak" })}
        dirty={false}
        onFieldChange={jest.fn()}
        onClose={jest.fn()}
        onTrash={jest.fn()}
        onSave={jest.fn()}
        onGetResume={jest.fn()}
      />,
    );
    expect(screen.getByRole("dialog", { name: "Willow & Oak" })).toBeInTheDocument();

    rerender(
      <JobDetailModal
        draft={buildJob({ companyName: "  " })}
        dirty={false}
        onFieldChange={jest.fn()}
        onClose={jest.fn()}
        onTrash={jest.fn()}
        onSave={jest.fn()}
        onGetResume={jest.fn()}
      />,
    );
    expect(screen.getByRole("dialog", { name: "Job details" })).toBeInTheDocument();
  });

  it("populates every field from the draft", () => {
    const draft = buildJob({
      companyName: "Willow & Oak",
      contacts: [
        {
          id: "c1",
          name: "Dana Reyes",
          role: "Recruiter",
          email: "dana@willowoak.co",
          linkedin: "linkedin.com/in/danareyes",
          confidence: 94,
        },
      ],
      companyUrl: "https://willowoak.co",
      notes: "Reached out after the info session.",
      recruiterMessage: "Hi Dana, following up on...",
      followupMessage: "Just checking in...",
    });

    render(
      <JobDetailModal
        draft={draft}
        dirty={false}
        onFieldChange={jest.fn()}
        onClose={jest.fn()}
        onTrash={jest.fn()}
        onSave={jest.fn()}
        onGetResume={jest.fn()}
      />,
    );

    // Contacts are rendered as text, not inputs — see the read-only test below.
    expect(screen.getByText("Dana Reyes")).toBeInTheDocument();
    expect(screen.getByText("Recruiter")).toBeInTheDocument();
    expect(screen.getByText("dana@willowoak.co")).toBeInTheDocument();
    expect(screen.getByText("linkedin.com/in/danareyes")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://willowoak.co")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Reached out after the info session.")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Hi Dana, following up on...")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Just checking in...")).toBeInTheDocument();
  });

  it("shows contacts as read-only text, with no way to edit or add one", () => {
    render(
      <JobDetailModal
        draft={buildJob()}
        dirty={false}
        onFieldChange={jest.fn()}
        onClose={jest.fn()}
        onTrash={jest.fn()}
        onSave={jest.fn()}
        onGetResume={jest.fn()}
      />,
    );

    // The role is Hunter's free-text job title, rendered as text rather than a
    // <select>: an arbitrary title with no matching <option> would fall back to
    // the empty placeholder and vanish from the screen while still in state.
    expect(screen.getByText("Recruiter")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Recruiter")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add contact/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remove/i })).not.toBeInTheDocument();
  });

  it("shows each contact's confidence, and an em dash when there is none", () => {
    render(
      <JobDetailModal
        draft={buildJob({
          contacts: [
            { id: "c1", name: "Dana Reyes", role: "Recruiter", email: "", linkedin: "", confidence: 94 },
            { id: "c2", name: "Sam Ito", role: "", email: "", linkedin: "", confidence: null },
          ],
        })}
        dirty={false}
        onFieldChange={jest.fn()}
        onClose={jest.fn()}
        onTrash={jest.fn()}
        onSave={jest.fn()}
        onGetResume={jest.fn()}
      />,
    );

    expect(screen.getByText("94%")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("says so plainly when a job has no contacts", () => {
    render(
      <JobDetailModal
        draft={buildJob({ contacts: [] })}
        dirty={false}
        onFieldChange={jest.fn()}
        onClose={jest.fn()}
        onTrash={jest.fn()}
        onSave={jest.fn()}
        onGetResume={jest.fn()}
      />,
    );

    expect(screen.getByText("No contacts found for this job yet.")).toBeInTheDocument();
  });

  it("reports edits to a text field", () => {
    const onFieldChange = jest.fn();
    render(
      <JobDetailModal
        draft={buildJob()}
        dirty={false}
        onFieldChange={onFieldChange}
        onClose={jest.fn()}
        onTrash={jest.fn()}
        onSave={jest.fn()}
        onGetResume={jest.fn()}
      />,
    );

    fireEvent.change(dateInputNear("Date applied"), { target: { value: "2026-07-10" } });

    expect(onFieldChange).toHaveBeenCalledWith("dateApplied", "2026-07-10");
  });

  it("reports a status change from the dropdown", async () => {
    const user = userEvent.setup({ delay: null });
    const onFieldChange = jest.fn();
    render(
      <JobDetailModal
        draft={buildJob({ status: "Interested" })}
        dirty={false}
        onFieldChange={onFieldChange}
        onClose={jest.fn()}
        onTrash={jest.fn()}
        onSave={jest.fn()}
        onGetResume={jest.fn()}
      />,
    );

    await user.selectOptions(screen.getByDisplayValue("Interested"), "Offer");

    expect(onFieldChange).toHaveBeenCalledWith("status", "Offer");
  });

  it("tints the last-contacted date field once it's stale", () => {
    render(
      <JobDetailModal
        draft={buildJob({ dateLastContacted: ISO_6_DAYS_AGO })}
        dirty={false}
        onFieldChange={jest.fn()}
        onClose={jest.fn()}
        onTrash={jest.fn()}
        onSave={jest.fn()}
        onGetResume={jest.fn()}
      />,
    );

    expect(dateInputNear("Date last contacted")).toHaveStyle({ background: "#f8ddd5" });
  });

  it("leaves the last-contacted date field neutral while still fresh", () => {
    render(
      <JobDetailModal
        draft={buildJob({ dateLastContacted: ISO_4_DAYS_AGO })}
        dirty={false}
        onFieldChange={jest.fn()}
        onClose={jest.fn()}
        onTrash={jest.fn()}
        onSave={jest.fn()}
        onGetResume={jest.fn()}
      />,
    );

    expect(dateInputNear("Date last contacted")).toHaveStyle({ background: "#fff" });
  });

  it("disables save and labels it 'Saved' when there are no changes", () => {
    render(
      <JobDetailModal
        draft={buildJob()}
        dirty={false}
        onFieldChange={jest.fn()}
        onClose={jest.fn()}
        onTrash={jest.fn()}
        onSave={jest.fn()}
        onGetResume={jest.fn()}
      />,
    );

    const saveButton = screen.getByRole("button", { name: "Saved" });
    expect(saveButton).toBeDisabled();
  });

  it("enables save and labels it 'Save changes' once dirty", () => {
    render(
      <JobDetailModal
        draft={buildJob()}
        dirty
        onFieldChange={jest.fn()}
        onClose={jest.fn()}
        onTrash={jest.fn()}
        onSave={jest.fn()}
        onGetResume={jest.fn()}
      />,
    );

    const saveButton = screen.getByRole("button", { name: "Save changes" });
    expect(saveButton).toBeEnabled();
  });

  it("wires up close, delete, save, and get-resume buttons", async () => {
    const user = userEvent.setup({ delay: null });
    const onClose = jest.fn();
    const onTrash = jest.fn();
    const onSave = jest.fn();
    const onGetResume = jest.fn();
    render(
      <JobDetailModal
        draft={buildJob()}
        dirty
        onFieldChange={jest.fn()}
        onClose={onClose}
        onTrash={onTrash}
        onSave={onSave}
        onGetResume={onGetResume}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await user.click(screen.getByRole("button", { name: /Get Tailored Resume/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onTrash).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onGetResume).toHaveBeenCalledTimes(1);
  });
});
