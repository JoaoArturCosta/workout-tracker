import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  decimal,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const muscleGroupEnum = pgEnum("muscle_group", [
  "chest",
  "back",
  "shoulders",
  "arms",
  "legs",
  "core",
]);

export const weightUnitEnum = pgEnum("weight_unit", ["kg", "lbs"]);

// Users table (managed by NextAuth/Supabase Auth)
export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: varchar("email", { length: 255 }),
  name: varchar("name", { length: 255 }),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Exercises table
export const exercises = pgTable(
  "exercises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    muscleGroup: muscleGroupEnum("muscle_group").notNull(),
    equipment: text("equipment"),
    isCustom: boolean("is_custom").default(false),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    muscleGroupIdx: index("idx_exercises_muscle_group").on(table.muscleGroup),
    userIdIdx: index("idx_exercises_user_id").on(table.userId),
  })
);

// Workout templates table
export const workoutTemplates = pgTable(
  "workout_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 50 }).notNull(),
    dayNumber: integer("day_number").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("idx_workout_templates_user_id").on(table.userId),
    dayNumberIdx: index("idx_workout_templates_day_number").on(table.dayNumber),
  })
);

// Template exercises table
export const templateExercises = pgTable(
  "template_exercises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => workoutTemplates.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull(),
    sets: integer("sets").notNull(),
    repsMin: integer("reps_min").notNull(),
    repsMax: integer("reps_max").notNull(),
    rpeTarget: integer("rpe_target"),
  },
  (table) => ({
    templateIdIdx: index("idx_template_exercises_template_id").on(
      table.templateId
    ),
  })
);

// Workout sessions table
export const workoutSessions = pgTable(
  "workout_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    templateId: uuid("template_id")
      .notNull()
      .references(() => workoutTemplates.id, { onDelete: "cascade" }),
    startTime: timestamp("start_time").defaultNow().notNull(),
    endTime: timestamp("end_time"),
    durationMinutes: integer("duration_minutes"),
    completed: boolean("completed").default(false),
  },
  (table) => ({
    userIdIdx: index("idx_workout_sessions_user_id").on(table.userId),
  })
);

// Session exercises table
export const sessionExercises = pgTable(
  "session_exercises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => workoutSessions.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull(),
  },
  (table) => ({
    sessionIdIdx: index("idx_session_exercises_session_id").on(table.sessionId),
  })
);

// Session sets table
export const sessionSets = pgTable(
  "session_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionExerciseId: uuid("session_exercise_id")
      .notNull()
      .references(() => sessionExercises.id, { onDelete: "cascade" }),
    setNumber: integer("set_number").notNull(),
    weight: decimal("weight", { precision: 5, scale: 2 }).notNull(),
    reps: integer("reps").notNull(),
    rpe: integer("rpe"),
    completed: boolean("completed").default(false),
  },
  (table) => ({
    sessionExerciseIdIdx: index("idx_session_sets_session_exercise_id").on(
      table.sessionExerciseId
    ),
  })
);

// Body weight logs table
export const bodyWeightLogs = pgTable(
  "body_weight_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weight: decimal("weight", { precision: 5, scale: 2 }).notNull(),
    unit: weightUnitEnum("unit").default("kg"),
    loggedAt: timestamp("logged_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("idx_body_weight_logs_user_id").on(table.userId),
  })
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  exercises: many(exercises),
  workoutTemplates: many(workoutTemplates),
  workoutSessions: many(workoutSessions),
  bodyWeightLogs: many(bodyWeightLogs),
}));

export const exercisesRelations = relations(exercises, ({ one, many }) => ({
  user: one(users, {
    fields: [exercises.userId],
    references: [users.id],
  }),
  templateExercises: many(templateExercises),
  sessionExercises: many(sessionExercises),
}));

export const workoutTemplatesRelations = relations(
  workoutTemplates,
  ({ one, many }) => ({
    user: one(users, {
      fields: [workoutTemplates.userId],
      references: [users.id],
    }),
    templateExercises: many(templateExercises),
    workoutSessions: many(workoutSessions),
  })
);

export const templateExercisesRelations = relations(
  templateExercises,
  ({ one }) => ({
    template: one(workoutTemplates, {
      fields: [templateExercises.templateId],
      references: [workoutTemplates.id],
    }),
    exercise: one(exercises, {
      fields: [templateExercises.exerciseId],
      references: [exercises.id],
    }),
  })
);

export const workoutSessionsRelations = relations(
  workoutSessions,
  ({ one, many }) => ({
    user: one(users, {
      fields: [workoutSessions.userId],
      references: [users.id],
    }),
    template: one(workoutTemplates, {
      fields: [workoutSessions.templateId],
      references: [workoutTemplates.id],
    }),
    sessionExercises: many(sessionExercises),
  })
);

export const sessionExercisesRelations = relations(
  sessionExercises,
  ({ one, many }) => ({
    session: one(workoutSessions, {
      fields: [sessionExercises.sessionId],
      references: [workoutSessions.id],
    }),
    exercise: one(exercises, {
      fields: [sessionExercises.exerciseId],
      references: [exercises.id],
    }),
    sessionSets: many(sessionSets),
  })
);

export const sessionSetsRelations = relations(sessionSets, ({ one }) => ({
  sessionExercise: one(sessionExercises, {
    fields: [sessionSets.sessionExerciseId],
    references: [sessionExercises.id],
  }),
}));

export const bodyWeightLogsRelations = relations(bodyWeightLogs, ({ one }) => ({
  user: one(users, {
    fields: [bodyWeightLogs.userId],
    references: [users.id],
  }),
}));

// Export types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Exercise = typeof exercises.$inferSelect;
export type NewExercise = typeof exercises.$inferInsert;

export type WorkoutTemplate = typeof workoutTemplates.$inferSelect;
export type NewWorkoutTemplate = typeof workoutTemplates.$inferInsert;

export type TemplateExercise = typeof templateExercises.$inferSelect;
export type NewTemplateExercise = typeof templateExercises.$inferInsert;

export type WorkoutSession = typeof workoutSessions.$inferSelect;
export type NewWorkoutSession = typeof workoutSessions.$inferInsert;

export type SessionExercise = typeof sessionExercises.$inferSelect;
export type NewSessionExercise = typeof sessionExercises.$inferInsert;

export type SessionSet = typeof sessionSets.$inferSelect;
export type NewSessionSet = typeof sessionSets.$inferInsert;

export type BodyWeightLog = typeof bodyWeightLogs.$inferSelect;
export type NewBodyWeightLog = typeof bodyWeightLogs.$inferInsert;
