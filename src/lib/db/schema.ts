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
  primaryKey,
  uniqueIndex,
  check,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

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
export const workoutStatusEnum = pgEnum("workout_status", [
  "Active",
  "Completed",
  "Partial",
  "Discarded",
]);
export const setStatusEnum = pgEnum("set_status", [
  "Pending",
  "Completed",
  "Skipped",
]);
export const workoutModeEnum = pgEnum("workout_mode", ["Reps", "Duration"]);
export const restStatusEnum = pgEnum("rest_status", [
  "Scheduled",
  "Fired",
  "Cancelled",
]);
export const readinessStatusEnum = pgEnum("readiness_status", [
  "Pending",
  "Passed",
  "Failed",
  "Expired",
]);

// NextAuth tables
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }),
  emailVerified: timestamp("email_verified"),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 255 }).notNull(),
  provider: varchar("provider", { length: 255 }).notNull(),
  providerAccountId: varchar("provider_account_id", { length: 255 }).notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: varchar("token_type", { length: 255 }),
  scope: varchar("scope", { length: 255 }),
  id_token: text("id_token"),
  session_state: varchar("session_state", { length: 255 }),
});

export const sessions = pgTable("sessions", {
  sessionToken: varchar("session_token", { length: 255 }).primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires").notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: varchar("identifier", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    expires: timestamp("expires").notNull(),
  },
  (table) => ({
    compositePk: primaryKey({ columns: [table.identifier, table.token] }),
  })
);

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
    archivedAt: timestamp("archived_at"),
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
    mode: workoutModeEnum("mode").notNull().default("Reps"),
    repsMin: integer("reps_min"),
    repsMax: integer("reps_max"),
    targetSeconds: integer("target_seconds"),
    rpeTarget: integer("rpe_target"),
    restTimeSeconds: integer("rest_time_seconds").default(120),
  },
  (table) => ({
    templateIdIdx: index("idx_template_exercises_template_id").on(
      table.templateId
    ),
    exerciseModeUniqueIdx: uniqueIndex(
      "uq_template_exercises_template_exercise_mode"
    ).on(table.templateId, table.exerciseId, table.mode),
    modeTargetsCheck: check(
      "template_exercises_mode_targets_check",
      sql`(
        ("mode" = 'Reps' AND "reps_min" BETWEEN 1 AND 100 AND
          "reps_max" BETWEEN 1 AND 100 AND "reps_min" <= "reps_max" AND
          "target_seconds" IS NULL)
        OR
        ("mode" = 'Duration' AND "target_seconds" BETWEEN 1 AND 3600 AND
          "reps_min" IS NULL AND "reps_max" IS NULL)
      )`
    ),
  })
);

