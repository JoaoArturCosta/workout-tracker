import {
  WorkoutTransitionError,
  applyWorkoutTransition,
  type SetStatus,
  type WorkoutState,
  type WorkoutStatus,
} from "./state-machine";
import type {
  CommandEnvelope,
  SetResult,
  WorkoutCommand,
  WorkoutMode,
} from "@/lib/workouts/contracts";

export type CommandSetResult = SetResult;

export type CommandSet = {
  id: string;
  /** Exercise occurrence id: sets of one exercise share a group. */
  exerciseOccurrenceId: string;
  mode: WorkoutMode;
  status: SetStatus;
  completedAt: Date | null;
  result: CommandSetResult | null;
};

export type CommandWorkout = {
  id: string;
  userId: string;
  status: WorkoutStatus;
  revision: number;
  controllerDeviceId: string | null;
  controllerEpoch: number;
  startTime: Date;
  endTime: Date | null;
  durationMinutes: number | null;
  sets: CommandSet[];
};

export type WorkoutCommandEnvelope = CommandEnvelope;

export type CommandResult = {
  sessionId: string;
  status: WorkoutStatus;
  revision: number;
  controllerEpoch: number;
  sets: CommandSet[];
};

export type StoredCommandReceipt = {
  result: CommandResult;
  postCommitEffect?: unknown;
};

type ReceiptKey = {
  operationId: string;
  sessionId: string;
  userId: string;
};

export type WorkoutCommandTransaction = {
  findReceipt(key: ReceiptKey): Promise<StoredCommandReceipt | null>;
  lockWorkout(input: {
    sessionId: string;
    userId: string;
  }): Promise<CommandWorkout | null>;
  saveWorkout(workout: CommandWorkout): Promise<void>;
  saveReceipt(
    key: ReceiptKey &
      StoredCommandReceipt & {
        commandType: WorkoutCommand["type"];
        controllerEpoch: number;
        expectedRevision: number;
      }
  ): Promise<void>;
  cancelScheduledRest(sessionId: string, now: Date): Promise<void>;
  scheduleRest(input: {
    sessionId: string;
    completedSetId: string;
    currentSetId: string;
    controllerEpoch: number;
    now: Date;
  }): Promise<{ restId: string; token: string; dueAt: Date } | null>;
};

export type WorkoutCommandStore = {
  transaction<T>(
    run: (tx: WorkoutCommandTransaction) => Promise<T>
  ): Promise<T>;
};

export type WorkoutCommandHookContext = {
  before: CommandWorkout;
  after: CommandWorkout;
  command: WorkoutCommand;
  envelope: WorkoutCommandEnvelope;
  now: Date;
};

export type WorkoutCommandHooks = {
  afterTransition?(
    tx: WorkoutCommandTransaction,
    context: WorkoutCommandHookContext
  ): Promise<unknown>;
  afterCommit?(effect: unknown): Promise<void>;
};

export type WorkoutCommandErrorCode =
  | "WORKOUT_NOT_FOUND"
  | "STALE_REVISION"
  | "STALE_CONTROLLER"
  | "INVALID_TRANSITION";

export class WorkoutCommandError extends Error {
  constructor(
    readonly code: WorkoutCommandErrorCode,
    message: string,
    readonly transitionCode?: string
  ) {
    super(message);
    this.name = "WorkoutCommandError";
  }
}

const toState = (workout: CommandWorkout): WorkoutState => ({
  status: workout.status,
  sets: workout.sets.map(({ id, exerciseOccurrenceId, status, completedAt }) => ({
    id,
    exerciseOccurrenceId,
    status,
    completedAt,
  })),
});

const applyState = (
  workout: CommandWorkout,
  state: WorkoutState
): CommandWorkout => ({
  ...workout,
  status: state.status,
  sets: state.sets.map((set) => {
    const prior = workout.sets.find((candidate) => candidate.id === set.id);
    if (!prior) {
      throw new WorkoutCommandError(
        "INVALID_TRANSITION",
        "Transition returned an unknown set"
      );
    }
    return {
      ...prior,
      status: set.status,
      completedAt: set.completedAt,
      result: set.status === "Completed" ? prior.result : null,
    };
  }),
});

const replaceResult = (
  workout: CommandWorkout,
  setId: string,
  result: CommandSetResult
): CommandWorkout => {
  const set = workout.sets.find((candidate) => candidate.id === setId);
  if (!set || set.mode !== result.mode) {
    throw new WorkoutCommandError(
      "INVALID_TRANSITION",
      "Set result mode does not match the frozen workout plan",
      "RESULT_MODE_MISMATCH"
    );
  }
  return {
    ...workout,
    sets: workout.sets.map((candidate) =>
      candidate.id === setId ? { ...candidate, result } : candidate
    ),
  };
};

