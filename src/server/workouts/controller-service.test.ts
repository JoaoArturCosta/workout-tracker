import { describe, expect, it } from "vitest";

import {
  ControllerError,
  handoffController,
  replaceLostController,
  type ControllerStore,
  type ControllerTransaction,
  type ControllerWorkout,
} from "./controller-service";

class MemoryControllerStore implements ControllerStore {
  constructor(
    public workout: ControllerWorkout,
    readonly deviceIds = new Set(["device-1", "device-2"])
  ) {}

  transaction<T>(run: (tx: ControllerTransaction) => Promise<T>): Promise<T> {
    return run({
      lockWorkout: async ({ sessionId, userId }) =>
        sessionId === this.workout.id && userId === this.workout.userId
          ? { ...this.workout }
          : null,
      userOwnsDevice: async ({ deviceId }) => this.deviceIds.has(deviceId),
      saveController: async (workout) => {
        this.workout = { ...workout };
      },
      cancelScheduledRest: async () => undefined,
    });
  }
}

const workout = (): ControllerWorkout => ({
  id: "session-1",
  userId: "user-1",
  status: "Active",
  revision: 3,
  controllerEpoch: 4,
  controllerDeviceId: "device-1",
});

describe("controller service", () => {
  it("hands off after the current device has no pending actions", async () => {
    const store = new MemoryControllerStore(workout());

    const result = await handoffController({
      store,
      userId: "user-1",
      input: {
        sessionId: "session-1",
        currentDeviceId: "device-1",
        nextDeviceId: "device-2",
        controllerEpoch: 4,
        acknowledgedRevision: 3,
        pendingOperationCount: 0,
      },
    });

    expect(result).toEqual({
      sessionId: "session-1",
      controllerDeviceId: "device-2",
      controllerEpoch: 5,
      revision: 4,
    });
  });

  it.each([
    {
      name: "pending actions",
      change: { pendingOperationCount: 1 },
      code: "PENDING_OPERATIONS",
    },
    {
      name: "unacknowledged server state",
      change: { acknowledgedRevision: 2 },
      code: "STALE_REVISION",
    },
    {
      name: "old controller",
      change: { currentDeviceId: "device-2" },
      code: "STALE_CONTROLLER",
    },
  ] as const)("blocks handoff with $name", async ({ change, code }) => {
    const store = new MemoryControllerStore(workout());

    await expect(
      handoffController({
        store,
        userId: "user-1",
        input: {
          sessionId: "session-1",
          currentDeviceId: "device-1",
          nextDeviceId: "device-2",
          controllerEpoch: 4,
          acknowledgedRevision: 3,
          pendingOperationCount: 0,
          ...change,
        },
      })
    ).rejects.toEqual(expect.objectContaining({ code }));
  });

  it("replaces a lost controller without its outbox or acknowledgement", async () => {
    const store = new MemoryControllerStore(workout());
    const invalidated: string[] = [];

    const result = await replaceLostController({
      store,
      userId: "user-1",
      input: {
        sessionId: "session-1",
        nextDeviceId: "device-2",
        controllerEpoch: 4,
        confirmUnsyncedDataLoss: true,
      },
      hooks: {
        invalidateRest: async (_tx, sessionId) => {
          invalidated.push(sessionId);
        },
      },
    });

    expect(result.controllerEpoch).toBe(5);
    expect(result.controllerDeviceId).toBe("device-2");
    expect(invalidated).toEqual(["session-1"]);
  });

  it("requires the explicit lost-data confirmation", async () => {
    const store = new MemoryControllerStore(workout());

    await expect(
      replaceLostController({
        store,
        userId: "user-1",
        input: {
          sessionId: "session-1",
          nextDeviceId: "device-2",
          controllerEpoch: 4,
          confirmUnsyncedDataLoss: false,
        },
      })
    ).rejects.toBeInstanceOf(ControllerError);
  });

  it("rejects another replacement with the old controller epoch", async () => {
    const store = new MemoryControllerStore(workout());

    await replaceLostController({
      store,
      userId: "user-1",
      input: {
        sessionId: "session-1",
        nextDeviceId: "device-2",
        controllerEpoch: 4,
        confirmUnsyncedDataLoss: true,
      },
    });

    await expect(
      replaceLostController({
        store,
        userId: "user-1",
        input: {
          sessionId: "session-1",
          nextDeviceId: "device-1",
          controllerEpoch: 4,
          confirmUnsyncedDataLoss: true,
        },
      })
    ).rejects.toEqual(
      expect.objectContaining({ code: "STALE_CONTROLLER" })
    );
  });
});
