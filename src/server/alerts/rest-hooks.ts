import { z } from "zod";
import { and, eq } from "drizzle-orm";

import type { Database } from "@/lib/db";
import { restPeriods } from "@/lib/db/schema";
import type {
  WorkoutCommandHooks,
  WorkoutCommandTransaction,
} from "@/server/workouts/command-service";
import type {
  ControllerHooks,
} from "@/server/workouts/controller-service";
import {
  createAlertRuntime,
  isAlertEnvironmentConfigured,
} from "./runtime";

const publishEffectSchema = z
  .object({
    restId: z.string().uuid(),
    token: z.string().uuid(),
    dueAt: z.string().datetime(),
  })
  .strict();

export type AlertWorkoutTransaction = WorkoutCommandTransaction;

interface RestHookDependencies {
  publish(input: {
    restId: string;
    token: string;
    dueAt: Date;
  }): Promise<{ messageId: string }>;
  recordMessageId(
    restId: string,
    token: string,
    messageId: string
  ): Promise<void>;
}

export function createRestAlertCommandHooks(
  dependencies: RestHookDependencies
): WorkoutCommandHooks {
  return {
    async afterTransition(tx, context) {
      if (context.command.type === "EditCompletedSet") {
        return undefined;
      }

      await tx.cancelScheduledRest(context.after.id, context.now);
      if (context.command.type !== "CompleteSet") {
        return undefined;
      }

      const currentSet = context.after.sets.find(
        (set) => set.status === "Pending"
      );
      if (!currentSet) {
        return undefined;
      }
      const rest = await tx.scheduleRest({
        sessionId: context.after.id,
        completedSetId: context.command.sessionSetId,
        currentSetId: currentSet.id,
        controllerEpoch: context.after.controllerEpoch,
        now: context.now,
      });
      return rest
        ? {
            restId: rest.restId,
            token: rest.token,
            dueAt: rest.dueAt.toISOString(),
          }
        : undefined;
    },

    async afterCommit(unsafeEffect) {
      const effect = publishEffectSchema.parse(unsafeEffect);
      const published = await dependencies.publish({
        restId: effect.restId,
        token: effect.token,
        dueAt: new Date(effect.dueAt),
      });
      await dependencies.recordMessageId(
        effect.restId,
        effect.token,
        published.messageId
      );
    },
  };
}

export function createDatabaseRestAlertCommandHooks(
  db: Database
): WorkoutCommandHooks {
  const runtime = createAlertRuntime();
  return createRestAlertCommandHooks({
    publish: runtime.restPublisher.publish,
    async recordMessageId(restId, token, messageId) {
      await db
        .update(restPeriods)
        .set({ qstashMessageId: messageId, updatedAt: new Date() })
        .where(
          and(
            eq(restPeriods.id, restId),
            eq(restPeriods.token, token)
          )
        );
    },
  });
}

export function createDatabaseRestAlertCommandHooksIfConfigured(
  db: Database
): WorkoutCommandHooks | undefined {
  return isAlertEnvironmentConfigured()
    ? createDatabaseRestAlertCommandHooks(db)
    : undefined;
}

export const restAlertControllerHooks: ControllerHooks = {
  async invalidateRest(tx, sessionId, now) {
    await tx.cancelScheduledRest(sessionId, now);
  },
};
