import { describe, expect, it, vi } from "vitest";

import {
  handleNotificationClick,
  handlePushPayload,
  type WorkerClient,
  type WorkerRuntime,
} from "../../worker";

const restPayload = {
  version: 1 as const,
  kind: "rest-finished" as const,
  alertId: "f3d8f90a-cc85-41f2-aaed-b97830f8dbd0",
  sessionId: "e523a2fa-c062-4f82-a9ce-6f6076438395",
  currentSetId: "7678c33e-5316-470e-90bd-ef7c2a6895da",
  dueAt: "2026-07-27T12:00:00.000Z",
  deepLink:
    "/sessions/e523a2fa-c062-4f82-a9ce-6f6076438395?set=7678c33e-5316-470e-90bd-ef7c2a6895da",
  exerciseLabel: "Bench press",
  setPosition: "Set 2 of 3",
  target: { mode: "Reps" as const, repsMin: 8, repsMax: 10 },
};

describe("push worker", () => {
  it("shows privacy-safe rest content then acknowledges presentation", async () => {
    const runtime: WorkerRuntime = {
      showNotification: vi.fn().mockResolvedValue(undefined),
      postAck: vi.fn().mockResolvedValue(undefined),
      matchClients: vi.fn().mockResolvedValue([]),
      openWindow: vi.fn().mockResolvedValue(undefined),
    };

    await handlePushPayload(restPayload, runtime);

    expect(runtime.showNotification).toHaveBeenCalledWith(
      "Rest finished",
      expect.objectContaining({
        body: "Bench press · Set 2 of 3 · 8–10 reps",
        tag: "rest-f3d8f90a-cc85-41f2-aaed-b97830f8dbd0",
        data: {
          alertId: restPayload.alertId,
          deepLink: restPayload.deepLink,
        },
      })
    );
    expect(runtime.postAck).toHaveBeenCalledWith(
      expect.objectContaining({
        alertId: restPayload.alertId,
        event: "ShowResolved",
      })
    );
  });

  it("focuses an open app window and navigates to the current set", async () => {
    const client: WorkerClient = {
      url: "https://workouts.example/sessions",
      focus: vi.fn().mockResolvedValue(undefined),
      navigate: vi.fn().mockResolvedValue(undefined),
    };
    const runtime: WorkerRuntime = {
      showNotification: vi.fn(),
      postAck: vi.fn().mockResolvedValue(undefined),
      matchClients: vi.fn().mockResolvedValue([client]),
      openWindow: vi.fn(),
    };

    await handleNotificationClick(
      {
        alertId: restPayload.alertId,
        deepLink: restPayload.deepLink,
      },
      runtime
    );

    expect(client.navigate).toHaveBeenCalledWith(restPayload.deepLink);
    expect(client.focus).toHaveBeenCalledOnce();
    expect(runtime.openWindow).not.toHaveBeenCalled();
  });
});
