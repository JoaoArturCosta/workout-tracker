import type { Session } from "next-auth";

import {
  createInnerTRPCContext,
  type TRPCContext,
} from "@/server/api/trpc";
import type { Database } from "@/lib/db";

export function createTestSession(userId = "test-user"): Session {
  return {
    user: {
      id: userId,
      name: "Test User",
      email: `${userId}@example.test`,
      image: null,
    },
    expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
}

export function createTestContext(opts: {
  db: Database;
  userId?: string;
  session?: Session | null;
}): TRPCContext {
  return createInnerTRPCContext({
    db: opts.db,
    session: opts.session ?? createTestSession(opts.userId),
  });
}

export function createUnauthenticatedTestContext(db: Database): TRPCContext {
  return createInnerTRPCContext({ db, session: null });
}
