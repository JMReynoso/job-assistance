import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConfirmDeleteModal from "@/components/job-assistance/ConfirmDeleteModal";

describe("ConfirmDeleteModal", () => {
  it("names the job in the confirmation message", () => {
    render(<ConfirmDeleteModal title="Willow & Oak" onConfirm={jest.fn()} onCancel={jest.fn()} />);

    expect(
      screen.getByRole("dialog", { name: "Delete this job?" }),
    ).toHaveTextContent("This removes Willow & Oak from your tracker. This can’t be undone.");
  });

  it("calls the matching handler for confirm and cancel", async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    render(<ConfirmDeleteModal title="Willow & Oak" onConfirm={onConfirm} onCancel={onCancel} />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
