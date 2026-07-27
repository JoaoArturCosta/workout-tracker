import { describe, expect, it } from "vitest";

import {
  summarizeCompletedSets,
  type AnalyticsSet,
} from "./progress-analytics";

const set = (
  overrides: Partial<AnalyticsSet> = {}
): AnalyticsSet => ({
  workoutStatus: "Completed",
  setStatus: "Completed",
  mode: "Reps",
  externalLoadKg: 20,
  actualReps: 10,
  actualSeconds: null,
  ...overrides,
});

describe("progress analytics", () => {
  it("includes completed sets from Completed and Partial workouts", () => {
    const summary = summarizeCompletedSets([
      set(),
      set({ workoutStatus: "Partial", externalLoadKg: 10, actualReps: 5 }),
    ]);

    expect(summary).toEqual({
      completedSetCount: 2,
      repsSetCount: 2,
      totalVolume: 250,
      durationSetCount: 0,
      totalActualSeconds: 0,
    });
  });

  it("excludes Skipped sets and every set from Discarded workouts", () => {
    const summary = summarizeCompletedSets([
      set({ setStatus: "Skipped" }),
      set({ workoutStatus: "Discarded" }),
    ]);

    expect(summary.completedSetCount).toBe(0);
    expect(summary.totalVolume).toBe(0);
  });

  it("never converts Duration seconds into reps volume", () => {
    const summary = summarizeCompletedSets([
      set({
        mode: "Duration",
        externalLoadKg: 50,
        actualReps: null,
        actualSeconds: 90,
      }),
    ]);

    expect(summary).toEqual({
      completedSetCount: 1,
      repsSetCount: 0,
      totalVolume: 0,
      durationSetCount: 1,
      totalActualSeconds: 90,
    });
  });
});
