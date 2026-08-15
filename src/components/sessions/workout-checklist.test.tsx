import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { WorkoutChecklist, type ChecklistExercise } from "./workout-checklist";

function exercise(id: string, exerciseName: string, statuses: Array<"Pending" | "Completed" | "Skipped">): ChecklistExercise {
  return {
    id,
    exerciseName,
    mode: "Reps",
    repsMin: 7,
    repsMax: 10,
    sets: statuses.map((status, index) => ({
      id: `${id}-set-${index + 1}`,
      setNumber: index + 1,
      status,
      actualReps: status === "Completed" ? 8 : null,
      externalLoadKg: status === "Completed" ? 50 : null,
    })),
  };
}

describe("WorkoutChecklist", () => {
  it("selects the global current exercise by default", () => {
    render(<WorkoutChecklist exercises={[exercise("squat", "Squat", ["Completed"]), exercise("row", "Row", ["Pending"])]} />);

    expect(screen.getByRole("button", { name: "Squat (complete)" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Row" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("list")).toHaveAccessibleName("Row");
  });

  it("renders square exercise tiles and only the selected exercise sets", async () => {
    const user = userEvent.setup();
    render(<WorkoutChecklist exercises={[exercise("squat", "Squat", ["Pending", "Pending"]), exercise("row", "Row", ["Pending"])]} />);

    const squatTile = screen.getByRole("button", { name: "Squat" });
    const rowTile = screen.getByRole("button", { name: "Row" });
    expect(squatTile).toHaveAttribute("aria-pressed", "true");
    expect(rowTile).toHaveAttribute("aria-pressed", "false");
    expect(screen.getAllByRole("list")).toHaveLength(1);
    expect(screen.getByRole("list")).toHaveAccessibleName("Squat");
    expect(within(screen.getByRole("list")).getAllByRole("checkbox").map((checkbox) => checkbox.getAttribute("aria-label"))).toEqual(["Complete Squat set 1", "Complete Squat set 2"]);

    await user.click(rowTile);

    expect(squatTile).toHaveAttribute("aria-pressed", "false");
    expect(rowTile).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("list")).toHaveAccessibleName("Row");
    expect(within(screen.getByRole("list")).getByRole("checkbox", { name: "Complete Row set 1" })).toBeDisabled();
  });

  it("keeps every exercise tile in one responsive row", () => {
    const exercises = [
      exercise("one", "Squat", ["Pending"]),
      exercise("two", "Row", ["Pending"]),
      exercise("three", "Press", ["Pending"]),
      exercise("four", "Fly", ["Pending"]),
    ];

    render(<WorkoutChecklist exercises={exercises} />);

    const row = screen.getByLabelText("Exercises");
    expect(row).toHaveStyle({ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" });
    expect(row).not.toHaveClass("overflow-x-auto");
    exercises.forEach(({ id }) => {
      expect(screen.getByTestId(`exercise-tile-${id}`).firstElementChild).toHaveClass("aspect-square", "w-full", "min-w-0");
    });
  });

  it("truncates long exercise names without replacing them with letter labels", () => {
    render(<WorkoutChecklist exercises={[exercise("one", "Incline Dumbbell Press", ["Pending"]), exercise("two", "Row", ["Pending"])]} />);

    const longNameTile = screen.getByTestId("exercise-tile-one");
    expect(within(longNameTile).getByText("Incline Dumbbell Press", { selector: "[data-exercise-label]" })).toHaveClass("truncate", "w-full");
    expect(screen.getByRole("button", { name: "Incline Dumbbell Press" })).toHaveAttribute("title", "Incline Dumbbell Press");
  });

  it("marks completed exercises and advances to the next incomplete tile", () => {
    const first = [exercise("squat", "Squat", ["Pending", "Pending"]), exercise("row", "Row", ["Pending", "Pending"])] satisfies ChecklistExercise[];
    const { rerender } = render(<WorkoutChecklist exercises={first} />);

    expect(screen.getByRole("button", { name: "Squat" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("checkbox", { name: "Complete Squat set 1" })).toBeDisabled();

    const afterSquat = [exercise("squat", "Squat", ["Completed", "Completed"]), exercise("row", "Row", ["Pending", "Pending"])] satisfies ChecklistExercise[];
    rerender(<WorkoutChecklist exercises={afterSquat} />);

    expect(screen.getByRole("button", { name: "Squat (complete)" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("exercise-complete-squat")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Row" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("list")).toHaveAccessibleName("Row");
    expect(screen.getByRole("checkbox", { name: "Complete Row set 1" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Complete Row set 2" })).toBeDisabled();
  });

  it("keeps the current set locked to global exercise order", async () => {
    const user = userEvent.setup();
    render(<WorkoutChecklist exercises={[exercise("squat", "Squat", ["Pending"]), exercise("row", "Row", ["Pending"])]} />);

    await user.click(screen.getByRole("button", { name: "Row" }));

    expect(screen.getByRole("checkbox", { name: "Complete Row set 1" })).toBeDisabled();
  });

  it("moves Current to the exercise completed most recently", () => {
    // Squat set 1 done earlier; Row set 1 completed out of order later —
    // Current follows Row's remaining set instead of global order.
    const squat = { ...exercise("squat", "Squat", ["Completed", "Pending"]), sets: exercise("squat", "Squat", ["Completed", "Pending"]).sets.map((set, index) => ({ ...set, completedAt: set.status === "Completed" ? new Date("2026-08-15T10:00:00.000Z").toISOString() : null, setNumber: index + 1 })) };
    const row = { ...exercise("row", "Row", ["Completed", "Pending"]), sets: exercise("row", "Row", ["Completed", "Pending"]).sets.map((set, index) => ({ ...set, completedAt: set.status === "Completed" ? new Date("2026-08-15T10:05:00.000Z").toISOString() : null, setNumber: index + 1 })) };
    render(<WorkoutChecklist exercises={[squat, row]} />);

    expect(screen.getByRole("button", { name: "Row" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Current")).toBeInTheDocument();
  });

  it("passes skip set actions from the row menu to the parent", async () => {
    const user = userEvent.setup();
    const onSkipSet = vi.fn();

    render(<WorkoutChecklist exercises={[exercise("squat", "Squat", ["Pending"])]} onSkipSet={onSkipSet} />);

    await user.click(screen.getByRole("button", { name: "Squat set 1 options" }));
    await user.click(screen.getByRole("menuitem", { name: "Skip set" }));

    expect(onSkipSet).toHaveBeenCalledWith("squat-set-1");
  });

  it("selects any displayed set, including completed and skipped sets", async () => {
    const user = userEvent.setup();
    render(<WorkoutChecklist exercises={[exercise("squat", "Squat", ["Completed", "Skipped"])]} />);

    const completedRow = screen.getByTestId("set-row-1");
    const skippedRow = screen.getByTestId("set-row-2");
    const completedContent = within(completedRow).getByRole("button", { name: /Set 1 Reps Target 7-10/ });
    const skippedContent = within(skippedRow).getByRole("button", { name: /Set 2 Reps Target 7-10/ });
    expect(completedContent).toHaveAttribute("aria-pressed", "true");

    await user.click(skippedContent);

    expect(completedContent).toHaveAttribute("aria-pressed", "false");
    expect(skippedContent).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Skipped")).toBeInTheDocument();
    expect(screen.getByText("50 kg · 8 reps")).toBeInTheDocument();
    expect(screen.getByTestId("set-inline-editor")).toBeInTheDocument();
  });

  it("shows saved weight and reps without edit controls in read-only history", () => {
    render(
      <WorkoutChecklist
        exercises={[exercise("squat", "Squat", ["Completed"])]}
        readOnly
      />
    );

    expect(screen.getByText("50 kg · 8 reps")).toBeVisible();
    expect(screen.queryByTestId("set-inline-editor")).not.toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Complete Squat set 1" })
    ).toBeDisabled();
  });

  it("propagates a set selection across exercises", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    render(<WorkoutChecklist exercises={[exercise("squat", "Squat", ["Pending", "Pending"]), exercise("row", "Row", ["Completed", "Pending"])]} onSelectionChange={onSelectionChange} />);

    await user.click(screen.getByRole("button", { name: "Row" }));
    expect(onSelectionChange).toHaveBeenLastCalledWith({ exerciseId: "row", setId: "row-set-2" });

    const selectedRow = screen.getByTestId("set-row-2");
    await user.click(within(selectedRow).getByRole("button", { name: /Set 2 Reps Target 7-10/ }));
    expect(onSelectionChange).toHaveBeenLastCalledWith({ exerciseId: "row", setId: "row-set-2" });

    await user.click(within(screen.getByTestId("set-row-1")).getByRole("button", { name: /Set 1 Reps Target 7-10/ }));
    expect(onSelectionChange).toHaveBeenLastCalledWith({ exerciseId: "row", setId: "row-set-1" });
  });

  it("falls back to the current set when the selected exercise disappears", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    const initial = [exercise("squat", "Squat", ["Pending"]), exercise("row", "Row", ["Pending", "Pending"])] satisfies ChecklistExercise[];
    const { rerender } = render(<WorkoutChecklist exercises={initial} onSelectionChange={onSelectionChange} />);

    await user.click(screen.getByRole("button", { name: "Row" }));
    expect(onSelectionChange).toHaveBeenLastCalledWith({ exerciseId: "row", setId: "row-set-1" });

    rerender(<WorkoutChecklist exercises={[exercise("squat", "Squat", ["Pending"])]} onSelectionChange={onSelectionChange} />);
    expect(onSelectionChange).toHaveBeenLastCalledWith({ exerciseId: "squat", setId: "squat-set-1" });
  });

  it("does not enable completion without a completion handler", () => {
    render(<WorkoutChecklist exercises={[exercise("squat", "Squat", ["Pending"])]} />);

    expect(screen.getByRole("checkbox", { name: "Complete Squat set 1" })).toBeDisabled();
  });

  it("completes from the keyboard and focuses the next set", async () => {
    const user = userEvent.setup();
    const onCompleteSet = vi.fn();
    render(<WorkoutChecklist exercises={[exercise("squat", "Squat", ["Pending", "Pending"])]} onCompleteSet={onCompleteSet} />);

    const firstRow = screen.getByTestId("set-row-1");
    expect(within(firstRow).getByRole("checkbox", { name: "Complete Squat set 1" })).toBeEnabled();
    await user.click(within(firstRow).getByRole("button", { name: /Set 1 Reps/ }));
    const weight = screen.getByLabelText("Weight");
    await user.type(weight, "50");
    await user.keyboard("{Enter}");
    await user.type(screen.getByLabelText("Reps"), "8");
    await user.keyboard("{Enter}");

    expect(onCompleteSet).toHaveBeenCalledWith("squat-set-1", { externalLoadKg: 50, actualReps: 8, rpe: null });
    expect(screen.getByTestId("set-row-2")).toHaveAttribute("data-selected", "true");
    expect(screen.getByLabelText("Weight")).toHaveFocus();
  });

  it("stays on the set when completion is cancelled", async () => {
    const user = userEvent.setup();
    const onCompleteSet = vi.fn(() => false);
    render(<WorkoutChecklist exercises={[exercise("squat", "Squat", ["Pending", "Pending"])]} onCompleteSet={onCompleteSet} />);

    await user.type(screen.getByLabelText("Reps"), "8");
    await user.keyboard("{Enter}");

    expect(screen.getByTestId("set-row-1")).toHaveAttribute("data-selected", "true");
    expect(screen.getByTestId("set-row-2")).not.toHaveAttribute("data-selected");
  });

  it("uncompletes a checked set", async () => {
    const user = userEvent.setup();
    const onUncompleteSet = vi.fn();
    render(<WorkoutChecklist exercises={[exercise("squat", "Squat", ["Completed", "Pending"])]} onUncompleteSet={onUncompleteSet} />);

    const checkbox = screen.getByRole("checkbox", { name: "Complete Squat set 1" });
    expect(checkbox).toBeEnabled();
    await user.click(checkbox);

    expect(onUncompleteSet).toHaveBeenCalledWith("squat-set-1");
  });
});
