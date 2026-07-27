import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  WorkoutCommandEnvelopeSchema,
  WorkoutModeEnum,
} from "@/lib/workouts/contracts";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { createDatabaseRestAlertCommandHooksIfConfigured } from "@/server/alerts/rest-hooks";
import {
  WorkoutCommandError,
  executeWorkoutCommand,
} from "@/server/workouts/command-service";
import { createDrizzleWorkoutCommandStore } from "@/server/workouts/drizzle-stores";
import {
  getActiveWorkoutSnapshot,
  getPriorSetValues,
  getWorkoutHistory,
  getWorkoutSnapshot,
} from "@/server/workouts/queries";
import {
  StartWorkoutError,
  startWorkout,
} from "@/server/workouts/start-workout";

const commandError = (error: unknown): never => {
  if (error instanceof WorkoutCommandError) {
    throw new TRPCError({
      code:
        error.code === "WORKOUT_NOT_FOUND"
          ? "NOT_FOUND"
          : error.code === "INVALID_TRANSITION"
            ? "BAD_REQUEST"
            : "CONFLICT",
      message: error.message,
      cause: error,
    });
  }
  throw error;
};

const startError = (error: unknown): never => {
  if (error instanceof StartWorkoutError) {
    throw new TRPCError({
      code:
        error.code === "TEMPLATE_NOT_FOUND"
          ? "NOT_FOUND"
          : error.code === "ACTIVE_WORKOUT_EXISTS"
            ? "CONFLICT"
            : "BAD_REQUEST",
      message: error.message,
      cause: error,
    });
  }
  throw error;
};

export const sessionRouter = createTRPCRouter({
  start: protectedProcedure
    .input(
      z.object({
        templateId: z.string().uuid(),
        deviceId: z.string().uuid(),
        deviceLabel: z.string().trim().min(1).max(100).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        return await startWorkout({
          db: ctx.db,
          userId: ctx.session.user.id,
          ...input,
        });
      } catch (error) {
        return startError(error);
      }
    }),

  getCurrent: protectedProcedure.query(({ ctx }) =>
    getActiveWorkoutSnapshot({
      db: ctx.db,
      userId: ctx.session.user.id,
    })
  ),

  getById: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const snapshot = await getWorkoutSnapshot({
        db: ctx.db,
        userId: ctx.session.user.id,
        sessionId: input.sessionId,
      });
      if (!snapshot) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return snapshot;
    }),

  // Kept as a read alias while existing links move to getById.
  getSessionWithExercises: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const snapshot = await getWorkoutSnapshot({
        db: ctx.db,
        userId: ctx.session.user.id,
        sessionId: input.sessionId,
      });
      if (!snapshot) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return snapshot;
    }),

  getHistory: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(10) }))
    .query(({ input, ctx }) =>
      getWorkoutHistory({
        db: ctx.db,
        userId: ctx.session.user.id,
        limit: input.limit,
      })
    ),

  getPriorSetValues: protectedProcedure
    .input(
      z.object({
        exerciseId: z.string().uuid(),
        mode: WorkoutModeEnum,
        setNumber: z.number().int().positive(),
      })
    )
    .query(({ input, ctx }) =>
      getPriorSetValues({
        db: ctx.db,
        userId: ctx.session.user.id,
        ...input,
      })
    ),

  command: protectedProcedure
    .input(WorkoutCommandEnvelopeSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await executeWorkoutCommand({
          store: createDrizzleWorkoutCommandStore(ctx.db),
          userId: ctx.session.user.id,
          envelope: input,
          hooks: createDatabaseRestAlertCommandHooksIfConfigured(ctx.db),
        });
      } catch (error) {
        return commandError(error);
      }
    }),
});
