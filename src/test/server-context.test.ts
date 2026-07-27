import { describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import {
  createTestContext,
  createUnauthenticatedTestContext,
} from "@/test/server-context";

describe("server test context", () => {
  it("injects the supplied database and authenticated user", () => {
    const context = createTestContext({ db, userId: "user-123" });

    expect(context.db).toBe(db);
    expect(context.session?.user.id).toBe("user-123");
  });

  it("can build an unauthenticated context", () => {
    const context = createUnauthenticatedTestContext(db);

    expect(context.session).toBeNull();
  });
});