const applyCommand = (
  workout: CommandWorkout,
  command: WorkoutCommand,
  now: Date
): CommandWorkout => {
  try {
    switch (command.type) {
      case "SaveSet": {
        const transitioned = applyState(
          workout,
          applyWorkoutTransition(toState(workout), {
            type: "SaveSet",
            setId: command.sessionSetId,
            completedAt: now,
          })
        );
        return replaceResult(
          transitioned,
          command.sessionSetId,
          command.result
        );
      }
      case "CompleteSet":
      case "Finish": {
        const transitioned = applyState(
          workout,
          applyWorkoutTransition(toState(workout), {
            type:
              command.type === "CompleteSet" ? "CompleteCurrent" : "Finish",
            setId: command.sessionSetId,
            completedAt: now,
          })
        );
        return replaceResult(
          transitioned,
          command.sessionSetId,
          command.result
        );
      }
      case "SkipSet":
      case "RestoreSet":
      case "Undo":
        return applyState(
          workout,
          applyWorkoutTransition(toState(workout), {
            type:
              command.type === "SkipSet"
                ? "SkipCurrent"
                : command.type === "RestoreSet"
                  ? "Restore"
                  : "UndoCompletion",
            setId: command.sessionSetId,
          })
        );
      case "End":
      case "Discard":
        return applyState(
          workout,
          applyWorkoutTransition(toState(workout), {
            type: command.type === "End" ? "EndEarly" : "Discard",
          })
        );
      case "EditCompletedSet": {
        if (workout.status !== "Active") {
          throw new WorkoutTransitionError(
            "WORKOUT_ENDED",
            "Ended workouts cannot change"
          );
        }
        const set = workout.sets.find(
          (candidate) => candidate.id === command.sessionSetId
        );
        if (!set || set.status !== "Completed") {
          throw new WorkoutTransitionError(
            "SET_NOT_COMPLETED",
            "Only a completed set can be edited"
          );
        }
        return replaceResult(workout, command.sessionSetId, command.result);
      }
      case "SkipRest":
        if (workout.status !== "Active") {
          throw new WorkoutTransitionError(
            "WORKOUT_ENDED",
            "Ended workouts cannot change"
          );
        }
        return workout;
    }
  } catch (error) {
    if (error instanceof WorkoutTransitionError) {
      throw new WorkoutCommandError(
        "INVALID_TRANSITION",
        error.message,
        error.code
      );
    }
    throw error;
  }
};

const toResult = (workout: CommandWorkout): CommandResult => ({
  sessionId: workout.id,
  status: workout.status,
  revision: workout.revision,
  controllerEpoch: workout.controllerEpoch,
  sets: workout.sets,
});

export const executeWorkoutCommand = async ({
  store,
  userId,
  envelope,
  hooks = {},
  now = new Date(),
}: {
  store: WorkoutCommandStore;
  userId: string;
  envelope: WorkoutCommandEnvelope;
  hooks?: WorkoutCommandHooks;
  now?: Date;
}): Promise<{ result: CommandResult; replayed: boolean }> => {
  const transactionResult = await store.transaction(async (tx) => {
    const receiptKey = {
      operationId: envelope.operationId,
      sessionId: envelope.sessionId,
      userId,
    };
    const priorReceipt = await tx.findReceipt(receiptKey);
    if (priorReceipt) {
      return { receipt: priorReceipt, replayed: true };
    }

    const before = await tx.lockWorkout({
      sessionId: envelope.sessionId,
      userId,
    });
    if (!before) {
      throw new WorkoutCommandError(
        "WORKOUT_NOT_FOUND",
        "Workout not found"
      );
    }
    // A matching command can commit while this request waits on the workout
    // row lock. Re-read the receipt after the lock so concurrent retries also
    // return the first result instead of failing the revision check.
    const concurrentReceipt = await tx.findReceipt(receiptKey);
    if (concurrentReceipt) {
      return { receipt: concurrentReceipt, replayed: true };
    }
    if (
      before.controllerEpoch !== envelope.controllerEpoch ||
      before.controllerDeviceId !== envelope.deviceId
    ) {
      throw new WorkoutCommandError(
        "STALE_CONTROLLER",
        "The Controlling device changed"
      );
    }
    if (before.revision !== envelope.expectedRevision) {
      throw new WorkoutCommandError(
        "STALE_REVISION",
        "The workout changed before this command"
      );
    }

    const transitioned = applyCommand(before, envelope.command, now);
    const ended = before.status === "Active" && transitioned.status !== "Active";
    const after = {
      ...transitioned,
      revision: before.revision + 1,
      endTime: ended ? now : transitioned.endTime,
      durationMinutes: ended
        ? Math.max(
            0,
            Math.round((now.getTime() - before.startTime.getTime()) / 60_000)
          )
        : transitioned.durationMinutes,
    };
    await tx.saveWorkout(after);
    const postCommitEffect = await hooks.afterTransition?.(tx, {
      before,
      after,
      command: envelope.command,
      envelope,
      now,
    });
    const receipt: StoredCommandReceipt = {
      result: toResult(after),
      postCommitEffect,
    };
    await tx.saveReceipt({
      ...receiptKey,
      commandType: envelope.command.type,
      controllerEpoch: envelope.controllerEpoch,
      expectedRevision: envelope.expectedRevision,
      ...receipt,
    });

    return { receipt, replayed: false };
  });

  if (
    hooks.afterCommit &&
    transactionResult.receipt.postCommitEffect !== undefined
  ) {
    await hooks.afterCommit(transactionResult.receipt.postCommitEffect);
  }

  return {
    result: transactionResult.receipt.result,
    replayed: transactionResult.replayed,
  };
};
