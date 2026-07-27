import { describe, expect, it, vi } from "vitest";

import {
  createReadinessService,
  type ReadinessRepository,
} from "./readiness-service";

function createRepository(): ReadinessRepository {
  return {
    createAttempt: vi.fn().mockResolvedValue(undefined),
    markDispatched: vi.fn().mockResolvedValue(true),
    acceptPresentationAck: vi.fn().mockResolvedValue(true),
    failAttempt: vi.fn().mockResolvedValue(undefined),
    getAttemptStatus: vi.fn().mockResolvedValue("Pending"),
  };
}

describe("push readiness", () => {
  it("marks readiness only after the matching show ACK within 15 seconds", async () => {
    const repository = createRepository();
    const sendTestPush = vi.fn().mockResolvedValue({ status: "accepted" });
    const service = createReadinessService({
      repository,
      sendTestPush,
      createNonce: () => "ready-random-nonce-123456",
      createId: () => "f3d8f90a-cc85-41f2-aaed-b97830f8dbd0",
    });
    const startedAt = new Date("2026-07-27T12:00:00.000Z");

    const attempt = await service.start({
      userId: "user-1",
      deviceId: "device-1",
      subscriptionId: "subscription-1",
      now: startedAt,
    });
    const accepted = await service.acknowledge({
      alertId: attempt.id,
      nonce: attempt.nonce,
      occurredAt: new Date("2026-07-27T12:00:14.999Z"),
    });

    expect(attempt.expiresAt.toISOString()).toBe(
      "2026-07-27T12:00:15.000Z"
    );
    expect(repository.createAttempt).toHaveBeenCalledOnce();
    expect(repository.markDispatched).toHaveBeenCalledWith(
      attempt.id,
      startedAt,
      new Date("2026-07-27T12:00:15.000Z")
    );
    expect(accepted).toBe(true);
  });

  it("fails closed when provider acceptance fails", async () => {
    const repository = createRepository();
    const service = createReadinessService({
      repository,
      sendTestPush: vi.fn().mockResolvedValue({ status: "rejected" }),
      createNonce: () => "ready-random-nonce-123456",
      createId: () => "f3d8f90a-cc85-41f2-aaed-b97830f8dbd0",
    });

    await expect(
      service.start({
        userId: "user-1",
        deviceId: "device-1",
        subscriptionId: "subscription-1",
        now: new Date("2026-07-27T12:00:00.000Z"),
      })
    ).resolves.toMatchObject({ status: "Failed" });
    expect(repository.failAttempt).toHaveBeenCalledWith(
      "f3d8f90a-cc85-41f2-aaed-b97830f8dbd0",
      "PushRejected"
    );
  });
});
