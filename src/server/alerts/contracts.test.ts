import { describe, expect, it } from "vitest";

import {
  pushAckSchema,
  pushPayloadSchema,
  restAlertPayloadSchema,
} from "./contracts";

describe("push alert contracts", () => {
  it("accepts a privacy-safe rest alert", () => {
    const payload = {
      version: 1,
      kind: "rest-finished",
      alertId: "f3d8f90a-cc85-41f2-aaed-b97830f8dbd0",
      sessionId: "e523a2fa-c062-4f82-a9ce-6f6076438395",
      currentSetId: "7678c33e-5316-470e-90bd-ef7c2a6895da",
      dueAt: "2026-07-27T12:00:00.000Z",
      deepLink:
        "/sessions/e523a2fa-c062-4f82-a9ce-6f6076438395?set=7678c33e-5316-470e-90bd-ef7c2a6895da",
      exerciseLabel: "Bench press",
      setPosition: "Set 2 of 3",
      target: { mode: "Reps", repsMin: 8, repsMax: 10 },
    };

    expect(restAlertPayloadSchema.parse(payload)).toEqual(payload);
    expect(pushPayloadSchema.parse(payload)).toEqual(payload);
  });

  it("rejects private workout values and off-site links", () => {
    const base = {
      version: 1,
      kind: "rest-finished",
      alertId: "f3d8f90a-cc85-41f2-aaed-b97830f8dbd0",
      sessionId: "e523a2fa-c062-4f82-a9ce-6f6076438395",
      currentSetId: "7678c33e-5316-470e-90bd-ef7c2a6895da",
      dueAt: "2026-07-27T12:00:00.000Z",
      exerciseLabel: "Bench press",
      setPosition: "Set 2 of 3",
      target: { mode: "Duration", targetSeconds: 45 },
    };

    expect(() =>
      restAlertPayloadSchema.parse({
        ...base,
        deepLink: "https://attacker.example/steal",
        load: 100,
        rpe: 9,
      })
    ).toThrow();
  });

  it("accepts one-time presentation and tap ACKs", () => {
    expect(
      pushAckSchema.parse({
        alertId: "f3d8f90a-cc85-41f2-aaed-b97830f8dbd0",
        attemptNonce: "ready-random-nonce-123456",
        event: "ShowResolved",
        occurredAt: "2026-07-27T12:00:01.000Z",
      })
    ).toEqual({
      alertId: "f3d8f90a-cc85-41f2-aaed-b97830f8dbd0",
      attemptNonce: "ready-random-nonce-123456",
      event: "ShowResolved",
      occurredAt: "2026-07-27T12:00:01.000Z",
    });
  });
});
