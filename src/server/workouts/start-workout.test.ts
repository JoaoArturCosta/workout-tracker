import { describe, expect, it } from "vitest";

import { autoCompleteActiveWorkout } from "./start-workout";

describe("autoCompleteActiveWorkout", () => {
  it("closes the current workout and invalidates stale writes", () => {
    const now = new Date("2026-08-11T10:30:00.000Z");

    expect(
      autoCompleteActiveWorkout({
        startTime: new Date("2026-08-11T09:15:00.000Z"),
        revision: 12,
        controllerEpoch: 1,
        now,
      })
    ).toEqual({
      status: "Completed",
      completed: true,
      endTime: now,
      durationMinutes: 75,
      revision: 13,
      controllerEpoch: 2,
    });
  });

  it("never stores a negative duration", () => {
    const now = new Date("2026-08-11T10:00:00.000Z");

    expect(
      autoCompleteActiveWorkout({
        startTime: new Date("2026-08-11T10:01:00.000Z"),
        revision: 0,
        controllerEpoch: 3,
        now,
      }).durationMinutes
    ).toBe(0);
  });
});
