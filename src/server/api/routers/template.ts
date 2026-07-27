import { TRPCError } from "@trpc/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import {
  CreateTemplateExerciseSchema,
  CreateWorkoutTemplateSchema,
} from "@/lib/schemas";
import {
  exercises,
  templateExercises,
  workoutTemplates,
} from "@/lib/db/schema";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

const TemplateInputSchema = CreateWorkoutTemplateSchema.omit({
  userId: true,
});

const occurrenceValues = (
  templateId: string,
  items: z.infer<typeof CreateTemplateExerciseSchema>[]
) =>
  items.map((occurrence, index) => ({
    templateId,
    exerciseId: occurrence.exerciseId,
    orderIndex: occurrence.orderIndex ?? index,
    sets: occurrence.sets,
    mode: occurrence.mode,
    repsMin: occurrence.mode === "Reps" ? occurrence.repsMin : null,
    repsMax: occurrence.mode === "Reps" ? occurrence.repsMax : null,
    targetSeconds:
      occurrence.mode === "Duration" ? occurrence.targetSeconds : null,
    rpeTarget: occurrence.rpeTarget ?? null,
    restTimeSeconds: occurrence.restTimeSeconds ?? 120,
  }));

const templateSelection = {
  id: workoutTemplates.id,
  name: workoutTemplates.name,
  dayNumber: workoutTemplates.dayNumber,
  archivedAt: workoutTemplates.archivedAt,
  userId: workoutTemplates.userId,
  createdAt: workoutTemplates.createdAt,
  updatedAt: workoutTemplates.updatedAt,
};

const occurrenceSelection = {
  id: templateExercises.id,
  templateId: templateExercises.templateId,
  exerciseId: templateExercises.exerciseId,
  orderIndex: templateExercises.orderIndex,
  sets: templateExercises.sets,
  mode: templateExercises.mode,
  repsMin: templateExercises.repsMin,
  repsMax: templateExercises.repsMax,
  targetSeconds: templateExercises.targetSeconds,
  rpeTarget: templateExercises.rpeTarget,
  restTimeSeconds: templateExercises.restTimeSeconds,
  exercise: {
    id: exercises.id,
    name: exercises.name,
    muscleGroup: exercises.muscleGroup,
    equipment: exercises.equipment,
    isCustom: exercises.isCustom,
    userId: exercises.userId,
    createdAt: exercises.createdAt,
  },
};

