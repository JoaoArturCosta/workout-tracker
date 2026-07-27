import { and, asc, eq } from "drizzle-orm";

import type { Database } from "@/lib/db";
import {
  exercises,
  sessionExercises,
  sessionSets,
  templateExercises,
  workoutDevices,
  workoutSessions,
  workoutTemplates,
} from "@/lib/db/schema";
import { getWorkoutSnapshot } from "./queries";

export type StartWorkoutErrorCode =
  | "TEMPLATE_NOT_FOUND"
  | "TEMPLATE_ARCHIVED"
  | "EMPTY_TEMPLATE"
  | "ACTIVE_WORKOUT_EXISTS"
  | "START_FAILED";

export class StartWorkoutError extends Error {
  constructor(
    readonly code: StartWorkoutErrorCode,
    message: string
  ) {
    super(message);
    this.name = "StartWorkoutError";
  }
}

const isUniqueViolation = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "23505";

export const startWorkout = async ({
  db,
  userId,
  templateId,
  deviceId,
  deviceLabel,
  now = new Date(),
}: {
  db: Database;
  userId: string;
  templateId: string;
  deviceId: string;
  deviceLabel?: string;
  now?: Date;
}) => {
  try {
    return await db.transaction(async (tx) => {
      const [template] = await tx
        .select()
        .from(workoutTemplates)
        .where(
          and(
            eq(workoutTemplates.id, templateId),
            eq(workoutTemplates.userId, userId)
          )
        )
        .limit(1);

      if (!template) {
        throw new StartWorkoutError(
          "TEMPLATE_NOT_FOUND",
          "Workout template not found"
        );
      }
      if (template.archivedAt) {
        throw new StartWorkoutError(
          "TEMPLATE_ARCHIVED",
          "Archived workout templates cannot start a workout"
        );
      }

      const plan = await tx
        .select({
          templateExercise: templateExercises,
          exerciseName: exercises.name,
        })
        .from(templateExercises)
        .innerJoin(exercises, eq(templateExercises.exerciseId, exercises.id))
        .where(eq(templateExercises.templateId, templateId))
        .orderBy(asc(templateExercises.orderIndex));

      if (plan.length === 0) {
        throw new StartWorkoutError(
          "EMPTY_TEMPLATE",
          "Add at least one Exercise occurrence before starting"
        );
      }

      const [device] = await tx
        .insert(workoutDevices)
        .values({
          userId,
          deviceId,
          label: deviceLabel,
          lastSeenAt: now,
        })
        .onConflictDoUpdate({
          target: [workoutDevices.userId, workoutDevices.deviceId],
          set: {
            label: deviceLabel,
            lastSeenAt: now,
          },
        })
        .returning({ id: workoutDevices.id });

      const [session] = await tx
        .insert(workoutSessions)
        .values({
          userId,
          templateId,
          status: "Active",
          revision: 0,
          controllerEpoch: 1,
          controllerDeviceId: device.id,
          templateName: template.name,
          templateDayNumber: template.dayNumber,
          startTime: now,
          completed: false,
        })
        .returning({ id: workoutSessions.id });

      for (const { templateExercise, exerciseName } of plan) {
        const [occurrence] = await tx
          .insert(sessionExercises)
          .values({
            sessionId: session.id,
            templateExerciseId: templateExercise.id,
            exerciseId: templateExercise.exerciseId,
            exerciseName,
            orderIndex: templateExercise.orderIndex,
            setCount: templateExercise.sets,
            mode: templateExercise.mode,
            repsMin: templateExercise.repsMin,
            repsMax: templateExercise.repsMax,
            targetSeconds: templateExercise.targetSeconds,
            rpeTarget: templateExercise.rpeTarget,
            restTimeSeconds: templateExercise.restTimeSeconds ?? 120,
          })
          .returning({ id: sessionExercises.id });

        await tx.insert(sessionSets).values(
          Array.from({ length: templateExercise.sets }, (_, index) => ({
            sessionExerciseId: occurrence.id,
            setNumber: index + 1,
            status: "Pending" as const,
            mode: templateExercise.mode,
            weight: "0",
            reps: 0,
            externalLoadKg: 0,
            completed: false,
          }))
        );
      }

      const snapshot = await getWorkoutSnapshot({
        db: tx,
        userId,
        sessionId: session.id,
      });
      if (!snapshot) {
        throw new StartWorkoutError(
          "START_FAILED",
          "Workout could not be loaded after start"
        );
      }
      return snapshot;
    });
  } catch (error) {
    if (error instanceof StartWorkoutError) throw error;
    if (isUniqueViolation(error)) {
      throw new StartWorkoutError(
        "ACTIVE_WORKOUT_EXISTS",
        "End the active workout before starting another"
      );
    }
    throw error;
  }
};
