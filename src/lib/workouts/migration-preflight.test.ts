import { describe, expect, it } from "vitest";
import type { QueryResult, QueryResultRow } from "pg";

import { findMigrationIssues } from "../../../scripts/check-workout-migration";

type Row = { id: string };

function fixtureClient(...results: Row[][]) {
  let queryIndex = 0;
  const queries: string[] = [];
  const client = {
    queries,
    async query<R extends QueryResultRow = Row>(
      sql: string
    ): Promise<QueryResult<R>> {
      queries.push(sql);
      const rows = (results[queryIndex++] ?? []) as unknown as R[];
      return {
        command: "SELECT",
        rowCount: rows.length,
        oid: 0,
        fields: [],
        rows,
      };
    },
  };
  return client as Parameters<typeof findMigrationIssues>[0] & {
    queries: string[];
  };
}

const clean = [[], [], [], [], []];

describe("workout migration preflight", () => {
  it("passes a clean legacy history", async () => {
    await expect(findMigrationIssues(fixtureClient(...clean))).resolves.toEqual(
      []
    );
  });

  it("reports more than one legacy active session for an account", async () => {
    const client = fixtureClient([], [], [{ id: "session-a, session-b" }], [], []);
    const issues = await findMigrationIssues(client);

    expect(issues).toEqual([
      expect.objectContaining({
        code: "MULTIPLE_ACTIVE_WORKOUTS",
        ids: ["session-a, session-b"],
      }),
    ]);
    expect(client.queries[2]).toContain("completed");
    expect(client.queries[2]).toContain("end_time IS NULL");
  });

  it("reports invalid values on a legacy completed set", async () => {
    const client = fixtureClient([], [], [], [{ id: "set-invalid" }], []);
    const issues = await findMigrationIssues(client);

    expect(issues).toEqual([
      expect.objectContaining({
        code: "INVALID_COMPLETED_SET",
        ids: ["set-invalid"],
      }),
    ]);
    expect(client.queries[3]).toContain("completed = TRUE");
    expect(client.queries[3]).toContain("weight");
  });

  it("reports a session occurrence that cannot be frozen", async () => {
    const issues = await findMigrationIssues(
      fixtureClient([], [], [], [], [{ id: "occurrence-missing-exercise" }])
    );

    expect(issues).toEqual([
      expect.objectContaining({
        code: "SESSION_CANNOT_FREEZE",
        ids: ["occurrence-missing-exercise"],
      }),
    ]);
  });
});
