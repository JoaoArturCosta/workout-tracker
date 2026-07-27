import type { WorkoutStatus } from "./state-machine";

export type ControllerWorkout = {
  id: string;
  userId: string;
  status: WorkoutStatus;
  revision: number;
  controllerDeviceId: string | null;
  controllerEpoch: number;
};

export type ControllerTransaction = {
  lockWorkout(input: {
    sessionId: string;
    userId: string;
  }): Promise<ControllerWorkout | null>;
  userOwnsDevice(input: {
    deviceId: string;
    userId: string;
  }): Promise<boolean>;
  saveController(workout: ControllerWorkout): Promise<void>;
  cancelScheduledRest(sessionId: string, now: Date): Promise<void>;
};

export type ControllerStore = {
  transaction<T>(run: (tx: ControllerTransaction) => Promise<T>): Promise<T>;
};

export type ControllerHooks = {
  invalidateRest?(
    tx: ControllerTransaction,
    sessionId: string,
    now: Date
  ): Promise<void>;
};

export type ControllerErrorCode =
  | "WORKOUT_NOT_FOUND"
  | "WORKOUT_ENDED"
  | "DEVICE_NOT_FOUND"
  | "SAME_DEVICE"
  | "PENDING_OPERATIONS"
  | "STALE_REVISION"
  | "STALE_CONTROLLER"
  | "DATA_LOSS_CONFIRMATION_REQUIRED";

export class ControllerError extends Error {
  constructor(
    readonly code: ControllerErrorCode,
    message: string
  ) {
    super(message);
    this.name = "ControllerError";
  }
}

export type ControllerResult = {
  sessionId: string;
  controllerDeviceId: string;
  controllerEpoch: number;
  revision: number;
};

const requireWorkout = (
  workout: ControllerWorkout | null
): ControllerWorkout => {
  if (!workout) {
    throw new ControllerError("WORKOUT_NOT_FOUND", "Workout not found");
  }
  if (workout.status !== "Active") {
    throw new ControllerError(
      "WORKOUT_ENDED",
      "Ended workouts do not have a controller"
    );
  }
  return workout;
};

const requireEpoch = (
  workout: ControllerWorkout,
  controllerEpoch: number
) => {
  if (workout.controllerEpoch !== controllerEpoch) {
    throw new ControllerError(
      "STALE_CONTROLLER",
      "The Controlling device changed"
    );
  }
};

const requireOwnedDevice = async (
  tx: ControllerTransaction,
  userId: string,
  deviceId: string
) => {
  if (!(await tx.userOwnsDevice({ userId, deviceId }))) {
    throw new ControllerError(
      "DEVICE_NOT_FOUND",
      "The target device is not registered"
    );
  }
};

const saveNewController = async ({
  tx,
  workout,
  nextDeviceId,
  hooks,
  now,
}: {
  tx: ControllerTransaction;
  workout: ControllerWorkout;
  nextDeviceId: string;
  hooks: ControllerHooks;
  now: Date;
}): Promise<ControllerResult> => {
  if (workout.controllerDeviceId === nextDeviceId) {
    throw new ControllerError(
      "SAME_DEVICE",
      "The target device already controls this workout"
    );
  }
  const next = {
    ...workout,
    controllerDeviceId: nextDeviceId,
    controllerEpoch: workout.controllerEpoch + 1,
    revision: workout.revision + 1,
  };
  await hooks.invalidateRest?.(tx, workout.id, now);
  await tx.saveController(next);
  return {
    sessionId: next.id,
    controllerDeviceId: nextDeviceId,
    controllerEpoch: next.controllerEpoch,
    revision: next.revision,
  };
};

export const handoffController = async ({
  store,
  userId,
  input,
  hooks = {},
  now = new Date(),
}: {
  store: ControllerStore;
  userId: string;
  input: {
    sessionId: string;
    currentDeviceId: string;
    nextDeviceId: string;
    controllerEpoch: number;
    acknowledgedRevision: number;
    pendingOperationCount: number;
  };
  hooks?: ControllerHooks;
  now?: Date;
}): Promise<ControllerResult> =>
  store.transaction(async (tx) => {
    const workout = requireWorkout(
      await tx.lockWorkout({ sessionId: input.sessionId, userId })
    );
    requireEpoch(workout, input.controllerEpoch);
    if (workout.controllerDeviceId !== input.currentDeviceId) {
      throw new ControllerError(
        "STALE_CONTROLLER",
        "Only the Controlling device can hand off"
      );
    }
    if (input.pendingOperationCount !== 0) {
      throw new ControllerError(
        "PENDING_OPERATIONS",
        "Sync pending actions before handoff"
      );
    }
    if (input.acknowledgedRevision !== workout.revision) {
      throw new ControllerError(
        "STALE_REVISION",
        "Refresh the workout before handoff"
      );
    }
    await requireOwnedDevice(tx, userId, input.nextDeviceId);
    return saveNewController({
      tx,
      workout,
      nextDeviceId: input.nextDeviceId,
      hooks,
      now,
    });
  });

export const replaceLostController = async ({
  store,
  userId,
  input,
  hooks = {},
  now = new Date(),
}: {
  store: ControllerStore;
  userId: string;
  input: {
    sessionId: string;
    nextDeviceId: string;
    controllerEpoch: number;
    confirmUnsyncedDataLoss: boolean;
  };
  hooks?: ControllerHooks;
  now?: Date;
}): Promise<ControllerResult> => {
  if (!input.confirmUnsyncedDataLoss) {
    throw new ControllerError(
      "DATA_LOSS_CONFIRMATION_REQUIRED",
      "Confirm that unsynced work on the lost device will not be recovered"
    );
  }

  return store.transaction(async (tx) => {
    const workout = requireWorkout(
      await tx.lockWorkout({ sessionId: input.sessionId, userId })
    );
    requireEpoch(workout, input.controllerEpoch);
    await requireOwnedDevice(tx, userId, input.nextDeviceId);
    return saveNewController({
      tx,
      workout,
      nextDeviceId: input.nextDeviceId,
      hooks,
      now,
    });
  });
};
