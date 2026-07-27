import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WorkoutHeader } from "./workout-header";

describe("WorkoutHeader", () => {
  it("hides the end workout button when no header action is supplied", () => {
    render(
      <WorkoutHeader
        name="Leg day"
        status="Active"
        completedSets={1}
        totalSets={3}
      />
    );

    expect(screen.queryByRole("button", { name: "End workout" })).not.toBeInTheDocument();
  });

  it("does not show the end workout button after the workout ends", () => {
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
