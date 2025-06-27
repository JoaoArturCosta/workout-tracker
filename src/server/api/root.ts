import { createTRPCRouter } from "@/server/api/trpc";
import { exerciseRouter } from "@/server/api/routers/exercise";
import { templateRouter } from "@/server/api/routers/template";
import { sessionRouter } from "@/server/api/routers/session";
import { progressRouter } from "@/server/api/routers/progress";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  exercise: exerciseRouter,
  template: templateRouter,
  session: sessionRouter,
  progress: progressRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
