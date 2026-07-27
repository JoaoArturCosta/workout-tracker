import { describe, expect, it } from "vitest";

import {
  WorkoutTransitionError,
  applyWorkoutTransition,
  getCurrentSet,
  type WorkoutState,
} from "./state-machine";

const activeWorkout = (
  statuses: Array<"Pending" | "Completed" | "Skipped">
): WorkoutState => ({
  status: "Active",
  sets: statuses.map((status, index) => ({
    id: `set-${index + 1}`,
    status,
    completedAt:
      status === "Completed"
        ? new Date(`2026-07-27T10:0${index}:00.000Z`)
        : null,
  })),
});

describe("workout state machine", () => {
  it("uses the first pending set as Current", () => {
    const workout = activeWorkout(["Completed", "Skipped", "Pending", "Pending"]);

    expect(getCurrentSet(workout)?.id).toBe("set-3");
  });

  it("completes only Current when another pending set remains", () => {
    const next = applyWorkoutTransition(
      activeWorkout(["Pending", "Pending"]),
      {
        type: "CompleteCurrent",
        setId: "set-1",
        completedAt: new Date("2026-07-27T11:00:00.000Z"),
      }
    );

    expect(next.status).toBe("Active");
    expect(next.sets.map((set) => set.status)).toEqual([
      "Completed",
      "Pending",
    ]);
  });

  it("saves a non-current pending set without moving Current", () => {
    const next = applyWorkoutTransition(
      activeWorkout(["Pending", "Pending", "Pending"]),
      {
        type: "SaveSet",
        setId: "set-2",
        completedAt: new Date("2026-07-27T11:00:00.000Z"),
      }
    );

    expect(next.status).toBe("Active");
    expect(next.sets.map((set) => set.status)).toEqual([
      "Pending",
      "Completed",
      "Pending",
    ]);
    expect(getCurrentSet(next)?.id).toBe("set-1");
  });

  it("saves a skipped set as completed", () => {
    const next = applyWorkoutTransition(
      activeWorkout(["Pending", "Skipped"]),
      {
        type: "SaveSet",
        setId: "set-2",
        completedAt: new Date("2026-07-27T11:00:00.000Z"),
      }
    );

    expect(next.sets[1]).toEqual({
      id: "set-2",
      status: "Completed",
      completedAt: new Date("2026-07-27T11:00:00.000Z"),
    });
  });

  it("preserves completion time when saving a completed set", () => {
    const workout = activeWorkout(["Completed", "Pending"]);

    const next = applyWorkoutTransition(workout, {
      type: "SaveSet",
      setId: "set-1",
      completedAt: new Date("2026-07-27T12:00:00.000Z"),
    });

    expect(next.sets[0].completedAt).toEqual(workout.sets[0].completedAt);
  });

  it("ends Completed when saving the last skipped set completes the plan", () => {
    const next = applyWorkoutTransition(
      activeWorkout(["Completed", "Skipped"]),
      {
        type: "SaveSet",
        setId: "set-2",
        completedAt: new Date("2026-07-27T11:00:00.000Z"),
      }
    );

    expect(next.status).toBe("Completed");
    expect(next.sets.every((set) => set.status === "Completed")).toBe(true);
  });

  it("keeps Current on the normal completion path and guards the final pending set", () => {
    expect(() =>
      applyWorkoutTransition(activeWorkout(["Pending", "Pending"]), {
        type: "SaveSet",
        setId: "set-1",
        completedAt: new Date("2026-07-27T11:00:00.000Z"),
      })
    ).toThrowError(expect.objectContaining({ code: "SET_IS_CURRENT" }));

    expect(() =>
      applyWorkoutTransition(activeWorkout(["Completed", "Pending"]), {
        type: "SaveSet",
        setId: "set-2",
        completedAt: new Date("2026-07-27T11:00:00.000Z"),
      })
    ).toThrowError(
      expect.objectContaining({ code: "FINAL_SET_REQUIRES_FINISH" })
    );
  });

  it("requires Finish confirmation for the final pending set", () => {
    expect(() =>
      applyWorkoutTransition(activeWorkout(["Pending"]), {
        type: "CompleteCurrent",
        setId: "set-1",
        completedAt: new Date("2026-07-27T11:00:00.000Z"),
      })
    ).toThrowError(
      expect.objectContaining({ code: "FINAL_SET_REQUIRES_FINISH" })
    );
  });

  it("finishes Completed only when every planned set is completed", () => {
    const next = applyWorkoutTransition(
      activeWorkout(["Completed", "Pending"]),
      {
        type: "Finish",
        setId: "set-2",
        completedAt: new Date("2026-07-27T11:00:00.000Z"),
      }
    );

    expect(next.status).toBe("Completed");
    expect(next.sets.every((set) => set.status === "Completed")).toBe(true);
  });

  it("finishes Partial when a planned set was skipped", () => {
    const next = applyWorkoutTransition(
      activeWorkout(["Skipped", "Pending"]),
      {
        type: "Finish",
        setId: "set-2",
        completedAt: new Date("2026-07-27T11:00:00.000Z"),
      }
    );

    expect(next.status).toBe("Partial");
  });

  it("skips only Current without completing it", () => {
    const next = applyWorkoutTransition(
      activeWorkout(["Pending", "Pending"]),
      { type: "SkipCurrent", setId: "set-1" }
    );

    expect(next.sets.map((set) => set.status)).toEqual(["Skipped", "Pending"]);
  });

  it("restores a skipped set while the workout is active", () => {
    const next = applyWorkoutTransition(
      activeWorkout(["Skipped", "Pending"]),
      { type: "Restore", setId: "set-1" }
    );

    expect(next.sets.map((set) => set.status)).toEqual(["Pending", "Pending"]);
    expect(getCurrentSet(next)?.id).toBe("set-1");
  });

  it("undoes only the latest completed set", () => {
    const next = applyWorkoutTransition(
      activeWorkout(["Completed", "Completed", "Pending"]),
      { type: "UndoCompletion", setId: "set-2" }
    );

    expect(next.sets.map((set) => set.status)).toEqual([
      "Completed",
      "Pending",
      "Pending",
    ]);

    expect(() =>
      applyWorkoutTransition(
        activeWorkout(["Completed", "Completed", "Pending"]),
        { type: "UndoCompletion", setId: "set-1" }
      )
    ).toThrowError(expect.objectContaining({ code: "NOT_LATEST_COMPLETION" }));
  });

  it("ends early as Partial and skips every remaining pending set", () => {
    const next = applyWorkoutTransition(
      activeWorkout(["Completed", "Pending", "Skipped"]),
      { type: "EndEarly" }
    );

    expect(next.status).toBe("Partial");
    expect(next.sets.map((set) => set.status)).toEqual([
      "Completed",
      "Skipped",
      "Skipped",
    ]);
  });

  it("discards without deleting set records and skips pending sets", () => {
    const workout = activeWorkout(["Completed", "Pending", "Skipped"]);
    const next = applyWorkoutTransition(workout, { type: "Discard" });

    expect(next.status).toBe("Discarded");
    expect(next.sets.map((set) => set.status)).toEqual([
      "Completed",
      "Skipped",
      "Skipped",
    ]);
    expect(next.sets.map((set) => set.id)).toEqual(
      workout.sets.map((set) => set.id)
    );
    expect(next.sets[1].completedAt).toBeNull();
  });

  it.each(["Completed", "Partial", "Discarded"] as const)(
    "rejects all transitions after a workout is %s",
    (status) => {
      const workout = { ...activeWorkout(["Pending"]), status };

      expect(() =>
        applyWorkoutTransition(workout, {
          type: "SkipCurrent",
          setId: "set-1",
        })
      ).toThrow(WorkoutTransitionError);
    }
  );

  it("rejects a non-current complete or skip", () => {
    const workout = activeWorkout(["Pending", "Pending"]);

    for (const action of [
      {
        type: "CompleteCurrent" as const,
        setId: "set-2",
        completedAt: new Date(),
      },
      { type: "SkipCurrent" as const, setId: "set-2" },
    ]) {
      expect(() => applyWorkoutTransition(workout, action)).toThrowError(
        expect.objectContaining({ code: "SET_NOT_CURRENT" })
      );
    }
  });
});
