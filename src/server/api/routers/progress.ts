import { z } from "zod";
import { eq, and, desc, asc, gte, inArray } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import {
  bodyWeightLogs,
  sessionSets,
  sessionExercises,
  workoutSessions,
  workoutTemplates,
  exercises,
} from "@/lib/db/schema";

export const progressRouter = createTRPCRouter({
  // Body Weight Logging
  logBodyWeight: protectedProcedure
    .input(
      z.object({
        weight: z.number().positive().max(1000),
        unit: z.enum(["kg", "lbs"]).default("kg"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [result] = await ctx.db
        .insert(bodyWeightLogs)
        .values({
          userId: ctx.session.user.id,
          weight: input.weight.toString(),
          unit: input.unit,
        })
        .returning();

      return result;
    }),

  getBodyWeightHistory: protectedProcedure
    .input(
      z.object({
        timeframe: z.enum(["week", "month", "year"]).optional(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ input, ctx }) => {
      const timeframes = {
        week: 7,
        month: 30,
        year: 365,
      };

      const conditions = [eq(bodyWeightLogs.userId, ctx.session.user.id)];

      if (input.timeframe) {
        const days = timeframes[input.timeframe];
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        conditions.push(gte(bodyWeightLogs.loggedAt, startDate));
      }

      const result = await ctx.db
        .select()
        .from(bodyWeightLogs)
        .where(and(...conditions))
        .orderBy(desc(bodyWeightLogs.loggedAt))
        .limit(input.limit);

      return result;
    }),

  // Get 1RM calculation for an exercise
  getOneRM: protectedProcedure
    .input(z.object({ exerciseId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      // Get all completed sets for this exercise
      const setsData = await ctx.db
        .select({
          weight: sessionSets.weight,
          reps: sessionSets.reps,
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
        .orderBy(desc(sessionSets.weight))
        .limit(10);

      if (setsData.length === 0) {
        return null;
      }

      // Calculate 1RM using Epley formula: weight * (1 + reps/30)
      const oneRMCalculations = setsData.map((set) => {
        const weight = parseFloat(set.weight);
        return {
          weight,
          reps: set.reps,
          oneRM: Math.round(weight * (1 + set.reps / 30) * 100) / 100,
        };
      });

      // Return the highest calculated 1RM
      const maxOneRM = Math.max(...oneRMCalculations.map((calc) => calc.oneRM));

      return {
        oneRepMax: maxOneRM,
        calculations: oneRMCalculations,
      };
    }),

  // Get volume progression for an exercise
  getVolumeProgression: protectedProcedure
    .input(
      z.object({
        exerciseId: z.string().uuid(),
        timeframe: z.enum(["week", "month", "year"]).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const timeframes = {
        week: 7,
        month: 30,
        year: 365,
      };

      const days = timeframes[input.timeframe || "month"];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get sets data with dates
      const setsData = await ctx.db
        .select({
          weight: sessionSets.weight,
          reps: sessionSets.reps,
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
            eq(sessionSets.completed, true),
            gte(workoutSessions.startTime, startDate)
          )
        )
        .orderBy(asc(workoutSessions.startTime));

      // Calculate volume (weight * reps) grouped by date
      const volumeByDate = setsData.reduce(
        (acc: Record<string, number>, set) => {
          const date = set.startTime.toISOString().split("T")[0];
          const weight = parseFloat(set.weight);
          const volume = weight * set.reps;
          acc[date] = (acc[date] || 0) + volume;
          return acc;
        },
        {}
      );

      const progressData = Object.entries(volumeByDate).map(
        ([date, volume]) => ({
          date,
          volume: Math.round(volume * 100) / 100,
        })
      );

      return progressData;
    }),

  // Get strength standards comparison
  getStrengthStandards: protectedProcedure
    .input(z.object({ exerciseId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      // Get user's best set for this exercise
      const [bestSet] = await ctx.db
        .select({
          weight: sessionSets.weight,
          reps: sessionSets.reps,
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
        .orderBy(desc(sessionSets.weight))
        .limit(1);

      if (!bestSet) {
        return null;
      }

      const weight = parseFloat(bestSet.weight);
      const oneRM = weight * (1 + bestSet.reps / 30);

      // Basic strength standards (these would come from a proper database in production)
      const standards = {
        beginner: oneRM * 0.5,
        novice: oneRM * 0.75,
        intermediate: oneRM * 1.0,
        advanced: oneRM * 1.5,
        elite: oneRM * 2.0,
      };

      let currentLevel = "beginner";
      if (oneRM >= standards.elite) currentLevel = "elite";
      else if (oneRM >= standards.advanced) currentLevel = "advanced";
      else if (oneRM >= standards.intermediate) currentLevel = "intermediate";
      else if (oneRM >= standards.novice) currentLevel = "novice";

      return {
        userOneRM: Math.round(oneRM * 100) / 100,
        currentLevel,
        standards: {
          beginner: Math.round(standards.beginner * 100) / 100,
          novice: Math.round(standards.novice * 100) / 100,
          intermediate: Math.round(standards.intermediate * 100) / 100,
          advanced: Math.round(standards.advanced * 100) / 100,
          elite: Math.round(standards.elite * 100) / 100,
        },
      };
    }),

  // Session History with detailed analytics
  getSessionHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
        exerciseId: z.string().uuid().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      // Get sessions with basic info
      const sessionsQuery = ctx.db
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

      const sessions = await sessionsQuery;

      if (sessions.length === 0) {
        return [];
      }

      // Get session exercises and sets for all sessions
      const sessionIds = sessions.map((s) => s.session.id);
      const sessionExercisesData = await ctx.db
        .select({
          sessionId: sessionExercises.sessionId,
          exerciseId: sessionExercises.exerciseId,
          orderIndex: sessionExercises.orderIndex,
          exercise: exercises,
          sets: sessionSets,
        })
        .from(sessionExercises)
        .leftJoin(exercises, eq(sessionExercises.exerciseId, exercises.id))
        .leftJoin(
          sessionSets,
          eq(sessionExercises.id, sessionSets.sessionExerciseId)
        )
        .where(
          and(
            inArray(sessionExercises.sessionId, sessionIds),
            input.exerciseId
              ? eq(sessionExercises.exerciseId, input.exerciseId)
              : undefined
          )
        );

      // Group data by session
      const sessionData = sessions.map((sessionInfo) => {
        const sessionExercisesForSession = sessionExercisesData.filter(
          (ex) => ex.sessionId === sessionInfo.session.id
        );

        // Group exercises with their sets
        const exercisesWithSets = sessionExercisesForSession.reduce(
          (acc, row) => {
            const existingExercise = acc.find(
              (e) => e.exerciseId === row.exerciseId
            );
            if (existingExercise) {
              if (row.sets && row.sets.completed) {
                existingExercise.session_sets.push(row.sets);
              }
            } else {
              acc.push({
                exerciseId: row.exerciseId,
                orderIndex: row.orderIndex,
                exercises: row.exercise,
                session_sets: row.sets && row.sets.completed ? [row.sets] : [],
              });
            }
            return acc;
          },
          [] as Array<{
            exerciseId: string;
            orderIndex: number;
            exercises: typeof exercises.$inferSelect | null;
            session_sets: (typeof sessionSets.$inferSelect)[];
          }>
        );

        // Calculate session stats
        const totalVolume = exercisesWithSets.reduce(
          (exerciseTotal, exercise) => {
            const exerciseVolume = exercise.session_sets.reduce(
              (setTotal: number, set: typeof sessionSets.$inferSelect) => {
                const weight = parseFloat(set.weight);
                return setTotal + weight * set.reps;
              },
              0
            );
            return exerciseTotal + exerciseVolume;
          },
          0
        );

        const totalSets = exercisesWithSets.reduce((total, exercise) => {
          return total + exercise.session_sets.length;
        }, 0);

        return {
          id: sessionInfo.session.id,
          start_time: sessionInfo.session.startTime?.toISOString(),
          end_time: sessionInfo.session.endTime?.toISOString(),
          duration_minutes: sessionInfo.session.durationMinutes,
          completed: sessionInfo.session.completed,
          workout_templates: sessionInfo.template,
          session_exercises: exercisesWithSets,
          stats: {
            totalVolume: Math.round(totalVolume * 100) / 100,
            totalSets,
            exerciseCount: exercisesWithSets.length,
          },
        };
      });

      return sessionData;
    }),

  // Enhanced Personal Records tracking
  getPersonalRecords: protectedProcedure
    .input(
      z.object({
        exerciseId: z.string().uuid().optional(),
        timeframe: z.enum(["week", "month", "year", "all"]).default("all"),
      })
    )
    .query(async ({ input, ctx }) => {
      const timeframes = {
        week: 7,
        month: 30,
        year: 365,
      };

      const whereConditions = [
        eq(workoutSessions.userId, ctx.session.user.id),
        eq(workoutSessions.completed, true),
        eq(sessionSets.completed, true),
      ];

      if (input.exerciseId) {
        whereConditions.push(eq(sessionExercises.exerciseId, input.exerciseId));
      }

      if (input.timeframe !== "all") {
        const days = timeframes[input.timeframe];
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        whereConditions.push(gte(workoutSessions.startTime, startDate));
      }

      const setsData = await ctx.db
        .select({
          weight: sessionSets.weight,
          reps: sessionSets.reps,
          rpe: sessionSets.rpe,
          exerciseId: sessionExercises.exerciseId,
          exercise: exercises,
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
        .innerJoin(exercises, eq(sessionExercises.exerciseId, exercises.id))
        .where(and(...whereConditions));

      // Group by exercise and find PRs
      const exercisePRs = setsData.reduce(
        (
          acc: Record<
            string,
            {
              exerciseId: string;
              exerciseName: string;
              muscleGroup: string;
              maxWeight: {
                weight: number;
                reps: number;
                date: string | undefined;
              };
              maxVolume: {
                weight: number;
                reps: number;
                volume: number;
                date: string | undefined;
              };
              maxOneRM: {
                weight: number;
                reps: number;
                oneRM: number;
                date: string | undefined;
              };
            }
          >,
          set
        ) => {
          const exerciseId = set.exerciseId;
          const weight = parseFloat(set.weight);
          const oneRM = weight * (1 + set.reps / 30);
          const volume = weight * set.reps;

          if (!acc[exerciseId]) {
            acc[exerciseId] = {
              exerciseId,
              exerciseName: set.exercise.name,
              muscleGroup: set.exercise.muscleGroup,
              maxWeight: {
                weight,
                reps: set.reps,
                date: set.startTime?.toISOString(),
              },
              maxVolume: {
                weight,
                reps: set.reps,
                volume,
                date: set.startTime?.toISOString(),
              },
              maxOneRM: {
                weight,
                reps: set.reps,
                oneRM,
                date: set.startTime?.toISOString(),
              },
            };
          } else {
            // Update max weight
            if (weight > acc[exerciseId].maxWeight.weight) {
              acc[exerciseId].maxWeight = {
                weight,
                reps: set.reps,
                date: set.startTime?.toISOString(),
              };
            }

            // Update max volume
            if (volume > acc[exerciseId].maxVolume.volume) {
              acc[exerciseId].maxVolume = {
                weight,
                reps: set.reps,
                volume,
                date: set.startTime?.toISOString(),
              };
            }

            // Update max 1RM
            if (oneRM > acc[exerciseId].maxOneRM.oneRM) {
              acc[exerciseId].maxOneRM = {
                weight,
                reps: set.reps,
                oneRM,
                date: set.startTime?.toISOString(),
              };
            }
          }

          return acc;
        },
        {}
      );

      return Object.values(exercisePRs);
    }),
});
