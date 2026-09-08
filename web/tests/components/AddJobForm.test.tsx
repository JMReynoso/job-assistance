import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AddJobForm from "@/components/job-assistance/AddJobForm";
import { buildHomeForm } from "../mock/home-form.mock";

describe("AddJobForm", () => {
  it("renders every quick-add field with its current value", () => {
    const home = buildHomeForm({
      companyName: "Acme Robotics",
      jobPosting: "https://acme.example/careers/1",
      companyPage: "https://acme.example",
      companyLinkedIn: "https://linkedin.com/company/acme",
      extraLinks: "https://glassdoor.com/acme",
    });

    render(<AddJobForm home={home} onFieldChange={jest.fn()} onAdd={jest.fn()} />);

    expect(screen.getByDisplayValue("Acme Robotics")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://acme.example/careers/1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://acme.example")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://linkedin.com/company/acme")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://glassdoor.com/acme")).toBeInTheDocument();
  });

  it("reports which field changed", () => {
    const onFieldChange = jest.fn();
    render(<AddJobForm home={buildHomeForm()} onFieldChange={onFieldChange} onAdd={jest.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("e.g. Willow & Oak"), {
      target: { value: "Acme Robotics" },
    });
    expect(onFieldChange).toHaveBeenCalledWith("companyName", "Acme Robotics");

    fireEvent.change(
      screen.getByPlaceholderText("Any other useful links — Glassdoor, Crunchbase, press mentions… one per line"),
      { target: { value: "https://glassdoor.com/acme" } },
    );
    expect(onFieldChange).toHaveBeenCalledWith("extraLinks", "https://glassdoor.com/acme");
  });

  it("renders the job description textarea and reports its edits", () => {
    const onFieldChange = jest.fn();
    const home = buildHomeForm({ jobDescription: "We are looking for a Senior Backend Engineer…" });
    render(<AddJobForm home={home} onFieldChange={onFieldChange} onAdd={jest.fn()} />);

    expect(screen.getByDisplayValue("We are looking for a Senior Backend Engineer…")).toBeInTheDocument();

    fireEvent.change(
      screen.getByPlaceholderText(
        "Paste the full job posting text here — this is what your resume gets tailored and scored against…",
      ),
      { target: { value: "Updated posting text" } },
    );
    expect(onFieldChange).toHaveBeenCalledWith("jobDescription", "Updated posting text");
  });

  it("labels the URL field 'Job posting link', not 'Job posting URL'", () => {
    render(<AddJobForm home={buildHomeForm()} onFieldChange={jest.fn()} onAdd={jest.fn()} />);

    expect(screen.getByText("Job posting link")).toBeInTheDocument();
    expect(screen.queryByText("Job posting URL")).not.toBeInTheDocument();
  });

  it("calls onAdd when the button is clicked with every required field filled", async () => {
    const user = userEvent.setup();
    const onAdd = jest.fn();
    const home = buildHomeForm({
      companyName: "Acme Robotics",
      jobPosting: "https://acme.example/careers/1",
      companyPage: "https://acme.example",
      companyLinkedIn: "https://linkedin.com/company/acme",
      jobDescription: "We are looking for a backend engineer…",
    });
    render(<AddJobForm home={home} onFieldChange={jest.fn()} onAdd={onAdd} />);

    await user.click(screen.getByRole("button", { name: "Add to tracker" }));

    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("disables the button and lists every missing field for an empty form", () => {
    render(<AddJobForm home={buildHomeForm()} onFieldChange={jest.fn()} onAdd={jest.fn()} />);

    const button = screen.getByRole("button", { name: "Add to tracker" });
    expect(button).toBeDisabled();
    expect(
      screen.getByText("Still needed: Company name, Job posting link, Company page, Company LinkedIn, Job description."),
    ).toBeInTheDocument();
  });

  it("enables the button once every required field is filled", () => {
    const home = buildHomeForm({
      companyName: "Acme Robotics",
      jobPosting: "https://acme.example/careers/1",
      companyPage: "https://acme.example",
      companyLinkedIn: "https://linkedin.com/company/acme",
      jobDescription: "We are looking for a backend engineer…",
    });
    render(<AddJobForm home={home} onFieldChange={jest.fn()} onAdd={jest.fn()} />);

    const button = screen.getByRole("button", { name: "Add to tracker" });
    expect(button).toBeEnabled();
    expect(screen.queryByText(/Still needed:/)).not.toBeInTheDocument();
  });
});
