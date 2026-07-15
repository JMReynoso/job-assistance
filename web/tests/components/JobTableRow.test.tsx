import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import JobTableRow from "@/components/job-assistance/JobTableRow";
import { OPEN_BUTTON_BG, OPEN_BUTTON_COLOR } from "@/lib/job-assistance/constants";
import { buildJob } from "../mock/jobs.mock";
import { FROZEN_NOW, ISO_4_DAYS_AGO, ISO_6_DAYS_AGO } from "../mock/dates.mock";

// <tr> is only valid inside a <table>, so every render wraps it the way JobTable does.
function renderRow(props: Partial<ComponentProps<typeof JobTableRow>> = {}) {
  const defaultProps: ComponentProps<typeof JobTableRow> = {
    job: buildJob(),
    index: 0,
    hovered: false,
    striped: true,
    openButtonBg: OPEN_BUTTON_BG,
    openButtonColor: OPEN_BUTTON_COLOR,
    onHoverChange: jest.fn(),
    onOpen: jest.fn(),
    onStatusChange: jest.fn(),
  };

  return render(
    <table>
      <tbody>
        <JobTableRow {...defaultProps} {...props} />
      </tbody>
    </table>,
  );
}

describe("JobTableRow", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(FROZEN_NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows the company name, status, and formatted dates", () => {
    renderRow({ job: buildJob({ companyName: "Willow & Oak", dateApplied: "2026-07-03" }) });

    expect(screen.getByText("Willow & Oak")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveValue("Applied");
    expect(screen.getByText("Jul 3")).toBeInTheDocument();
  });

  it("falls back to 'Untitled role' for a blank company name", () => {
    renderRow({ job: buildJob({ companyName: "" }) });

    expect(screen.getByText("Untitled role")).toBeInTheDocument();
  });

  it("hides the open button when the row isn't hovered", () => {
    renderRow({ hovered: false });

    expect(screen.getByRole("button", { name: "open" })).toHaveStyle({ opacity: 0, pointerEvents: "none" });
  });

  it("reveals the open button when the row is hovered", () => {
    renderRow({ hovered: true });

    expect(screen.getByRole("button", { name: "open" })).toHaveStyle({ opacity: 1, pointerEvents: "auto" });
  });

  it("reports hover enter and leave", async () => {
    const user = userEvent.setup({ delay: null });
    const onHoverChange = jest.fn();
    renderRow({ onHoverChange });

    await user.hover(screen.getByText("Willow & Oak"));
    expect(onHoverChange).toHaveBeenCalledWith("job-1");

    await user.unhover(screen.getByText("Willow & Oak"));
    expect(onHoverChange).toHaveBeenCalledWith(null);
  });

  it("opens the job when the open button is clicked", async () => {
    const user = userEvent.setup({ delay: null });
    const onOpen = jest.fn();
    renderRow({ job: buildJob({ id: "job-42" }), hovered: true, onOpen });

    await user.click(screen.getByRole("button", { name: "open" }));

    expect(onOpen).toHaveBeenCalledWith("job-42");
  });

  it("reports a status change", async () => {
    const user = userEvent.setup({ delay: null });
    const onStatusChange = jest.fn();
    renderRow({ job: buildJob({ id: "job-42" }), onStatusChange });

    await user.selectOptions(screen.getByRole("combobox"), "Offer");

    expect(onStatusChange).toHaveBeenCalledWith("job-42", "Offer");
  });

  it("highlights the last-contacted date red once it's stale", () => {
    renderRow({ job: buildJob({ dateLastContacted: ISO_6_DAYS_AGO }) });

    const pill = screen.getByText("Jul 9");
    expect(pill).toHaveClass("bg-[#f5d3ca]");
  });

  it("leaves the last-contacted date unstyled while still fresh", () => {
    renderRow({ job: buildJob({ dateLastContacted: ISO_4_DAYS_AGO }) });

    const cell = screen.getByText("Jul 11");
    expect(cell).not.toHaveClass("bg-[#f5d3ca]");
  });

  it("shows an em dash when there's no last-contacted date, and treats it as fresh", () => {
    renderRow({ job: buildJob({ dateLastContacted: "" }) });

    const cell = screen.getByText("—");
    expect(cell).not.toHaveClass("bg-[#f5d3ca]");
  });

  it("alternates the row background for striped odd rows only when striping is enabled", () => {
    const { container: stripedOdd } = renderRow({ index: 1, striped: true });
    expect(stripedOdd.querySelector("tr")).toHaveStyle({ background: "#f8f4ea" });

    const { container: stripedEven } = renderRow({ index: 0, striped: true });
    expect(stripedEven.querySelector("tr")).toHaveStyle({ background: "transparent" });

    const { container: unstriped } = renderRow({ index: 1, striped: false });
    expect(unstriped.querySelector("tr")).toHaveStyle({ background: "transparent" });
  });

  it("uses fireEvent as an equivalent lower-level way to trigger a status change", () => {
    const onStatusChange = jest.fn();
    renderRow({ job: buildJob({ id: "job-7" }), onStatusChange });

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Ghosted" } });

    expect(onStatusChange).toHaveBeenCalledWith("job-7", "Ghosted");
  });
});
