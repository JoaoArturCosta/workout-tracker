import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

export const progressRouter = createTRPCRouter({
  // Get 1RM calculation for an exercise
  getOneRM: protectedProcedure
    .input(z.object({ exerciseId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      // Fetch the best set for this exercise from session sets
      const { data, error } = await ctx.supabase
        .from("session_sets")
        .select(
          `
          weight,
          reps,
          session_exercises!inner (
            session_id,
            exercise_id,
            workout_sessions!inner (
              user_id,
              completed
            )
          )
        `
        )
        .eq("session_exercises.exercise_id", input.exerciseId)
        .eq("session_exercises.workout_sessions.user_id", ctx.session.user.id)
        .eq("session_exercises.workout_sessions.completed", true)
        .eq("completed", true)
        .order("weight", { ascending: false })
        .limit(10);

      if (error) {
        throw new Error(`Failed to fetch exercise data: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return null;
      }

      // Calculate 1RM using Epley formula: weight * (1 + reps/30)
      const oneRMCalculations = data.map((set) => ({
        weight: set.weight,
        reps: set.reps,
        oneRM: Math.round(set.weight * (1 + set.reps / 30) * 100) / 100,
      }));

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

      const { data, error } = await ctx.supabase
        .from("session_sets")
        .select(
          `
          weight,
          reps,
          session_exercises!inner (
            exercise_id,
            workout_sessions!inner (
              user_id,
              completed,
              start_time
            )
          )
        `
        )
        .eq("session_exercises.exercise_id", input.exerciseId)
        .eq("session_exercises.workout_sessions.user_id", ctx.session.user.id)
        .eq("session_exercises.workout_sessions.completed", true)
        .eq("completed", true)
        .gte(
          "session_exercises.workout_sessions.start_time",
          startDate.toISOString()
        )
        .order("session_exercises.workout_sessions.start_time");

      if (error) {
        throw new Error(`Failed to fetch volume data: ${error.message}`);
      }

      // Calculate volume (weight * reps) grouped by session
      const volumeBySession = (data || []).reduce(
        (acc: Record<string, number>, set: any) => {
          const sessionDate =
            set.session_exercises.workout_sessions.start_time.split("T")[0];
          const volume = set.weight * set.reps;
          acc[sessionDate] = (acc[sessionDate] || 0) + volume;
          return acc;
        },
        {}
      );

      const progressData = Object.entries(volumeBySession).map(
        ([date, volume]) => ({
          date,
          volume,
        })
      );

      return progressData;
    }),

  // Get strength standards comparison
  getStrengthStandards: protectedProcedure
    .input(z.object({ exerciseId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      // Get user's best 1RM for this exercise
      const oneRMResult = await ctx.supabase
        .from("session_sets")
        .select(
          `
          weight,
          reps,
          session_exercises!inner (
            exercise_id,
            workout_sessions!inner (
              user_id,
              completed
            )
          )
        `
        )
        .eq("session_exercises.exercise_id", input.exerciseId)
        .eq("session_exercises.workout_sessions.user_id", ctx.session.user.id)
        .eq("session_exercises.workout_sessions.completed", true)
        .eq("completed", true)
        .order("weight", { ascending: false })
        .limit(1);

      if (
        oneRMResult.error ||
        !oneRMResult.data ||
        oneRMResult.data.length === 0
      ) {
        return null;
      }

      const bestSet = oneRMResult.data[0];
      const oneRM = bestSet.weight * (1 + bestSet.reps / 30);

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
        standards,
      };
    }),
});
