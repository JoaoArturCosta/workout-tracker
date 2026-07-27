import type {
  SetStatus,
  WorkoutMode,
  WorkoutStatus,
} from "@/lib/workouts/contracts";

export type AnalyticsSet = {
  workoutStatus: WorkoutStatus;
  setStatus: SetStatus;
  mode: WorkoutMode;
  externalLoadKg: number;
  actualReps: number | null;
  actualSeconds: number | null;
};

export type WorkoutSetSummary = {
  completedSetCount: number;
  repsSetCount: number;
  totalVolume: number;
  durationSetCount: number;
  totalActualSeconds: number;
};

export const summarizeCompletedSets = (
  sets: AnalyticsSet[]
): WorkoutSetSummary =>
  sets.reduce<WorkoutSetSummary>(
    (summary, set) => {
      if (
        !["Completed", "Partial"].includes(set.workoutStatus) ||
        set.setStatus !== "Completed"
      ) {
        return summary;
      }

      summary.completedSetCount += 1;
      if (set.mode === "Reps" && set.actualReps !== null) {
        summary.repsSetCount += 1;
        summary.totalVolume += set.externalLoadKg * set.actualReps;
      }
      if (set.mode === "Duration" && set.actualSeconds !== null) {
        summary.durationSetCount += 1;
        summary.totalActualSeconds += set.actualSeconds;
      }
      return summary;
    },
    {
      completedSetCount: 0,
      repsSetCount: 0,
      totalVolume: 0,
      durationSetCount: 0,
      totalActualSeconds: 0,
    }
  );
