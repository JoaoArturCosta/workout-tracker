import { describe, expect, it, vi } from "vitest";

import {
  createSubscriptionService,
  type SubscriptionRepository,
} from "./subscriptions";

describe("push subscriptions", () => {
  it("replaces device subscriptions without returning secrets", async () => {
    const repository: SubscriptionRepository = {
      replace: vi.fn().mockResolvedValue({
        id: "subscription-1",
        ready: false,
      }),
      revokeOwned: vi.fn(),
      revoke: vi.fn(),
      getStatus: vi.fn(),
    };
    const service = createSubscriptionService(repository);

    const result = await service.replace({
      userId: "user-1",
      deviceId: "device-1",
      endpoint: "https://push.example/opaque",
      p256dh: "private-client-key",
      auth: "private-auth-secret",
      installed: true,
      workerVersion: "worker-v1",
    });

    expect(result).toEqual({
      subscriptionId: "subscription-1",
      backgroundAlertReady: false,
    });
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it("revokes expired subscriptions and their readiness", async () => {
    const repository: SubscriptionRepository = {
      replace: vi.fn(),
      revokeOwned: vi.fn(),
      revoke: vi.fn().mockResolvedValue(true),
      getStatus: vi.fn(),
    };
    const service = createSubscriptionService(repository);

    await expect(
      service.pruneExpired("subscription-1", new Date("2026-07-27T12:00:00Z"))
    ).resolves.toBe(true);
    expect(repository.revoke).toHaveBeenCalledWith(
      "subscription-1",
      new Date("2026-07-27T12:00:00Z")
    );
  });
});
