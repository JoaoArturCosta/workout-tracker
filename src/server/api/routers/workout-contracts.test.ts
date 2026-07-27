import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { createTestContext, createUnauthenticatedTestContext } from "@/test/server-context";
import { deviceRouter } from "./device";
import { sessionRouter } from "./session";
import { templateRouter } from "./template";

describe("workout router contracts", () => {
  it("requires authentication before reading an active workout", async () => {
    const caller = sessionRouter.createCaller(
      createUnauthenticatedTestContext(db)
    );

    await expect(caller.getCurrent()).rejects.toEqual(
      expect.objectContaining<Partial<TRPCError>>({ code: "UNAUTHORIZED" })
    );
  });

  it("rejects a CompleteSet command without its mode result", async () => {
    const caller = sessionRouter.createCaller(createTestContext({ db }));

    await expect(
      caller.command({
        operationId: "11111111-1111-4111-8111-111111111111",
        sessionId: "22222222-2222-4222-8222-222222222222",
        deviceId: "33333333-3333-4333-8333-333333333333",
        controllerEpoch: 1,
        expectedRevision: 0,
        command: {
          type: "CompleteSet",
          sessionSetId: "44444444-4444-4444-8444-444444444444",
          // @ts-expect-error This malformed input proves runtime validation.
          result: undefined,
        },
      })
    ).rejects.toEqual(
      expect.objectContaining<Partial<TRPCError>>({ code: "BAD_REQUEST" })
    );
  });

  it("requires explicit lost-device data-loss confirmation", async () => {
    const caller = deviceRouter.createCaller(createTestContext({ db }));

    await expect(
      caller.replaceLostDevice({
        sessionId: "22222222-2222-4222-8222-222222222222",
        nextDeviceId: "33333333-3333-4333-8333-333333333333",
        controllerEpoch: 1,
        // @ts-expect-error This malformed input proves runtime validation.
        confirmUnsyncedDataLoss: false,
      })
    ).rejects.toEqual(
      expect.objectContaining<Partial<TRPCError>>({ code: "BAD_REQUEST" })
    );
  });

  it("does not expose broad set writes, hard workout deletes, or template deletes", () => {
    expect(sessionRouter._def.procedures).not.toHaveProperty("updateSet");
    expect(sessionRouter._def.procedures).not.toHaveProperty("complete");
    expect(sessionRouter._def.procedures).not.toHaveProperty("cancel");
    expect(templateRouter._def.procedures).not.toHaveProperty("delete");
    expect(templateRouter._def.procedures).toHaveProperty("archive");
    expect(templateRouter._def.procedures).toHaveProperty("restore");
  });

  it("rejects Duration template rows without a duration target", async () => {
    const caller = templateRouter.createCaller(createTestContext({ db }));

    await expect(
      caller.create({
        name: "Conditioning",
        dayNumber: 2,
        exercises: [
          {
            exerciseId: "44444444-4444-4444-8444-444444444444",
            orderIndex: 0,
            sets: 3,
            mode: "Duration",
            repsMin: null,
            repsMax: null,
            targetSeconds: null,
            rpeTarget: null,
            restTimeSeconds: 60,
          },
        ],
      })
    ).rejects.toEqual(
      expect.objectContaining<Partial<TRPCError>>({ code: "BAD_REQUEST" })
    );
  });
});
