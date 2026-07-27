import { and, desc, eq, isNull, ne } from "drizzle-orm";

import type { Database } from "@/lib/db";
import {
  pushSubscriptions,
  readinessAttempts,
  workoutDevices,
} from "@/lib/db/schema";
import type {
  ReplaceSubscriptionInput,
  SubscriptionRepository,
} from "./subscriptions";

export function createSubscriptionRepository(
  db: Database
): SubscriptionRepository {
  return {
    async replace(input: ReplaceSubscriptionInput) {
      return db.transaction(async (tx) => {
        const [device] = await tx
          .select({ id: workoutDevices.id })
          .from(workoutDevices)
          .where(
            and(
              eq(workoutDevices.userId, input.userId),
              eq(workoutDevices.deviceId, input.deviceId)
            )
          )
          .limit(1);
        if (!device) {
          throw new Error("Device not found");
        }

        const [sameEndpoint] = await tx
          .select()
          .from(pushSubscriptions)
          .where(eq(pushSubscriptions.endpoint, input.endpoint))
          .limit(1);
        if (sameEndpoint && sameEndpoint.deviceId !== device.id) {
          throw new Error("Push endpoint belongs to another device");
        }

        const now = new Date();
        await tx
          .update(readinessAttempts)
          .set({ status: "Failed" })
          .where(
            and(
              eq(readinessAttempts.deviceId, device.id),
              eq(readinessAttempts.status, "Pending")
            )
          );
        await tx
          .update(pushSubscriptions)
          .set({ revokedAt: now, readinessPassedAt: null, updatedAt: now })
          .where(
            and(
              eq(pushSubscriptions.deviceId, device.id),
              isNull(pushSubscriptions.revokedAt),
              ...(sameEndpoint
                ? [ne(pushSubscriptions.id, sameEndpoint.id)]
                : [])
            )
          );

        if (sameEndpoint) {
          const stateChanged =
            sameEndpoint.p256dh !== input.p256dh ||
            sameEndpoint.auth !== input.auth ||
            sameEndpoint.workerVersion !== input.workerVersion ||
            sameEndpoint.installed !== input.installed ||
            sameEndpoint.revokedAt !== null;
          const [saved] = await tx
            .update(pushSubscriptions)
            .set({
              p256dh: input.p256dh,
              auth: input.auth,
              installed: input.installed,
              workerVersion: input.workerVersion,
              revokedAt: null,
              readinessPassedAt: stateChanged
                ? null
                : sameEndpoint.readinessPassedAt,
              updatedAt: now,
            })
            .where(eq(pushSubscriptions.id, sameEndpoint.id))
            .returning({
              id: pushSubscriptions.id,
              readinessPassedAt: pushSubscriptions.readinessPassedAt,
              installed: pushSubscriptions.installed,
            });
          return {
            id: saved.id,
            ready: saved.installed && saved.readinessPassedAt !== null,
          };
        }

        const [saved] = await tx
          .insert(pushSubscriptions)
          .values({
            deviceId: device.id,
            endpoint: input.endpoint,
            p256dh: input.p256dh,
            auth: input.auth,
            workerVersion: input.workerVersion,
            installed: input.installed,
          })
          .returning({ id: pushSubscriptions.id });
        return { id: saved.id, ready: false };
      });
    },

    async revokeOwned(userId, subscriptionId, now) {
      const revoked = await db
        .update(pushSubscriptions)
        .set({ revokedAt: now, readinessPassedAt: null, updatedAt: now })
        .from(workoutDevices)
        .where(
          and(
            eq(pushSubscriptions.id, subscriptionId),
            eq(pushSubscriptions.deviceId, workoutDevices.id),
            eq(workoutDevices.userId, userId),
            isNull(pushSubscriptions.revokedAt)
          )
        )
        .returning({ id: pushSubscriptions.id });
      return revoked.length === 1;
    },

    async revoke(subscriptionId, now) {
      const revoked = await db
        .update(pushSubscriptions)
        .set({ revokedAt: now, readinessPassedAt: null, updatedAt: now })
        .where(
          and(
            eq(pushSubscriptions.id, subscriptionId),
            isNull(pushSubscriptions.revokedAt)
          )
        )
        .returning({ id: pushSubscriptions.id });
      return revoked.length === 1;
    },

    async getStatus(input) {
      const [subscription] = await db
        .select({
          id: pushSubscriptions.id,
          installed: pushSubscriptions.installed,
          readinessPassedAt: pushSubscriptions.readinessPassedAt,
        })
        .from(workoutDevices)
        .innerJoin(
          pushSubscriptions,
          eq(pushSubscriptions.deviceId, workoutDevices.id)
        )
        .where(
          and(
            eq(workoutDevices.userId, input.userId),
            eq(workoutDevices.deviceId, input.deviceId),
            isNull(pushSubscriptions.revokedAt)
          )
        )
        .orderBy(desc(pushSubscriptions.updatedAt))
        .limit(1);

      return {
        subscriptionId: subscription?.id ?? null,
        installed: subscription?.installed ?? false,
        backgroundAlertReady:
          subscription?.installed === true &&
          subscription.readinessPassedAt !== null,
      };
    },
  };
}
