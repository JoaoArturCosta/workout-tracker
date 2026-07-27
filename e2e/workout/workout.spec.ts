import { expect, test } from "@playwright/test";

test.describe("workout journeys", () => {
  test.beforeEach(async ({ page }) => {
    // E2E auth and seed data are supplied by the staging harness. Keep local runs
    // deterministic by allowing the harness to skip auth-dependent journeys.
    test.skip(!process.env.E2E_AUTH_READY, "Set E2E_AUTH_READY=1 with a seeded authenticated browser");
    await page.goto("/sessions");
  });

  test("template mode setup and checklist flow", async ({ page }) => {
    await page.goto("/templates");
    await page.getByRole("button", { name: /create template/i }).click();
    await expect(page.getByText(/exercise occurrences/i)).toBeVisible();
    await page.getByRole("button", { name: /cancel|close/i }).first().click().catch(() => undefined);
    await page.goto("/sessions");
    await expect(page.getByRole("heading", { name: /workouts/i })).toBeVisible();
  });

  test("ended history stays read-only", async ({ page }) => {
    const history = page.getByText(/workout history/i);
    await expect(history).toBeVisible();
    const ended = page.locator('[data-testid="workout-header"]').filter({ hasText: /Completed|Partial/ }).first();
    if (await ended.count()) {
      await ended.click();
      await expect(page.getByText(/set checklist/i)).toBeVisible();
      await expect(page.getByRole("button", { name: /discard|finish|end early/i })).toHaveCount(0);
    }
  });

  test("progress separates Duration from Reps", async ({ page }) => {
    await page.goto("/progress");
    await expect(page.getByText(/Duration sets/i)).toBeVisible();
    await expect(page.getByText(/never treated as reps/i)).toBeVisible();
  });
});