export const templateRouter = createTRPCRouter({
  getAll: protectedProcedure
    .input(
      z
        .object({ includeArchived: z.boolean().default(false) })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      const filters = [eq(workoutTemplates.userId, ctx.session.user.id)];
      if (!input?.includeArchived) {
        filters.push(isNull(workoutTemplates.archivedAt));
      }
      const templates = await ctx.db
        .select(templateSelection)
        .from(workoutTemplates)
        .where(and(...filters))
        .orderBy(asc(workoutTemplates.dayNumber));

      return Promise.all(
        templates.map(async (template) => ({
          ...template,
          template_exercises: await ctx.db
            .select(occurrenceSelection)
            .from(templateExercises)
            .leftJoin(
              exercises,
              eq(templateExercises.exerciseId, exercises.id)
            )
            .where(eq(templateExercises.templateId, template.id))
            .orderBy(asc(templateExercises.orderIndex)),
        }))
      );
    }),

  getByDay: protectedProcedure
    .input(z.object({ dayNumber: z.number().int().min(1).max(7) }))
    .query(async ({ input, ctx }) => {
      const [template] = await ctx.db
        .select(templateSelection)
        .from(workoutTemplates)
        .where(
          and(
            eq(workoutTemplates.userId, ctx.session.user.id),
            eq(workoutTemplates.dayNumber, input.dayNumber),
            isNull(workoutTemplates.archivedAt)
          )
        )
        .limit(1);
      if (!template) return null;

      return {
        ...template,
        template_exercises: await ctx.db
          .select(occurrenceSelection)
          .from(templateExercises)
          .leftJoin(
            exercises,
            eq(templateExercises.exerciseId, exercises.id)
          )
          .where(eq(templateExercises.templateId, template.id))
          .orderBy(asc(templateExercises.orderIndex)),
      };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const [template] = await ctx.db
        .select(templateSelection)
        .from(workoutTemplates)
        .where(
          and(
            eq(workoutTemplates.id, input.id),
            eq(workoutTemplates.userId, ctx.session.user.id)
          )
        )
        .limit(1);
      if (!template) throw new TRPCError({ code: "NOT_FOUND" });

      return {
        ...template,
        template_exercises: await ctx.db
          .select(occurrenceSelection)
          .from(templateExercises)
          .leftJoin(
            exercises,
            eq(templateExercises.exerciseId, exercises.id)
          )
          .where(eq(templateExercises.templateId, template.id))
          .orderBy(asc(templateExercises.orderIndex)),
      };
    }),

  create: protectedProcedure
    .input(TemplateInputSchema)
    .mutation(async ({ input, ctx }) =>
      ctx.db.transaction(async (tx) => {
        const [template] = await tx
          .insert(workoutTemplates)
          .values({
            userId: ctx.session.user.id,
            name: input.name,
            dayNumber: input.dayNumber,
          })
          .returning();
        if (input.exercises?.length) {
          await tx
            .insert(templateExercises)
            .values(occurrenceValues(template.id, input.exercises));
        }
        return template;
      })
    ),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: TemplateInputSchema.partial(),
      })
    )
    .mutation(async ({ input, ctx }) =>
      ctx.db.transaction(async (tx) => {
        const [template] = await tx
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
        if (!template) throw new TRPCError({ code: "NOT_FOUND" });

        if (input.data.exercises !== undefined) {
          await tx
            .delete(templateExercises)
            .where(eq(templateExercises.templateId, input.id));
          if (input.data.exercises.length) {
            await tx
              .insert(templateExercises)
              .values(occurrenceValues(input.id, input.data.exercises));
          }
        }
        return template;
      })
    ),

  archive: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const [template] = await ctx.db
        .update(workoutTemplates)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(workoutTemplates.id, input.id),
            eq(workoutTemplates.userId, ctx.session.user.id),
            isNull(workoutTemplates.archivedAt)
          )
        )
        .returning();
      if (!template) throw new TRPCError({ code: "NOT_FOUND" });
      return template;
    }),

  restore: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const [template] = await ctx.db
        .update(workoutTemplates)
        .set({ archivedAt: null, updatedAt: new Date() })
        .where(
          and(
            eq(workoutTemplates.id, input.id),
            eq(workoutTemplates.userId, ctx.session.user.id)
          )
        )
        .returning();
      if (!template) throw new TRPCError({ code: "NOT_FOUND" });
      return template;
    }),

  duplicate: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        newDayNumber: z.number().int().min(1).max(7),
        newName: z.string().trim().min(1).max(50),
      })
    )
    .mutation(async ({ input, ctx }) =>
      ctx.db.transaction(async (tx) => {
        const [source] = await tx
          .select()
          .from(workoutTemplates)
          .where(
            and(
              eq(workoutTemplates.id, input.id),
              eq(workoutTemplates.userId, ctx.session.user.id)
            )
          )
          .limit(1);
        if (!source) throw new TRPCError({ code: "NOT_FOUND" });

        const sourceOccurrences = await tx
          .select()
          .from(templateExercises)
          .where(eq(templateExercises.templateId, source.id));
        const [copy] = await tx
          .insert(workoutTemplates)
          .values({
            userId: ctx.session.user.id,
            name: input.newName,
            dayNumber: input.newDayNumber,
          })
          .returning();
        if (sourceOccurrences.length) {
          await tx.insert(templateExercises).values(
            sourceOccurrences.map((sourceOccurrence) => {
              const { id, templateId, ...occurrence } = sourceOccurrence;
              void id;
              void templateId;
              return { ...occurrence, templateId: copy.id };
            })
          );
        }
        return copy;
      })
    ),
});
