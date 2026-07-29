import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SessionHistoryCard } from "@/components/progress/session-history-card";

describe("SessionHistoryCard", () => {
  it("links the whole history entry to the saved session", () => {
    render(
      <SessionHistoryCard
        id="session-123"
        name="Push"
        startTime="2026-07-28T08:00:00.000Z"
        status="Completed"
        totalVolume={3490.5}
        durationSetCount={0}
        totalActualSeconds={0}
      />
    );

    expect(
      screen.getByRole("link", { name: "View Push session details" })
    ).toHaveAttribute("href", "/sessions/session-123");
    expect(screen.getByText("3490.5 kg Reps volume")).toBeVisible();
  });
});
