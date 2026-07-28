import { describe, expect, it } from "vitest";

import {
  apiRuntimeCacheRule,
  pwaBuildExcludes,
} from "../../next.config";

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

describe("PWA precache exclusions", () => {
  it.each([
    "app-build-manifest.json",
    "dynamic-css-manifest.json",
  ])("excludes Vercel-unserved build asset %s", (assetName) => {
    expect(pwaBuildExcludes.some((pattern) => pattern.test(assetName))).toBe(
      true,
    );
  });
});
