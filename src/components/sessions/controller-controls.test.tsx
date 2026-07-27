import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ControllerControls } from "./controller-controls";

const props = {
  controllerDeviceId: "device-2",
  controllerEpoch: 1,
  acknowledgedRevision: 4,
  pendingOperationCount: 0,
  onHandoff: vi.fn(),
  onReplaceLostDevice: vi.fn(),
};

describe("ControllerControls", () => {
  it("keeps device status hidden until the disclosure is opened", async () => {
    const user = userEvent.setup();

    render(<ControllerControls {...props} controllerState="ReadOnly" />);

    expect(screen.getByRole("button", { name: /device control/i })).toBeInTheDocument();
    expect(screen.queryByText("ReadOnly")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /device control/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("ReadOnly")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Replace lost device" })).toBeInTheDocument();
  });

  it("shows handoff controls for the controlling device", async () => {
    const user = userEvent.setup();

    render(<ControllerControls {...props} controllerState="Controlling" />);
    await user.click(screen.getByRole("button", { name: /device control/i }));

    expect(screen.getByRole("textbox", { name: "Next device UUID" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hand off" })).toBeDisabled();
  });

  it("supports a controlled dialog without a visible trigger", () => {
    render(<ControllerControls {...props} controllerState="ReadOnly" open onOpenChange={vi.fn()} hideTrigger />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("ReadOnly")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /device control/i })).not.toBeInTheDocument();
  });
});
