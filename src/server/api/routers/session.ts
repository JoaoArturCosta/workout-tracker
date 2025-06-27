import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

export const sessionRouter = createTRPCRouter({
  // Start a workout session
  start: protectedProcedure
    .input(z.object({ templateId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase
        .from("workout_sessions")
        .insert({
          user_id: ctx.session.user.id,
          template_id: input.templateId,
          start_time: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to start session: ${error.message}`);
      }

      return data;
    }),

  // Get session history
  getHistory: protectedProcedure
    .input(z.object({ limit: z.number().default(10) }))
    .query(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase
        .from("workout_sessions")
        .select("*")
        .eq("user_id", ctx.session.user.id)
        .eq("completed", true)
        .order("start_time", { ascending: false })
        .limit(input.limit);

      if (error) {
        throw new Error(`Failed to fetch session history: ${error.message}`);
      }

      return data || [];
    }),

  // Complete a session
  complete: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const endTime = new Date();

      // Get session start time to calculate duration
      const { data: session, error: fetchError } = await ctx.supabase
        .from("workout_sessions")
        .select("start_time")
        .eq("id", input.sessionId)
        .eq("user_id", ctx.session.user.id)
        .single();

      if (fetchError || !session) {
        throw new Error("Session not found");
      }

      const startTime = new Date(session.start_time);
      const durationMinutes = Math.round(
        (endTime.getTime() - startTime.getTime()) / 60000
      );

      const { data, error } = await ctx.supabase
        .from("workout_sessions")
        .update({
          end_time: endTime.toISOString(),
          duration_minutes: durationMinutes,
          completed: true,
        })
        .eq("id", input.sessionId)
        .eq("user_id", ctx.session.user.id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to complete session: ${error.message}`);
      }

      return data;
    }),
});
