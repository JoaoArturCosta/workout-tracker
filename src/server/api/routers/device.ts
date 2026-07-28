import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import {
  deliveryEvents,
  pushSubscriptions,
  workoutDevices,
  workoutSessions,
} from "@/lib/db/schema";
import {
  createTRPCRouter,
  protectedProcedure,
} from "@/server/api/trpc";
import { createReadinessRepository } from "@/server/alerts/readiness-db";
import { createReadinessService } from "@/server/alerts/readiness-service";
import { createAlertRuntime } from "@/server/alerts/runtime";
import { createSubscriptionRepository } from "@/server/alerts/subscriptions-db";
import { createSubscriptionService } from "@/server/alerts/subscriptions";
import { restAlertControllerHooks } from "@/server/alerts/rest-hooks";
import { isAllowedPushEndpoint } from "@/server/alerts/push-endpoint";
import { getRestAlertDiagnostics } from "@/server/alerts/telemetry-db";
import { getPushProviderDetail } from "@/server/alerts/web-push";
import {
  ControllerError,
  handoffController,
  replaceLostController,
} from "@/server/workouts/controller-service";
import { createDrizzleControllerStore } from "@/server/workouts/drizzle-stores";

const deviceIdSchema = z.string().uuid();
const subscriptionIdSchema = z.string().uuid();

