import { describe, expect, it, vi } from "vitest";

import { createRestAlertPublisher, type QStashClient } from "./qstash";

describe("rest alert job publishing", () => {
  it("uses the durable rest token as the deduplication key", async () => {
    const publishJSON = vi
      .fn()
      .mockResolvedValue({ messageId: "msg_01", url: "" });
    const client: QStashClient = { publishJSON };
    const publisher = createRestAlertPublisher(client, {
      canonicalAppUrl: "https://workouts.example",
    });

    const result = await publisher.publish({
      restId: "f3d8f90a-cc85-41f2-aaed-b97830f8dbd0",
      token: "ed71ff14-53fe-4b06-9c15-85e58a769fa9",
      dueAt: new Date("2026-07-27T12:00:30.000Z"),
      now: new Date("2026-07-27T12:00:00.250Z"),
    });

    expect(result).toEqual({ messageId: "msg_01" });
    expect(publishJSON).toHaveBeenCalledWith({
      url: "https://workouts.example/api/rest-alerts/dispatch",
      body: {
        restId: "f3d8f90a-cc85-41f2-aaed-b97830f8dbd0",
        token: "ed71ff14-53fe-4b06-9c15-85e58a769fa9",
      },
      delay: "30s",
      retries: 3,
      deduplicationId: "ed71ff1453fe4b069c1585e58a769fa9",
      label: ["rest-alert"],
    });
  });
});
