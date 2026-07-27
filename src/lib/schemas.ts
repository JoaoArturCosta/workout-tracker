import { z } from "zod";
import {
  CommandEnvelopeSchema,
  ControllerStateEnum,
  DurationSetResultSchema,
  ExerciseModeEnum,
  RepSetResultSchema,
  RestStatusEnum,
  SetResultSchema,
  SetStatusEnum,
  SyncErrorCodeEnum,
  SyncErrorSchema,
  TemplateOccurrenceSchema,
  WorkoutCommandEnvelopeSchema,
  WorkoutModeEnum,
  WorkoutSetStateSchema,
  WorkoutStatusEnum,
} from "@/lib/workouts/contracts";

export {
  CommandEnvelopeSchema,
  ControllerStateEnum,
  DurationSetResultSchema,
  ExerciseModeEnum,
  RepSetResultSchema,
  RestStatusEnum,
  SetResultSchema,
  SetStatusEnum,
  SyncErrorCodeEnum,
  SyncErrorSchema,
  TemplateOccurrenceSchema,
  WorkoutCommandEnvelopeSchema,
  WorkoutModeEnum,
  WorkoutSetStateSchema,
  WorkoutStatusEnum,
};

// Muscle Groups
export const MuscleGroupEnum = z.enum([
  "chest",
  "back",
  "shoulders",
  "arms",
  "legs",
  "core",
]);

export const WeightUnitEnum = z.enum(["kg", "lbs"]);

// Exercise Schemas
export const ExerciseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  muscleGroup: MuscleGroupEnum,
  equipment: z.string().optional().nullable(),
  isCustom: z.boolean().nullable().default(false),
  userId: z.string().uuid().optional().nullable(),
  createdAt: z.string().datetime().or(z.date()),
});

export const CreateExerciseSchema = z.object({
  name: z.string().min(1).max(100),
  muscleGroup: MuscleGroupEnum,
  equipment: z.string().optional(),
});

// Template Schemas
const TemplateExerciseSchemaBase = z.object({
  id: z.string().uuid(),
  templateId: z.string().uuid(),
  exerciseId: z.string().uuid(),
  orderIndex: z.number().min(0),
  sets: z.number().min(1).max(20),
  repsMin: z.number().int().min(1).max(100).nullable().optional(),
  repsMax: z.number().int().min(1).max(100).nullable().optional(),
  targetSeconds: z.number().int().min(1).max(3600).nullable().optional(),
  mode: WorkoutModeEnum.default("Reps"),
  rpeTarget: z.number().int().min(6).max(10).nullable().optional(),
  restTimeSeconds: z.number().int().min(0).max(3600).default(120),
});

const validateTemplateExerciseTargets = (
  value: {
    mode: "Reps" | "Duration";
    repsMin?: number | null;
    repsMax?: number | null;
    targetSeconds?: number | null;
  },
  ctx: z.RefinementCtx
) => {
  if (value.mode === "Reps") {
    if (value.repsMin == null || value.repsMax == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["repsMin"],
        message: "Rep mode requires rep targets",
      });
    } else if (value.repsMin > value.repsMax) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["repsMax"],
        message: "repsMax must be at least repsMin",
      });
    }
    if (value.targetSeconds != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetSeconds"],
        message: "Rep mode cannot set targetSeconds",
      });
    }
  } else {
    if (value.targetSeconds == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetSeconds"],
        message: "Duration mode requires targetSeconds",
      });
    }
    if (value.repsMin != null || value.repsMax != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["repsMin"],
        message: "Duration mode cannot set rep targets",
      });
    }
  }
};

export const TemplateExerciseSchema = TemplateExerciseSchemaBase.superRefine(
  validateTemplateExerciseTargets
);

export const CreateTemplateExerciseSchema = TemplateExerciseSchemaBase.omit({
  id: true,
  templateId: true,
}).superRefine(validateTemplateExerciseTargets);

export const WorkoutTemplateSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1).max(50),
  dayNumber: z.number().min(1).max(7),
  createdAt: z.string().datetime().or(z.date()),
  updatedAt: z.string().datetime().or(z.date()),
  exercises: z.array(TemplateExerciseSchema).optional(),
});

export const CreateWorkoutTemplateSchema = WorkoutTemplateSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  exercises: true,
}).extend({
  exercises: z.array(CreateTemplateExerciseSchema).optional(),
});

// Session Schemas
const SessionSetSchemaBase = z.object({
  id: z.string().uuid(),
  sessionExerciseId: z.string().uuid(),
  setNumber: z.number().min(1),
  weight: z.number().min(0).max(1000),
  reps: z.number().int().min(1).max(100),
  mode: WorkoutModeEnum.default("Reps"),
  status: SetStatusEnum.default("Pending"),
  externalLoadKg: z.coerce.number().min(0).max(1000).default(0),
  actualReps: z.number().int().min(1).max(100).nullable().optional(),
  actualSeconds: z.number().int().min(1).max(3600).nullable().optional(),
  rpe: z.number().int().min(6).max(10).nullable().optional(),
  completedAt: z.string().datetime().or(z.date()).nullable().optional(),
  completed: z.boolean().default(false),
});

