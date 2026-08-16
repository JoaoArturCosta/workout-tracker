import { findCurrentSet } from "@/lib/workouts/current-set";
import type { SetStatus, WorkoutCommand } from "@/lib/workouts/contracts";
import type { OfflineWorkoutSnapshot } from "./models";

type OptimisticSet = {
  id: string;
  status: SetStatus;
  mode: "Reps" | "Duration";
  completedAt?: Date | string | null;
  externalLoadKg: number;
  actualReps: number | null;
  actualSeconds: number | null;
  rpe: number | null;
};

type OptimisticRest = {
  currentSetId: string | null;
  startedAt: Date | string;
  dueAt: Date | string;
} | null;

type OptimisticWorkout = {
  status: "Active" | "Completed" | "Partial" | "Discarded";
  rest?: OptimisticRest;
  occurrences: Array<{
    id?: string;
    restTimeSeconds?: number;
    sets: OptimisticSet[];
  }>;
};

/** Commands that complete a set and so may schedule a rest period. */
const REST_SCHEDULING_COMMAND: Record<string, boolean> = {
  CompleteSet: true,
  SaveSet: true,
};

/** Apply one typed command to the local frozen snapshot before sync. */
export function applyOptimisticWorkoutCommand<TData extends OptimisticWorkout>(
  snapshot: OfflineWorkoutSnapshot<TData>,
  command: WorkoutCommand,
): OfflineWorkoutSnapshot<TData> {
  const updatedAt = Date.now();
  const setId = "sessionSetId" in command ? command.sessionSetId : undefined;
  const occurrences = snapshot.data.occurrences.map((occurrence) => ({
    ...occurrence,
    sets: occurrence.sets.map((set) => {
      if (command.type === "Discard" && set.status === "Pending") {
        return { ...set, status: "Skipped" as const, completedAt: null };
      }
      if (set.id !== setId) return set;
      if ((command.type === "CompleteSet" || command.type === "SaveSet" || command.type === "EditCompletedSet" || command.type === "Finish") && command.result) {
        return { ...set, status: "Completed" as const, completedAt: set.status === "Completed" ? set.completedAt : new Date(updatedAt), mode: command.result.mode, externalLoadKg: command.result.externalLoadKg, actualReps: command.result.actualReps ?? null, actualSeconds: command.result.actualSeconds ?? null, rpe: command.result.rpe };
      }
      if (command.type === "SkipSet") return { ...set, status: "Skipped" as const };
      if (command.type === "RestoreSet") return { ...set, status: "Pending" as const, completedAt: null };
      if (command.type === "Undo") return { ...set, status: "Pending" as const, completedAt: null, externalLoadKg: 0, actualReps: null, actualSeconds: null, rpe: null };
      return set;
    }),
  }));
  const allSetsCompleted = occurrences.every((occurrence) =>
    occurrence.sets.every((set) => set.status === "Completed")
  );
  const terminalStatus = command.type === "Finish" || (command.type === "SaveSet" && allSetsCompleted) ? "Completed" : command.type === "End" ? "Partial" : command.type === "Discard" ? "Discarded" : undefined;
  const rest = nextRest(snapshot.data, command, occurrences, updatedAt, terminalStatus ?? snapshot.data.status);
  const data = { ...snapshot.data, status: terminalStatus ?? snapshot.data.status, rest, occurrences } as TData;
  return { ...snapshot, status: terminalStatus ?? snapshot.status, data, updatedAt };
}

/**
 * Mirror the server's rest decision: a completing command schedules rest for
 * the Current set that follows it; anything else that changes the workout
 * cancels rest, and edits leave it alone.
 */
function nextRest(
  data: OptimisticWorkout,
  command: WorkoutCommand,
  occurrences: OptimisticWorkout["occurrences"],
  now: number,
  status: OptimisticWorkout["status"],
): OptimisticRest {
  if (command.type === "EditCompletedSet") return data.rest ?? null;
  if (!REST_SCHEDULING_COMMAND[command.type] || status !== "Active") {
    return null;
  }
  const { sessionSetId } = command as { sessionSetId: string };

  const completedOccurrence = occurrences.find((occurrence) =>
    occurrence.sets.some((set) => set.id === sessionSetId)
  );
  const restTimeSeconds = completedOccurrence?.restTimeSeconds;
  if (restTimeSeconds == null) return null;

  const currentSet = findCurrentSet(
    occurrences.flatMap((occurrence) =>
      occurrence.sets.map((set) => ({
        ...set,
        exerciseOccurrenceId: occurrence.id ?? "",
      }))
    )
  );
  if (!currentSet) return null;

  const startedAt = new Date(now);
  return {
    currentSetId: currentSet.id,
    startedAt,
    dueAt: new Date(now + restTimeSeconds * 1_000),
  };
}
