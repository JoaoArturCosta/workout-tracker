import {
  and,
  desc,
  eq,
  gte,
  isNull,
  lt,
  lte,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { Database } from "@/lib/db";
import {
  deliveryEvents,
  pushSubscriptions,
  restPeriods,
  sessionExercises,
  sessionSets,
  workoutSessions,
} from "@/lib/db/schema";
import type {
  CurrentRestAlert,
  RestDispatchRepository,
} from "./dispatch-service";

const currentSet = alias(sessionSets, "rest_current_set");
const currentExercise = alias(sessionExercises, "rest_current_exercise");
const MAX_CALLBACK_LATENESS_MS = 60_000;

export function createRestDispatchRepository(
  db: Database
): RestDispatchRepository {
  return {
    async withCurrentAlert(input, send) {
      return db.transaction(async (tx) => {
        const staleBefore = new Date(
          input.now.getTime() - MAX_CALLBACK_LATENESS_MS
        );
        await tx
          .update(restPeriods)
          .set({
            status: "Cancelled",
            cancelledAt: input.now,
            updatedAt: input.now,
          })
          .where(
            and(
              eq(restPeriods.id, input.restId),
              eq(restPeriods.token, input.token),
              eq(restPeriods.status, "Scheduled"),
              lt(restPeriods.dueAt, staleBefore)
            )
          );

        const [alert] = await tx
          .select({
            restId: restPeriods.id,
            sessionId: restPeriods.sessionId,
            currentSetId: restPeriods.currentSetId,
            dueAt: restPeriods.dueAt,
            exerciseLabel: restPeriods.nextExerciseName,
            setNumber: restPeriods.nextSetNumber,
            setCount: restPeriods.nextSetCount,
            mode: restPeriods.nextMode,
            repsMin: restPeriods.nextRepsMin,
            repsMax: restPeriods.nextRepsMax,
            targetSeconds: restPeriods.nextTargetSeconds,
            subscriptionId: pushSubscriptions.id,
            endpoint: pushSubscriptions.endpoint,
            p256dh: pushSubscriptions.p256dh,
            auth: pushSubscriptions.auth,
          })
          .from(restPeriods)
          .innerJoin(
            workoutSessions,
            eq(workoutSessions.id, restPeriods.sessionId)
          )
          .innerJoin(currentSet, eq(currentSet.id, restPeriods.currentSetId))
          .innerJoin(
            currentExercise,
            eq(currentExercise.id, currentSet.sessionExerciseId)
          )
          .innerJoin(
            pushSubscriptions,
            eq(pushSubscriptions.deviceId, workoutSessions.controllerDeviceId)
          )
          .where(
            and(
              eq(restPeriods.id, input.restId),
              eq(restPeriods.token, input.token),
              eq(restPeriods.status, "Scheduled"),
              lte(restPeriods.dueAt, input.now),
              gte(restPeriods.dueAt, staleBefore),
              eq(workoutSessions.status, "Active"),
              eq(
                workoutSessions.controllerEpoch,
                restPeriods.controllerEpoch
              ),
              eq(currentSet.status, "Pending"),
              eq(currentExercise.sessionId, workoutSessions.id),
              eq(pushSubscriptions.installed, true),
              isNull(pushSubscriptions.revokedAt),
              sql`${pushSubscriptions.readinessPassedAt} IS NOT NULL`,
              sql`NOT EXISTS (
                SELECT 1
                FROM ${sessionSets} AS earlier_set
                INNER JOIN ${sessionExercises} AS earlier_exercise
                  ON earlier_exercise.id = earlier_set.session_exercise_id
                WHERE earlier_exercise.session_id = ${workoutSessions.id}
                  AND earlier_set.status = 'Pending'
                  AND (
                    earlier_exercise.order_index < ${currentExercise.orderIndex}
                    OR (
                      earlier_exercise.order_index = ${currentExercise.orderIndex}
                      AND earlier_set.set_number < ${currentSet.setNumber}
                    )
                  )
              )`
            )
          )
          .orderBy(desc(pushSubscriptions.updatedAt))
          .limit(1)
          .for("update", { of: restPeriods });

        if (!isCompleteAlert(alert)) {
          return null;
        }

        await tx.insert(deliveryEvents).values({
          restPeriodId: alert.restId,
          subscriptionId: alert.subscriptionId,
          eventType: "CallbackReceived",
          occurredAt: input.now,
          latencyMs: Math.max(
            0,
            input.now.getTime() - alert.dueAt.getTime()
          ),
        });

        const result = await send(alert);
        await tx.insert(deliveryEvents).values({
          restPeriodId: alert.restId,
          subscriptionId: alert.subscriptionId,
          eventType:
            result.status === "accepted" ? "PushAccepted" : "PushRejected",
          occurredAt: new Date(),
          detail:
            "providerStatus" in result
              ? { providerStatus: result.providerStatus }
              : null,
        });

        if (result.status !== "rejected") {
          await tx
            .update(restPeriods)
            .set({
              status: "Fired",
              firedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(restPeriods.id, input.restId),
                eq(restPeriods.status, "Scheduled"),
                eq(restPeriods.token, input.token)
              )
            );
        }
        return result;
      });
    },

    async pruneSubscription(subscriptionId, now) {
      await db
        .update(pushSubscriptions)
        .set({ revokedAt: now, readinessPassedAt: null, updatedAt: now })
        .where(eq(pushSubscriptions.id, subscriptionId));
    },
  };
}

function isCompleteAlert(
  alert:
    | (Omit<
        CurrentRestAlert,
        "currentSetId" | "exerciseLabel" | "setNumber" | "setCount" | "mode"
      > & {
        currentSetId: string | null;
        exerciseLabel: string | null;
        setNumber: number | null;
        setCount: number | null;
        mode: "Reps" | "Duration" | null;
      })
    | undefined
): alert is CurrentRestAlert {
  return Boolean(
    alert?.currentSetId &&
      alert.exerciseLabel &&
      alert.setNumber &&
      alert.setCount &&
      alert.mode
  );
}