// A stable, per-user device identity. One workout may assign one of these
// devices as its controller; other devices can still read the workout.
export const workoutDevices = pgTable(
  "workout_devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deviceId: varchar("device_id", { length: 128 }).notNull(),
    label: varchar("label", { length: 100 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("idx_workout_devices_user_id").on(table.userId),
    userDeviceUniqueIdx: uniqueIndex("uq_workout_devices_user_device").on(
      table.userId,
      table.deviceId
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
    status: workoutStatusEnum("status").notNull().default("Active"),
    revision: integer("revision").notNull().default(0),
    controllerEpoch: integer("controller_epoch").notNull().default(1),
    controllerDeviceId: uuid("controller_device_id").references(
      () => workoutDevices.id,
      { onDelete: "set null" }
    ),
    templateName: varchar("template_name", { length: 50 }),
    templateDayNumber: integer("template_day_number"),
    startTime: timestamp("start_time").defaultNow().notNull(),
    endTime: timestamp("end_time"),
    durationMinutes: integer("duration_minutes"),
    completed: boolean("completed").default(false),
  },
  (table) => ({
    userIdIdx: index("idx_workout_sessions_user_id").on(table.userId),
    activeUserUniqueIdx: uniqueIndex("uq_workout_sessions_one_active_user")
      .on(table.userId)
      .where(sql`"status" = 'Active'`),
    revisionCheck: check(
      "workout_sessions_revision_check",
      sql`"revision" >= 0 AND "controller_epoch" > 0`
    ),
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
    templateExerciseId: uuid("template_exercise_id").references(
      () => templateExercises.id,
      { onDelete: "set null" }
    ),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    exerciseName: varchar("exercise_name", { length: 100 }),
    orderIndex: integer("order_index").notNull(),
    setCount: integer("set_count").notNull().default(1),
    mode: workoutModeEnum("mode").notNull().default("Reps"),
    repsMin: integer("reps_min"),
    repsMax: integer("reps_max"),
    targetSeconds: integer("target_seconds"),
    rpeTarget: integer("rpe_target"),
    restTimeSeconds: integer("rest_time_seconds").notNull().default(120),
  },
  (table) => ({
    sessionIdIdx: index("idx_session_exercises_session_id").on(table.sessionId),
    sessionOrderUniqueIdx: uniqueIndex("uq_session_exercises_session_order").on(
      table.sessionId,
      table.orderIndex
    ),
    modeTargetsCheck: check(
      "session_exercises_mode_targets_check",
      sql`(
        ("mode" = 'Reps' AND "reps_min" BETWEEN 1 AND 100 AND
          "reps_max" BETWEEN 1 AND 100 AND "reps_min" <= "reps_max" AND
          "target_seconds" IS NULL)
        OR
        ("mode" = 'Duration' AND "target_seconds" BETWEEN 1 AND 3600 AND
          "reps_min" IS NULL AND "reps_max" IS NULL)
      )`
    ),
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
    status: setStatusEnum("status").notNull().default("Pending"),
    mode: workoutModeEnum("mode").notNull().default("Reps"),
    weight: decimal("weight", { precision: 5, scale: 2 }).notNull(),
    reps: integer("reps").notNull(),
    externalLoadKg: decimal("external_load_kg", { precision: 7, scale: 3 })
      .$type<number>()
      .notNull()
      .default(0),
    actualReps: integer("actual_reps"),
    actualSeconds: integer("actual_seconds"),
    rpe: integer("rpe"),
    completedAt: timestamp("completed_at"),
    completed: boolean("completed").default(false),
  },
  (table) => ({
    sessionExerciseIdIdx: index("idx_session_sets_session_exercise_id").on(
      table.sessionExerciseId
    ),
    setPositionUniqueIdx: uniqueIndex("uq_session_sets_exercise_set_number").on(
      table.sessionExerciseId,
      table.setNumber
    ),
    resultCheck: check(
      "session_sets_status_result_check",
      sql`(
        ("status" IN ('Pending', 'Skipped') AND "actual_reps" IS NULL AND
          "actual_seconds" IS NULL AND "completed_at" IS NULL)
        OR
        ("status" = 'Completed' AND "external_load_kg" BETWEEN 0 AND 1000 AND
          (("mode" = 'Reps' AND "actual_reps" BETWEEN 1 AND 100 AND
            "actual_seconds" IS NULL) OR
           ("mode" = 'Duration' AND "actual_seconds" BETWEEN 1 AND 3600 AND
            "actual_reps" IS NULL)))
      )`
    ),
    rpeCheck: check(
      "session_sets_rpe_check",
      sql`"rpe" IS NULL OR "rpe" BETWEEN 6 AND 10`
    ),
  })
);

export const operationReceipts = pgTable(
  "operation_receipts",
  {
    operationId: uuid("operation_id").primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => workoutSessions.id, { onDelete: "cascade" }),
    controllerEpoch: integer("controller_epoch").notNull(),
    expectedRevision: integer("expected_revision").notNull(),
    commandType: varchar("command_type", { length: 40 }).notNull(),
    result: jsonb("result").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    sessionIdx: index("idx_operation_receipts_session_id").on(table.sessionId),
    commandRevisionCheck: check(
      "operation_receipts_revision_check",
      sql`"controller_epoch" > 0 AND "expected_revision" >= 0`
    ),
  })
);

export const restPeriods = pgTable(
  "rest_periods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => workoutSessions.id, { onDelete: "cascade" }),
    completedSetId: uuid("completed_set_id").references(() => sessionSets.id, {
      onDelete: "set null",
    }),
    currentSetId: uuid("current_set_id").references(() => sessionSets.id, {
      onDelete: "set null",
    }),
    status: restStatusEnum("status").notNull().default("Scheduled"),
    token: uuid("token").notNull().defaultRandom(),
    dueAt: timestamp("due_at").notNull(),
    controllerEpoch: integer("controller_epoch").notNull(),
    nextExerciseName: varchar("next_exercise_name", { length: 100 }),
    nextSetNumber: integer("next_set_number"),
    nextSetCount: integer("next_set_count"),
    nextMode: workoutModeEnum("next_mode"),
    nextRepsMin: integer("next_reps_min"),
    nextRepsMax: integer("next_reps_max"),
    nextTargetSeconds: integer("next_target_seconds"),
    qstashMessageId: varchar("qstash_message_id", { length: 255 }),
    firedAt: timestamp("fired_at"),
    cancelledAt: timestamp("cancelled_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    sessionIdx: index("idx_rest_periods_session_id").on(table.sessionId),
    tokenUniqueIdx: uniqueIndex("uq_rest_periods_token").on(table.token),
    currentScheduledUniqueIdx: uniqueIndex("uq_rest_periods_current_scheduled")
      .on(table.sessionId)
      .where(sql`"status" = 'Scheduled'`),
    epochCheck: check(
      "rest_periods_epoch_check",
      sql`"controller_epoch" > 0`
    ),
  })
);

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => workoutDevices.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    workerVersion: varchar("worker_version", { length: 100 }),
    installed: boolean("installed").notNull().default(false),
    readinessPassedAt: timestamp("readiness_passed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    revokedAt: timestamp("revoked_at"),
  },
  (table) => ({
    deviceIdx: index("idx_push_subscriptions_device_id").on(table.deviceId),
    endpointUniqueIdx: uniqueIndex("uq_push_subscriptions_endpoint").on(
      table.endpoint
    ),
    activeDeviceUniqueIdx: uniqueIndex(
      "uq_push_subscriptions_active_device"
    )
      .on(table.deviceId)
      .where(sql`"revoked_at" IS NULL`),
  })
);

