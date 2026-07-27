import { z } from "zod";

/** Values stored in the expanded workout model. Keep these values stable: they
 * are part of the offline command and database contracts. */
export const WorkoutStatusEnum = z.enum([
  "Active",
  "Completed",
  "Partial",
  "Discarded",
]);

export const SetStatusEnum = z.enum(["Pending", "Completed", "Skipped"]);

export const WorkoutModeEnum = z.enum(["Reps", "Duration"]);
// ExerciseMode is a useful name for callers that do not deal with workouts.
export const ExerciseModeEnum = WorkoutModeEnum;

export const RestStatusEnum = z.enum(["Scheduled", "Fired", "Cancelled"]);

export const ControllerStateEnum = z.enum(["Controlling", "ReadOnly"]);

export const SyncErrorCodeEnum = z.enum([
  "NETWORK",
  "VALIDATION",
  "STALE_REVISION",
  "STALE_CONTROLLER",
  "CONFLICT",
  "UNAUTHORIZED",
]);

const WholeNumber = z.number().int();
const ExternalLoadKg = z.number().finite().min(0).max(1000);
const OptionalRpe = WholeNumber.min(6).max(10).nullable().default(null);

const ResultFields = {
  externalLoadKg: ExternalLoadKg.default(0),
  rpe: OptionalRpe,
};

export const RepSetResultSchema = z
  .object({
    mode: z.literal("Reps"),
    actualReps: WholeNumber.min(1).max(100),
    actualSeconds: z.null().optional().default(null),
    ...ResultFields,
  })
  .strict();

export const DurationSetResultSchema = z
  .object({
    mode: z.literal("Duration"),
    actualReps: z.null().optional().default(null),
    actualSeconds: WholeNumber.min(1).max(3600),
    ...ResultFields,
  })
  .strict();

export const SetResultSchema = z.discriminatedUnion("mode", [
  RepSetResultSchema,
  DurationSetResultSchema,
]);

export const PendingSetSchema = z
  .object({
    status: z.literal("Pending"),
    result: z.undefined().optional(),
  })
  .strict();

export const SkippedSetSchema = z
  .object({
    status: z.literal("Skipped"),
    result: z.undefined().optional(),
  })
  .strict();

export const CompletedSetSchema = z
  .object({
    status: z.literal("Completed"),
    result: SetResultSchema,
  })
  .strict();

export const WorkoutSetStateSchema = z.discriminatedUnion("status", [
  PendingSetSchema,
  CompletedSetSchema,
  SkippedSetSchema,
]);

const SessionSetCommand = z.object({ sessionSetId: z.string().uuid() });
const CompleteSetCommand = SessionSetCommand.extend({
  type: z.literal("CompleteSet"),
  result: SetResultSchema,
}).strict();
const SaveSetCommand = SessionSetCommand.extend({
  type: z.literal("SaveSet"),
  result: SetResultSchema,
}).strict();
const EditCompletedSetCommand = SessionSetCommand.extend({
  type: z.literal("EditCompletedSet"),
  result: SetResultSchema,
}).strict();
const SkipSetCommand = SessionSetCommand.extend({
  type: z.literal("SkipSet"),
}).strict();
const RestoreSetCommand = SessionSetCommand.extend({
  type: z.literal("RestoreSet"),
}).strict();
const SkipRestCommand = z.object({ type: z.literal("SkipRest") }).strict();
const UndoCommand = SessionSetCommand.extend({ type: z.literal("Undo") }).strict();
const FinishCommand = SessionSetCommand.extend({
  type: z.literal("Finish"),
  result: SetResultSchema,
}).strict();
const EndCommand = z.object({ type: z.literal("End") }).strict();
const DiscardCommand = z.object({ type: z.literal("Discard") }).strict();

export const WorkoutCommandSchema = z.discriminatedUnion("type", [
  CompleteSetCommand,
  SaveSetCommand,
  EditCompletedSetCommand,
  SkipSetCommand,
  RestoreSetCommand,
  SkipRestCommand,
  UndoCommand,
  FinishCommand,
  EndCommand,
  DiscardCommand,
]);

export const CommandEnvelopeSchema = z
  .object({
    operationId: z.string().uuid(),
    sessionId: z.string().uuid(),
    deviceId: z.string().uuid(),
    controllerEpoch: WholeNumber.nonnegative(),
    expectedRevision: WholeNumber.nonnegative(),
    command: WorkoutCommandSchema,
  })
  .strict();

// Long name used by the command service in later sprints.
export const WorkoutCommandEnvelopeSchema = CommandEnvelopeSchema;

export const SyncErrorSchema = z.object({
  code: SyncErrorCodeEnum,
  message: z.string().min(1),
  retryable: z.boolean().default(false),
  operationId: z.string().uuid().optional(),
});

export const TemplateOccurrenceSchema = z
  .object({
    mode: WorkoutModeEnum,
    repsMin: WholeNumber.min(1).max(100).nullable().optional(),
    repsMax: WholeNumber.min(1).max(100).nullable().optional(),
    targetSeconds: WholeNumber.min(1).max(3600).nullable().optional(),
    sets: WholeNumber.min(1).max(20),
    rpeTarget: WholeNumber.min(6).max(10).nullable().optional(),
    restTimeSeconds: WholeNumber.min(0).max(3600).default(120),
  })
  .superRefine((value, ctx) => {
    if (value.mode === "Reps") {
      if (value.repsMin == null || value.repsMax == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["repsMin"],
          message: "Rep mode requires repsMin and repsMax",
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
  });

export type WorkoutStatus = z.infer<typeof WorkoutStatusEnum>;
export type SetStatus = z.infer<typeof SetStatusEnum>;
export type WorkoutMode = z.infer<typeof WorkoutModeEnum>;
export type ExerciseMode = WorkoutMode;
export type RestStatus = z.infer<typeof RestStatusEnum>;
export type ControllerState = z.infer<typeof ControllerStateEnum>;
export type SyncErrorCode = z.infer<typeof SyncErrorCodeEnum>;
export type RepSetResult = z.infer<typeof RepSetResultSchema>;
export type DurationSetResult = z.infer<typeof DurationSetResultSchema>;
export type SetResult = z.infer<typeof SetResultSchema>;
export type WorkoutSetState = z.infer<typeof WorkoutSetStateSchema>;
export type WorkoutCommand = z.infer<typeof WorkoutCommandSchema>;
export type CommandEnvelope = z.infer<typeof CommandEnvelopeSchema>;
export type SyncError = z.infer<typeof SyncErrorSchema>;
export type TemplateOccurrence = z.infer<typeof TemplateOccurrenceSchema>;
