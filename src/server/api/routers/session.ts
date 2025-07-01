import { z } from "zod";
import { and, eq, desc, asc } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { UpdateSessionSetSchema } from "@/lib/schemas";
import {
  workoutSessions,
  sessionExercises,
  sessionSets,
  templateExercises,
  exercises,
  workoutTemplates,
} from "@/lib/db/schema";

export const sessionRouter = createTRPCRouter({
  // Start a workout session
  start: protectedProcedure
    .input(z.object({ templateId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      // First create the session
      const [session] = await ctx.db
        .insert(workoutSessions)
        .values({
          userId: ctx.session.user.id,
          templateId: input.templateId,
          startTime: new Date(),
        })
        .returning();

      // Get template exercises to create session exercises
      const templateExercisesList = await ctx.db
        .select()
        .from(templateExercises)
        .where(eq(templateExercises.templateId, input.templateId))
        .orderBy(asc(templateExercises.orderIndex));

      // Create session exercises
      if (templateExercisesList.length > 0) {
        const sessionExerciseData = templateExercisesList.map((te) => ({
          sessionId: session.id,
          exerciseId: te.exerciseId,
          orderIndex: te.orderIndex,
        }));

        const createdExercises = await ctx.db
          .insert(sessionExercises)
          .values(sessionExerciseData)
          .returning();

        // Create empty sets based on template
        const allSets = [];
        for (let i = 0; i < templateExercisesList.length; i++) {
          const te = templateExercisesList[i];
          const sessionExercise = createdExercises[i];

          for (let setNum = 1; setNum <= te.sets; setNum++) {
            allSets.push({
              sessionExerciseId: sessionExercise.id,
              setNumber: setNum,
              weight: "0",
              reps: 0,
              completed: false,
            });
          }
        }

        if (allSets.length > 0) {
          await ctx.db.insert(sessionSets).values(allSets);
        }
      }

      return session;
    }),

  // Get current active session
  getCurrent: protectedProcedure.query(async ({ ctx }) => {
    const [currentSession] = await ctx.db
      .select({
        session: workoutSessions,
        template: workoutTemplates,
      })
      .from(workoutSessions)
      .leftJoin(
        workoutTemplates,
        eq(workoutSessions.templateId, workoutTemplates.id)
      )
      .where(
        and(
          eq(workoutSessions.userId, ctx.session.user.id),
          eq(workoutSessions.completed, false)
        )
      )
      .orderBy(desc(workoutSessions.startTime))
      .limit(1);

    if (!currentSession) {
      return null;
    }

    // Get session exercises with exercises and sets
    const exercisesList = await ctx.db
      .select({
        sessionExercise: sessionExercises,
        exercise: exercises,
        sets: sessionSets,
      })
      .from(sessionExercises)
      .leftJoin(exercises, eq(sessionExercises.exerciseId, exercises.id))
      .leftJoin(
        sessionSets,
        eq(sessionExercises.id, sessionSets.sessionExerciseId)
      )
      .where(eq(sessionExercises.sessionId, currentSession.session.id))
      .orderBy(asc(sessionExercises.orderIndex));

    // Group sets by session exercise
    const exercisesWithSets = exercisesList.reduce((acc, row) => {
      const existingExercise = acc.find((e) => e.id === row.sessionExercise.id);
      if (existingExercise) {
        if (row.sets) {
          existingExercise.session_sets.push(row.sets);
        }
      } else {
        acc.push({
          id: row.sessionExercise.id,
          session_id: row.sessionExercise.sessionId,
          exercise_id: row.sessionExercise.exerciseId,
          order_index: row.sessionExercise.orderIndex,
          exercises: row.exercise,
          session_sets: row.sets ? [row.sets] : [],
        });
      }
      return acc;
    }, [] as any[]);

    return {
      ...currentSession.session,
      start_time: currentSession.session.startTime.toISOString(),
      workout_templates: currentSession.template,
      session_exercises: exercisesWithSets,
    };
  }),

  // Get session with exercises and sets
  getSessionWithExercises: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const [sessionData] = await ctx.db
        .select({
          session: workoutSessions,
          template: workoutTemplates,
        })
        .from(workoutSessions)
        .leftJoin(
          workoutTemplates,
          eq(workoutSessions.templateId, workoutTemplates.id)
        )
        .where(
          and(
            eq(workoutSessions.id, input.sessionId),
            eq(workoutSessions.userId, ctx.session.user.id)
          )
        );

      if (!sessionData) {
        throw new Error("Session not found");
      }

      // Get session exercises with exercises, sets, and template exercise data
      const exercisesList = await ctx.db
        .select({
          sessionExercise: sessionExercises,
          exercise: exercises,
          sets: sessionSets,
          templateExercise: templateExercises,
        })
        .from(sessionExercises)
        .leftJoin(exercises, eq(sessionExercises.exerciseId, exercises.id))
        .leftJoin(
          templateExercises,
          and(
            eq(templateExercises.templateId, sessionData.session.templateId),
            eq(templateExercises.exerciseId, sessionExercises.exerciseId)
          )
        )
        .leftJoin(
          sessionSets,
          eq(sessionExercises.id, sessionSets.sessionExerciseId)
        )
        .where(eq(sessionExercises.sessionId, input.sessionId))
        .orderBy(asc(sessionExercises.orderIndex));

      // Group sets by session exercise
      const exercisesWithSets = exercisesList.reduce((acc, row) => {
        const existingExercise = acc.find(
          (e) => e.id === row.sessionExercise.id
        );
        if (existingExercise) {
          if (row.sets) {
            existingExercise.session_sets.push(row.sets);
          }
        } else {
          acc.push({
            id: row.sessionExercise.id,
            session_id: row.sessionExercise.sessionId,
            exercise_id: row.sessionExercise.exerciseId,
            order_index: row.sessionExercise.orderIndex,
            exercises: row.exercise,
            template_exercise: row.templateExercise,
            session_sets: row.sets ? [row.sets] : [],
          });
        }
        return acc;
      }, [] as any[]);

      return {
        ...sessionData.session,
        start_time: sessionData.session.startTime.toISOString(),
        workout_templates: sessionData.template,
        session_exercises: exercisesWithSets,
      };
    }),

  // Update a set during workout
  updateSet: protectedProcedure
    .input(UpdateSessionSetSchema)
    .mutation(async ({ input, ctx }) => {
      // Verify user owns this set through session
      const [sessionCheck] = await ctx.db
        .select({ userId: workoutSessions.userId })
        .from(sessionSets)
        .innerJoin(
          sessionExercises,
          eq(sessionSets.sessionExerciseId, sessionExercises.id)
        )
        .innerJoin(
          workoutSessions,
          eq(sessionExercises.sessionId, workoutSessions.id)
        )
        .where(eq(sessionSets.id, input.id));

      if (!sessionCheck || sessionCheck.userId !== ctx.session.user.id) {
        throw new Error("Set not found or access denied");
      }

      const [updatedSet] = await ctx.db
        .update(sessionSets)
        .set({
          weight: input.weight?.toString(),
          reps: input.reps,
          rpe: input.rpe,
          completed: input.completed,
        })
        .where(eq(sessionSets.id, input.id))
        .returning();

      return updatedSet;
    }),

  // Get previous session values for auto-population
  getPreviousSessionValues: protectedProcedure
    .input(
      z.object({
        exerciseId: z.string().uuid(),
        limit: z.number().default(3),
      })
    )
    .query(async ({ input, ctx }) => {
      const previousSets = await ctx.db
        .select({
          weight: sessionSets.weight,
          reps: sessionSets.reps,
          rpe: sessionSets.rpe,
          setNumber: sessionSets.setNumber,
          startTime: workoutSessions.startTime,
        })
        .from(sessionSets)
        .innerJoin(
          sessionExercises,
          eq(sessionSets.sessionExerciseId, sessionExercises.id)
        )
        .innerJoin(
          workoutSessions,
          eq(sessionExercises.sessionId, workoutSessions.id)
        )
        .where(
          and(
            eq(sessionExercises.exerciseId, input.exerciseId),
            eq(workoutSessions.userId, ctx.session.user.id),
            eq(workoutSessions.completed, true),
            eq(sessionSets.completed, true)
          )
        )
        .orderBy(desc(workoutSessions.startTime))
        .limit(input.limit * 10); // Get more to account for multiple sets per session

      // Group by session and return the most recent sessions
      const sessionMap = new Map();
      previousSets.forEach((set) => {
        const sessionDate = set.startTime.toISOString();
        if (!sessionMap.has(sessionDate)) {
          sessionMap.set(sessionDate, []);
        }
        sessionMap.get(sessionDate).push(set);
      });

      const recentSessions = Array.from(sessionMap.entries())
        .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
        .slice(0, input.limit)
        .map(([date, sets]) => ({
          date,
          sets: sets.sort((a: any, b: any) => a.setNumber - b.setNumber),
        }));

      return recentSessions;
    }),

  // Get session history
  getHistory: protectedProcedure
    .input(z.object({ limit: z.number().default(10) }))
    .query(async ({ input, ctx }) => {
      const history = await ctx.db
        .select({
          session: workoutSessions,
          template: workoutTemplates,
        })
        .from(workoutSessions)
        .leftJoin(
          workoutTemplates,
          eq(workoutSessions.templateId, workoutTemplates.id)
        )
        .where(
          and(
            eq(workoutSessions.userId, ctx.session.user.id),
            eq(workoutSessions.completed, true)
          )
        )
        .orderBy(desc(workoutSessions.startTime))
        .limit(input.limit);

      return history.map(({ session, template }) => ({
        ...session,
        start_time: session.startTime.toISOString(),
        duration_minutes: session.durationMinutes,
        workout_templates: template,
      }));
    }),

  // Complete a session
  complete: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const endTime = new Date();

      // Get session start time to calculate duration
      const [session] = await ctx.db
        .select({ startTime: workoutSessions.startTime })
        .from(workoutSessions)
        .where(
          and(
            eq(workoutSessions.id, input.sessionId),
            eq(workoutSessions.userId, ctx.session.user.id)
          )
        );

      if (!session) {
        throw new Error("Session not found");
      }

      const durationMinutes = Math.round(
        (endTime.getTime() - session.startTime.getTime()) / 60000
      );

      const [updatedSession] = await ctx.db
        .update(workoutSessions)
        .set({
          endTime,
          durationMinutes,
          completed: true,
        })
        .where(
          and(
            eq(workoutSessions.id, input.sessionId),
            eq(workoutSessions.userId, ctx.session.user.id)
          )
        )
        .returning();

      return updatedSession;
    }),

  // Delete/cancel a session
  cancel: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.db
        .delete(workoutSessions)
        .where(
          and(
            eq(workoutSessions.id, input.sessionId),
            eq(workoutSessions.userId, ctx.session.user.id),
            eq(workoutSessions.completed, false)
          )
        );

      return { success: true };
    }),
});
