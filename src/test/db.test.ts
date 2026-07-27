import { describe, expect, it } from "vitest";

import { assertTestDatabaseUrl } from "@/test/db";

describe("test database guard", () => {
  it("rejects a missing test database URL", () => {
    expect(() => assertTestDatabaseUrl(undefined, "postgres://main")).toThrow(
      "TEST_DATABASE_URL is required",
    );
  });

  it("rejects the main database URL", () => {
    expect(() =>
      assertTestDatabaseUrl("postgres://main", "postgres://main"),
    ).toThrow("must not equal DATABASE_URL");
  });

  it("accepts a separate test database URL", () => {
    expect(() =>
      assertTestDatabaseUrl("postgres://test", "postgres://main"),
    ).not.toThrow();
  });
});
