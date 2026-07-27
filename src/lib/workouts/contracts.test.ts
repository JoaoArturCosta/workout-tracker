import { describe, expect, it } from "vitest";

import {
  CommandEnvelopeSchema,
  DurationSetResultSchema,
  RepSetResultSchema,
  TemplateOccurrenceSchema,
  WorkoutSetStateSchema,
} from "./contracts";

const uuid = "f3d8f90a-cc85-41f2-aaed-b97830f8dbd0";

describe("workout domain contracts", () => {
  it.each([
    ["minimum reps", 1],
    ["maximum reps", 100],
  ])("accepts %s", (_label, actualReps) => {
    expect(
      RepSetResultSchema.parse({ mode: "Reps", actualReps })
    ).toMatchObject({ mode: "Reps", actualReps, externalLoadKg: 0, rpe: null });
  });

  it.each([0, 101, 1.5])("rejects invalid reps %s", (actualReps) => {
    expect(() =>
      RepSetResultSchema.parse({ mode: "Reps", actualReps })
    ).toThrow();
  });

  it.each([1, 3600])("accepts duration boundary %s", (actualSeconds) => {
    expect(
      DurationSetResultSchema.parse({ mode: "Duration", actualSeconds })
    ).toMatchObject({ mode: "Duration", actualSeconds, externalLoadKg: 0 });
  });

  it.each([0, 3601, 2.5])("rejects invalid duration %s", (actualSeconds) => {
    expect(() =>
      DurationSetResultSchema.parse({ mode: "Duration", actualSeconds })
    ).toThrow();
  });

  it("allows a zero-to-1000 kg load and explicit null RPE", () => {
    expect(
      RepSetResultSchema.parse({
        mode: "Reps",
        actualReps: 8,
        externalLoadKg: 1000,
        rpe: null,
      })
    ).toMatchObject({ externalLoadKg: 1000, rpe: null });
  });

  it("rejects an out-of-range load or RPE", () => {
    expect(() =>
      RepSetResultSchema.parse({
        mode: "Reps",
        actualReps: 8,
        externalLoadKg: 1000.001,
      })
    ).toThrow();
    expect(() =>
      RepSetResultSchema.parse({ mode: "Reps", actualReps: 8, rpe: 5 })
    ).toThrow();
  });

  it("does not let pending or skipped sets carry a result", () => {
    expect(() =>
      WorkoutSetStateSchema.parse({
        status: "Pending",
        result: { mode: "Reps", actualReps: 8 },
      })
    ).toThrow();
    expect(() =>
      WorkoutSetStateSchema.parse({
        status: "Skipped",
        result: { mode: "Duration", actualSeconds: 30 },
      })
    ).toThrow();
  });

  it("enforces mode-aware template targets", () => {
    expect(
      TemplateOccurrenceSchema.parse({
        mode: "Reps",
        sets: 3,
        repsMin: 8,
        repsMax: 10,
      })
    ).toMatchObject({ mode: "Reps", repsMin: 8, repsMax: 10 });
    expect(
      TemplateOccurrenceSchema.parse({
        mode: "Duration",
        sets: 2,
        targetSeconds: 45,
      })
    ).toMatchObject({ mode: "Duration", targetSeconds: 45 });
    expect(() =>
      TemplateOccurrenceSchema.parse({
        mode: "Duration",
        sets: 2,
        targetSeconds: 45,
        repsMin: 8,
      })
    ).toThrow();
  });

  it("requires identity and revision data for every command", () => {
    const parsed = CommandEnvelopeSchema.parse({
      operationId: uuid,
      sessionId: uuid,
      deviceId: uuid,
      controllerEpoch: 1,
      expectedRevision: 0,
      command: {
        type: "CompleteSet",
        sessionSetId: uuid,
        result: { mode: "Reps", actualReps: 8 },
      },
    });
    expect(parsed.command.type).toBe("CompleteSet");
    expect(() =>
      CommandEnvelopeSchema.parse({
        operationId: uuid,
        sessionId: uuid,
        deviceId: uuid,
        controllerEpoch: 1,
        expectedRevision: 0,
        command: { type: "CompleteSet", sessionSetId: uuid },
      })
    ).toThrow();
  });

  it("accepts SaveSet with the same guarded result contract", () => {
    const parsed = CommandEnvelopeSchema.parse({
      operationId: uuid,
      sessionId: uuid,
      deviceId: uuid,
      controllerEpoch: 1,
      expectedRevision: 0,
      command: {
        type: "SaveSet",
        sessionSetId: uuid,
        result: { mode: "Reps", actualReps: 8 },
      },
    });

    expect(parsed.command).toMatchObject({
      type: "SaveSet",
      sessionSetId: uuid,
      result: {
        mode: "Reps",
        actualReps: 8,
      },
    });
  });
});
