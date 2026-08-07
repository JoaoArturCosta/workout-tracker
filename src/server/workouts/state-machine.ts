export type WorkoutStatus = "Active" | "Completed" | "Partial" | "Discarded";
export type SetStatus = "Pending" | "Completed" | "Skipped";

export type WorkoutStateSet = {
  id: string;
  status: SetStatus;
  completedAt: Date | null;
};

export type WorkoutState = {
  status: WorkoutStatus;
  sets: WorkoutStateSet[];
};

export type WorkoutTransition =
  | { type: "CompleteCurrent"; setId: string; completedAt: Date }
  | { type: "SaveSet"; setId: string; completedAt: Date }
  | { type: "Finish"; setId: string; completedAt: Date }
  | { type: "SkipCurrent"; setId: string }
  | { type: "Restore"; setId: string }
  | { type: "UndoCompletion"; setId: string }
  | { type: "EndEarly" }
  | { type: "Discard" };

export type WorkoutTransitionErrorCode =
  | "WORKOUT_ENDED"
  | "SET_NOT_FOUND"
  | "SET_NOT_CURRENT"
  | "SET_IS_CURRENT"
  | "SET_NOT_SKIPPED"
  | "SET_NOT_COMPLETED"
  | "FINAL_SET_REQUIRES_FINISH"
  | "FINISH_REQUIRES_FINAL_SET";

export class WorkoutTransitionError extends Error {
  constructor(
    readonly code: WorkoutTransitionErrorCode,
    message: string
  ) {
    super(message);
    this.name = "WorkoutTransitionError";
  }
}

export const getCurrentSet = (
  workout: WorkoutState
): WorkoutStateSet | undefined =>
  workout.sets.find((set) => set.status === "Pending");

const requireActive = (workout: WorkoutState) => {
  if (workout.status !== "Active") {
    throw new WorkoutTransitionError(
      "WORKOUT_ENDED",
      "Ended workouts cannot change"
    );
  }
};

const requireSet = (workout: WorkoutState, setId: string) => {
  const set = workout.sets.find((candidate) => candidate.id === setId);
  if (!set) {
    throw new WorkoutTransitionError("SET_NOT_FOUND", "Set not found");
  }
  return set;
};

const requireCurrent = (workout: WorkoutState, setId: string) => {
  const current = getCurrentSet(workout);
  if (!current || current.id !== setId) {
    throw new WorkoutTransitionError(
      "SET_NOT_CURRENT",
      "Only the Current set can change"
    );
  }
  return current;
};

const replaceSet = (
  workout: WorkoutState,
  setId: string,
  update: Pick<WorkoutStateSet, "status" | "completedAt">
): WorkoutState => ({
  ...workout,
  sets: workout.sets.map((set) =>
    set.id === setId ? { ...set, ...update } : set
  ),
});

export const applyWorkoutTransition = (
  workout: WorkoutState,
  transition: WorkoutTransition
): WorkoutState => {
  requireActive(workout);

  switch (transition.type) {
    case "CompleteCurrent": {
      requireCurrent(workout, transition.setId);
      if (workout.sets.filter((set) => set.status === "Pending").length === 1) {
        throw new WorkoutTransitionError(
          "FINAL_SET_REQUIRES_FINISH",
          "The final set must use Finish"
        );
      }
      return replaceSet(workout, transition.setId, {
        status: "Completed",
        completedAt: transition.completedAt,
      });
    }
    case "SaveSet": {
      const set = requireSet(workout, transition.setId);
      if (set.status === "Completed") {
        return workout;
      }
      if (set.status === "Pending") {
        if (
          workout.sets.filter((candidate) => candidate.status === "Pending")
            .length === 1
        ) {
          throw new WorkoutTransitionError(
            "FINAL_SET_REQUIRES_FINISH",
            "The final pending set must use Finish"
          );
        }
        if (getCurrentSet(workout)?.id === transition.setId) {
          throw new WorkoutTransitionError(
            "SET_IS_CURRENT",
            "The Current set must use CompleteSet"
          );
        }
      }
      const completed = replaceSet(workout, transition.setId, {
        status: "Completed",
        completedAt: transition.completedAt,
      });
      return completed.sets.every(
        (candidate) => candidate.status === "Completed"
      )
        ? { ...completed, status: "Completed" }
        : completed;
    }
    case "Finish": {
      requireCurrent(workout, transition.setId);
      if (workout.sets.filter((set) => set.status === "Pending").length !== 1) {
        throw new WorkoutTransitionError(
          "FINISH_REQUIRES_FINAL_SET",
          "Finish requires the final pending set"
        );
      }
      const completed = replaceSet(workout, transition.setId, {
        status: "Completed",
        completedAt: transition.completedAt,
      });
      return {
        ...completed,
        status: completed.sets.every((set) => set.status === "Completed")
          ? "Completed"
          : "Partial",
      };
    }
    case "SkipCurrent": {
      requireCurrent(workout, transition.setId);
      return replaceSet(workout, transition.setId, {
        status: "Skipped",
        completedAt: null,
      });
    }
    case "Restore": {
      const set = requireSet(workout, transition.setId);
      if (set.status !== "Skipped") {
        throw new WorkoutTransitionError(
          "SET_NOT_SKIPPED",
          "Only a skipped set can be restored"
        );
      }
      return replaceSet(workout, transition.setId, {
        status: "Pending",
        completedAt: null,
      });
    }
    case "UndoCompletion": {
      const set = requireSet(workout, transition.setId);
      if (set.status !== "Completed") {
        throw new WorkoutTransitionError(
          "SET_NOT_COMPLETED",
          "Only a completed set can be undone"
        );
      }
      return replaceSet(workout, transition.setId, {
        status: "Pending",
        completedAt: null,
      });
    }
    case "EndEarly":
      return {
        status: "Partial",
        sets: workout.sets.map((set) =>
          set.status === "Pending"
            ? { ...set, status: "Skipped", completedAt: null }
            : set
        ),
      };
    case "Discard":
      return {
        ...workout,
        status: "Discarded",
        sets: workout.sets.map((set) =>
          set.status === "Pending"
            ? { ...set, status: "Skipped", completedAt: null }
            : set
        ),
      };
  }
};
