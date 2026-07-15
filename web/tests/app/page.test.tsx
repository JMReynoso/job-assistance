import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

describe("Home page", () => {
  it("renders the job assistance app", () => {
    render(<Home />);

    expect(screen.getByText("job assistance")).toBeInTheDocument();
    expect(screen.getByText("Start tracking a job")).toBeInTheDocument();
    expect(screen.getByText("Job tracker")).toBeInTheDocument();
  });
});
