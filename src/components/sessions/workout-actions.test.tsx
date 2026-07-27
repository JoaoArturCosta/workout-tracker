import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkoutActions } from "./workout-actions";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("WorkoutActions", () => {
  it("puts end and discard in the workout options menu", async () => {
    const user = userEvent.setup();
    const onEnd = vi.fn();
    const onDiscard = vi.fn();
    Object.defineProperty(window, "confirm", {
      configurable: true,
      value: vi.fn(() => true),
    });

    render(
      <WorkoutActions
        onEnd={onEnd}
        onDiscard={onDiscard}
      />
    );

    expect(screen.getByRole("button", { name: "Workout options" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Workout options" }));

    const menu = screen.getByRole("menu");
    expect(within(menu).queryByRole("menuitem", { name: "Skip set" })).not.toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "End early" })).toBeVisible();
    expect(within(menu).getByRole("menuitem", { name: "Discard" })).toHaveAttribute("data-variant", "destructive");

    await user.click(within(menu).getByRole("menuitem", { name: "Discard" }));
    expect(onDiscard).toHaveBeenCalledOnce();
  });

  it("keeps options disabled when actions are disabled", () => {
    render(
      <WorkoutActions
        disabled
        onEnd={vi.fn()}
        onDiscard={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Workout options" })).toBeDisabled();
  });

  it("keeps non-terminal actions as direct buttons", () => {
    const onRestore = vi.fn();
    const onUndo = vi.fn();
    const onSkipRest = vi.fn();
    const onFinish = vi.fn();

    render(
      <WorkoutActions
        canRestore
        canUndo
        canFinish
        onRestore={onRestore}
        onUndo={onUndo}
        onSkipRest={onSkipRest}
        onFinish={onFinish}
      />
    );

    expect(screen.getByRole("button", { name: "Restore set" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Undo last completion" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Skip rest" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Finish" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Workout options" })).not.toBeInTheDocument();
  });
});
