import { beforeEach, describe, expect, it } from "vitest";

import {
  closeOfflineDb,
  deleteOfflineDb,
  getDeviceId,
  getDeviceRecord,
} from "./db";

describe("offline workout device storage", () => {
  beforeEach(async () => {
    await deleteOfflineDb();
  });

  it("stores one stable device ID in the out-of-line device store", async () => {
    const firstId = await getDeviceId();
    const secondId = await getDeviceId();

    expect(secondId).toBe(firstId);
    await expect(getDeviceRecord()).resolves.toMatchObject({
      id: "device",
      deviceId: firstId,
    });

    await closeOfflineDb();
  });
});
