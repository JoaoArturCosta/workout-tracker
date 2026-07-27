import { describe, expect, it, vi } from "vitest";

import {
  createRestAlertDispatcher,
  type RestDispatchRepository,
} from "./dispatch-service";

const currentAlert = {
  restId: "f3d8f90a-cc85-41f2-aaed-b97830f8dbd0",
  sessionId: "e523a2fa-c062-4f82-a9ce-6f6076438395",
  currentSetId: "7678c33e-5316-470e-90bd-ef7c2a6895da",
  dueAt: new Date("2026-07-27T12:00:00.000Z"),
  exerciseLabel: "Bench press",
  setNumber: 2,
  setCount: 3,
  mode: "Reps" as const,
  repsMin: 8,
  repsMax: 10,
  targetSeconds: null,
  subscriptionId: "subscription-1",
  endpoint: "https://push.example/opaque",
  p256dh: "p256dh",
  auth: "auth",
};

describe("rest alert dispatch", () => {
  it("does nothing for stale or duplicate triggers", async () => {
    const repository: RestDispatchRepository = {
      withCurrentAlert: vi.fn().mockResolvedValue(null),
      pruneSubscription: vi.fn(),
    };
    const dispatcher = createRestAlertDispatcher({
      repository,
      send: vi.fn(),
    });

    await expect(
      dispatcher.dispatch({
        restId: currentAlert.restId,
        token: "rest-token",
        now: new Date("2026-07-27T12:00:01.000Z"),
      })
    ).resolves.toEqual({ status: "stale" });
  });

  it("sends only the display data captured by the current rest record", async () => {
    const repository: RestDispatchRepository = {
      withCurrentAlert: vi.fn(async (_input, send) => send(currentAlert)),
      pruneSubscription: vi.fn(),
    };
    const send = vi.fn().mockResolvedValue({
      status: "accepted",
      providerStatus: 201,
    });
    const dispatcher = createRestAlertDispatcher({ repository, send });

    await expect(
      dispatcher.dispatch({
        restId: currentAlert.restId,
        token: "rest-token",
        now: new Date("2026-07-27T12:00:01.000Z"),
      })
    ).resolves.toEqual({ status: "sent" });

    const payload = send.mock.calls[0][1];
    expect(payload).toMatchObject({
      kind: "rest-finished",
      exerciseLabel: "Bench press",
      setPosition: "Set 2 of 3",
      target: { mode: "Reps", repsMin: 8, repsMax: 10 },
    });
    expect(JSON.stringify(payload)).not.toMatch(/load|weight|rpe/i);
  });
});
