import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { TestDatabase } from "../support/test-database";

/**
 * Proves the migration set applies cleanly to a real PostgreSQL instance and
 * that the structural guarantees the application relies on actually exist.
 */
describe("migrations", () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await TestDatabase.create();
  });

  afterAll(async () => {
    await db?.close();
  });

  it("creates every expected table", async () => {
    const rows = await db.asOwner<{ table_name: string }>(
      `select table_name from information_schema.tables
        where table_schema = 'public' and table_type = 'BASE TABLE'
        order by table_name`,
    );

    expect(rows.map((r) => r.table_name)).toEqual([
      "activity_logs",
      "attendance_sessions",
      "breaks",
      "daily_report_tasks",
      "daily_work_reports",
      "data_sheet_columns",
      "data_sheet_memberships",
      "data_sheet_rows",
      "data_sheets",
      "profiles",
      "task_comments",
      "task_time_entries",
      "tasks",
      "teams",
    ]);
  });

  it("enables and forces row level security on every public table", async () => {
    const rows = await db.asOwner<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>(
      `select c.relname, c.relrowsecurity, c.relforcerowsecurity
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
        order by c.relname`,
    );

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.relrowsecurity, `${row.relname} must have RLS enabled`).toBe(true);
      expect(row.relforcerowsecurity, `${row.relname} must force RLS`).toBe(true);
    }
  });

  it("gives every table at least one policy, so nothing is silently open", async () => {
    const rows = await db.asOwner<{ relname: string; policy_count: number }>(
      `select c.relname, count(p.polname)::int as policy_count
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
         left join pg_policy p on p.polrelid = c.oid
        where n.nspname = 'public' and c.relkind = 'r'
        group by c.relname
        order by c.relname`,
    );

    for (const row of rows) {
      expect(row.policy_count, `${row.relname} has no RLS policy`).toBeGreaterThan(0);
    }
  });

  it("keeps activity_logs append-only for application roles", async () => {
    const rows = await db.asOwner<{ cmd: string }>(
      `select case p.polcmd
                when 'r' then 'SELECT' when 'a' then 'INSERT'
                when 'w' then 'UPDATE' when 'd' then 'DELETE' else '*' end as cmd
         from pg_policy p
         join pg_class c on c.oid = p.polrelid
        where c.relname = 'activity_logs'`,
    );

    const commands = rows.map((r) => r.cmd);
    expect(commands).toContain("INSERT");
    expect(commands).toContain("SELECT");
    expect(commands).not.toContain("UPDATE");
    expect(commands).not.toContain("DELETE");
  });

  it("enforces the single-active-record invariants with partial unique indexes", async () => {
    const rows = await db.asOwner<{ indexname: string }>(
      `select indexname from pg_indexes
        where schemaname = 'public'
          and indexname in (
            'attendance_sessions_one_open_per_user',
            'breaks_one_open_per_session',
            'breaks_one_open_per_user',
            'task_time_entries_one_open_per_user'
          )
        order by indexname`,
    );

    expect(rows.map((r) => r.indexname)).toEqual([
      "attendance_sessions_one_open_per_user",
      "breaks_one_open_per_session",
      "breaks_one_open_per_user",
      "task_time_entries_one_open_per_user",
    ]);
  });

  it("pins the search_path of every security definer helper", async () => {
    const rows = await db.asOwner<{ proname: string; config: string[] | null }>(
      `select p.proname, p.proconfig as config
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'app' and p.prosecdef
        order by p.proname`,
    );

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(
        (row.config ?? []).some((entry) => entry.startsWith("search_path=")),
        `app.${row.proname} must pin its search_path`,
      ).toBe(true);
    }
  });
});
