import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MissingKeywords from "@/components/job-assistance/MissingKeywords";
import type { JobKeyword } from "@/lib/job-assistance/types";

const KEYWORDS: JobKeyword[] = [
  { keyword: "Kubernetes", include: false },
  { keyword: "gRPC", include: true },
];

describe("MissingKeywords", () => {
  it("renders one checkbox per keyword, reflecting include", () => {
    render(<MissingKeywords keywords={KEYWORDS} onToggle={jest.fn()} />);

    expect(screen.getByRole("checkbox", { name: "Kubernetes" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "gRPC" })).toBeChecked();
  });

  it("fires onToggle with the keyword that was clicked", async () => {
    const user = userEvent.setup();
    const onToggle = jest.fn();
    render(<MissingKeywords keywords={KEYWORDS} onToggle={onToggle} />);

    await user.click(screen.getByRole("checkbox", { name: "Kubernetes" }));

    expect(onToggle).toHaveBeenCalledWith("Kubernetes");
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("disables every checkbox when disabled is set", () => {
    render(<MissingKeywords keywords={KEYWORDS} onToggle={jest.fn()} disabled />);

    expect(screen.getByRole("checkbox", { name: "Kubernetes" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "gRPC" })).toBeDisabled();
  });

  it("renders nothing when there are no missing keywords", () => {
    const { container } = render(<MissingKeywords keywords={[]} onToggle={jest.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });
});
