import { z } from "zod";
import { eq, and, ilike } from "drizzle-orm";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
} from "@/server/api/trpc";
import { exercises } from "@/lib/db/schema";
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
      let query = ctx.db.select().from(exercises);

      // Build where conditions
      const conditions = [];

      if (input.muscleGroup) {
        conditions.push(eq(exercises.muscleGroup, input.muscleGroup));
      }

      if (input.search) {
        conditions.push(ilike(exercises.name, `%${input.search}%`));
      }

      if (input.isCustom !== undefined) {
        conditions.push(eq(exercises.isCustom, input.isCustom));
      }

      // Apply where conditions if any
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      // Execute query with ordering
      const result = await query.orderBy(exercises.name);
      return result;
    }),

  // Get user's custom exercises (protected)
  getCustom: protectedProcedure.query(async ({ ctx }) => {
    const result = await ctx.db
      .select()
      .from(exercises)
      .where(
        and(
          eq(exercises.userId, ctx.session.user.id),
          eq(exercises.isCustom, true)
        )
      )
      .orderBy(exercises.name);

    return result;
  }),

  // Get exercise by ID
  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const result = await ctx.db
        .select()
        .from(exercises)
        .where(eq(exercises.id, input.id))
        .limit(1);

      return result[0] || null;
    }),

  // Get exercises by muscle group
  getByMuscleGroup: publicProcedure
    .input(z.object({ muscleGroup: MuscleGroupEnum }))
    .query(async ({ input, ctx }) => {
      const result = await ctx.db
        .select()
        .from(exercises)
        .where(eq(exercises.muscleGroup, input.muscleGroup))
        .orderBy(exercises.name);

      return result;
    }),

  // Create custom exercise (protected)
  create: protectedProcedure
    .input(CreateExerciseSchema)
    .mutation(async ({ input, ctx }) => {
      const result = await ctx.db
        .insert(exercises)
        .values({
          name: input.name,
          muscleGroup: input.muscleGroup,
          equipment: input.equipment,
          isCustom: true,
          userId: ctx.session.user.id,
        })
        .returning();

      return result[0];
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
      const existingExercise = await ctx.db
        .select()
        .from(exercises)
        .where(
          and(
            eq(exercises.id, input.id),
            eq(exercises.userId, ctx.session.user.id),
            eq(exercises.isCustom, true)
          )
        )
        .limit(1);

      if (!existingExercise[0]) {
        throw new Error("Exercise not found or not owned by user");
      }

      const result = await ctx.db
        .update(exercises)
        .set({
          name: input.data.name,
          muscleGroup: input.data.muscleGroup,
          equipment: input.data.equipment,
        })
        .where(eq(exercises.id, input.id))
        .returning();

      return result[0];
    }),

  // Delete custom exercise (protected)
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      // First verify the exercise belongs to the user
      const existingExercise = await ctx.db
        .select()
        .from(exercises)
        .where(
          and(
            eq(exercises.id, input.id),
            eq(exercises.userId, ctx.session.user.id),
            eq(exercises.isCustom, true)
          )
        )
        .limit(1);

      if (!existingExercise[0]) {
        throw new Error("Exercise not found or not owned by user");
      }

      await ctx.db.delete(exercises).where(eq(exercises.id, input.id));

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
      const conditions = [ilike(exercises.name, `%${input.query}%`)];

      if (input.muscleGroup) {
        conditions.push(eq(exercises.muscleGroup, input.muscleGroup));
      }

      if (!input.includeCustom) {
        conditions.push(eq(exercises.isCustom, false));
      }

      const result = await ctx.db
        .select()
        .from(exercises)
        .where(and(...conditions))
        .orderBy(exercises.name)
        .limit(20);

      return result;
    }),
});