export const deviceRouter = createTRPCRouter({
  register: protectedProcedure
    .input(
      z.object({
        deviceId: deviceIdSchema,
        label: z.string().trim().min(1).max(100).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      const [device] = await ctx.db
        .insert(workoutDevices)
        .values({
          userId: ctx.session.user.id,
          deviceId: input.deviceId,
          label: input.label,
          lastSeenAt: now,
        })
        .onConflictDoUpdate({
          target: [workoutDevices.userId, workoutDevices.deviceId],
          set: { label: input.label, lastSeenAt: now },
        })
        .returning({
          deviceId: workoutDevices.deviceId,
          label: workoutDevices.label,
          createdAt: workoutDevices.createdAt,
          lastSeenAt: workoutDevices.lastSeenAt,
        });

      const [activeWorkout] = await ctx.db
        .select({
          sessionId: workoutSessions.id,
          controllerDeviceId: workoutDevices.deviceId,
          controllerEpoch: workoutSessions.controllerEpoch,
          revision: workoutSessions.revision,
        })
        .from(workoutSessions)
        .leftJoin(
          workoutDevices,
          eq(workoutSessions.controllerDeviceId, workoutDevices.id)
        )
        .where(
          and(
            eq(workoutSessions.userId, ctx.session.user.id),
            eq(workoutSessions.status, "Active")
          )
        )
        .limit(1);

      return {
        ...device,
        activeWorkout: activeWorkout
          ? {
              sessionId: activeWorkout.sessionId,
              controllerState:
                activeWorkout.controllerDeviceId === input.deviceId
                  ? ("Controlling" as const)
                  : ("ReadOnly" as const),
              controllerEpoch: activeWorkout.controllerEpoch,
              revision: activeWorkout.revision,
            }
          : null,
      };
    }),

  getControllerState: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        deviceId: deviceIdSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      const [workout] = await ctx.db
        .select({
          status: workoutSessions.status,
          revision: workoutSessions.revision,
          controllerEpoch: workoutSessions.controllerEpoch,
          controllerDeviceId: workoutDevices.deviceId,
        })
        .from(workoutSessions)
        .leftJoin(
          workoutDevices,
          eq(workoutSessions.controllerDeviceId, workoutDevices.id)
        )
        .where(
          and(
            eq(workoutSessions.id, input.sessionId),
            eq(workoutSessions.userId, ctx.session.user.id)
          )
        )
        .limit(1);
      if (!workout) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return {
        ...workout,
        controllerState:
          workout.status === "Active" &&
          workout.controllerDeviceId === input.deviceId
            ? ("Controlling" as const)
            : ("ReadOnly" as const),
      };
    }),

  handoff: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        currentDeviceId: deviceIdSchema,
        nextDeviceId: deviceIdSchema,
        controllerEpoch: z.number().int().positive(),
        acknowledgedRevision: z.number().int().nonnegative(),
        pendingOperationCount: z.number().int().nonnegative(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await handoffController({
          store: createDrizzleControllerStore(ctx.db),
          userId: ctx.session.user.id,
          input,
          hooks: restAlertControllerHooks,
        });
      } catch (error) {
        return mapControllerError(error);
      }
    }),

  replaceLostDevice: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        nextDeviceId: deviceIdSchema,
        controllerEpoch: z.number().int().positive(),
        confirmUnsyncedDataLoss: z.literal(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await replaceLostController({
          store: createDrizzleControllerStore(ctx.db),
          userId: ctx.session.user.id,
          input,
          hooks: restAlertControllerHooks,
        });
      } catch (error) {
        return mapControllerError(error);
      }
    }),

  pushStatus: protectedProcedure
    .input(z.object({ deviceId: deviceIdSchema }))
    .query(async ({ input, ctx }) => {
      const subscriptions = createSubscriptionService(
        createSubscriptionRepository(ctx.db)
      );
      const status = await subscriptions.getStatus({
        userId: ctx.session.user.id,
        deviceId: input.deviceId,
      });
      return {
        ...status,
        publicVapidKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null,
      };
    }),

  replacePushSubscription: protectedProcedure
    .input(
      z
        .object({
          deviceId: deviceIdSchema,
          endpoint: z.string().url().max(2_048),
          p256dh: z.string().min(16).max(512),
          auth: z.string().min(8).max(512),
          installed: z.boolean(),
          workerVersion: z.string().trim().min(1).max(100),
        })
        .strict()
    )
    .mutation(async ({ input, ctx }) => {
      if (!isAllowedPushEndpoint(input.endpoint)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Unsupported push endpoint",
        });
      }

      const subscriptions = createSubscriptionService(
        createSubscriptionRepository(ctx.db)
      );
      try {
        return await subscriptions.replace({
          userId: ctx.session.user.id,
          ...input,
        });
      } catch (error) {
        throw mapDeviceError(error);
      }
    }),

  unsubscribePush: protectedProcedure
    .input(z.object({ subscriptionId: subscriptionIdSchema }))
    .mutation(async ({ input, ctx }) => {
      const subscriptions = createSubscriptionService(
        createSubscriptionRepository(ctx.db)
      );
      return {
        removed: await subscriptions.unsubscribe(
          ctx.session.user.id,
          input.subscriptionId
        ),
      };
    }),

  startReadinessTest: protectedProcedure
    .input(
      z.object({
        deviceId: deviceIdSchema,
        subscriptionId: subscriptionIdSchema,
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [record] = await ctx.db
        .select({
          deviceId: workoutDevices.id,
          subscriptionId: pushSubscriptions.id,
          endpoint: pushSubscriptions.endpoint,
          p256dh: pushSubscriptions.p256dh,
          auth: pushSubscriptions.auth,
          installed: pushSubscriptions.installed,
        })
        .from(workoutDevices)
        .innerJoin(
          pushSubscriptions,
          eq(pushSubscriptions.deviceId, workoutDevices.id)
        )
        .where(
          and(
            eq(workoutDevices.userId, ctx.session.user.id),
            eq(workoutDevices.deviceId, input.deviceId),
            eq(pushSubscriptions.id, input.subscriptionId),
            isNull(pushSubscriptions.revokedAt)
          )
        )
        .limit(1);
      if (!record || !record.installed) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Install the PWA before testing background alerts",
        });
      }

      const runtime = createAlertRuntime();
      const readiness = createReadinessService({
        repository: createReadinessRepository(ctx.db),
        createId: crypto.randomUUID,
        createNonce: crypto.randomUUID,
        sendTestPush: async (payload) => {
          const result = await runtime.pushSender.send(record, payload);
          await ctx.db.insert(deliveryEvents).values({
            readinessAttemptId: payload.alertId,
            subscriptionId: record.subscriptionId,
            eventType:
              result.status === "accepted"
                ? "PushAccepted"
                : "PushRejected",
            detail:
              result.status === "accepted"
                ? null
                : getPushProviderDetail(result),
          });
          if (result.status === "expired") {
            await createSubscriptionService(
              createSubscriptionRepository(ctx.db)
            ).pruneExpired(record.subscriptionId);
          }
          return { status: result.status };
        },
      });

      const attempt = await readiness.start({
        userId: ctx.session.user.id,
        deviceId: record.deviceId,
        subscriptionId: record.subscriptionId,
      });
      return {
        attemptId: attempt.id,
        status: attempt.status,
        expiresAt: attempt.expiresAt,
      };
    }),

  readinessTestStatus: protectedProcedure
    .input(z.object({ attemptId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const readiness = createReadinessService({
        repository: createReadinessRepository(ctx.db),
        createId: crypto.randomUUID,
        createNonce: crypto.randomUUID,
        sendTestPush: async () => ({ status: "rejected" }),
      });
      return {
        status: await readiness.getStatus({
          userId: ctx.session.user.id,
          attemptId: input.attemptId,
        }),
      };
    }),

  alertDiagnostics: protectedProcedure.query(({ ctx }) =>
    getRestAlertDiagnostics(ctx.db, ctx.session.user.id)
  ),
});

function mapDeviceError(error: unknown): TRPCError {
  const message = error instanceof Error ? error.message : "Push setup failed";
  if (message === "Device not found") {
    return new TRPCError({ code: "NOT_FOUND", message });
  }
  if (message === "Push endpoint belongs to another device") {
    return new TRPCError({ code: "CONFLICT", message });
  }
  return new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
}

function mapControllerError(error: unknown): never {
  if (error instanceof ControllerError) {
    throw new TRPCError({
      code:
        error.code === "WORKOUT_NOT_FOUND" ||
        error.code === "DEVICE_NOT_FOUND"
          ? "NOT_FOUND"
          : "CONFLICT",
      message: error.message,
      cause: error,
    });
  }
  throw error;
}
