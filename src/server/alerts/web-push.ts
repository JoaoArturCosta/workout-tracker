import type {
  RequestOptions,
  SendResult,
  PushSubscription as WebPushSubscription,
} from "web-push";

import {
  pushPayloadSchema,
  restAlertPayloadSchema,
  type PushPayload,
  type RestAlertPayload,
} from "./contracts";

export interface PushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushTransport {
  sendNotification(
    subscription: WebPushSubscription,
    payload: string,
    options: RequestOptions
  ): Promise<SendResult>;
}

export interface VapidConfig {
  subject: string;
  publicKey: string;
  privateKey: string;
}

export type PushSendResult =
  | { status: "accepted"; providerStatus: number }
  | { status: "expired"; providerStatus: 404 | 410 }
  | { status: "rejected"; providerStatus?: number };

interface RestDisplayInput {
  alertId: string;
  sessionId: string;
  currentSetId: string;
  dueAt: Date;
  exerciseLabel: string;
  setNumber: number;
  setCount: number;
  mode: "Reps" | "Duration";
  repsMin?: number;
  repsMax?: number;
  targetSeconds?: number;
}

export function buildRestAlertPayload(
  input: RestDisplayInput
): RestAlertPayload {
  const target =
    input.mode === "Reps"
      ? {
          mode: "Reps" as const,
          repsMin: input.repsMin,
          repsMax: input.repsMax,
        }
      : {
          mode: "Duration" as const,
          targetSeconds: input.targetSeconds,
        };

  return restAlertPayloadSchema.parse({
    version: 1,
    kind: "rest-finished",
    alertId: input.alertId,
    sessionId: input.sessionId,
    currentSetId: input.currentSetId,
    dueAt: input.dueAt.toISOString(),
    deepLink: `/sessions/${input.sessionId}?set=${input.currentSetId}`,
    exerciseLabel: input.exerciseLabel,
    setPosition: `Set ${input.setNumber} of ${input.setCount}`,
    target,
  });
}

export function createWebPushSender(
  transport: PushTransport,
  vapid: VapidConfig
) {
  return {
    async send(
      subscription: PushSubscription,
      unsafePayload: PushPayload
    ): Promise<PushSendResult> {
      const payload = pushPayloadSchema.parse(unsafePayload);

      try {
        const response = await transport.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          JSON.stringify(payload),
          {
            TTL: 60,
            urgency: "high",
            topic: `${payload.kind === "rest-finished" ? "rest" : "ready"}-${payload.alertId.slice(0, 20)}`,
            vapidDetails: vapid,
          }
        );

        return {
          status: "accepted",
          providerStatus: response.statusCode,
        };
      } catch (error) {
        const providerStatus = readStatusCode(error);
        if (providerStatus === 404 || providerStatus === 410) {
          return { status: "expired", providerStatus };
        }
        return {
          status: "rejected",
          ...(providerStatus === undefined ? {} : { providerStatus }),
        };
      }
    },
  };
}

function readStatusCode(error: unknown): number | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  ) {
    return error.statusCode;
  }
  return undefined;
}
