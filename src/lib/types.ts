import type { RouterOutputs } from "@/lib/trpc";

// Exercise types
export type Exercise = RouterOutputs["exercise"]["getAll"][0];

// Template types
export type Template = RouterOutputs["template"]["getAll"][0];
export type TemplateExercise = Template["template_exercises"][0];

// Session types
export type Session = RouterOutputs["session"]["getHistory"][0];
export type SessionHistory = RouterOutputs["progress"]["getSessionHistory"][0];
export type SessionWithExercises =
  RouterOutputs["session"]["getSessionWithExercises"];
export type SessionExercise = NonNullable<
  SessionWithExercises["session_exercises"]
>[0];
export type SessionSet = NonNullable<SessionExercise["sets"]>[0];

// Progress types
export type BodyWeightEntry =
  RouterOutputs["progress"]["getBodyWeightHistory"][0];
export type PersonalRecord = RouterOutputs["progress"]["getPersonalRecords"][0];
export type OneRMData = RouterOutputs["progress"]["getOneRM"];
export type OneRMCalculation = NonNullable<OneRMData>["calculations"][0];
export type VolumeData = RouterOutputs["progress"]["getVolumeProgression"][0];
export type StrengthStandards =
  RouterOutputs["progress"]["getStrengthStandards"];
