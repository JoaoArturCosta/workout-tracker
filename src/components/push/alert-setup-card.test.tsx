import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AlertSetupCard } from "./alert-setup-card";
import { ForegroundOnlyWarning } from "./foreground-only-warning";

describe("Alert setup", () => {
  it("can be skipped without blocking the workout", async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn();
    render(
      <AlertSetupCard
        state="NeedsSetup"
        publicVapidKey="public-key"
        onSaveSubscription={vi.fn()}
        onRunReadiness={vi.fn()}
        onSkip={onSkip}
      />
    );

    await user.click(screen.getByRole("button", { name: "Skip for now" }));

    expect(onSkip).toHaveBeenCalledOnce();
    expect(screen.getByRole("alert")).toHaveTextContent(
      /Keep this app open for rest alerts/i
    );
  });

  it("shows the durable ready state", () => {
    render(
      <AlertSetupCard
        state="Ready"
        publicVapidKey="public-key"
        onSaveSubscription={vi.fn()}
        onRunReadiness={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    expect(screen.getByText("Background-alert ready")).toBeInTheDocument();
  });
});

describe("Foreground-only warning", () => {
  it("gives one fixed keep-open warning", () => {
    render(<ForegroundOnlyWarning />);

    expect(
      screen.getByText(/Keep this app open for rest alerts/i)
    ).toBeInTheDocument();
  });
});
