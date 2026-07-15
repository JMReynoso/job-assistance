import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SelectField from "@/components/job-assistance/SelectField";

describe("SelectField", () => {
  const options = ["Friendly", "Formal", "Casual"] as const;

  it("renders the label and every option", () => {
    render(<SelectField label="Message style" value="Friendly" options={options} onChange={jest.fn()} />);

    expect(screen.getByText("Message style")).toBeInTheDocument();
    options.forEach((option) => {
      expect(screen.getByRole("option", { name: option })).toBeInTheDocument();
    });
  });

  it("reflects the current value as selected", () => {
    render(<SelectField label="Message style" value="Formal" options={options} onChange={jest.fn()} />);

    expect(screen.getByRole("combobox")).toHaveValue("Formal");
  });

  it("calls onChange with the newly selected option", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<SelectField label="Message style" value="Friendly" options={options} onChange={onChange} />);

    await user.selectOptions(screen.getByRole("combobox"), "Casual");

    expect(onChange).toHaveBeenCalledWith("Casual");
  });
});
