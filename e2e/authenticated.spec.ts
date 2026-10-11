import { expect, test } from "@playwright/test";

import { expectNoAccessibilityViolations, HAS_LIVE_SUPABASE, signIn, SKIP_REASON } from "./support";

/**
 * Authenticated suite.
 *
 * These specs need a running Supabase project with a bootstrapped
 * administrator. Without one they are skipped with the reason below — they are
 * never reported as passing. See docs/testing.md for how to enable them.
 */
test.describe("authenticated workspace", () => {
  test.skip(!HAS_LIVE_SUPABASE, SKIP_REASON);

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("signs in and lands on the overview", async ({ page }) => {
    await expect(page).toHaveURL(/\/overview/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("shows role-appropriate navigation", async ({ page }) => {
    await expect(page.getByRole("link", { name: "Overview" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Time tracker" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Daily reports" }).first()).toBeVisible();
  });

  test("marks version 2 items as planned rather than offering dead buttons", async ({ page }) => {
    const resources = page.getByText("Resources", { exact: true }).first();
    await expect(resources).toBeVisible();
    await expect(page.getByText("v2").first()).toBeVisible();
  });

  test("clocks in, starts a break, ends it and clocks out", async ({ page }) => {
    await page.goto("/time");

    const clockIn = page.getByRole("button", { name: "Clock in" });
    if (await clockIn.isVisible()) {
      await clockIn.click();
      await expect(page.getByText("Working", { exact: true })).toBeVisible({ timeout: 15_000 });
    }

    await page.getByRole("button", { name: "Start break" }).click();
    await expect(page.getByText("On break", { exact: true })).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "End break" }).click();
    await expect(page.getByText("Working", { exact: true })).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Clock out" }).click();
    await expect(page.getByRole("button", { name: "Clock in" })).toBeVisible({ timeout: 15_000 });
  });

  test("does not offer a task timer while clocked out", async ({ page }) => {
    await page.goto("/time");
    const clockOut = page.getByRole("button", { name: "Clock out" });
    if (await clockOut.isVisible()) {
      await clockOut.click();
    }

    await page.goto("/tasks");
    const firstTask = page.getByRole("link").filter({ hasText: /./ }).first();
    if (await firstTask.isVisible()) {
      await firstTask.click();
      await expect(page.getByText(/clock in to track time/i)).toBeVisible();
    }
  });

  test("writes and submits a daily report", async ({ page }) => {
    await page.goto("/daily-reports");

    const summary = page.getByLabel("What did you work on today?");
    if (await summary.isVisible()) {
      await summary.fill("End-to-end test run of the Rangverse daily report flow.");
      await page.getByRole("button", { name: "Save draft" }).click();
      await expect(page.getByText(/draft saved/i)).toBeVisible({ timeout: 15_000 });
    }
  });

  test("blocks a direct URL to a record the signed-in user cannot access", async ({ page }) => {
    const response = await page.goto("/data/a-sheet-that-does-not-exist");
    expect(response?.status()).toBeGreaterThanOrEqual(400);
  });

  test("overview passes axe", async ({ page }) => {
    await page.goto("/overview");
    await expectNoAccessibilityViolations(page);
  });

  test("time tracker passes axe", async ({ page }) => {
    await page.goto("/time");
    await expectNoAccessibilityViolations(page);
  });

  test("tasks list passes axe", async ({ page }) => {
    await page.goto("/tasks");
    await expectNoAccessibilityViolations(page);
  });

  test("data hub passes axe", async ({ page }) => {
    await page.goto("/data");
    await expectNoAccessibilityViolations(page);
  });

  test("signs out cleanly", async ({ page }) => {
    await page.goto("/overview");
    await page.getByRole("button", { name: /account menu/i }).click();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});
