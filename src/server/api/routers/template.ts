import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { CreateWorkoutTemplateSchema } from "@/lib/schemas";
import {
  workoutTemplates,
  templateExercises,
  exercises,
} from "@/lib/db/schema";

export const templateRouter = createTRPCRouter({
  // Get all user templates
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const templates = await ctx.db
      .select({
        id: workoutTemplates.id,
        name: workoutTemplates.name,
        dayNumber: workoutTemplates.dayNumber,
        userId: workoutTemplates.userId,
        createdAt: workoutTemplates.createdAt,
        updatedAt: workoutTemplates.updatedAt,
      })
      .from(workoutTemplates)
      .where(eq(workoutTemplates.userId, ctx.session.user.id))
      .orderBy(workoutTemplates.dayNumber);

    // Get template exercises for each template
    const templatesWithExercises = await Promise.all(
      templates.map(async (template) => {
        const templateExercisesList = await ctx.db
          .select({
            id: templateExercises.id,
            templateId: templateExercises.templateId,
            exerciseId: templateExercises.exerciseId,
            orderIndex: templateExercises.orderIndex,
            sets: templateExercises.sets,
            repsMin: templateExercises.repsMin,
            repsMax: templateExercises.repsMax,
            rpeTarget: templateExercises.rpeTarget,
            exercise: {
              id: exercises.id,
              name: exercises.name,
              muscleGroup: exercises.muscleGroup,
              equipment: exercises.equipment,
              isCustom: exercises.isCustom,
              userId: exercises.userId,
              createdAt: exercises.createdAt,
            },
          })
          .from(templateExercises)
          .leftJoin(exercises, eq(templateExercises.exerciseId, exercises.id))
          .where(eq(templateExercises.templateId, template.id))
          .orderBy(templateExercises.orderIndex);

        return {
          ...template,
          template_exercises: templateExercisesList,
        };
      })
    );

    return templatesWithExercises;
  }),

  // Get template by day number
  getByDay: protectedProcedure
    .input(z.object({ dayNumber: z.number().min(1).max(7) }))
    .query(async ({ input, ctx }) => {
      const template = await ctx.db
        .select()
        .from(workoutTemplates)
        .where(
          and(
            eq(workoutTemplates.userId, ctx.session.user.id),
            eq(workoutTemplates.dayNumber, input.dayNumber)
          )
        )
        .limit(1);

      if (!template[0]) {
        return null;
      }

      // Get template exercises
      const templateExercisesList = await ctx.db
        .select({
          id: templateExercises.id,
          templateId: templateExercises.templateId,
          exerciseId: templateExercises.exerciseId,
          orderIndex: templateExercises.orderIndex,
          sets: templateExercises.sets,
          repsMin: templateExercises.repsMin,
          repsMax: templateExercises.repsMax,
          rpeTarget: templateExercises.rpeTarget,
          exercise: {
            id: exercises.id,
            name: exercises.name,
            muscleGroup: exercises.muscleGroup,
            equipment: exercises.equipment,
            isCustom: exercises.isCustom,
            userId: exercises.userId,
            createdAt: exercises.createdAt,
          },
        })
        .from(templateExercises)
        .leftJoin(exercises, eq(templateExercises.exerciseId, exercises.id))
        .where(eq(templateExercises.templateId, template[0].id))
        .orderBy(templateExercises.orderIndex);

      return {
        ...template[0],
        template_exercises: templateExercisesList,
      };
    }),

  // Get template by ID
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const template = await ctx.db
        .select()
        .from(workoutTemplates)
        .where(
          and(
            eq(workoutTemplates.id, input.id),
            eq(workoutTemplates.userId, ctx.session.user.id)
          )
        )
        .limit(1);

      if (!template[0]) {
        throw new Error("Template not found");
      }

      // Get template exercises
      const templateExercisesList = await ctx.db
        .select({
          id: templateExercises.id,
          template_id: templateExercises.templateId,
          exercise_id: templateExercises.exerciseId,
          order_index: templateExercises.orderIndex,
          sets: templateExercises.sets,
          reps_min: templateExercises.repsMin,
          reps_max: templateExercises.repsMax,
          rpe_target: templateExercises.rpeTarget,
          exercises: {
            id: exercises.id,
            name: exercises.name,
            muscle_group: exercises.muscleGroup,
            equipment: exercises.equipment,
            is_custom: exercises.isCustom,
            user_id: exercises.userId,
            created_at: exercises.createdAt,
          },
        })
        .from(templateExercises)
        .leftJoin(exercises, eq(templateExercises.exerciseId, exercises.id))
        .where(eq(templateExercises.templateId, template[0].id))
        .orderBy(templateExercises.orderIndex);

      return {
        ...template[0],
        day_number: template[0].dayNumber,
        user_id: template[0].userId,
        created_at: template[0].createdAt,
        updated_at: template[0].updatedAt,
        template_exercises: templateExercisesList,
      };
    }),

  // Create template
  create: protectedProcedure
    .input(CreateWorkoutTemplateSchema)
    .mutation(async ({ input, ctx }) => {
      // First create the template
      const [template] = await ctx.db
        .insert(workoutTemplates)
        .values({
          userId: ctx.session.user.id,
          name: input.name,
          dayNumber: input.dayNumber,
        })
        .returning();

      if (!template) {
        throw new Error("Failed to create template");
      }

      // Then create the exercises if provided
      if (input.exercises && input.exercises.length > 0) {
        const templateExerciseValues = input.exercises.map(
          (exercise, index) => ({
            templateId: template.id,
            exerciseId: exercise.exerciseId,
            orderIndex: exercise.orderIndex ?? index,
            sets: exercise.sets,
            repsMin: exercise.repsMin,
            repsMax: exercise.repsMax,
            rpeTarget: exercise.rpeTarget,
          })
        );

        try {
          await ctx.db.insert(templateExercises).values(templateExerciseValues);
        } catch (error) {
          // Clean up the template if exercise creation fails
          await ctx.db
            .delete(workoutTemplates)
            .where(eq(workoutTemplates.id, template.id));

          throw new Error(`Failed to create template exercises: ${error}`);
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
      const [updated] = await ctx.db
        .update(workoutTemplates)
        .set({
          name: input.data.name,
          dayNumber: input.data.dayNumber,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(workoutTemplates.id, input.id),
            eq(workoutTemplates.userId, ctx.session.user.id)
          )
        )
        .returning();

      if (!updated) {
        throw new Error("Template not found or not owned by user");
      }

      return updated;
    }),

  // Delete template
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const result = await ctx.db
        .delete(workoutTemplates)
        .where(
          and(
            eq(workoutTemplates.id, input.id),
            eq(workoutTemplates.userId, ctx.session.user.id)
          )
        )
        .returning();

      if (!result.length) {
        throw new Error("Template not found or not owned by user");
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
      // Get the original template
      const originalTemplate = await ctx.db
        .select()
        .from(workoutTemplates)
        .where(
          and(
            eq(workoutTemplates.id, input.id),
            eq(workoutTemplates.userId, ctx.session.user.id)
          )
        )
        .limit(1);

      if (!originalTemplate[0]) {
        throw new Error("Template not found");
      }

      // Get the original template exercises
      const originalExercises = await ctx.db
        .select()
        .from(templateExercises)
        .where(eq(templateExercises.templateId, input.id));

      // Create the new template
      const [newTemplate] = await ctx.db
        .insert(workoutTemplates)
        .values({
          userId: ctx.session.user.id,
          name: input.newName,
          dayNumber: input.newDayNumber,
        })
        .returning();

      if (!newTemplate) {
        throw new Error("Failed to duplicate template");
      }

      // Create the new template exercises
      if (originalExercises.length > 0) {
        const newTemplateExercises = originalExercises.map((exercise) => ({
          templateId: newTemplate.id,
          exerciseId: exercise.exerciseId,
          orderIndex: exercise.orderIndex,
          sets: exercise.sets,
          repsMin: exercise.repsMin,
          repsMax: exercise.repsMax,
          rpeTarget: exercise.rpeTarget,
        }));

        await ctx.db.insert(templateExercises).values(newTemplateExercises);
      }

      return newTemplate;
    }),
});
