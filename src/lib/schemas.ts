import { z } from "zod";

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
export const TemplateExerciseSchema = z.object({
  id: z.string().uuid(),
  templateId: z.string().uuid(),
  exerciseId: z.string().uuid(),
  orderIndex: z.number().min(0),
  sets: z.number().min(1).max(20),
  repsMin: z.number().min(1).max(100),
  repsMax: z.number().min(1).max(100),
  rpeTarget: z.number().min(6).max(10).optional(),
});

export const CreateTemplateExerciseSchema = TemplateExerciseSchema.omit({
  id: true,
  templateId: true,
});

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
export const SessionSetSchema = z.object({
  id: z.string().uuid(),
  sessionExerciseId: z.string().uuid(),
  setNumber: z.number().min(1),
  weight: z.number().positive().max(1000),
  reps: z.number().min(1).max(100),
  rpe: z.number().min(6).max(10).optional(),
  completed: z.boolean().default(false),
});

export const CreateSessionSetSchema = SessionSetSchema.omit({
  id: true,
  sessionExerciseId: true,
});

export const UpdateSessionSetSchema = SessionSetSchema.partial().extend({
  id: z.string().uuid(),
});

export const SessionExerciseSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  exerciseId: z.string().uuid(),
  orderIndex: z.number().min(0),
  sets: z.array(SessionSetSchema).optional(),
});

export const WorkoutSessionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  templateId: z.string().uuid(),
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
