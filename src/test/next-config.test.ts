import { describe, expect, it } from "vitest";

import { apiRuntimeCacheRule } from "../../next.config";

describe("PWA API cache rule", () => {
  it("matches same-origin API and tRPC URLs", () => {
    const matches = apiRuntimeCacheRule.urlPattern;

    expect(matches.test("https://workout.test/api/trpc/session.get")).toBe(true);
    expect(matches.test("https://workout.test/api/health")).toBe(true);
    expect(matches.test("https://workout.test/_next/static/app.js")).toBe(false);
  });

  it("never falls back to a cache", () => {
    expect(apiRuntimeCacheRule.handler).toBe("NetworkOnly");
  });
});
