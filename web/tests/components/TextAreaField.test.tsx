import { fireEvent, render, screen } from "@testing-library/react";
import TextAreaField from "@/components/job-assistance/TextAreaField";

describe("TextAreaField", () => {
  it("renders the label and current value", () => {
    render(<TextAreaField label="Notes" value="Call recap" onChange={jest.fn()} minHeight={100} />);

    expect(screen.getByText("Notes")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("Call recap");
  });

  it("applies the given minimum height", () => {
    render(<TextAreaField label="Notes" value="" onChange={jest.fn()} minHeight={150} />);

    expect(screen.getByRole("textbox")).toHaveStyle({ minHeight: "150px" });
  });

  it("calls onChange with the new value when edited", () => {
    const onChange = jest.fn();
    render(<TextAreaField label="Notes" value="" onChange={onChange} minHeight={100} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Follow up Friday" } });

    expect(onChange).toHaveBeenCalledWith("Follow up Friday");
  });
});
