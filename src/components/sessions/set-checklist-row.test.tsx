import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SetChecklistRow } from "./set-checklist-row";

const baseProps = {
  setId: "set-1",
  exerciseName: "Squat",
  setNumber: 1,
  mode: "Reps" as const,
  status: "Pending" as const,
  current: true,
  repsMin: 7,
  repsMax: 10,
};

describe("SetChecklistRow", () => {
  it("uses the shadcn checkbox for the current set", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();

    render(<SetChecklistRow {...baseProps} onComplete={onComplete} />);

    const checkbox = screen.getByRole("checkbox", { name: "Complete Squat set 1" });
    expect(checkbox).toBeEnabled();
    expect(screen.getByText("Target 7-10")).toBeInTheDocument();

    await user.click(checkbox);

    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("keeps completed, skipped, and waiting sets disabled", () => {
    const { rerender } = render(<SetChecklistRow {...baseProps} status="Completed" current={false} />);
    expect(screen.getByRole("checkbox", { name: "Complete Squat set 1" })).toBeDisabled();

    rerender(<SetChecklistRow {...baseProps} status="Skipped" current />);
    expect(screen.getByRole("checkbox", { name: "Complete Squat set 1" })).toBeDisabled();

    rerender(<SetChecklistRow {...baseProps} current={false} />);
    expect(screen.getByRole("checkbox", { name: "Complete Squat set 1" })).toBeDisabled();
  });

  it("shows the editor for a selected skipped set", () => {
    render(<SetChecklistRow {...baseProps} status="Skipped" current={false} selected onSave={vi.fn()} />);

    expect(screen.getByTestId("set-inline-editor")).toBeInTheDocument();
  });

  it("shows the inline editor and saves when required values are valid", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(<SetChecklistRow {...baseProps} selected onSave={onSave} />);

    expect(screen.getByTestId("set-inline-editor")).toBeInTheDocument();
    expect(screen.getByLabelText("Weight")).toHaveValue(0);
    expect(screen.getByLabelText("Weight")).toHaveAttribute("id", "set-set-1-external-load");
    expect(screen.getByLabelText("Reps")).toHaveValue(null);
    expect(screen.getByLabelText("RPE")).toHaveValue(null);
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear" })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Weight"), "50");
    await user.type(screen.getByLabelText("Reps"), "8");
    expect(onSave).not.toHaveBeenCalled();
    await user.tab();

    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledWith({ externalLoadKg: 50, actualReps: 8, rpe: null });
  });

  it("does not mark values outside the target as errors", () => {
    render(<SetChecklistRow {...baseProps} selected actualReps={6} onSave={vi.fn()} />);

    const reps = screen.getByLabelText("Reps");
    expect(screen.queryByText("Outside target")).not.toBeInTheDocument();
    expect(reps).not.toHaveAttribute("aria-invalid");
    expect(reps.parentElement).not.toHaveAttribute("data-invalid");
  });

  it("prefills an unsaved set from prior values without saving on blur", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(<SetChecklistRow {...baseProps} selected externalLoadKg={0} onSave={onSave} prior={{ externalLoadKg: 50, actualReps: 8, actualSeconds: null, rpe: 8 }} />);

    expect(screen.getByLabelText("Weight")).toHaveValue(50);
    expect(screen.getByLabelText("Reps")).toHaveValue(8);
    expect(screen.getByLabelText("RPE")).toHaveValue(8);

    await user.click(screen.getByLabelText("Weight"));
    await user.tab();
    expect(onSave).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText("Reps"));
    await user.type(screen.getByLabelText("Reps"), "9");
    await user.tab();
    expect(onSave).toHaveBeenCalledWith({ externalLoadKg: 50, actualReps: 9, rpe: 8 });
  });

  it("keeps typed values when prior values arrive later", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const { rerender } = render(<SetChecklistRow {...baseProps} selected onSave={onSave} />);

    await user.type(screen.getByLabelText("Weight"), "40");
    await user.type(screen.getByLabelText("Reps"), "6");
    rerender(<SetChecklistRow {...baseProps} selected onSave={onSave} prior={{ externalLoadKg: 50, actualReps: 8, actualSeconds: null, rpe: null }} />);

    expect(screen.getByLabelText("Weight")).toHaveValue(40);
    expect(screen.getByLabelText("Reps")).toHaveValue(6);
  });

  it("keeps a completed result ahead of prior values", () => {
    render(<SetChecklistRow {...baseProps} status="Completed" current={false} selected externalLoadKg={60} actualReps={9} onSave={vi.fn()} prior={{ externalLoadKg: 50, actualReps: 8, actualSeconds: null, rpe: 8 }} />);

    expect(screen.getByLabelText("Weight")).toHaveValue(60);
    expect(screen.getByLabelText("Reps")).toHaveValue(9);
  });

  it("does not submit twice until source values update", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    const { rerender } = render(<SetChecklistRow {...baseProps} selected onSave={onSave} />);

    await user.type(screen.getByLabelText("Reps"), "8");
    await user.tab();
    expect(onSave).toHaveBeenCalledOnce();

    await user.clear(screen.getByLabelText("Reps"));
    await user.type(screen.getByLabelText("Reps"), "9");
    await user.tab();
    expect(onSave).toHaveBeenCalledOnce();

    rerender(<SetChecklistRow {...baseProps} selected actualReps={8} onSave={onSave} />);
    await user.clear(screen.getByLabelText("Reps"));
    await user.type(screen.getByLabelText("Reps"), "9");
    await user.tab();
    expect(onSave).toHaveBeenCalledTimes(2);
  });

  it("keeps non-current rows editable only when selected", () => {
    const onSave = vi.fn();
    const { rerender } = render(<SetChecklistRow {...baseProps} current={false} />);
    expect(screen.queryByTestId("set-inline-editor")).not.toBeInTheDocument();
    expect(screen.getByText("Waiting")).toBeInTheDocument();

    rerender(<SetChecklistRow {...baseProps} current={false} selected onSave={onSave} />);
    expect(screen.getByTestId("set-inline-editor")).toBeInTheDocument();

    rerender(<SetChecklistRow {...baseProps} readOnly />);
    expect(screen.queryByTestId("set-inline-editor")).not.toBeInTheDocument();
    expect(screen.getByText("Current")).toBeInTheDocument();
  });

  it("saves a selected non-current pending row", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(<SetChecklistRow {...baseProps} current={false} selected onSave={onSave} />);

    await user.type(screen.getByLabelText("Reps"), "8");
    await user.tab();

    expect(onSave).toHaveBeenCalledWith({ externalLoadKg: 0, actualReps: 8, rpe: null });
  });

  it("disables inline controls without disabling the summary state", () => {
    render(<SetChecklistRow {...baseProps} selected disabled />);

    expect(screen.getByLabelText("Weight")).toBeDisabled();
    expect(screen.getByLabelText("Reps")).toBeDisabled();
    expect(screen.getByLabelText("RPE")).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Complete Squat set 1" })).toBeDisabled();
  });

  it("offers skip set from the leading options menu", async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn();

    render(<SetChecklistRow {...baseProps} onSkip={onSkip} />);

    await user.click(screen.getByRole("button", { name: "Squat set 1 options" }));
    await user.click(screen.getByRole("menuitem", { name: "Skip set" }));

    expect(onSkip).toHaveBeenCalledOnce();
  });

  it("selects completed rows and exposes their editable result", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(<SetChecklistRow {...baseProps} status="Completed" current={false} selected onSelect={onSelect} onSave={vi.fn()} />);

    const row = screen.getByTestId("set-row-1");
    const content = within(row).getByRole("button", { name: /Set 1 Reps Target 7-10/ });
    expect(content).toHaveAttribute("aria-pressed", "true");
    expect(row).toHaveClass("ring-2");
    expect(screen.getByTestId("set-inline-editor")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Complete Squat set 1" })).toBeDisabled();

    await user.click(content);

    expect(onSelect).toHaveBeenCalledOnce();
  });

  it("does not select the row when using its controls", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onComplete = vi.fn();

    render(<SetChecklistRow {...baseProps} onSelect={onSelect} onComplete={onComplete} />);

    await user.click(screen.getByRole("checkbox", { name: "Complete Squat set 1" }));

    expect(onComplete).toHaveBeenCalledOnce();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("keeps the completion checkbox on the right and locks non-current skip menus", () => {
    const { rerender } = render(<SetChecklistRow {...baseProps} onComplete={vi.fn()} onSkip={vi.fn()} />);

    expect(screen.getByRole("checkbox", { name: "Complete Squat set 1" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Squat set 1 options" })).toBeEnabled();

    rerender(<SetChecklistRow {...baseProps} current={false} onComplete={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByRole("checkbox", { name: "Complete Squat set 1" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Squat set 1 options" })).toBeDisabled();
  });
});
