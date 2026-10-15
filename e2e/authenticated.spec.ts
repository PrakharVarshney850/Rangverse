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

  test("shows role-appropriate navigation", async ({ page }, testInfo) => {
    if (testInfo.project.name === "mobile-chromium") {
      const quickNavigation = page.getByRole("navigation", { name: "Quick navigation" });
      await expect(quickNavigation.getByRole("link", { name: "Overview" })).toBeVisible();
      await expect(quickNavigation.getByRole("link", { name: "Time" })).toBeVisible();
      await expect(quickNavigation.getByRole("link", { name: "Reports" })).toBeVisible();
      return;
    }

    const primaryNavigation = page.getByRole("navigation", { name: "Primary" });
    await expect(primaryNavigation.getByRole("link", { name: "Overview" })).toBeVisible();
    await expect(primaryNavigation.getByRole("link", { name: "Time tracker" })).toBeVisible();
    await expect(primaryNavigation.getByRole("link", { name: "Daily reports" })).toBeVisible();
  });

  test("keeps password recovery available to a signed-in user", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(page).toHaveURL(/\/reset-password$/);
    await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
  });

  test("marks version 2 items as planned rather than offering dead buttons", async ({ page }) => {
    if (await page.getByRole("button", { name: "Open menu" }).isVisible()) {
      await page.getByRole("button", { name: "Open menu" }).click();
    }

    const primaryNavigation = page.getByRole("navigation", { name: "Primary" });
    const resources = primaryNavigation.getByText("Resources", { exact: true });
    await expect(resources).toBeVisible();
    await expect(primaryNavigation.getByText("v2").first()).toBeVisible();
  });

  test("clocks in, starts a break, ends it and clocks out", async ({ page }) => {
    await page.goto("/time");

    const endBreak = page.getByRole("button", { name: "End break" });
    if (await endBreak.isVisible()) {
      await endBreak.click();
      await expect(page.getByText("Working", { exact: true })).toBeVisible({ timeout: 15_000 });
    }

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
    const taskLinks = page.locator('a[href^="/tasks/"]');
    test.skip((await taskLinks.count()) === 0, "Requires at least one visible task fixture.");
    await taskLinks.first().click();
    await expect(page.getByText(/clock in to track time/i)).toBeVisible();
  });

  test("writes and submits a daily report", async ({ page }) => {
    await page.goto("/daily-reports");

    const summary = page.getByLabel("What did you work on today?");
    if (await summary.isVisible()) {
      await summary.fill("End-to-end test run of the Rangverse daily report flow.");
      await page.getByRole("button", { name: "Submit report" }).click();
      await expect(
        page.getByText("Report submitted. Your manager can see it now.", { exact: true }),
      ).toBeVisible({ timeout: 15_000 });
      await expect(page.locator('[role="status"]').filter({ hasText: "Submitted" })).toBeVisible({
        timeout: 15_000,
      });
    } else {
      await expect(page.getByRole("status")).toContainText("Submitted");
    }
  });

  test("shows not found for an unknown data sheet", async ({ page }) => {
    await page.goto("/data/a-sheet-that-does-not-exist");
    await expect(page.getByRole("heading", { name: "Nothing on this stage" })).toBeVisible();
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
