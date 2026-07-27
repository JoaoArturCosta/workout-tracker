import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("test toolchain", () => {
  it("runs a unit test", () => {
    expect(2 + 2).toBe(4);
  });

  it("runs a DOM test", () => {
    render(<button type="button">Start workout</button>);
    expect(screen.getByRole("button", { name: "Start workout" })).toBeVisible();
  });
});
