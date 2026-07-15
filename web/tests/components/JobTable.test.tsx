import { render, screen } from "@testing-library/react";
import JobTable from "@/components/job-assistance/JobTable";
import { buildJob } from "../mock/jobs.mock";

describe("JobTable", () => {
  it("renders one row per job, in order", () => {
    const jobs = [
      buildJob({ id: "1", companyName: "Willow & Oak" }),
      buildJob({ id: "2", companyName: "Maple Grove Studio" }),
    ];

    render(
      <JobTable jobs={jobs} hoveredId={null} onHoverChange={jest.fn()} onOpen={jest.fn()} onStatusChange={jest.fn()} />,
    );

    const rows = screen.getAllByRole("row").slice(1); // drop the header row
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Willow & Oak");
    expect(rows[1]).toHaveTextContent("Maple Grove Studio");
  });

  it("pluralizes the job count correctly", () => {
    const { rerender } = render(
      <JobTable
        jobs={[buildJob({ id: "1" })]}
        hoveredId={null}
        onHoverChange={jest.fn()}
        onOpen={jest.fn()}
        onStatusChange={jest.fn()}
      />,
    );
    expect(screen.getByText("1 job")).toBeInTheDocument();

    rerender(
      <JobTable
        jobs={[buildJob({ id: "1" }), buildJob({ id: "2" })]}
        hoveredId={null}
        onHoverChange={jest.fn()}
        onOpen={jest.fn()}
        onStatusChange={jest.fn()}
      />,
    );
    expect(screen.getByText("2 jobs")).toBeInTheDocument();
  });

  it("shows an empty state and no rows when there are no jobs", () => {
    render(<JobTable jobs={[]} hoveredId={null} onHoverChange={jest.fn()} onOpen={jest.fn()} onStatusChange={jest.fn()} />);

    expect(screen.getByText("No jobs yet — add one above to get started.")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(1); // header row only
    expect(screen.getByText("0 jobs")).toBeInTheDocument();
  });
});
