import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConfirmCloseModal from "@/components/job-assistance/ConfirmCloseModal";

describe("ConfirmCloseModal", () => {
  it("names the job in the confirmation message", () => {
    render(<ConfirmCloseModal title="Willow & Oak" onSaveAndClose={jest.fn()} onExitWithoutSaving={jest.fn()} onCancel={jest.fn()} />);

    expect(
      screen.getByRole("dialog", { name: "Save your changes?" }),
    ).toHaveTextContent("You’ve made edits to Willow & Oak. Want to keep them?");
  });

  it("calls the matching handler for each action", async () => {
    const user = userEvent.setup();
    const onSaveAndClose = jest.fn();
    const onExitWithoutSaving = jest.fn();
    const onCancel = jest.fn();
    render(
      <ConfirmCloseModal
        title="Willow & Oak"
        onSaveAndClose={onSaveAndClose}
        onExitWithoutSaving={onExitWithoutSaving}
        onCancel={onCancel}
      />,
    );

    await user.click(screen.getByRole("button", { name: /save & close/i }));
    await user.click(screen.getByRole("button", { name: "Exit without saving" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onSaveAndClose).toHaveBeenCalledTimes(1);
    expect(onExitWithoutSaving).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
