import { describe, expect, it } from "vitest";

import {
  WorkoutCommandError,
  executeWorkoutCommand,
  type CommandWorkout,
  type StoredCommandReceipt,
  type WorkoutCommandStore,
  type WorkoutCommandTransaction,
} from "./command-service";

const workout = (): CommandWorkout => ({
  id: "workout-1",
  userId: "user-1",
  status: "Active",
  revision: 0,
  controllerDeviceId: "device-1",
  controllerEpoch: 2,
  startTime: new Date("2026-07-27T10:00:00.000Z"),
  endTime: null,
  durationMinutes: null,
  sets: [
    {
      id: "set-1",
      exerciseOccurrenceId: "occ-1",
      mode: "Reps",
      status: "Pending",
      completedAt: null,
      result: null,
    },
    {
      id: "set-2",
      exerciseOccurrenceId: "occ-1",
      mode: "Reps",
      status: "Pending",
      completedAt: null,
      result: null,
    },
  ],
});

class MemoryStore implements WorkoutCommandStore {
  receipts = new Map<string, StoredCommandReceipt>();

  constructor(public workout: CommandWorkout) {}

  transaction<T>(
    run: (tx: WorkoutCommandTransaction) => Promise<T>
  ): Promise<T> {
    return run({
      findReceipt: async ({ operationId, sessionId, userId }) =>
        this.receipts.get(`${userId}:${sessionId}:${operationId}`) ?? null,
      lockWorkout: async ({ sessionId, userId }) =>
        this.workout.id === sessionId && this.workout.userId === userId
          ? structuredClone(this.workout)
          : null,
      saveWorkout: async (next) => {
        this.workout = structuredClone(next);
      },
      saveReceipt: async ({
        operationId,
        result,
        postCommitEffect,
        sessionId,
        userId,
      }) => {
        this.receipts.set(
          `${userId}:${sessionId}:${operationId}`,
          structuredClone({ result, postCommitEffect })
        );
      },
      cancelScheduledRest: async () => undefined,
      scheduleRest: async () => null,
    });
  }
}

const envelope = {
  operationId: "11111111-1111-4111-8111-111111111111",
  sessionId: "workout-1",
  deviceId: "device-1",
  controllerEpoch: 2,
  expectedRevision: 0,
  command: {
    type: "CompleteSet" as const,
    sessionSetId: "set-1",
    result: {
      mode: "Reps" as const,
      externalLoadKg: 20,
      actualReps: 8,
      actualSeconds: null,
      rpe: null,
    },
  },
};

