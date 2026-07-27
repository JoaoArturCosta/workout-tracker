import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

type Manifest = {
  id?: string;
  display?: string;
  icons?: Array<{ src: string; sizes: string; type: string }>;
};

function readPngDimensions(path: string) {
  const data = readFileSync(path);
  expect(data.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20),
  };
}

describe("PWA install assets", () => {
  it("has a stable standalone manifest", () => {
    const manifest = JSON.parse(
      readFileSync(resolve("public/manifest.json"), "utf8"),
    ) as Manifest;

    expect(manifest.id).toBe("/");
    expect(manifest.display).toBe("standalone");
  });

  it("ships valid PNGs at every declared icon size", () => {
    const manifest = JSON.parse(
      readFileSync(resolve("public/manifest.json"), "utf8"),
    ) as Manifest;

    for (const icon of manifest.icons ?? []) {
      const [size] = icon.sizes.split("x").map(Number);
      const dimensions = readPngDimensions(resolve("public", icon.src.slice(1)));

      expect(icon.type).toBe("image/png");
      expect(dimensions).toEqual({ width: size, height: size });
    }
  });
});