export const SessionSetSchema = SessionSetSchemaBase.superRefine((value, ctx) => {
  if (value.status === "Completed") {
    if (value.mode === "Reps" && value.actualReps == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["actualReps"], message: "Completed Rep set requires actualReps" });
    }
    if (value.mode === "Duration" && value.actualSeconds == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["actualSeconds"], message: "Completed Duration set requires actualSeconds" });
    }
  } else if (value.actualReps != null || value.actualSeconds != null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["status"], message: "Pending and Skipped sets cannot carry a result" });
  }
  if (value.mode === "Reps" && value.actualSeconds != null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["actualSeconds"], message: "Rep set cannot carry actualSeconds" });
  }
  if (value.mode === "Duration" && value.actualReps != null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["actualReps"], message: "Duration set cannot carry actualReps" });
  }
});

export const CreateSessionSetSchema = SessionSetSchemaBase.omit({
  id: true,
  sessionExerciseId: true,
});

export const UpdateSessionSetSchema = SessionSetSchemaBase.partial().extend({
  id: z.string().uuid(),
});

export const SessionExerciseSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  exerciseId: z.string().uuid(),
  templateExerciseId: z.string().uuid().nullable().optional(),
  exerciseName: z.string().min(1).max(100).nullable().optional(),
  orderIndex: z.number().min(0),
  setCount: z.number().int().min(1).max(20).optional(),
  mode: WorkoutModeEnum.default("Reps"),
  repsMin: z.number().int().min(1).max(100).nullable().optional(),
  repsMax: z.number().int().min(1).max(100).nullable().optional(),
  targetSeconds: z.number().int().min(1).max(3600).nullable().optional(),
  rpeTarget: z.number().int().min(6).max(10).nullable().optional(),
  restTimeSeconds: z.number().int().min(0).max(3600).optional(),
  sets: z.array(SessionSetSchema).optional(),
});

export const WorkoutSessionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  templateId: z.string().uuid(),
  status: WorkoutStatusEnum.default("Active"),
  revision: z.number().int().nonnegative().default(0),
  controllerEpoch: z.number().int().positive().default(1),
  controllerDeviceId: z.string().uuid().nullable().optional(),
  templateName: z.string().max(50).nullable().optional(),
  templateDayNumber: z.number().int().min(1).max(7).nullable().optional(),
  startTime: z.string().datetime().or(z.date()),
  endTime: z.string().datetime().or(z.date()).optional(),
  durationMinutes: z.number().positive().optional(),
  completed: z.boolean().default(false),
  exercises: z.array(SessionExerciseSchema).optional(),
});

export const CreateWorkoutSessionSchema = WorkoutSessionSchema.omit({
  id: true,
  endTime: true,
  durationMinutes: true,
  completed: true,
  exercises: true,
});

// Body Weight Schemas
export const BodyWeightLogSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  weight: z.number().positive().max(1000),
  unit: WeightUnitEnum.default("kg"),
  loggedAt: z.string().datetime().or(z.date()),
});

export const CreateBodyWeightLogSchema = BodyWeightLogSchema.omit({
  id: true,
  loggedAt: true,
});

// Progress Schemas
export const ProgressCalculationSchema = z.object({
  oneRepMax: z.number().positive(),
  totalVolume: z.number().positive(),
  averageRpe: z.number().min(6).max(10).optional(),
  personalRecord: z.boolean().default(false),
});

// Form Validation Schemas
export const ExerciseFilterSchema = z.object({
  muscleGroup: MuscleGroupEnum.optional().or(z.literal("")),
  search: z.string().optional(),
  isCustom: z.boolean().optional(),
});

export const ProgressQuerySchema = z.object({
  exerciseId: z.string().uuid(),
  timeframe: z.enum(["week", "month", "year"]).optional(),
  limit: z.number().min(1).max(100).default(10),
});

// Type exports
export type Exercise = z.infer<typeof ExerciseSchema>;
export type CreateExercise = z.infer<typeof CreateExerciseSchema>;
export type WorkoutTemplate = z.infer<typeof WorkoutTemplateSchema>;
export type CreateWorkoutTemplate = z.infer<typeof CreateWorkoutTemplateSchema>;
export type TemplateExercise = z.infer<typeof TemplateExerciseSchema>;
export type CreateTemplateExercise = z.infer<
  typeof CreateTemplateExerciseSchema
>;
export type WorkoutSession = z.infer<typeof WorkoutSessionSchema>;
export type CreateWorkoutSession = z.infer<typeof CreateWorkoutSessionSchema>;
export type SessionExercise = z.infer<typeof SessionExerciseSchema>;
export type SessionSet = z.infer<typeof SessionSetSchema>;
export type CreateSessionSet = z.infer<typeof CreateSessionSetSchema>;
export type UpdateSessionSet = z.infer<typeof UpdateSessionSetSchema>;
export type BodyWeightLog = z.infer<typeof BodyWeightLogSchema>;
export type CreateBodyWeightLog = z.infer<typeof CreateBodyWeightLogSchema>;
export type ProgressCalculation = z.infer<typeof ProgressCalculationSchema>;
export type ExerciseFilter = z.infer<typeof ExerciseFilterSchema>;
export type ProgressQuery = z.infer<typeof ProgressQuerySchema>;
export type MuscleGroup = z.infer<typeof MuscleGroupEnum>;
export type WeightUnit = z.infer<typeof WeightUnitEnum>;
export type WorkoutStatus = z.infer<typeof WorkoutStatusEnum>;
export type SetStatus = z.infer<typeof SetStatusEnum>;
export type WorkoutMode = z.infer<typeof WorkoutModeEnum>;
export type SetResult = z.infer<typeof SetResultSchema>;
export type CommandEnvelope = z.infer<typeof CommandEnvelopeSchema>;
export type SyncError = z.infer<typeof SyncErrorSchema>;
