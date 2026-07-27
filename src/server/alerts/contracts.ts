import { z } from "zod";

const appDeepLinkSchema = z
  .string()
  .max(500)
  .regex(/^\/(?!\/)/, "Push deep links must stay within this app");

const repsTargetSchema = z
  .object({
    mode: z.literal("Reps"),
    repsMin: z.number().int().min(1).max(100),
    repsMax: z.number().int().min(1).max(100),
  })
  .strict()
  .refine(({ repsMin, repsMax }) => repsMin <= repsMax, {
    message: "Minimum reps cannot exceed maximum reps",
  });

const durationTargetSchema = z
  .object({
    mode: z.literal("Duration"),
    targetSeconds: z.number().int().min(1).max(3600),
  })
  .strict();

export const restAlertPayloadSchema = z
  .object({
    version: z.literal(1),
    kind: z.literal("rest-finished"),
    alertId: z.string().uuid(),
    sessionId: z.string().uuid(),
    currentSetId: z.string().uuid(),
    dueAt: z.string().datetime(),
    deepLink: appDeepLinkSchema,
    exerciseLabel: z.string().trim().min(1).max(100),
    setPosition: z.string().trim().min(1).max(40),
    target: z.union([repsTargetSchema, durationTargetSchema]),
  })
  .strict();

export const readinessPushPayloadSchema = z
  .object({
    version: z.literal(1),
    kind: z.literal("readiness-test"),
    alertId: z.string().uuid(),
    attemptNonce: z.string().min(16).max(200),
    deepLink: appDeepLinkSchema,
  })
  .strict();

export const pushPayloadSchema = z.discriminatedUnion("kind", [
  restAlertPayloadSchema,
  readinessPushPayloadSchema,
]);

export const pushAckSchema = z
  .object({
    alertId: z.string().uuid(),
    attemptNonce: z.string().min(16).max(200).optional(),
    event: z.enum([
      "WorkerReceived",
      "ShowResolved",
      "ShowFailed",
      "Tap",
    ]),
    occurredAt: z.string().datetime(),
  })
  .strict();

export type RestAlertPayload = z.infer<typeof restAlertPayloadSchema>;
export type ReadinessPushPayload = z.infer<
  typeof readinessPushPayloadSchema
>;
export type PushPayload = z.infer<typeof pushPayloadSchema>;
export type PushAck = z.infer<typeof pushAckSchema>;
