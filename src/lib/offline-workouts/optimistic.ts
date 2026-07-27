import type { SetStatus, WorkoutCommand } from "@/lib/workouts/contracts";
import type { OfflineWorkoutSnapshot } from "./models";

type OptimisticSet = {
  id: string;
  status: SetStatus;
  mode: "Reps" | "Duration";
  externalLoadKg: number;
  actualReps: number | null;
  actualSeconds: number | null;
  rpe: number | null;
};

type OptimisticWorkout = {
  status: "Active" | "Completed" | "Partial" | "Discarded";
  occurrences: Array<{ sets: OptimisticSet[] }>;
};

/** Apply one typed command to the local frozen snapshot before sync. */
export function applyOptimisticWorkoutCommand<TData extends OptimisticWorkout>(
  snapshot: OfflineWorkoutSnapshot<TData>,
  command: WorkoutCommand,
): OfflineWorkoutSnapshot<TData> {
  const setId = "sessionSetId" in command ? command.sessionSetId : undefined;
  const occurrences = snapshot.data.occurrences.map((occurrence) => ({
    ...occurrence,
    sets: occurrence.sets.map((set) => {
      if (set.id !== setId) return set;
      if ((command.type === "CompleteSet" || command.type === "EditCompletedSet") && command.result) {
        return { ...set, status: "Completed" as const, mode: command.result.mode, externalLoadKg: command.result.externalLoadKg, actualReps: command.result.actualReps ?? null, actualSeconds: command.result.actualSeconds ?? null, rpe: command.result.rpe };
      }
      if (command.type === "SkipSet") return { ...set, status: "Skipped" as const };
      if (command.type === "RestoreSet" || command.type === "Undo") return { ...set, status: "Pending" as const };
      return set;
    }),
  }));
  const terminalStatus = command.type === "Finish" ? "Completed" : command.type === "End" ? "Partial" : command.type === "Discard" ? "Discarded" : undefined;
  const data = { ...snapshot.data, status: terminalStatus ?? snapshot.data.status, occurrences } as TData;
  return { ...snapshot, status: terminalStatus ?? snapshot.status, data, updatedAt: Date.now() };
}
