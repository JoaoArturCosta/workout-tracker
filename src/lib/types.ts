import type { RouterOutputs } from "@/lib/trpc";
export type {
  CommandEnvelope,
  ControllerState,
  DurationSetResult,
  ExerciseMode,
  RepSetResult,
  RestStatus,
  SetResult,
  SetStatus,
  SyncError,
  SyncErrorCode,
  TemplateOccurrence,
  WorkoutCommand,
  WorkoutMode,
  WorkoutSetState,
  WorkoutStatus,
} from "@/lib/workouts/contracts";

// Exercise types
export type Exercise = RouterOutputs["exercise"]["getAll"][0];

// Template types
export type Template = RouterOutputs["template"]["getAll"][0];
export type TemplateExercise = Template["template_exercises"][0];

// Session types
export type Session = RouterOutputs["session"]["getHistory"][0];
export type SessionHistory = RouterOutputs["progress"]["getSessionHistory"][0];
export type SessionWithExercises = RouterOutputs["session"]["getById"];

// Progress types
export type BodyWeightEntry =
  RouterOutputs["progress"]["getBodyWeightHistory"][0];
export type PersonalRecord = RouterOutputs["progress"]["getPersonalRecords"][0];
export type OneRMData = RouterOutputs["progress"]["getOneRM"];
export type OneRMCalculation = NonNullable<OneRMData>["calculations"][0];
export type VolumeData = RouterOutputs["progress"]["getVolumeProgression"][0];
export type StrengthStandards =
  RouterOutputs["progress"]["getStrengthStandards"];
