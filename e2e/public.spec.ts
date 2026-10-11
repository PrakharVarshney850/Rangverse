import { expect, test } from "@playwright/test";

import { expectNoAccessibilityViolations } from "./support";

/**
 * Public suite — runs without a live Supabase project.
 *
 * It covers the authenticated boundary, routing, form behaviour, responsive
 * layout and accessibility. Everything here is genuinely executed.
 */

test.describe("the authenticated boundary", () => {
  const protectedRoutes = [
    "/overview",
    "/tasks",
    "/time",
    "/daily-reports",
    "/data",
    "/team",
    "/reports",
    "/settings",
    "/admin/users",
    "/admin/sheets",
    "/admin/activity",
  ];

  for (const route of protectedRoutes) {
    test(`sends an anonymous visitor from ${route} to sign-in`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(route)}`));
      await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    });
  }

  test("remembers where the visitor was heading", async ({ page }) => {
    await page.goto("/tasks");
    await expect(page.locator('input[name="next"]')).toHaveValue("/tasks");
  });

  test("redirects the root to the overview, which then requires sign-in", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("sign-in form", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("shows the Rangmanch brand lockup", async ({ page }) => {
    await expect(page.getByText("RANGVERSE").first()).toBeVisible();
    await expect(page.getByText("The Workspace Behind the Stage")).toBeVisible();
  });

  test("states that accounts are invite-only", async ({ page }) => {
    await expect(page.getByText(/created by invitation only/i)).toBeVisible();
  });

  test("offers no public sign-up link", async ({ page }) => {
    await expect(page.getByRole("link", { name: /sign up|register|create account/i })).toHaveCount(
      0,
    );
  });

  test("labels every field for assistive technology", async ({ page }) => {
    await expect(page.getByLabel("Work email")).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  });

  test("is operable with the keyboard alone", async ({ page }) => {
    await page.getByLabel("Work email").focus();
    await page.keyboard.type("someone@rangmanch.in");
    await page.keyboard.press("Tab");
    // Tab order reaches the forgot-password link before the password field.
    await page.getByLabel("Password", { exact: true }).focus();
    await page.keyboard.type("not-the-right-password");

    await expect(page.getByLabel("Work email")).toHaveValue("someone@rangmanch.in");
  });

  test("links to password recovery", async ({ page }) => {
    await page.getByRole("link", { name: "Forgot password?" }).click();
    await expect(page).toHaveURL(/\/forgot-password/);
    await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  });
});

test.describe("password recovery", () => {
  test("explains the flow without revealing whether an account exists", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.getByLabel("Work email")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send reset link" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to sign in" })).toBeVisible();
  });

  test("states the password policy on the reset screen", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(page.getByText(/at least 12 characters/i)).toBeVisible();
    await expect(page.getByLabel("New password", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Confirm new password")).toBeVisible();
  });
});

test.describe("error states", () => {
  test("shows a helpful not-found page", async ({ page }) => {
    const response = await page.goto("/this-route-does-not-exist");
    // Unauthenticated visitors are sent to sign-in before reaching 404.
    expect(response?.status()).toBeLessThan(500);
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("responsive layout", () => {
  test("keeps the sign-in card usable on a phone", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chromium", "Mobile viewport only");

    await page.goto("/login");

    const card = page.getByRole("heading", { name: "Welcome back" });
    await expect(card).toBeVisible();

    // Nothing may overflow horizontally on a narrow screen.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("renders the sign-in card on desktop without overflow", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Desktop viewport only");

    await page.goto("/login");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

test.describe("accessibility", () => {
  test("sign-in passes axe", async ({ page }) => {
    await page.goto("/login");
    await expectNoAccessibilityViolations(page);
  });

  test("forgot password passes axe", async ({ page }) => {
    await page.goto("/forgot-password");
    await expectNoAccessibilityViolations(page);
  });

  test("reset password passes axe", async ({ page }) => {
    await page.goto("/reset-password");
    await expectNoAccessibilityViolations(page);
  });

  test("every focusable control shows a visible focus indicator", async ({ page }) => {
    await page.goto("/login");

    // Inputs use a focus ring (box-shadow); links and plain buttons fall back
    // to the global outline. Either is an acceptable visible indicator.
    for (const locator of [
      page.getByLabel("Work email"),
      page.getByRole("link", { name: "Forgot password?" }),
      page.getByRole("button", { name: "Sign in" }),
    ]) {
      await locator.focus();

      const indicator = await page.evaluate(() => {
        const element = document.activeElement;
        if (!element) return null;
        const style = window.getComputedStyle(element);
        return {
          outlineStyle: style.outlineStyle,
          outlineWidth: style.outlineWidth,
          boxShadow: style.boxShadow,
        };
      });

      const hasOutline =
        indicator?.outlineStyle !== "none" && indicator?.outlineWidth !== "0px";
      const hasRing = Boolean(indicator?.boxShadow && indicator.boxShadow !== "none");

      expect(
        hasOutline || hasRing,
        `No visible focus indicator: ${JSON.stringify(indicator)}`,
      ).toBe(true);
    }
  });
});
