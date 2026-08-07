import { describe, expect, it } from "vitest";
import { applyOptimisticWorkoutCommand } from "./optimistic";
import type { OfflineWorkoutSnapshot } from "./models";

const base = (): OfflineWorkoutSnapshot<{
  status: "Active" | "Completed" | "Partial" | "Discarded";
  occurrences: Array<{ sets: Array<{ id: string; status: "Pending" | "Completed" | "Skipped"; mode: "Reps"; completedAt: Date | null; externalLoadKg: number; actualReps: number | null; actualSeconds: number | null; rpe: number | null }> }>;
}> => ({
  sessionId: "00000000-0000-0000-0000-000000000001",
  revision: 1,
  controllerEpoch: 1,
  controllerDeviceId: "00000000-0000-0000-0000-000000000002",
  status: "Active",
  data: { status: "Active", occurrences: [{ sets: [
    { id: "00000000-0000-0000-0000-000000000003", status: "Pending", mode: "Reps", completedAt: null, externalLoadKg: 0, actualReps: null, actualSeconds: null, rpe: null },
    { id: "00000000-0000-0000-0000-000000000004", status: "Pending", mode: "Reps", completedAt: null, externalLoadKg: 0, actualReps: null, actualSeconds: null, rpe: null },
  ] }] },
  updatedAt: 0,
});

describe("applyOptimisticWorkoutCommand", () => {
  it("applies a completed result to the matching set", () => {
    const next = applyOptimisticWorkoutCommand(base(), { type: "CompleteSet", sessionSetId: "00000000-0000-0000-0000-000000000003", result: { mode: "Reps", externalLoadKg: 20, actualReps: 8, actualSeconds: null, rpe: null } });
    expect(next.data.occurrences[0].sets[0]).toMatchObject({ status: "Completed", externalLoadKg: 20, actualReps: 8 });
  });

  it("applies the final result when finishing", () => {
    const snapshot = base();
    snapshot.data.occurrences[0].sets[0] = { ...snapshot.data.occurrences[0].sets[0], status: "Completed", completedAt: new Date("2026-07-27T11:00:00.000Z"), actualReps: 8 };
    const next = applyOptimisticWorkoutCommand(snapshot, { type: "Finish", sessionSetId: "00000000-0000-0000-0000-000000000004", result: { mode: "Reps", externalLoadKg: 25, actualReps: 10, actualSeconds: null, rpe: 9 } });

    expect(next.status).toBe("Completed");
    expect(next.data.occurrences[0].sets[1]).toMatchObject({ status: "Completed", externalLoadKg: 25, actualReps: 10, rpe: 9 });
  });

  it("clears a completed result when undoing it", () => {
    const snapshot = base();
    snapshot.data.occurrences[0].sets[0] = { ...snapshot.data.occurrences[0].sets[0], status: "Completed", completedAt: new Date("2026-07-27T11:00:00.000Z"), externalLoadKg: 20, actualReps: 8, rpe: 8 };
    const next = applyOptimisticWorkoutCommand(snapshot, { type: "Undo", sessionSetId: "00000000-0000-0000-0000-000000000003" });

    expect(next.data.occurrences[0].sets[0]).toMatchObject({ status: "Pending", completedAt: null, externalLoadKg: 0, actualReps: null, actualSeconds: null, rpe: null });
  });

  it.each(["Pending", "Skipped", "Completed"] as const)(
    "saves a %s set optimistically",
    (status) => {
      const snapshot = base();
      const set = snapshot.data.occurrences[0].sets[1];
      set.status = status;
      set.completedAt =
        status === "Completed"
          ? new Date("2026-07-27T11:00:00.000Z")
          : null;

      const next = applyOptimisticWorkoutCommand(snapshot, {
        type: "SaveSet",
        sessionSetId: "00000000-0000-0000-0000-000000000004",
        result: {
          mode: "Reps",
          externalLoadKg: 22.5,
          actualReps: 9,
          actualSeconds: null,
          rpe: 8,
        },
      });

      expect(next.data.occurrences[0].sets[1]).toMatchObject({
        status: "Completed",
        externalLoadKg: 22.5,
        actualReps: 9,
        rpe: 8,
      });
      if (status === "Completed") {
        expect(next.data.occurrences[0].sets[1].completedAt).toEqual(
          new Date("2026-07-27T11:00:00.000Z")
        );
      } else {
        expect(
          next.data.occurrences[0].sets[1].completedAt
        ).toBeInstanceOf(Date);
      }
      expect(next.status).toBe("Active");
    }
  );

  it("ends optimistically when SaveSet completes every planned set", () => {
    const snapshot = base();
    snapshot.data.occurrences[0].sets[0] = {
      ...snapshot.data.occurrences[0].sets[0],
      status: "Completed",
      completedAt: new Date("2026-07-27T11:00:00.000Z"),
      actualReps: 8,
    };
    snapshot.data.occurrences[0].sets[1].status = "Skipped";

    const next = applyOptimisticWorkoutCommand(snapshot, {
      type: "SaveSet",
      sessionSetId: "00000000-0000-0000-0000-000000000004",
      result: {
        mode: "Reps",
        externalLoadKg: 22.5,
        actualReps: 9,
        actualSeconds: null,
        rpe: null,
      },
    });

    expect(next.status).toBe("Completed");
    expect(next.data.status).toBe("Completed");
  });

  it("marks End as Partial without changing completed set values", () => {
    const next = applyOptimisticWorkoutCommand(base(), { type: "End" });
    expect(next.status).toBe("Partial");
    expect(next.data.status).toBe("Partial");
    expect(next.data.occurrences[0].sets[0].status).toBe("Pending");
  });

  it("marks all pending sets as skipped when Discard is queued", () => {
    const snapshot = base();
    snapshot.data.occurrences[0].sets[0] = {
      ...snapshot.data.occurrences[0].sets[0],
      status: "Completed",
      completedAt: new Date("2026-07-27T11:00:00.000Z"),
    };

    const next = applyOptimisticWorkoutCommand(snapshot, { type: "Discard" });

    expect(next.status).toBe("Discarded");
    expect(next.data.status).toBe("Discarded");
    expect(next.data.occurrences[0].sets.map((set) => set.status)).toEqual([
      "Completed",
      "Skipped",
    ]);
    expect(next.data.occurrences[0].sets[1].completedAt).toBeNull();
  });
});
