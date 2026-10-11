import { expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Credentials for the authenticated suite. When they are absent the
 * authenticated specs skip with a visible reason — they are never reported as
 * having passed.
 */
export const LIVE_CREDENTIALS = {
  email: process.env.E2E_ADMIN_EMAIL,
  password: process.env.E2E_ADMIN_PASSWORD,
};

export const HAS_LIVE_SUPABASE = Boolean(
  LIVE_CREDENTIALS.email && LIVE_CREDENTIALS.password,
);

export const SKIP_REASON =
  "Requires a running Supabase project. Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run this spec. See docs/testing.md.";

/** Runs axe and asserts there are no violations above the chosen impact. */
export async function expectNoAccessibilityViolations(
  page: Page,
  options: { disableRules?: string[] } = {},
) {
  const builder = new AxeBuilder({ page }).withTags([
    "wcag2a",
    "wcag2aa",
    "wcag21a",
    "wcag21aa",
  ]);

  if (options.disableRules?.length) {
    builder.disableRules(options.disableRules);
  }

  const results = await builder.analyze();

  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );

  expect(
    serious,
    serious
      .map((v) => `${v.id}: ${v.help} (${v.nodes.length} node(s))\n  ${v.helpUrl}`)
      .join("\n"),
  ).toEqual([]);
}

export async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Work email").fill(LIVE_CREDENTIALS.email!);
  await page.getByLabel("Password", { exact: true }).fill(LIVE_CREDENTIALS.password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/overview/, { timeout: 30_000 });
}
