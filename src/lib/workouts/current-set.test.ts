import { describe, expect, it } from "vitest";

import { findCurrentSet, findLatestCompletedSet } from "./current-set";

const set = (
  id: string,
  exerciseOccurrenceId: string,
  status: "Pending" | "Completed" | "Skipped",
  completedAt?: string | null
) => ({ id, exerciseOccurrenceId, status, completedAt: completedAt ?? null });

describe("findLatestCompletedSet", () => {
  it("returns the most recently completed set", () => {
    const sets = [
      set("a1", "ex-a", "Completed", "2026-08-15T10:05:00Z"),
      set("b1", "ex-b", "Completed", "2026-08-15T10:00:00Z"),
    ];

    expect(findLatestCompletedSet(sets)?.id).toBe("a1");
  });

  it("keeps the later set in sequence order on ties", () => {
    const sets = [
      set("a1", "ex-a", "Completed", "2026-08-15T10:00:00Z"),
      set("b1", "ex-b", "Completed", "2026-08-15T10:00:00Z"),
    ];

    expect(findLatestCompletedSet(sets)?.id).toBe("b1");
  });

  it("ignores pending, skipped, and missing completion times", () => {
    const sets = [
      set("a1", "ex-a", "Pending"),
      set("a2", "ex-a", "Completed", null),
      set("a3", "ex-a", "Skipped"),
      set("b1", "ex-b", "Completed", "2026-08-15T10:00:00Z"),
    ];

    expect(findLatestCompletedSet(sets)?.id).toBe("b1");
  });

  it("returns undefined without completed sets", () => {
    expect(findLatestCompletedSet([set("a1", "ex-a", "Pending")])).toBeUndefined();
  });
});

describe("findCurrentSet", () => {
  it("falls back to the first pending set before any completion", () => {
    const sets = [
      set("a1", "ex-a", "Pending"),
      set("b1", "ex-b", "Pending"),
    ];

    expect(findCurrentSet(sets)?.id).toBe("a1");
  });

  it("keeps the sequence order after a normal completion", () => {
    const sets = [
      set("a1", "ex-a", "Completed", "2026-08-15T10:00:00Z"),
      set("a2", "ex-a", "Pending"),
      set("b1", "ex-b", "Pending"),
    ];

    expect(findCurrentSet(sets)?.id).toBe("a2");
  });

  it("follows the exercise completed most recently", () => {
    const sets = [
      set("a1", "ex-a", "Completed", "2026-08-15T10:00:00Z"),
      set("a2", "ex-a", "Pending"),
      set("b1", "ex-b", "Completed", "2026-08-15T10:05:00Z"),
      set("b2", "ex-b", "Pending"),
    ];

    expect(findCurrentSet(sets)?.id).toBe("b2");
  });

  it("stays on the exercised exercise when its remaining sets precede the anchor", () => {
    // A1, B1, B2, B3, C1 with B3 completed most recently: flat adjacency
    // would hand Current to C1, but the athlete is completing exercise B.
    const sets = [
      set("a1", "ex-a", "Completed", "2026-08-15T10:00:00Z"),
      set("b1", "ex-b", "Pending"),
      set("b2", "ex-b", "Pending"),
      set("b3", "ex-b", "Completed", "2026-08-15T10:06:00Z"),
      set("c1", "ex-c", "Pending"),
    ];

    expect(findCurrentSet(sets)?.id).toBe("b1");
  });

  it("falls back to the first pending set when the exercised exercise is exhausted", () => {
    const sets = [
      set("a1", "ex-a", "Pending"),
      set("b1", "ex-b", "Completed", "2026-08-15T10:05:00Z"),
      set("b2", "ex-b", "Completed", "2026-08-15T10:06:00Z"),
    ];

    expect(findCurrentSet(sets)?.id).toBe("a1");
  });

  it("ignores skipped sets when anchoring", () => {
    const sets = [
      set("a1", "ex-a", "Completed", "2026-08-15T10:00:00Z"),
      set("a2", "ex-a", "Skipped"),
      set("b1", "ex-b", "Pending"),
    ];

    expect(findCurrentSet(sets)?.id).toBe("b1");
  });

  it("returns undefined when no set is pending", () => {
    const sets = [
      set("a1", "ex-a", "Completed", "2026-08-15T10:00:00Z"),
      set("a2", "ex-a", "Skipped"),
    ];

    expect(findCurrentSet(sets)).toBeUndefined();
  });

  it("accepts Date values for completedAt", () => {
    const sets = [
      { id: "a1", exerciseOccurrenceId: "ex-a", status: "Completed" as const, completedAt: new Date("2026-08-15T10:00:00Z") },
      { id: "a2", exerciseOccurrenceId: "ex-a", status: "Pending" as const, completedAt: null },
      { id: "b1", exerciseOccurrenceId: "ex-b", status: "Completed" as const, completedAt: new Date("2026-08-15T10:05:00Z") },
      { id: "b2", exerciseOccurrenceId: "ex-b", status: "Pending" as const, completedAt: null },
    ];

    expect(findCurrentSet(sets)?.id).toBe("b2");
  });
});
