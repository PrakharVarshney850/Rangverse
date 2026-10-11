import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { TestDatabase } from "../support/test-database";

const here = path.dirname(fileURLToPath(import.meta.url));
const seedFile = path.resolve(here, "..", "..", "supabase", "seed.sql");

/**
 * The local seed must apply cleanly and must create structure only — never
 * invented people or business records.
 */
describe("local seed", () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await TestDatabase.create();
    await db.execAsOwner(await readFile(seedFile, "utf8"));
  }, 120_000);

  afterAll(async () => {
    await db?.close();
  });

  it("is idempotent", async () => {
    await db.execAsOwner(await readFile(seedFile, "utf8"));
    const teams = await db.asOwner<{ count: number }>(
      "select count(*)::int as count from public.teams",
    );
    expect(teams[0]?.count).toBe(2);
  });

  it("creates the four starter sheets", async () => {
    const rows = await db.asOwner<{ slug: string }>(
      "select slug from public.data_sheets order by slug",
    );
    expect(rows.map((r) => r.slug)).toEqual([
      "brand-leads",
      "campaign-tracker",
      "influencer-directory",
      "outreach-tracker",
    ]);
  });

  it("configures columns for every starter sheet", async () => {
    const rows = await db.asOwner<{ slug: string; column_count: number }>(
      `select s.slug, count(c.id)::int as column_count
         from public.data_sheets s
         left join public.data_sheet_columns c on c.sheet_id = s.id
        group by s.slug
        order by s.slug`,
    );

    for (const row of rows) {
      expect(row.column_count, `${row.slug} has no columns`).toBeGreaterThan(0);
    }
  });

  it("gives every SELECT column its options", async () => {
    const rows = await db.asOwner<{ label: string; option_count: number }>(
      `select label, coalesce(array_length(options, 1), 0)::int as option_count
         from public.data_sheet_columns
        where data_type = 'SELECT'`,
    );

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.option_count, `${row.label} has no options`).toBeGreaterThan(0);
    }
  });

  it("creates no people and no business records", async () => {
    const profiles = await db.asOwner<{ count: number }>(
      "select count(*)::int as count from public.profiles",
    );
    const records = await db.asOwner<{ count: number }>(
      "select count(*)::int as count from public.data_sheet_rows",
    );
    const tasks = await db.asOwner<{ count: number }>(
      "select count(*)::int as count from public.tasks",
    );

    expect(profiles[0]?.count).toBe(0);
    expect(records[0]?.count).toBe(0);
    expect(tasks[0]?.count).toBe(0);
  });
});
