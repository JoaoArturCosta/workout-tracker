import { describe, expect, it } from "vitest";
import { applyOptimisticWorkoutCommand } from "./optimistic";
import type { OfflineWorkoutSnapshot } from "./models";

const base = (): OfflineWorkoutSnapshot<{
  status: "Active" | "Completed" | "Partial" | "Discarded";
  occurrences: Array<{ sets: Array<{ id: string; status: "Pending" | "Completed" | "Skipped"; mode: "Reps"; externalLoadKg: number; actualReps: number | null; actualSeconds: number | null; rpe: number | null }> }>;
}> => ({
  sessionId: "00000000-0000-0000-0000-000000000001",
  revision: 1,
  controllerEpoch: 1,
  controllerDeviceId: "00000000-0000-0000-0000-000000000002",
  status: "Active",
  data: { status: "Active", occurrences: [{ sets: [{ id: "00000000-0000-0000-0000-000000000003", status: "Pending", mode: "Reps", externalLoadKg: 0, actualReps: null, actualSeconds: null, rpe: null }] }] },
  updatedAt: 0,
});

describe("applyOptimisticWorkoutCommand", () => {
  it("applies a completed result to the matching set", () => {
    const next = applyOptimisticWorkoutCommand(base(), { type: "CompleteSet", sessionSetId: "00000000-0000-0000-0000-000000000003", result: { mode: "Reps", externalLoadKg: 20, actualReps: 8, actualSeconds: null, rpe: null } });
    expect(next.data.occurrences[0].sets[0]).toMatchObject({ status: "Completed", externalLoadKg: 20, actualReps: 8 });
  });

  it("marks End as Partial without changing completed set values", () => {
    const next = applyOptimisticWorkoutCommand(base(), { type: "End" });
    expect(next.status).toBe("Partial");
    expect(next.data.status).toBe("Partial");
    expect(next.data.occurrences[0].sets[0].status).toBe("Pending");
  });
});
