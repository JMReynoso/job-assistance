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

  it("calls onAdd when the button is clicked", async () => {
    const user = userEvent.setup();
    const onAdd = jest.fn();
    render(<AddJobForm home={buildHomeForm()} onFieldChange={jest.fn()} onAdd={onAdd} />);

    await user.click(screen.getByRole("button", { name: "Add to tracker" }));

    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});
