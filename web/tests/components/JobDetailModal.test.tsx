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
      jobPostingUrl: "https://boards.greenhouse.io/willowoak/jobs/1",
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

    // Contacts are read-only text, the rest are editable inputs.
    expect(screen.getByText("Dana Reyes")).toBeInTheDocument();
    expect(screen.getByText("Recruiter")).toBeInTheDocument();
    expect(screen.getByText("dana@willowoak.co")).toBeInTheDocument();
    expect(screen.getByText("linkedin.com/in/danareyes")).toBeInTheDocument();
    expect(screen.getByText("94%")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://willowoak.co")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://boards.greenhouse.io/willowoak/jobs/1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Reached out after the info session.")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Hi Dana, following up on...")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Just checking in...")).toBeInTheDocument();
  });

  it("renders the contacts table read-only, with no add or remove affordances", () => {
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

    expect(screen.queryByRole("button", { name: /Add contact/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remove Dana Reyes/i })).not.toBeInTheDocument();
    // The contact's details are text, not form controls.
    expect(screen.queryByDisplayValue("Dana Reyes")).not.toBeInTheDocument();
    expect(screen.getByText("Dana Reyes")).toBeInTheDocument();
  });

  it("shows an em dash for a contact with no confidence score", () => {
    render(
      <JobDetailModal
        draft={buildJob({
          contacts: [
            { id: "c1", name: "Dana Reyes", role: "", email: "d@x.co", linkedin: "", confidence: null },
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

    // Two: the empty role cell and the absent confidence.
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });

  it("shows a spinner while the detail is loading and disables the form", () => {
    render(
      <JobDetailModal
        draft={buildJob()}
        dirty={false}
        onFieldChange={jest.fn()}
        onClose={jest.fn()}
        onTrash={jest.fn()}
        onSave={jest.fn()}
        onGetResume={jest.fn()}
        detailStatus="loading"
      />,
    );

    expect(screen.getByText(/Loading this job’s details/)).toBeInTheDocument();
    // Editing is blocked so an arriving response can't overwrite typed input.
    expect(dateInputNear("Date applied")).toBeDisabled();
  });

  it("offers a retry when the detail fetch failed", async () => {
    const user = userEvent.setup({ delay: null });
    const onRetryDetail = jest.fn();
    render(
      <JobDetailModal
        draft={buildJob()}
        dirty={false}
        onFieldChange={jest.fn()}
        onClose={jest.fn()}
        onTrash={jest.fn()}
        onSave={jest.fn()}
        onGetResume={jest.fn()}
        detailStatus="error"
        onRetryDetail={onRetryDetail}
      />,
    );

    expect(screen.getByText(/Couldn’t load this job’s details/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Try again/i }));
    expect(onRetryDetail).toHaveBeenCalledTimes(1);
  });

  it("renders no status chrome when there is nothing to load", () => {
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

    expect(screen.queryByText(/Loading this job’s details/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Couldn’t load this job’s details/)).not.toBeInTheDocument();
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

  it("shows a save error strip and keeps the button live to retry", () => {
    render(
      <JobDetailModal
        draft={buildJob()}
        dirty
        onFieldChange={jest.fn()}
        onClose={jest.fn()}
        onTrash={jest.fn()}
        onSave={jest.fn()}
        onGetResume={jest.fn()}
        saveStatus="error"
      />,
    );

    expect(screen.getByText(/Couldn.t save your changes/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
  });

  it("shows 'Saving…' and disables the button while a save is in flight", () => {
    render(
      <JobDetailModal
        draft={buildJob()}
        dirty
        onFieldChange={jest.fn()}
        onClose={jest.fn()}
        onTrash={jest.fn()}
        onSave={jest.fn()}
        onGetResume={jest.fn()}
        saveStatus="saving"
      />,
    );

    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  });

  it("disables Get Tailored Resume until one has been generated", () => {
    const { rerender } = render(
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
    expect(screen.getByRole("button", { name: /Get Tailored Resume/i })).toBeDisabled();

    rerender(
      <JobDetailModal
        draft={buildJob()}
        dirty={false}
        onFieldChange={jest.fn()}
        onClose={jest.fn()}
        onTrash={jest.fn()}
        onSave={jest.fn()}
        onGetResume={jest.fn()}
        resumeFileName="Jane_Doe_Willow_1.pdf"
      />,
    );
    expect(screen.getByRole("button", { name: /Get Tailored Resume/i })).toBeEnabled();
  });

  it("hides the match line when the resume hasn't been scored yet", () => {
    render(
      <JobDetailModal
        draft={buildJob()}
        dirty={false}
        onFieldChange={jest.fn()}
        onClose={jest.fn()}
        onTrash={jest.fn()}
        onSave={jest.fn()}
        onGetResume={jest.fn()}
        jdMatchPercent={null}
      />,
    );

    expect(screen.queryByText(/Job Description Match/)).not.toBeInTheDocument();
  });

  it("shows the match percentage once the resume has been scored", () => {
    render(
      <JobDetailModal
        draft={buildJob()}
        dirty={false}
        onFieldChange={jest.fn()}
        onClose={jest.fn()}
        onTrash={jest.fn()}
        onSave={jest.fn()}
        onGetResume={jest.fn()}
        jdMatchPercent={72}
      />,
    );

    expect(screen.getByText("Job Description Match: 72%")).toBeInTheDocument();
  });

  it("renders missing-keyword checkboxes and reports toggles", async () => {
    const user = userEvent.setup({ delay: null });
    const onToggleKeyword = jest.fn();
    render(
      <JobDetailModal
        draft={buildJob()}
        dirty={false}
        onFieldChange={jest.fn()}
        onClose={jest.fn()}
        onTrash={jest.fn()}
        onSave={jest.fn()}
        onGetResume={jest.fn()}
        missingKeywords={[{ keyword: "Kubernetes", include: false }]}
        onToggleKeyword={onToggleKeyword}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: "Kubernetes" }));

    expect(onToggleKeyword).toHaveBeenCalledWith("Kubernetes");
  });

  it("disables Regenerate until at least one keyword is checked", () => {
    const { rerender } = render(
      <JobDetailModal
        draft={buildJob()}
        dirty={false}
        onFieldChange={jest.fn()}
        onClose={jest.fn()}
        onTrash={jest.fn()}
        onSave={jest.fn()}
        onGetResume={jest.fn()}
        missingKeywords={[{ keyword: "Kubernetes", include: false }]}
      />,
    );
    expect(screen.getByRole("button", { name: /Regenerate Tailored Resume/i })).toBeDisabled();

    rerender(
      <JobDetailModal
        draft={buildJob()}
        dirty={false}
        onFieldChange={jest.fn()}
        onClose={jest.fn()}
        onTrash={jest.fn()}
        onSave={jest.fn()}
        onGetResume={jest.fn()}
        missingKeywords={[{ keyword: "Kubernetes", include: true }]}
      />,
    );
    expect(screen.getByRole("button", { name: /Regenerate Tailored Resume/i })).toBeEnabled();
  });

  it("fires onRegenerate when clicked with a keyword checked", async () => {
    const user = userEvent.setup({ delay: null });
    const onRegenerate = jest.fn();
    render(
      <JobDetailModal
        draft={buildJob()}
        dirty={false}
        onFieldChange={jest.fn()}
        onClose={jest.fn()}
        onTrash={jest.fn()}
        onSave={jest.fn()}
        onGetResume={jest.fn()}
        missingKeywords={[{ keyword: "Kubernetes", include: true }]}
        onRegenerate={onRegenerate}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Regenerate Tailored Resume/i }));

    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });

  it("renders no keyword chips or Regenerate button when there are none", () => {
    render(
      <JobDetailModal
        draft={buildJob()}
        dirty={false}
        onFieldChange={jest.fn()}
        onClose={jest.fn()}
        onTrash={jest.fn()}
        onSave={jest.fn()}
        onGetResume={jest.fn()}
        missingKeywords={[]}
      />,
    );

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Regenerate Tailored Resume/i })).not.toBeInTheDocument();
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
        resumeFileName="Jane_Doe_Willow_1.pdf"
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
