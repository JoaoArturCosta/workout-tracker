import { describe, expect, it, vi } from "vitest";

import {
  createRestAlertCommandHooks,
  restAlertControllerHooks,
  type AlertWorkoutTransaction,
} from "./rest-hooks";
import type {
  CommandWorkout,
  WorkoutCommandHookContext,
} from "@/server/workouts/command-service";

const before: CommandWorkout = {
  id: "session-1",
  userId: "user-1",
  status: "Active",
  revision: 2,
  controllerDeviceId: "device-1",
  controllerEpoch: 1,
  startTime: new Date("2026-07-27T11:00:00Z"),
  endTime: null,
  durationMinutes: null,
  sets: [
    {
      id: "set-1",
      mode: "Reps",
      status: "Pending",
      completedAt: null,
      result: null,
    },
    {
      id: "set-2",
      mode: "Reps",
      status: "Pending",
      completedAt: null,
      result: null,
    },
  ],
};

function context(
  command: WorkoutCommandHookContext["command"],
  after = before
): WorkoutCommandHookContext {
  return {
    before,
    after,
    command,
    envelope: {
      operationId: "2ed6289b-7aad-479b-84e3-f8f9b3fc063b",
      sessionId: "220011b7-6a4f-42fa-bb28-abda47f42258",
      deviceId: "49e69318-31d0-42bd-96f7-b767710065c2",
      controllerEpoch: 1,
      expectedRevision: 2,
      command,
    },
    now: new Date("2026-07-27T12:00:00Z"),
  };
}

describe("rest alert workout hooks", () => {
  it("replaces rest after a non-final completion and publishes after commit", async () => {
    const tx = {
      cancelScheduledRest: vi.fn().mockResolvedValue(undefined),
      scheduleRest: vi.fn().mockResolvedValue({
        restId: "df4d3631-a503-457d-88b1-08ec772ebf30",
        token: "8f75a333-d22e-41f0-afb5-00f2069cbe24",
        dueAt: new Date("2026-07-27T12:02:00Z"),
      }),
    } as unknown as AlertWorkoutTransaction;
    const publish = vi.fn().mockResolvedValue({ messageId: "msg-1" });
    const recordMessageId = vi.fn().mockResolvedValue(undefined);
    const hooks = createRestAlertCommandHooks({
      publish,
      recordMessageId,
    });
    const command = {
      type: "CompleteSet" as const,
      sessionSetId: "773e938e-1bb8-4f06-b222-d77eda3dc42f",
      result: {
        mode: "Reps" as const,
        actualReps: 10,
        actualSeconds: null,
        externalLoadKg: 20,
        rpe: null,
      },
    };

    const effect = await hooks.afterTransition?.(
      tx,
      context(command, {
        ...before,
        sets: [
          {
            id: command.sessionSetId,
            mode: "Reps",
            status: "Completed",
            completedAt: new Date("2026-07-27T12:00:00Z"),
            result: command.result,
          },
          before.sets[1],
        ],
      })
    );
    await hooks.afterCommit?.(effect);

    expect(tx.cancelScheduledRest).toHaveBeenCalledOnce();
    expect(tx.scheduleRest).toHaveBeenCalledWith({
      sessionId: before.id,
      completedSetId: command.sessionSetId,
      currentSetId: before.sets[1].id,
      controllerEpoch: before.controllerEpoch,
      now: new Date("2026-07-27T12:00:00Z"),
    });
    expect(publish).toHaveBeenCalledOnce();
    expect(recordMessageId).toHaveBeenCalledWith(
      "df4d3631-a503-457d-88b1-08ec772ebf30",
      "8f75a333-d22e-41f0-afb5-00f2069cbe24",
      "msg-1"
    );
  });

  it("invalidates rest when control changes", async () => {
    const tx = {
      cancelScheduledRest: vi.fn().mockResolvedValue(undefined),
    };

    await restAlertControllerHooks.invalidateRest?.(
      tx as never,
      before.id,
      new Date("2026-07-27T12:00:00Z")
    );

    expect(tx.cancelScheduledRest).toHaveBeenCalledOnce();
  });
});
