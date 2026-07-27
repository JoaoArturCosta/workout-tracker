import { and, count, eq, gte, isNull } from "drizzle-orm";

import type { Database } from "@/lib/db";
import {
  deliveryEvents,
  pushSubscriptions,
  readinessAttempts,
  workoutDevices,
} from "@/lib/db/schema";
import type {
  ReadinessAttempt,
  ReadinessRepository,
} from "./readiness-service";

export function createReadinessRepository(
  db: Database
): ReadinessRepository {
  return {
    async createAttempt(attempt: ReadinessAttempt) {
      const [recent] = await db
        .select({ count: count() })
        .from(readinessAttempts)
        .where(
          and(
            eq(readinessAttempts.deviceId, attempt.deviceId),
            gte(
              readinessAttempts.createdAt,
              new Date(attempt.startedAt.getTime() - 60_000)
            )
          )
        );
      if (recent.count >= 3) {
        throw new Error("Too many readiness tests. Wait one minute.");
      }

      const [ownedSubscription] = await db
        .select({ id: pushSubscriptions.id })
        .from(pushSubscriptions)
        .innerJoin(
          workoutDevices,
          eq(pushSubscriptions.deviceId, workoutDevices.id)
        )
        .where(
          and(
            eq(pushSubscriptions.id, attempt.subscriptionId),
            eq(pushSubscriptions.deviceId, attempt.deviceId),
            eq(workoutDevices.userId, attempt.userId),
            isNull(pushSubscriptions.revokedAt)
          )
        )
        .limit(1);
      if (!ownedSubscription) {
        throw new Error("Active push subscription not found");
      }

      await db.insert(readinessAttempts).values({
        id: attempt.id,
        deviceId: attempt.deviceId,
        subscriptionId: attempt.subscriptionId,
        nonce: attempt.nonce,
        status: "Pending",
        expiresAt: attempt.expiresAt,
        createdAt: attempt.startedAt,
      });
    },

    async markDispatched(attemptId, dispatchedAt, expiresAt) {
      const updated = await db
        .update(readinessAttempts)
        .set({ dispatchedAt, expiresAt })
        .where(
          and(
            eq(readinessAttempts.id, attemptId),
            eq(readinessAttempts.status, "Pending")
          )
        )
        .returning({ id: readinessAttempts.id });
      return updated.length === 1;
    },

    async acceptPresentationAck(input) {
      return db.transaction(async (tx) => {
        const [attempt] = await tx
          .select({
            id: readinessAttempts.id,
            subscriptionId: readinessAttempts.subscriptionId,
            nonce: readinessAttempts.nonce,
            status: readinessAttempts.status,
            dispatchedAt: readinessAttempts.dispatchedAt,
            expiresAt: readinessAttempts.expiresAt,
          })
          .from(readinessAttempts)
          .where(eq(readinessAttempts.id, input.attemptId))
          .limit(1);
        if (
          !attempt ||
          attempt.nonce !== input.nonce ||
          attempt.status !== "Pending" ||
          !attempt.dispatchedAt
        ) {
          return false;
        }

        if (
          input.occurredAt.getTime() < attempt.dispatchedAt.getTime() ||
          input.occurredAt.getTime() > attempt.expiresAt.getTime()
        ) {
          if (input.occurredAt.getTime() > attempt.expiresAt.getTime()) {
            await tx
              .update(readinessAttempts)
              .set({ status: "Expired" })
              .where(
                and(
                  eq(readinessAttempts.id, attempt.id),
                  eq(readinessAttempts.status, "Pending")
                )
              );
          }
          return false;
        }

        const passed = await tx
          .update(readinessAttempts)
          .set({ status: "Passed", acknowledgedAt: input.occurredAt })
          .where(
            and(
              eq(readinessAttempts.id, attempt.id),
              eq(readinessAttempts.status, "Pending")
            )
          )
          .returning({ id: readinessAttempts.id });
        if (passed.length !== 1 || !attempt.subscriptionId) {
          return false;
        }

        const readySubscriptions = await tx
          .update(pushSubscriptions)
          .set({
            readinessPassedAt: input.occurredAt,
            updatedAt: input.occurredAt,
          })
          .where(
            and(
              eq(pushSubscriptions.id, attempt.subscriptionId),
              eq(pushSubscriptions.installed, true),
              isNull(pushSubscriptions.revokedAt)
            )
          )
          .returning({ id: pushSubscriptions.id });

        return readySubscriptions.length === 1;
      });
    },

    async failAttempt(attemptId, reason) {
      await db.transaction(async (tx) => {
        const [attempt] = await tx
          .update(readinessAttempts)
          .set({ status: "Failed" })
          .where(
            and(
              eq(readinessAttempts.id, attemptId),
              eq(readinessAttempts.status, "Pending")
            )
          )
          .returning({
            id: readinessAttempts.id,
            subscriptionId: readinessAttempts.subscriptionId,
          });
        if (attempt) {
          await tx.insert(deliveryEvents).values({
            readinessAttemptId: attempt.id,
            subscriptionId: attempt.subscriptionId,
            eventType: "PushRejected",
            detail: { reason },
          });
        }
      });
    },

    async getAttemptStatus(input) {
      const [attempt] = await db
        .select({
          status: readinessAttempts.status,
          expiresAt: readinessAttempts.expiresAt,
        })
        .from(readinessAttempts)
        .innerJoin(
          workoutDevices,
          eq(readinessAttempts.deviceId, workoutDevices.id)
        )
        .where(
          and(
            eq(readinessAttempts.id, input.attemptId),
            eq(workoutDevices.userId, input.userId)
          )
        )
        .limit(1);
      if (!attempt) {
        return null;
      }
      if (
        attempt.status === "Pending" &&
        attempt.expiresAt.getTime() < Date.now()
      ) {
        await db
          .update(readinessAttempts)
          .set({ status: "Expired" })
          .where(
            and(
              eq(readinessAttempts.id, input.attemptId),
              eq(readinessAttempts.status, "Pending")
            )
          );
        return "Failed";
      }
      return attempt.status === "Expired" ? "Failed" : attempt.status;
    },
  };
}
