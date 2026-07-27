import {
  buildRestAlertPayload,
  type PushSendResult,
  type PushSubscription,
} from "./web-push";
import type { RestAlertPayload } from "./contracts";

export interface CurrentRestAlert {
  restId: string;
  sessionId: string;
  currentSetId: string;
  dueAt: Date;
  exerciseLabel: string;
  setNumber: number;
  setCount: number;
  mode: "Reps" | "Duration";
  repsMin: number | null;
  repsMax: number | null;
  targetSeconds: number | null;
  subscriptionId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface RestDispatchRepository {
  withCurrentAlert(
    input: { restId: string; token: string; now: Date },
    send: (alert: CurrentRestAlert) => Promise<PushSendResult>
  ): Promise<PushSendResult | null>;
  pruneSubscription(subscriptionId: string, now: Date): Promise<void>;
}

interface DispatchDependencies {
  repository: RestDispatchRepository;
  send(
    subscription: PushSubscription,
    payload: RestAlertPayload
  ): Promise<PushSendResult>;
}

export function createRestAlertDispatcher(
  dependencies: DispatchDependencies
) {
  return {
    async dispatch(input: {
      restId: string;
      token: string;
      now?: Date;
    }): Promise<{ status: "stale" | "sent" | "expired" | "rejected" }> {
      const now = input.now ?? new Date();
      const result = await dependencies.repository.withCurrentAlert(
        { ...input, now },
        async (alert) => {
          const payload = buildRestAlertPayload({
            alertId: alert.restId,
            sessionId: alert.sessionId,
            currentSetId: alert.currentSetId,
            dueAt: alert.dueAt,
            exerciseLabel: alert.exerciseLabel,
            setNumber: alert.setNumber,
            setCount: alert.setCount,
            mode: alert.mode,
            ...(alert.mode === "Reps"
              ? {
                  repsMin: alert.repsMin ?? undefined,
                  repsMax: alert.repsMax ?? undefined,
                }
              : { targetSeconds: alert.targetSeconds ?? undefined }),
          });
          const sendResult = await dependencies.send(
            {
              endpoint: alert.endpoint,
              p256dh: alert.p256dh,
              auth: alert.auth,
            },
            payload
          );
          if (sendResult.status === "expired") {
            await dependencies.repository.pruneSubscription(
              alert.subscriptionId,
              now
            );
          }
          return sendResult;
        }
      );

      if (!result) {
        return { status: "stale" };
      }
      if (result.status === "accepted") {
        return { status: "sent" };
      }
      return { status: result.status };
    },
  };
}
