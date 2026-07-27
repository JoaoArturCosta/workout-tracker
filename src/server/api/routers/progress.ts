import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import { z } from "zod";

import {
  bodyWeightLogs,
  sessionExercises,
  sessionSets,
  workoutSessions,
} from "@/lib/db/schema";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { summarizeCompletedSets } from "@/server/workouts/progress-analytics";

const TimeframeSchema = z.enum(["week", "month", "year"]);

const startOfTimeframe = (timeframe: z.infer<typeof TimeframeSchema>) => {
  const days = { week: 7, month: 30, year: 365 }[timeframe];
  const start = new Date();
  start.setDate(start.getDate() - days);
  return start;
};

const round = (value: number) => Math.round(value * 100) / 100;

export const progressRouter = createTRPCRouter({
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
        timeframe: TimeframeSchema.optional(),
        limit: z.number().int().min(1).max(100).default(50),
      })
    )
    .query(async ({ input, ctx }) => {
      const conditions = [eq(bodyWeightLogs.userId, ctx.session.user.id)];
      if (input.timeframe) {
        conditions.push(
          gte(bodyWeightLogs.loggedAt, startOfTimeframe(input.timeframe))
        );
      }
      return ctx.db
        .select()
        .from(bodyWeightLogs)
        .where(and(...conditions))
        .orderBy(desc(bodyWeightLogs.loggedAt))
        .limit(input.limit);
    }),

  getOneRM: protectedProcedure
    .input(z.object({ exerciseId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const rows = await ctx.db
        .select({
          externalLoadKg: sessionSets.externalLoadKg,
          actualReps: sessionSets.actualReps,
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
            eq(workoutSessions.userId, ctx.session.user.id),
            inArray(workoutSessions.status, ["Completed", "Partial"]),
            eq(sessionSets.status, "Completed"),
            eq(sessionSets.mode, "Reps"),
            eq(sessionExercises.mode, "Reps"),
            eq(sessionExercises.exerciseId, input.exerciseId)
          )
        );
      const calculations = rows.flatMap((row) =>
        row.actualReps === null
          ? []
          : [
              {
                weight: Number(row.externalLoadKg),
                reps: row.actualReps,
                oneRM: round(
                  Number(row.externalLoadKg) * (1 + row.actualReps / 30)
                ),
              },
            ]
      );
      if (!calculations.length) return null;
      return {
        oneRepMax: Math.max(...calculations.map((row) => row.oneRM)),
        calculations,
      };
    }),

  getVolumeProgression: protectedProcedure
    .input(
      z.object({
        exerciseId: z.string().uuid(),
        timeframe: TimeframeSchema.optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const rows = await ctx.db
        .select({
          externalLoadKg: sessionSets.externalLoadKg,
          actualReps: sessionSets.actualReps,
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
            eq(workoutSessions.userId, ctx.session.user.id),
            inArray(workoutSessions.status, ["Completed", "Partial"]),
            eq(sessionSets.status, "Completed"),
            eq(sessionSets.mode, "Reps"),
            eq(sessionExercises.mode, "Reps"),
            eq(sessionExercises.exerciseId, input.exerciseId),
            gte(
              workoutSessions.startTime,
              startOfTimeframe(input.timeframe ?? "month")
            )
          )
        )
        .orderBy(asc(workoutSessions.startTime));

      const volumeByDate = new Map<string, number>();
      for (const row of rows) {
        if (row.actualReps === null) continue;
        const date = row.startTime.toISOString().slice(0, 10);
        const volume = Number(row.externalLoadKg) * row.actualReps;
        volumeByDate.set(date, (volumeByDate.get(date) ?? 0) + volume);
      }
      return [...volumeByDate].map(([date, volume]) => ({
        date,
        volume: round(volume),
      }));
    }),

  getStrengthStandards: protectedProcedure
    .input(z.object({ exerciseId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const rows = await ctx.db
        .select({
          externalLoadKg: sessionSets.externalLoadKg,
          actualReps: sessionSets.actualReps,
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
            eq(workoutSessions.userId, ctx.session.user.id),
            inArray(workoutSessions.status, ["Completed", "Partial"]),
            eq(sessionSets.status, "Completed"),
            eq(sessionSets.mode, "Reps"),
            eq(sessionExercises.mode, "Reps"),
            eq(sessionExercises.exerciseId, input.exerciseId)
          )
        );
      const oneRepMaxes = rows.flatMap((row) =>
        row.actualReps === null
          ? []
          : [
              Number(row.externalLoadKg) *
                (1 + row.actualReps / 30),
            ]
      );
      if (!oneRepMaxes.length) return null;
      const oneRM = Math.max(...oneRepMaxes);
      const standards = {
        beginner: oneRM * 0.5,
        novice: oneRM * 0.75,
        intermediate: oneRM,
        advanced: oneRM * 1.5,
        elite: oneRM * 2,
      };
      let currentLevel = "beginner";
      if (oneRM >= standards.elite) currentLevel = "elite";
      else if (oneRM >= standards.advanced) currentLevel = "advanced";
      else if (oneRM >= standards.intermediate) {
        currentLevel = "intermediate";
      } else if (oneRM >= standards.novice) currentLevel = "novice";
      return {
        userOneRM: round(oneRM),
        currentLevel,
        standards: {
          beginner: round(standards.beginner),
          novice: round(standards.novice),
          intermediate: round(standards.intermediate),
          advanced: round(standards.advanced),
          elite: round(standards.elite),
        },
      };
    }),

  getSessionHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).default(20),
        exerciseId: z.string().uuid().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const sessions = await ctx.db
        .select({
          id: workoutSessions.id,
          status: workoutSessions.status,
          templateName: workoutSessions.templateName,
          templateDayNumber: workoutSessions.templateDayNumber,
          startTime: workoutSessions.startTime,
          endTime: workoutSessions.endTime,
          durationMinutes: workoutSessions.durationMinutes,
        })
        .from(workoutSessions)
        .where(
          and(
            eq(workoutSessions.userId, ctx.session.user.id),
            inArray(workoutSessions.status, ["Completed", "Partial"])
          )
        )
        .orderBy(desc(workoutSessions.startTime))
        .limit(input.limit);
      if (!sessions.length) return [];

      const rows = await ctx.db
        .select({
          sessionId: sessionExercises.sessionId,
          occurrenceId: sessionExercises.id,
          exerciseId: sessionExercises.exerciseId,
          exerciseName: sessionExercises.exerciseName,
          orderIndex: sessionExercises.orderIndex,
          mode: sessionExercises.mode,
          set: sessionSets,
        })
        .from(sessionExercises)
        .innerJoin(
          sessionSets,
          eq(sessionSets.sessionExerciseId, sessionExercises.id)
        )
        .where(
          and(
            inArray(
              sessionExercises.sessionId,
              sessions.map((session) => session.id)
            ),
            eq(sessionSets.status, "Completed"),
            input.exerciseId
              ? eq(sessionExercises.exerciseId, input.exerciseId)
              : undefined
          )
        )
        .orderBy(
          asc(sessionExercises.orderIndex),
          asc(sessionSets.setNumber)
        );

      return sessions.map((session) => {
        const sessionRows = rows.filter(
          (row) => row.sessionId === session.id
        );
        const occurrenceMap = new Map<
          string,
          {
            id: string;
            exerciseId: string;
            exerciseName: string;
            orderIndex: number;
            mode: "Reps" | "Duration";
            sets: (typeof sessionSets.$inferSelect)[];
          }
        >();
        for (const row of sessionRows) {
          const occurrence =
            occurrenceMap.get(row.occurrenceId) ?? {
              id: row.occurrenceId,
              exerciseId: row.exerciseId,
              exerciseName: row.exerciseName ?? "Exercise",
              orderIndex: row.orderIndex,
              mode: row.mode,
              sets: [],
            };
          occurrence.sets.push(row.set);
          occurrenceMap.set(row.occurrenceId, occurrence);
        }
        const stats = summarizeCompletedSets(
          sessionRows.map((row) => ({
            workoutStatus: session.status,
            setStatus: row.set.status,
            mode: row.set.mode,
            externalLoadKg: Number(row.set.externalLoadKg),
            actualReps: row.set.actualReps,
            actualSeconds: row.set.actualSeconds,
          }))
        );
        return {
          ...session,
          templateName: session.templateName ?? "Workout",
          duration_minutes: session.durationMinutes,
          occurrences: [...occurrenceMap.values()],
          stats: {
            ...stats,
            totalVolume: round(stats.totalVolume),
            totalSets: stats.completedSetCount,
            exerciseCount: occurrenceMap.size,
          },
        };
      });
    }),

  getDurationSummary: protectedProcedure
    .input(
      z.object({
        timeframe: TimeframeSchema.optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const conditions = [
        eq(workoutSessions.userId, ctx.session.user.id),
        inArray(workoutSessions.status, ["Completed", "Partial"]),
        eq(sessionSets.status, "Completed"),
        eq(sessionSets.mode, "Duration"),
        eq(sessionExercises.mode, "Duration"),
      ];
      if (input.timeframe) {
        conditions.push(
          gte(
            workoutSessions.startTime,
            startOfTimeframe(input.timeframe)
          )
        );
      }
      const rows = await ctx.db
        .select({ actualSeconds: sessionSets.actualSeconds })
        .from(sessionSets)
        .innerJoin(
          sessionExercises,
          eq(sessionSets.sessionExerciseId, sessionExercises.id)
        )
        .innerJoin(
          workoutSessions,
          eq(sessionExercises.sessionId, workoutSessions.id)
        )
        .where(and(...conditions));
      return {
        completedDurationSets: rows.length,
        totalActualSeconds: rows.reduce(
          (sum, row) => sum + (row.actualSeconds ?? 0),
          0
        ),
      };
    }),

  getPersonalRecords: protectedProcedure
    .input(
      z.object({
        exerciseId: z.string().uuid().optional(),
        timeframe: z
          .enum(["week", "month", "year", "all"])
          .default("all"),
      })
    )
    .query(async ({ input, ctx }) => {
      const conditions = [
        eq(workoutSessions.userId, ctx.session.user.id),
        inArray(workoutSessions.status, ["Completed", "Partial"]),
        eq(sessionSets.status, "Completed"),
        eq(sessionSets.mode, "Reps"),
        eq(sessionExercises.mode, "Reps"),
      ];
      if (input.exerciseId) {
        conditions.push(
          eq(sessionExercises.exerciseId, input.exerciseId)
        );
      }
      if (input.timeframe !== "all") {
        conditions.push(
          gte(
            workoutSessions.startTime,
            startOfTimeframe(input.timeframe)
          )
        );
      }
      const rows = await ctx.db
        .select({
          exerciseId: sessionExercises.exerciseId,
          exerciseName: sessionExercises.exerciseName,
          externalLoadKg: sessionSets.externalLoadKg,
          actualReps: sessionSets.actualReps,
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
        .where(and(...conditions));

      type RecordCard = {
        exerciseId: string;
        exerciseName: string;
        maxWeight: { weight: number; reps: number; date: string };
        maxVolume: {
          weight: number;
          reps: number;
          volume: number;
          date: string;
        };
        maxOneRM: {
          weight: number;
          reps: number;
          oneRM: number;
          date: string;
        };
      };
      const cards = new Map<string, RecordCard>();
      for (const row of rows) {
        if (row.actualReps === null) continue;
        const weight = Number(row.externalLoadKg);
        const reps = row.actualReps;
        const date = row.startTime.toISOString();
        const volume = weight * reps;
        const oneRM = weight * (1 + reps / 30);
        const card = cards.get(row.exerciseId) ?? {
          exerciseId: row.exerciseId,
          exerciseName: row.exerciseName ?? "Exercise",
          maxWeight: { weight, reps, date },
          maxVolume: { weight, reps, volume, date },
          maxOneRM: { weight, reps, oneRM, date },
        };
        if (weight > card.maxWeight.weight) {
          card.maxWeight = { weight, reps, date };
        }
        if (volume > card.maxVolume.volume) {
          card.maxVolume = { weight, reps, volume, date };
        }
        if (oneRM > card.maxOneRM.oneRM) {
          card.maxOneRM = { weight, reps, oneRM, date };
        }
        cards.set(row.exerciseId, card);
      }
      return [...cards.values()].map((card) => ({
        ...card,
        maxVolume: {
          ...card.maxVolume,
          volume: round(card.maxVolume.volume),
        },
        maxOneRM: {
          ...card.maxOneRM,
          oneRM: round(card.maxOneRM.oneRM),
        },
      }));
    }),
});
