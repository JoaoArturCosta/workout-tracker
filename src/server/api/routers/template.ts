import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { CreateWorkoutTemplateSchema } from "@/lib/schemas";

export const templateRouter = createTRPCRouter({
  // Get all user templates
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from("workout_templates")
      .select(
        `
        *,
        template_exercises (
          *,
          exercises (*)
        )
      `
      )
      .eq("user_id", ctx.session.user.id)
      .order("day_number");

    if (error) {
      throw new Error(`Failed to fetch templates: ${error.message}`);
    }

    return data || [];
  }),

  // Get template by day number
  getByDay: protectedProcedure
    .input(z.object({ dayNumber: z.number().min(1).max(7) }))
    .query(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase
        .from("workout_templates")
        .select(
          `
          *,
          template_exercises (
            *,
            exercises (*)
          )
        `
        )
        .eq("user_id", ctx.session.user.id)
        .eq("day_number", input.dayNumber)
        .single();

      if (error && error.code !== "PGRST116") {
        throw new Error(`Failed to fetch template: ${error.message}`);
      }

      return data;
    }),

  // Get template by ID
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase
        .from("workout_templates")
        .select(
          `
          *,
          template_exercises (
            *,
            exercises (*)
          )
        `
        )
        .eq("id", input.id)
        .eq("user_id", ctx.session.user.id)
        .single();

      if (error) {
        throw new Error(`Failed to fetch template: ${error.message}`);
      }

      return data;
    }),

  // Create template
  create: protectedProcedure
    .input(CreateWorkoutTemplateSchema)
    .mutation(async ({ input, ctx }) => {
      // First create the template
      const { data: template, error: templateError } = await ctx.supabase
        .from("workout_templates")
        .insert({
          user_id: ctx.session.user.id,
          name: input.name,
          day_number: input.dayNumber,
        })
        .select()
        .single();

      if (templateError) {
        throw new Error(`Failed to create template: ${templateError.message}`);
      }

      // Then create the exercises if provided
      if (input.exercises && input.exercises.length > 0) {
        const templateExercises = input.exercises.map((exercise, index) => ({
          template_id: template.id,
          exercise_id: exercise.exerciseId,
          order_index: exercise.orderIndex ?? index,
          sets: exercise.sets,
          reps_min: exercise.repsMin,
          reps_max: exercise.repsMax,
          rpe_target: exercise.rpeTarget,
        }));

        const { error: exercisesError } = await ctx.supabase
          .from("template_exercises")
          .insert(templateExercises);

        if (exercisesError) {
          // Clean up the template if exercise creation fails
          await ctx.supabase
            .from("workout_templates")
            .delete()
            .eq("id", template.id);

          throw new Error(
            `Failed to create template exercises: ${exercisesError.message}`
          );
        }
      }

      return template;
    }),

  // Update template
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: CreateWorkoutTemplateSchema.partial(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase
        .from("workout_templates")
        .update({
          name: input.data.name,
          day_number: input.data.dayNumber,
        })
        .eq("id", input.id)
        .eq("user_id", ctx.session.user.id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update template: ${error.message}`);
      }

      return data;
    }),

  // Delete template
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const { error } = await ctx.supabase
        .from("workout_templates")
        .delete()
        .eq("id", input.id)
        .eq("user_id", ctx.session.user.id);

      if (error) {
        throw new Error(`Failed to delete template: ${error.message}`);
      }

      return { success: true };
    }),

  // Duplicate template
  duplicate: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        newDayNumber: z.number().min(1).max(7),
        newName: z.string().min(1).max(50),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Get the original template with exercises
      const { data: originalTemplate, error: fetchError } = await ctx.supabase
        .from("workout_templates")
        .select(
          `
          *,
          template_exercises (*)
        `
        )
        .eq("id", input.id)
        .eq("user_id", ctx.session.user.id)
        .single();

      if (fetchError || !originalTemplate) {
        throw new Error("Template not found");
      }

      // Create the new template
      const { data: newTemplate, error: templateError } = await ctx.supabase
        .from("workout_templates")
        .insert({
          user_id: ctx.session.user.id,
          name: input.newName,
          day_number: input.newDayNumber,
        })
        .select()
        .single();

      if (templateError) {
        throw new Error(
          `Failed to duplicate template: ${templateError.message}`
        );
      }

      // Copy the exercises if any exist
      if (
        originalTemplate.template_exercises &&
        originalTemplate.template_exercises.length > 0
      ) {
        const newExercises = originalTemplate.template_exercises.map(
          (exercise: any) => ({
            template_id: newTemplate.id,
            exercise_id: exercise.exercise_id,
            order_index: exercise.order_index,
            sets: exercise.sets,
            reps_min: exercise.reps_min,
            reps_max: exercise.reps_max,
            rpe_target: exercise.rpe_target,
          })
        );

        const { error: exercisesError } = await ctx.supabase
          .from("template_exercises")
          .insert(newExercises);

        if (exercisesError) {
          // Clean up if exercise creation fails
          await ctx.supabase
            .from("workout_templates")
            .delete()
            .eq("id", newTemplate.id);

          throw new Error(
            `Failed to duplicate template exercises: ${exercisesError.message}`
          );
        }
      }

      return newTemplate;
    }),
});
