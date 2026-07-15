import { act, render, screen } from "@testing-library/react";
import NavBar from "@/components/job-assistance/NavBar";
import { formatDateTime } from "@/lib/job-assistance/date";
import { FROZEN_NOW } from "../mock/dates.mock";

describe("NavBar", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(FROZEN_NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows the title and the current date and time", () => {
    render(<NavBar />);

    expect(screen.getByText("job assistance")).toBeInTheDocument();
    expect(screen.getByText(formatDateTime(FROZEN_NOW))).toBeInTheDocument();
  });

  it("ticks the clock forward every second", () => {
    render(<NavBar />);

    // Modern fake timers advance Date along with the timer queue, so a
    // single advanceTimersByTime moves both the interval and "now" together.
    const oneMinuteLater = new Date(FROZEN_NOW.getTime() + 60_000);
    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    expect(screen.getByText(formatDateTime(oneMinuteLater))).toBeInTheDocument();
    expect(screen.queryByText(formatDateTime(FROZEN_NOW))).not.toBeInTheDocument();
  });
});
