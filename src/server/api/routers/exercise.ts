import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
} from "@/server/api/trpc";
import {
  CreateExerciseSchema,
  ExerciseFilterSchema,
  MuscleGroupEnum,
} from "@/lib/schemas";

export const exerciseRouter = createTRPCRouter({
  // Get all exercises (public - includes default exercises)
  getAll: publicProcedure
    .input(ExerciseFilterSchema)
    .query(async ({ input, ctx }) => {
      let query = ctx.supabase.from("exercises").select("*").order("name");

      // Filter by muscle group if provided
      if (input.muscleGroup) {
        query = query.eq("muscle_group", input.muscleGroup);
      }

      // Filter by search term if provided
      if (input.search) {
        query = query.ilike("name", `%${input.search}%`);
      }

      // Filter by custom status if provided
      if (input.isCustom !== undefined) {
        query = query.eq("is_custom", input.isCustom);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch exercises: ${error.message}`);
      }

      return data || [];
    }),

  // Get user's custom exercises (protected)
  getCustom: protectedProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from("exercises")
      .select("*")
      .eq("user_id", ctx.session.user.id)
      .eq("is_custom", true)
      .order("name");

    if (error) {
      throw new Error(`Failed to fetch custom exercises: ${error.message}`);
    }

    return data || [];
  }),

  // Get exercise by ID
  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase
        .from("exercises")
        .select("*")
        .eq("id", input.id)
        .single();

      if (error) {
        throw new Error(`Failed to fetch exercise: ${error.message}`);
      }

      return data;
    }),

  // Get exercises by muscle group
  getByMuscleGroup: publicProcedure
    .input(z.object({ muscleGroup: MuscleGroupEnum }))
    .query(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase
        .from("exercises")
        .select("*")
        .eq("muscle_group", input.muscleGroup)
        .order("name");

      if (error) {
        throw new Error(`Failed to fetch exercises: ${error.message}`);
      }

      return data || [];
    }),

  // Create custom exercise (protected)
  create: protectedProcedure
    .input(CreateExerciseSchema)
    .mutation(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase
        .from("exercises")
        .insert({
          name: input.name,
          muscle_group: input.muscleGroup,
          equipment: input.equipment,
          is_custom: true,
          user_id: ctx.session.user.id,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create exercise: ${error.message}`);
      }

      return data;
    }),

  // Update custom exercise (protected)
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: CreateExerciseSchema.partial(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // First verify the exercise belongs to the user
      const { data: exercise, error: fetchError } = await ctx.supabase
        .from("exercises")
        .select("*")
        .eq("id", input.id)
        .eq("user_id", ctx.session.user.id)
        .eq("is_custom", true)
        .single();

      if (fetchError || !exercise) {
        throw new Error("Exercise not found or not owned by user");
      }

      const { data, error } = await ctx.supabase
        .from("exercises")
        .update({
          name: input.data.name,
          muscle_group: input.data.muscleGroup,
          equipment: input.data.equipment,
        })
        .eq("id", input.id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update exercise: ${error.message}`);
      }

      return data;
    }),

  // Delete custom exercise (protected)
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      // First verify the exercise belongs to the user
      const { data: exercise, error: fetchError } = await ctx.supabase
        .from("exercises")
        .select("*")
        .eq("id", input.id)
        .eq("user_id", ctx.session.user.id)
        .eq("is_custom", true)
        .single();

      if (fetchError || !exercise) {
        throw new Error("Exercise not found or not owned by user");
      }

      const { error } = await ctx.supabase
        .from("exercises")
        .delete()
        .eq("id", input.id);

      if (error) {
        throw new Error(`Failed to delete exercise: ${error.message}`);
      }

      return { success: true };
    }),

  // Search exercises
  search: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        muscleGroup: MuscleGroupEnum.optional(),
        includeCustom: z.boolean().default(true),
      })
    )
    .query(async ({ input, ctx }) => {
      let query = ctx.supabase
        .from("exercises")
        .select("*")
        .ilike("name", `%${input.query}%`);

      if (input.muscleGroup) {
        query = query.eq("muscle_group", input.muscleGroup);
      }

      if (!input.includeCustom) {
        query = query.eq("is_custom", false);
      }

      query = query.order("name").limit(20);

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to search exercises: ${error.message}`);
      }

      return data || [];
    }),
});
