import { fireEvent, render, screen } from "@testing-library/react";
import FormField from "@/components/job-assistance/FormField";

describe("FormField", () => {
  it("renders the label and current value", () => {
    render(<FormField label="Company name" value="Willow & Oak" onChange={jest.fn()} />);

    expect(screen.getByText("Company name")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("Willow & Oak");
  });

  it("defaults to a text input", () => {
    render(<FormField label="Company name" value="" onChange={jest.fn()} />);

    expect(screen.getByRole("textbox")).toHaveAttribute("type", "text");
  });

  it("renders an email input when type='email'", () => {
    render(<FormField label="Contact email" value="" onChange={jest.fn()} type="email" />);

    expect(screen.getByRole("textbox")).toHaveAttribute("type", "email");
  });

  it("shows the given placeholder", () => {
    render(<FormField label="Company URL" value="" onChange={jest.fn()} placeholder="https://company.com" />);

    expect(screen.getByPlaceholderText("https://company.com")).toBeInTheDocument();
  });

  it("calls onChange with the new value when edited", () => {
    const onChange = jest.fn();
    render(<FormField label="Company name" value="" onChange={onChange} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Acme Robotics" } });

    expect(onChange).toHaveBeenCalledWith("Acme Robotics");
  });
});
