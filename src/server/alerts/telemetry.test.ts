import { describe, expect, it } from "vitest";

import { computePresentationSli, type DeliveryEvent } from "./telemetry";

describe("rest alert presentation SLI", () => {
  it("counts presentation ACKs within ten seconds of due time", () => {
    const events: DeliveryEvent[] = [
      {
        alertId: "alert-fast",
        type: "Due",
        occurredAt: new Date("2026-07-27T12:00:00.000Z"),
      },
      {
        alertId: "alert-fast",
        type: "ShowResolved",
        occurredAt: new Date("2026-07-27T12:00:09.999Z"),
      },
      {
        alertId: "alert-late",
        type: "Due",
        occurredAt: new Date("2026-07-27T12:01:00.000Z"),
      },
      {
        alertId: "alert-late",
        type: "ShowResolved",
        occurredAt: new Date("2026-07-27T12:01:10.001Z"),
      },
      {
        alertId: "alert-missing",
        type: "Due",
        occurredAt: new Date("2026-07-27T12:02:00.000Z"),
      },
    ];

    expect(
      computePresentationSli(
        events,
        new Date("2026-07-27T12:02:20.000Z")
      )
    ).toEqual({
      eligible: 3,
      presentedWithinTenSeconds: 1,
      failed: 2,
      rate: 1 / 3,
      label: "Presentation accepted",
    });
  });
});
