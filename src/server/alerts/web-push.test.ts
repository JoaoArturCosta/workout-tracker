import { describe, expect, it, vi } from "vitest";

import {
  buildRestAlertPayload,
  createWebPushSender,
  type PushTransport,
} from "./web-push";

describe("Web Push", () => {
  it("sends a short-lived, high-priority, coalesced rest alert", async () => {
    const sendNotification = vi.fn().mockResolvedValue({
      statusCode: 201,
      headers: {},
      body: "",
    });
    const transport: PushTransport = { sendNotification };
    const sender = createWebPushSender(transport, {
      subject: "mailto:alerts@example.com",
      publicKey: "public",
      privateKey: "private",
    });
    const payload = buildRestAlertPayload({
      alertId: "f3d8f90a-cc85-41f2-aaed-b97830f8dbd0",
      sessionId: "e523a2fa-c062-4f82-a9ce-6f6076438395",
      currentSetId: "7678c33e-5316-470e-90bd-ef7c2a6895da",
      dueAt: new Date("2026-07-27T12:00:00.000Z"),
      exerciseLabel: "Bench press",
      setNumber: 2,
      setCount: 3,
      mode: "Reps",
      repsMin: 8,
      repsMax: 10,
    });

    const result = await sender.send(
      {
        endpoint: "https://push.example/subscription",
        p256dh: "p256dh",
        auth: "auth",
      },
      payload
    );

    expect(result).toEqual({ status: "accepted", providerStatus: 201 });
    expect(sendNotification).toHaveBeenCalledOnce();
    const [, encodedPayload, options] = sendNotification.mock.calls[0];
    expect(JSON.parse(encodedPayload)).toEqual(payload);
    expect(options).toMatchObject({
      TTL: 60,
      urgency: "high",
      topic: "rest-f3d8f90a-cc85-41f2-a",
      vapidDetails: {
        subject: "mailto:alerts@example.com",
        publicKey: "public",
        privateKey: "private",
      },
    });
  });

  it.each([404, 410])(
    "marks a subscription expired on push status %s",
    async (statusCode) => {
      const transport: PushTransport = {
        sendNotification: vi.fn().mockRejectedValue({ statusCode }),
      };
      const sender = createWebPushSender(transport, {
        subject: "mailto:alerts@example.com",
        publicKey: "public",
        privateKey: "private",
      });

      await expect(
        sender.send(
          {
            endpoint: "https://push.example/subscription",
            p256dh: "p256dh",
            auth: "auth",
          },
          {
            version: 1,
            kind: "readiness-test",
            alertId: "f3d8f90a-cc85-41f2-aaed-b97830f8dbd0",
            attemptNonce: "ready-random-nonce-123456",
            deepLink: "/sessions",
          }
        )
      ).resolves.toEqual({ status: "expired", providerStatus: statusCode });
    }
  );
});