describe("executeWorkoutCommand", () => {
  it("applies one guarded command and increments revision once", async () => {
    const store = new MemoryStore(workout());

    const response = await executeWorkoutCommand({
      store,
      userId: "user-1",
      envelope,
      now: new Date("2026-07-27T12:00:00.000Z"),
    });

    expect(response.replayed).toBe(false);
    expect(response.result.revision).toBe(1);
    expect(response.result.sets[0]).toEqual({
      id: "set-1",
      exerciseOccurrenceId: "occ-1",
      mode: "Reps",
      status: "Completed",
      completedAt: new Date("2026-07-27T12:00:00.000Z"),
      result: envelope.command.result,
    });
  });

  it("discards the workout and marks every pending set as skipped", async () => {
    const current = workout();
    current.sets[0] = {
      ...current.sets[0],
      status: "Completed",
      completedAt: new Date("2026-07-27T11:00:00.000Z"),
      result: envelope.command.result,
    };
    const store = new MemoryStore(current);

    const response = await executeWorkoutCommand({
      store,
      userId: "user-1",
      envelope: {
        ...envelope,
        command: { type: "Discard" },
      },
      now: new Date("2026-07-27T12:00:00.000Z"),
    });

    expect(response.result.status).toBe("Discarded");
    expect(response.result.sets.map((set) => set.status)).toEqual([
      "Completed",
      "Skipped",
    ]);
    expect(response.result.sets[1].completedAt).toBeNull();
    expect(store.workout.endTime).toEqual(new Date("2026-07-27T12:00:00.000Z"));
  });

  it("returns the stored result when an operation ID is replayed", async () => {
    const store = new MemoryStore(workout());
    const first = await executeWorkoutCommand({
      store,
      userId: "user-1",
      envelope,
      now: new Date("2026-07-27T12:00:00.000Z"),
    });

    const replay = await executeWorkoutCommand({
      store,
      userId: "user-1",
      envelope,
      now: new Date("2026-07-27T13:00:00.000Z"),
    });

    expect(replay).toEqual({ ...first, replayed: true });
    expect(store.workout.revision).toBe(1);
  });

  it.each([
    {
      name: "revision",
      change: { expectedRevision: 9 },
      code: "STALE_REVISION",
    },
    {
      name: "controller epoch",
      change: { controllerEpoch: 1 },
      code: "STALE_CONTROLLER",
    },
    {
      name: "controller device",
      change: { deviceId: "device-2" },
      code: "STALE_CONTROLLER",
    },
  ] as const)("rejects a stale $name with a stable code", async (testCase) => {
    const store = new MemoryStore(workout());

    await expect(
      executeWorkoutCommand({
        store,
        userId: "user-1",
        envelope: { ...envelope, ...testCase.change },
      })
    ).rejects.toEqual(
      expect.objectContaining<Partial<WorkoutCommandError>>({
        code: testCase.code,
      })
    );
    expect(store.workout.revision).toBe(0);
  });

  it("edits a completed set without changing set order or completion time", async () => {
    const current = workout();
    current.sets[0] = {
      id: "set-1",
      exerciseOccurrenceId: "occ-1",
      mode: "Reps",
      status: "Completed",
      completedAt: new Date("2026-07-27T11:00:00.000Z"),
      result: envelope.command.result,
    };
    const store = new MemoryStore(current);

    const response = await executeWorkoutCommand({
      store,
      userId: "user-1",
      envelope: {
        ...envelope,
        command: {
          type: "EditCompletedSet",
          sessionSetId: "set-1",
          result: {
            mode: "Reps",
            externalLoadKg: 22.5,
            actualReps: 9,
            actualSeconds: null,
            rpe: 8,
          },
        },
      },
    });

    expect(response.result.sets[0]).toEqual({
      id: "set-1",
      exerciseOccurrenceId: "occ-1",
      mode: "Reps",
      status: "Completed",
      completedAt: new Date("2026-07-27T11:00:00.000Z"),
      result: {
        mode: "Reps",
        externalLoadKg: 22.5,
        actualReps: 9,
        actualSeconds: null,
        rpe: 8,
      },
    });
  });

  it("saves an out-of-order pending set without changing the current set", async () => {
    const store = new MemoryStore(workout());
    const result = {
      ...envelope.command.result,
      externalLoadKg: 25,
      actualReps: 10,
    };

    const response = await executeWorkoutCommand({
      store,
      userId: "user-1",
      envelope: {
        ...envelope,
        command: {
          type: "SaveSet",
          sessionSetId: "set-2",
          result,
        },
      },
      now: new Date("2026-07-27T12:00:00.000Z"),
    });

    expect(response.result.status).toBe("Active");
    expect(response.result.sets[0].status).toBe("Pending");
    expect(response.result.sets[1]).toEqual({
      id: "set-2",
      exerciseOccurrenceId: "occ-1",
      mode: "Reps",
      status: "Completed",
      completedAt: new Date("2026-07-27T12:00:00.000Z"),
      result,
    });
  });

  it.each(["Skipped", "Completed"] as const)(
    "saves a %s set and preserves prior completion time when present",
    async (status) => {
      const current = workout();
      const priorCompletedAt =
        status === "Completed"
          ? new Date("2026-07-27T11:00:00.000Z")
          : null;
      current.sets[1] = {
        ...current.sets[1],
        status,
        completedAt: priorCompletedAt,
        result: status === "Completed" ? envelope.command.result : null,
      };
      const store = new MemoryStore(current);
      const result = {
        ...envelope.command.result,
        externalLoadKg: 30,
        actualReps: 11,
      };

      const response = await executeWorkoutCommand({
        store,
        userId: "user-1",
        envelope: {
          ...envelope,
          command: {
            type: "SaveSet",
            sessionSetId: "set-2",
            result,
          },
        },
        now: new Date("2026-07-27T12:00:00.000Z"),
      });

      expect(response.result.sets[1]).toEqual({
        id: "set-2",
        exerciseOccurrenceId: "occ-1",
        mode: "Reps",
        status: "Completed",
        completedAt:
          priorCompletedAt ?? new Date("2026-07-27T12:00:00.000Z"),
        result,
      });
    }
  );

  it("keeps the final pending set on the Finish path", async () => {
    const current = workout();
    current.sets[0] = {
      ...current.sets[0],
      status: "Completed",
      completedAt: new Date("2026-07-27T11:00:00.000Z"),
      result: envelope.command.result,
    };
    const store = new MemoryStore(current);

    await expect(
      executeWorkoutCommand({
        store,
        userId: "user-1",
        envelope: {
          ...envelope,
          command: {
            type: "SaveSet",
            sessionSetId: "set-2",
            result: envelope.command.result,
          },
        },
      })
    ).rejects.toEqual(
      expect.objectContaining({
        code: "INVALID_TRANSITION",
        transitionCode: "FINAL_SET_REQUIRES_FINISH",
      })
    );
    expect(store.workout.revision).toBe(0);
  });

  it("rejects a result whose mode differs from the frozen set mode", async () => {
    const store = new MemoryStore(workout());

    await expect(
      executeWorkoutCommand({
        store,
        userId: "user-1",
        envelope: {
          ...envelope,
          command: {
            type: "CompleteSet",
            sessionSetId: "set-1",
            result: {
              mode: "Duration",
              externalLoadKg: 0,
              actualReps: null,
              actualSeconds: 30,
              rpe: null,
            },
          },
        },
      })
    ).rejects.toEqual(
      expect.objectContaining({
        code: "INVALID_TRANSITION",
        transitionCode: "RESULT_MODE_MISMATCH",
      })
    );
  });

  it("runs stored post-commit work after commit and on replay", async () => {
    const events: string[] = [];
    const store = new MemoryStore(workout());
    const originalTransaction = store.transaction.bind(store);
    store.transaction = async (run) => {
      const result = await originalTransaction(run);
      events.push("commit");
      return result;
    };

    const request = {
      store,
      userId: "user-1",
      envelope,
      hooks: {
        afterTransition: async () => {
          events.push("transition");
          return { restId: "rest-1" };
        },
        afterCommit: async () => {
          events.push("after-commit");
        },
      },
    };
    await executeWorkoutCommand(request);
    await executeWorkoutCommand(request);

    expect(events).toEqual([
      "transition",
      "commit",
      "after-commit",
      "commit",
      "after-commit",
    ]);
  });
});