export const readinessAttempts = pgTable(
  "readiness_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => workoutDevices.id, { onDelete: "cascade" }),
    subscriptionId: uuid("subscription_id").references(
      () => pushSubscriptions.id,
      { onDelete: "set null" }
    ),
    nonce: uuid("nonce").notNull().defaultRandom(),
    status: readinessStatusEnum("status").notNull().default("Pending"),
    dispatchedAt: timestamp("dispatched_at"),
    acknowledgedAt: timestamp("acknowledged_at"),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    deviceIdx: index("idx_readiness_attempts_device_id").on(table.deviceId),
    nonceUniqueIdx: uniqueIndex("uq_readiness_attempts_nonce").on(table.nonce),
  })
);

export const deliveryEvents = pgTable(
  "delivery_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restPeriodId: uuid("rest_period_id").references(() => restPeriods.id, {
      onDelete: "set null",
    }),
    readinessAttemptId: uuid("readiness_attempt_id").references(
      () => readinessAttempts.id,
      { onDelete: "set null" }
    ),
    subscriptionId: uuid("subscription_id").references(
      () => pushSubscriptions.id,
      { onDelete: "set null" }
    ),
    eventType: varchar("event_type", { length: 40 }).notNull(),
    providerMessageId: varchar("provider_message_id", { length: 255 }),
    latencyMs: integer("latency_ms"),
    detail: jsonb("detail"),
    occurredAt: timestamp("occurred_at").defaultNow().notNull(),
  },
  (table) => ({
    restIdx: index("idx_delivery_events_rest_period_id").on(table.restPeriodId),
    readinessIdx: index("idx_delivery_events_readiness_attempt_id").on(
      table.readinessAttemptId
    ),
    occurredIdx: index("idx_delivery_events_occurred_at").on(table.occurredAt),
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
  accounts: many(accounts),
  sessions: many(sessions),
  exercises: many(exercises),
  workoutTemplates: many(workoutTemplates),
  workoutSessions: many(workoutSessions),
  workoutDevices: many(workoutDevices),
  bodyWeightLogs: many(bodyWeightLogs),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
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

export const workoutDevicesRelations = relations(
  workoutDevices,
  ({ one, many }) => ({
    user: one(users, {
      fields: [workoutDevices.userId],
      references: [users.id],
    }),
    controlledSessions: many(workoutSessions),
    pushSubscriptions: many(pushSubscriptions),
    readinessAttempts: many(readinessAttempts),
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
    controllerDevice: one(workoutDevices, {
      fields: [workoutSessions.controllerDeviceId],
      references: [workoutDevices.id],
    }),
    sessionExercises: many(sessionExercises),
    operationReceipts: many(operationReceipts),
    restPeriods: many(restPeriods),
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

export const operationReceiptsRelations = relations(
  operationReceipts,
  ({ one }) => ({
    session: one(workoutSessions, {
      fields: [operationReceipts.sessionId],
      references: [workoutSessions.id],
    }),
  })
);

export const restPeriodsRelations = relations(restPeriods, ({ one, many }) => ({
  session: one(workoutSessions, {
    fields: [restPeriods.sessionId],
    references: [workoutSessions.id],
  }),
  completedSet: one(sessionSets, {
    fields: [restPeriods.completedSetId],
    references: [sessionSets.id],
    relationName: "completedRestSet",
  }),
  currentSet: one(sessionSets, {
    fields: [restPeriods.currentSetId],
    references: [sessionSets.id],
    relationName: "currentRestSet",
  }),
  deliveryEvents: many(deliveryEvents),
}));

export const pushSubscriptionsRelations = relations(
  pushSubscriptions,
  ({ one, many }) => ({
    device: one(workoutDevices, {
      fields: [pushSubscriptions.deviceId],
      references: [workoutDevices.id],
    }),
    readinessAttempts: many(readinessAttempts),
    deliveryEvents: many(deliveryEvents),
  })
);

export const readinessAttemptsRelations = relations(
  readinessAttempts,
  ({ one, many }) => ({
    device: one(workoutDevices, {
      fields: [readinessAttempts.deviceId],
      references: [workoutDevices.id],
    }),
    subscription: one(pushSubscriptions, {
      fields: [readinessAttempts.subscriptionId],
      references: [pushSubscriptions.id],
    }),
    deliveryEvents: many(deliveryEvents),
  })
);

export const deliveryEventsRelations = relations(deliveryEvents, ({ one }) => ({
  restPeriod: one(restPeriods, {
    fields: [deliveryEvents.restPeriodId],
    references: [restPeriods.id],
  }),
  readinessAttempt: one(readinessAttempts, {
    fields: [deliveryEvents.readinessAttemptId],
    references: [readinessAttempts.id],
  }),
  subscription: one(pushSubscriptions, {
    fields: [deliveryEvents.subscriptionId],
    references: [pushSubscriptions.id],
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

export type WorkoutDevice = typeof workoutDevices.$inferSelect;
export type NewWorkoutDevice = typeof workoutDevices.$inferInsert;

export type WorkoutSession = typeof workoutSessions.$inferSelect;
export type NewWorkoutSession = typeof workoutSessions.$inferInsert;

export type SessionExercise = typeof sessionExercises.$inferSelect;
export type NewSessionExercise = typeof sessionExercises.$inferInsert;

export type SessionSet = typeof sessionSets.$inferSelect;
export type NewSessionSet = typeof sessionSets.$inferInsert;

export type OperationReceipt = typeof operationReceipts.$inferSelect;
export type NewOperationReceipt = typeof operationReceipts.$inferInsert;

export type RestPeriod = typeof restPeriods.$inferSelect;
export type NewRestPeriod = typeof restPeriods.$inferInsert;

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;

export type ReadinessAttempt = typeof readinessAttempts.$inferSelect;
export type NewReadinessAttempt = typeof readinessAttempts.$inferInsert;

export type DeliveryEvent = typeof deliveryEvents.$inferSelect;
export type NewDeliveryEvent = typeof deliveryEvents.$inferInsert;

export type BodyWeightLog = typeof bodyWeightLogs.$inferSelect;
export type NewBodyWeightLog = typeof bodyWeightLogs.$inferInsert;

// NextAuth types
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type VerificationToken = typeof verificationTokens.$inferSelect;
export type NewVerificationToken = typeof verificationTokens.$inferInsert;
