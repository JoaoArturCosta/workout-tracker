import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink, loggerLink } from "@trpc/client";
import { type inferRouterInputs, type inferRouterOutputs } from "@trpc/server";

import { type AppRouter } from "@/server/api/root";

const getBaseUrl = () => {
  if (typeof window !== "undefined") return ""; // browser should use relative url
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL; // SSR should use NEXTAUTH_URL
  return `http://localhost:${process.env.PORT ?? 3000}`; // dev SSR should use localhost
};

/** A set of type-safe react-query hooks for your tRPC API. */
export const api = createTRPCReact<AppRouter>();

export const trpcClient = api.createClient({
  links: [
    loggerLink({
      enabled: (opts) =>
        process.env.NODE_ENV === "development" ||
        (opts.direction === "down" && opts.result instanceof Error),
    }),
    httpBatchLink({
      url: `${getBaseUrl()}/api/trpc`,
    }),
  ],
});

/**
 * Inference helper for inputs.
 *
 * @example type HelloInput = RouterInputs['example']['hello']
 */
export type RouterInputs = inferRouterInputs<AppRouter>;

/**
 * Inference helper for outputs.
 *
 * @example type HelloOutput = RouterOutputs['example']['hello']
 */
export type RouterOutputs = inferRouterOutputs<AppRouter>;
