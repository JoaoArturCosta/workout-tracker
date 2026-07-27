import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { WorkoutHeader } from "./workout-header";

describe("WorkoutHeader", () => {
  it("keeps the end workout button visible while an active workout is read-only", () => {
    render(
      <WorkoutHeader
        name="Leg day"
        status="Active"
        completedSets={1}
        totalSets={3}
      />
    );

    expect(screen.getByRole("button", { name: "End workout" })).toBeDisabled();
  });

  it("ends an active workout when the action is available", async () => {
    const user = userEvent.setup();
    const onEnd = vi.fn();

    render(
      <WorkoutHeader
        name="Leg day"
        status="Active"
        completedSets={1}
        totalSets={3}
        onEnd={onEnd}
      />
    );

    await user.click(screen.getByRole("button", { name: "End workout" }));

    expect(onEnd).toHaveBeenCalledOnce();
  });

  it("hides the end workout button after the workout ends", () => {
    render(
      <WorkoutHeader
        name="Leg day"
        status="Partial"
        completedSets={1}
        totalSets={3}
      />
    );

    expect(
      screen.queryByRole("button", { name: "End workout" })
    ).not.toBeInTheDocument();
  });
});
