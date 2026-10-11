import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  ADMIN,
  ANON,
  IDS,
  INTERN_A1,
  INTERN_A2,
  INTERN_B1,
  MANAGER_A,
  MANAGER_B,
  PAUSED_INTERN,
  seedDatabase,
  type SeededDatabase,
} from "../support/fixtures";

/**
 * The database authorization matrix.
 *
 * Every assertion runs against a real PostgreSQL instance with the production
 * migrations applied and the session switched to the `authenticated` role, so
 * these are the same policies a direct PostgREST request would hit. Nothing is
 * mocked and no result depends on application-side filtering.
 */
describe("row level security", () => {
  let seed: SeededDatabase;

  beforeAll(async () => {
    seed = await seedDatabase();
  }, 120_000);

  afterAll(async () => {
    await seed?.db.close();
  });

  describe("anonymous access", () => {
    it("cannot read private company data", async () => {
      for (const table of [
        "profiles",
        "tasks",
        "attendance_sessions",
        "daily_work_reports",
        "data_sheet_rows",
        "activity_logs",
      ]) {
        await seed.db.expectDenied(ANON, `select * from public.${table}`);
      }
    });

    it("cannot insert a profile", async () => {
      await seed.db.expectDenied(
        ANON,
        `insert into public.profiles (id, email) values ($1, $2)`,
        ["00000000-0000-4000-8000-0000000000ff", "intruder@example.com"],
      );
    });
  });

  describe("profiles", () => {
    it("lets an intern read only their own profile and their manager", async () => {
      const rows = await seed.db.asUser<{ id: string }>(
        INTERN_A1,
        "select id from public.profiles order by id",
      );
      expect(rows.map((r) => r.id).sort()).toEqual([IDS.managerA, IDS.internA1].sort());
    });

    it("stops intern A1 from reading intern A2", async () => {
      const rows = await seed.db.asUser(
        INTERN_A1,
        "select id from public.profiles where id = $1",
        [IDS.internA2],
      );
      expect(rows).toHaveLength(0);
    });

    it("lets manager A read their own reports but not manager B's", async () => {
      const visible = await seed.db.asUser<{ id: string }>(
        MANAGER_A,
        "select id from public.profiles order by id",
      );
      const ids = visible.map((r) => r.id);
      expect(ids).toContain(IDS.internA1);
      expect(ids).toContain(IDS.internA2);
      expect(ids).not.toContain(IDS.internB1);
      expect(ids).not.toContain(IDS.managerB);
    });

    it("lets an administrator read everyone", async () => {
      const rows = await seed.db.asUser(ADMIN, "select id from public.profiles");
      expect(rows.length).toBe(7);
    });

    it("blocks an intern from promoting themselves", async () => {
      const message = await seed.db.expectDenied(
        INTERN_A1,
        "update public.profiles set role = 'ADMIN' where id = $1",
        [IDS.internA1],
      );
      expect(message).toMatch(/only an administrator can change role/i);
    });

    it("blocks an intern from reassigning their manager", async () => {
      const message = await seed.db.expectDenied(
        INTERN_A1,
        "update public.profiles set manager_id = $1 where id = $2",
        [IDS.managerB, IDS.internA1],
      );
      expect(message).toMatch(/only an administrator/i);
    });

    it("blocks a manager from granting themselves administrator", async () => {
      const message = await seed.db.expectDenied(
        MANAGER_A,
        "update public.profiles set role = 'ADMIN' where id = $1",
        [IDS.managerA],
      );
      expect(message).toMatch(/only an administrator can change role/i);
    });

    it("blocks a manager from editing another manager's intern", async () => {
      const affected = await seed.db.asUser(
        MANAGER_B,
        "update public.profiles set full_name = 'Hijacked' where id = $1 returning id",
        [IDS.internA1],
      );
      expect(affected).toHaveLength(0);
    });

    it("lets an intern update their own editable profile fields", async () => {
      const rows = await seed.db.asUser<{ college: string }>(
        INTERN_A1,
        "update public.profiles set college = $1 where id = $2 returning college",
        ["Sharda University", IDS.internA1],
      );
      expect(rows[0]?.college).toBe("Sharda University");
    });

    it("lets an administrator change a role", async () => {
      const rows = await seed.db.asUser<{ role: string }>(
        ADMIN,
        "update public.profiles set role = 'INTERN' where id = $1 returning role",
        [IDS.internA2],
      );
      expect(rows[0]?.role).toBe("INTERN");
    });
  });

  describe("revoked access", () => {
    it("denies a paused account on the very next request", async () => {
      const rows = await seed.db.asUser(
        PAUSED_INTERN,
        "select id from public.profiles where id = $1",
        [IDS.paused],
      );
      expect(rows).toHaveLength(0);
    });

    it("stops a paused account from reading tasks", async () => {
      const rows = await seed.db.asUser(PAUSED_INTERN, "select id from public.tasks");
      expect(rows).toHaveLength(0);
    });
  });

  describe("tasks", () => {
    it("shows an intern only their own tasks", async () => {
      const rows = await seed.db.asUser<{ id: string }>(INTERN_A1, "select id from public.tasks");
      expect(rows.map((r) => r.id)).toEqual([seed.taskA1]);
    });

    it("stops intern A1 from reading intern B1's task", async () => {
      const rows = await seed.db.asUser(INTERN_A1, "select id from public.tasks where id = $1", [
        seed.taskB1,
      ]);
      expect(rows).toHaveLength(0);
    });

    it("shows manager A their team's tasks only", async () => {
      const rows = await seed.db.asUser<{ id: string }>(MANAGER_A, "select id from public.tasks");
      expect(rows.map((r) => r.id).sort()).toEqual([seed.taskA1, seed.taskA2].sort());
    });

    it("stops manager B from reading manager A's tasks", async () => {
      const rows = await seed.db.asUser(MANAGER_B, "select id from public.tasks where id = $1", [
        seed.taskA1,
      ]);
      expect(rows).toHaveLength(0);
    });

    it("stops an intern from creating a task", async () => {
      const message = await seed.db.expectDenied(
        INTERN_A1,
        `insert into public.tasks (title, assignee_id, created_by) values ('Self assigned', $1, $1)`,
        [IDS.internA1],
      );
      expect(message).toMatch(/row-level security|only administrators and managers/i);
    });

    it("stops an intern from reassigning their own task", async () => {
      const message = await seed.db.expectDenied(
        INTERN_A1,
        "update public.tasks set assignee_id = $1 where id = $2",
        [IDS.internA2, seed.taskA1],
      );
      expect(message).toMatch(/only change the status/i);
    });

    it("stops an intern from changing a task's priority", async () => {
      const message = await seed.db.expectDenied(
        INTERN_A1,
        "update public.tasks set priority = 'URGENT' where id = $1",
        [seed.taskA1],
      );
      expect(message).toMatch(/only change the status/i);
    });

    it("lets an intern move their own task's status", async () => {
      const rows = await seed.db.asUser<{ status: string }>(
        INTERN_A1,
        "update public.tasks set status = 'IN_PROGRESS' where id = $1 returning status",
        [seed.taskA1],
      );
      expect(rows[0]?.status).toBe("IN_PROGRESS");
    });

    it("stops a manager from assigning work outside their team", async () => {
      const message = await seed.db.expectDenied(
        MANAGER_A,
        `insert into public.tasks (title, assignee_id, created_by) values ('Cross-team', $1, $2)`,
        [IDS.internB1, IDS.managerA],
      );
      expect(message).toMatch(/own team members|row-level security/i);
    });

    it("lets a manager assign work inside their team", async () => {
      const rows = await seed.db.asUser<{ id: string }>(
        MANAGER_A,
        `insert into public.tasks (title, assignee_id, created_by) values ('In-team task', $1, $2) returning id`,
        [IDS.internA1, IDS.managerA],
      );
      expect(rows[0]?.id).toBeTruthy();
    });

    it("derives completed_at from the DONE status", async () => {
      const rows = await seed.db.asUser<{ completed_at: string | null }>(
        ADMIN,
        "update public.tasks set status = 'DONE' where id = $1 returning completed_at",
        [seed.taskA2],
      );
      expect(rows[0]?.completed_at).toBeTruthy();

      const reverted = await seed.db.asUser<{ completed_at: string | null }>(
        ADMIN,
        "update public.tasks set status = 'TO_DO' where id = $1 returning completed_at",
        [seed.taskA2],
      );
      expect(reverted[0]?.completed_at).toBeNull();
    });
  });

  describe("attendance", () => {
    it("stops a user from opening two sessions", async () => {
      await seed.db.asUser(INTERN_A1, "select public.rv_clock_in()");
      const again = await seed.db.asUser<{ rv_clock_in: string }>(
        INTERN_A1,
        "select public.rv_clock_in()",
      );
      expect(again).toHaveLength(1);

      const open = await seed.db.asUser<{ count: number }>(
        INTERN_A1,
        "select count(*)::int as count from public.attendance_sessions where clock_out_at is null",
      );
      expect(open[0]?.count).toBe(1);
    });

    it("stops a direct insert of a second open session", async () => {
      const message = await seed.db.expectDenied(
        INTERN_A1,
        "insert into public.attendance_sessions (user_id) values ($1)",
        [IDS.internA1],
      );
      expect(message).toMatch(/duplicate key|unique/i);
    });

    it("ignores a client-supplied clock-in time", async () => {
      await seed.db.asUser(INTERN_A2, "select public.rv_clock_out()").catch(() => undefined);
      const rows = await seed.db.asUser<{ clock_in_at: string }>(
        INTERN_A2,
        `insert into public.attendance_sessions (user_id, clock_in_at)
         values ($1, now() - interval '8 hours') returning clock_in_at`,
        [IDS.internA2],
      );
      const recorded = new Date(String(rows[0]?.clock_in_at)).getTime();
      expect(Date.now() - recorded).toBeLessThan(60_000);
    });

    it("stops an intern from reading another intern's attendance", async () => {
      const rows = await seed.db.asUser(
        INTERN_B1,
        "select id from public.attendance_sessions where user_id = $1",
        [IDS.internA1],
      );
      expect(rows).toHaveLength(0);
    });

    it("lets the managing manager read their intern's attendance", async () => {
      const rows = await seed.db.asUser(
        MANAGER_A,
        "select id from public.attendance_sessions where user_id = $1",
        [IDS.internA1],
      );
      expect(rows.length).toBeGreaterThan(0);
    });

    it("stops the other manager from reading it", async () => {
      const rows = await seed.db.asUser(
        MANAGER_B,
        "select id from public.attendance_sessions where user_id = $1",
        [IDS.internA1],
      );
      expect(rows).toHaveLength(0);
    });

    it("rejects a break without an open session", async () => {
      const message = await seed.db.expectDenied(INTERN_B1, "select public.rv_start_break()");
      expect(message).toMatch(/clock in before/i);
    });

    it("prevents a second concurrent break", async () => {
      await seed.db.asUser(INTERN_A1, "select public.rv_start_break()");
      await seed.db.asUser(INTERN_A1, "select public.rv_start_break()");
      const open = await seed.db.asUser<{ count: number }>(
        INTERN_A1,
        "select count(*)::int as count from public.breaks where ended_at is null",
      );
      expect(open[0]?.count).toBe(1);
    });

    it("refuses to clock out while a break is still running", async () => {
      const message = await seed.db.expectDenied(
        INTERN_A1,
        "update public.attendance_sessions set clock_out_at = now() where user_id = $1 and clock_out_at is null",
        [IDS.internA1],
      );
      expect(message).toMatch(/end the active break/i);
    });

    it("closes the break automatically when clocking out through the state machine", async () => {
      await seed.db.asUser(INTERN_A1, "select public.rv_clock_out()");
      const open = await seed.db.asUser<{ count: number }>(
        INTERN_A1,
        `select count(*)::int as count from public.breaks where ended_at is null`,
      );
      expect(open[0]?.count).toBe(0);
    });

    it("stops a user from editing somebody else's time", async () => {
      const rows = await seed.db.asUser(
        INTERN_B1,
        "update public.attendance_sessions set clock_out_at = now() where user_id = $1 returning id",
        [IDS.internA1],
      );
      expect(rows).toHaveLength(0);
    });
  });

  describe("task timers", () => {
    it("refuses to start without an attendance session", async () => {
      await seed.db.asUser(INTERN_B1, "select public.rv_stop_task_timer()").catch(() => undefined);
      const message = await seed.db.expectDenied(
        INTERN_B1,
        "select public.rv_start_task_timer($1)",
        [seed.taskB1],
      );
      expect(message).toMatch(/clock in before/i);
    });

    it("refuses to track time against another team's task", async () => {
      await seed.db.asUser(INTERN_B1, "select public.rv_clock_in()");
      const message = await seed.db.expectDenied(
        INTERN_B1,
        "select public.rv_start_task_timer($1)",
        [seed.taskA1],
      );
      expect(message).toMatch(/cannot track time/i);
    });

    it("refuses to start while on a break", async () => {
      await seed.db.asUser(INTERN_B1, "select public.rv_start_break()");
      const message = await seed.db.expectDenied(
        INTERN_B1,
        "select public.rv_start_task_timer($1)",
        [seed.taskB1],
      );
      expect(message).toMatch(/end your break/i);
      await seed.db.asUser(INTERN_B1, "select public.rv_end_break()");
    });

    it("keeps at most one running timer when switching tasks", async () => {
      await seed.db.asUser(INTERN_B1, "select public.rv_start_task_timer($1)", [seed.taskB1]);
      await seed.db.asUser(INTERN_B1, "select public.rv_start_task_timer($1)", [seed.taskB1]);
      const open = await seed.db.asUser<{ count: number }>(
        INTERN_B1,
        "select count(*)::int as count from public.task_time_entries where ended_at is null",
      );
      expect(open[0]?.count).toBe(1);
    });

    it("stops a user from editing a completed entry", async () => {
      await seed.db.asUser(INTERN_B1, "select public.rv_stop_task_timer()");
      const message = await seed.db.expectDenied(
        INTERN_B1,
        `update public.task_time_entries set ended_at = now() + interval '5 hours'
          where user_id = $1`,
        [IDS.internB1],
      );
      expect(message).toMatch(/completed time entry cannot be edited/i);
    });

    it("stops a user from deleting another user's entries", async () => {
      const rows = await seed.db.asUser(
        INTERN_A1,
        "delete from public.task_time_entries where user_id = $1 returning id",
        [IDS.internB1],
      );
      expect(rows).toHaveLength(0);
    });

    it("closes a running timer when the attendance session ends", async () => {
      await seed.db.asUser(INTERN_B1, "select public.rv_start_task_timer($1)", [seed.taskB1]);
      await seed.db.asUser(INTERN_B1, "select public.rv_clock_out()");
      const open = await seed.db.asUser<{ count: number }>(
        INTERN_B1,
        "select count(*)::int as count from public.task_time_entries where ended_at is null",
      );
      expect(open[0]?.count).toBe(0);
    });
  });

  describe("daily work reports", () => {
    it("keeps a draft private from the manager", async () => {
      await seed.db.asUser(
        INTERN_A1,
        `insert into public.daily_work_reports (user_id, report_date, summary)
         values ($1, current_date, 'Draft only') `,
        [IDS.internA1],
      );

      const managerView = await seed.db.asUser(
        MANAGER_A,
        "select id from public.daily_work_reports where user_id = $1",
        [IDS.internA1],
      );
      expect(managerView).toHaveLength(0);
    });

    it("shows the report to the manager once submitted", async () => {
      await seed.db.asUser(
        INTERN_A1,
        "update public.daily_work_reports set status = 'SUBMITTED' where user_id = $1",
        [IDS.internA1],
      );

      const managerView = await seed.db.asUser(
        MANAGER_A,
        "select id from public.daily_work_reports where user_id = $1",
        [IDS.internA1],
      );
      expect(managerView).toHaveLength(1);
    });

    it("stops intern A1 from reading intern A2's report", async () => {
      await seed.db.asUser(
        INTERN_A2,
        `insert into public.daily_work_reports (user_id, report_date, summary, status)
         values ($1, current_date, 'A2 work', 'SUBMITTED')`,
        [IDS.internA2],
      );

      const rows = await seed.db.asUser(
        INTERN_A1,
        "select id from public.daily_work_reports where user_id = $1",
        [IDS.internA2],
      );
      expect(rows).toHaveLength(0);
    });

    it("stops the other manager from reading it", async () => {
      const rows = await seed.db.asUser(
        MANAGER_B,
        "select id from public.daily_work_reports where user_id = $1",
        [IDS.internA2],
      );
      expect(rows).toHaveLength(0);
    });

    it("locks a submitted report against author edits", async () => {
      const message = await seed.db.expectDenied(
        INTERN_A1,
        "update public.daily_work_reports set summary = 'rewritten' where user_id = $1",
        [IDS.internA1],
      );
      expect(message).toMatch(/submitted report cannot be edited/i);
    });

    it("stops an author from writing their own manager feedback", async () => {
      const message = await seed.db.expectDenied(
        INTERN_A2,
        "update public.daily_work_reports set manager_feedback = 'Great job me' where user_id = $1",
        [IDS.internA2],
      );
      expect(message).toMatch(/reviewing manager/i);
    });

    it("lets the managing manager record feedback", async () => {
      const rows = await seed.db.asUser<{ reviewed_by: string }>(
        MANAGER_A,
        `update public.daily_work_reports set manager_feedback = 'Clear summary, keep going'
          where user_id = $1 returning reviewed_by`,
        [IDS.internA2],
      );
      expect(rows[0]?.reviewed_by).toBe(IDS.managerA);
    });

    it("rejects a non-URL evidence link", async () => {
      const message = await seed.db.expectDenied(
        INTERN_B1,
        `insert into public.daily_work_reports (user_id, report_date, summary, evidence_links)
         values ($1, current_date, 'With evidence', array['javascript:alert(1)'])`,
        [IDS.internB1],
      );
      expect(message).toMatch(/evidence_are_urls|violates check constraint/i);
    });
  });

  describe("data hub", () => {
    it("hides a sheet from someone with no membership", async () => {
      const rows = await seed.db.asUser(INTERN_B1, "select id from public.data_sheets");
      expect(rows).toHaveLength(0);
    });

    it("hides rows of an unassigned sheet even by direct id", async () => {
      const rows = await seed.db.asUser(
        INTERN_B1,
        "select id from public.data_sheet_rows where id = $1",
        [seed.rowAssignedA1],
      );
      expect(rows).toHaveLength(0);
    });

    it("shows a member only the records assigned to them", async () => {
      const rows = await seed.db.asUser<{ id: string }>(
        INTERN_A1,
        "select id from public.data_sheet_rows",
      );
      expect(rows.map((r) => r.id)).toEqual([seed.rowAssignedA1]);
    });

    it("stops a sheet member from reading another member's record", async () => {
      const rows = await seed.db.asUser(
        INTERN_A1,
        "select id from public.data_sheet_rows where id = $1",
        [seed.rowAssignedA2],
      );
      expect(rows).toHaveLength(0);
    });

    it("gives a manager their team's records plus unassigned ones", async () => {
      const rows = await seed.db.asUser<{ id: string }>(
        MANAGER_A,
        "select id from public.data_sheet_rows order by created_at",
      );
      expect(rows.map((r) => r.id).sort()).toEqual(
        [seed.rowAssignedA1, seed.rowAssignedA2, seed.rowUnassigned].sort(),
      );
    });

    it("keeps a different sheet out of reach entirely", async () => {
      const rows = await seed.db.asUser(
        MANAGER_A,
        "select id from public.data_sheet_rows where id = $1",
        [seed.rowBrandLead],
      );
      expect(rows).toHaveLength(0);
    });

    it("stops a VIEW member from editing a record", async () => {
      const rows = await seed.db.asUser(
        INTERN_A2,
        "update public.data_sheet_rows set row_data = '{\"handle\":\"@hacked\"}'::jsonb where id = $1 returning id",
        [seed.rowAssignedA2],
      );
      expect(rows).toHaveLength(0);
    });

    it("lets an EDIT member update their own record", async () => {
      const rows = await seed.db.asUser<{ row_data: Record<string, string> }>(
        INTERN_A1,
        `update public.data_sheet_rows
            set row_data = '{"handle":"@creator.one","followers":"15000"}'::jsonb
          where id = $1 returning row_data`,
        [seed.rowAssignedA1],
      );
      expect(rows[0]?.row_data.followers).toBe("15000");
    });

    it("rejects an unknown column in row data", async () => {
      const message = await seed.db.expectDenied(
        INTERN_A1,
        `update public.data_sheet_rows set row_data = '{"handle":"@x","secret":"y"}'::jsonb where id = $1`,
        [seed.rowAssignedA1],
      );
      expect(message).toMatch(/unknown column "secret"/i);
    });

    it("rejects a value that does not match the column type", async () => {
      const message = await seed.db.expectDenied(
        INTERN_A1,
        `update public.data_sheet_rows set row_data = '{"handle":"@x","contact_email":"not-an-email"}'::jsonb where id = $1`,
        [seed.rowAssignedA1],
      );
      expect(message).toMatch(/must be an email address/i);
    });

    it("rejects a missing required column", async () => {
      const message = await seed.db.expectDenied(
        INTERN_A1,
        `update public.data_sheet_rows set row_data = '{"followers":"10"}'::jsonb where id = $1`,
        [seed.rowAssignedA1],
      );
      expect(message).toMatch(/is required/i);
    });

    it("stops an intern from reassigning a record", async () => {
      const message = await seed.db.expectDenied(
        INTERN_A1,
        "update public.data_sheet_rows set assigned_to_user_id = null where id = $1",
        [seed.rowAssignedA1],
      );
      expect(message).toMatch(/only an administrator or manager can reassign/i);
    });

    it("stops a non-admin from granting sheet access", async () => {
      const message = await seed.db.expectDenied(
        MANAGER_A,
        `insert into public.data_sheet_memberships (sheet_id, user_id, access_level, created_by)
         values ($1, $2, 'EDIT', $3)`,
        [IDS.sheetBrandLeads, IDS.managerA, IDS.managerA],
      );
      expect(message).toMatch(/row-level security/i);
    });

    it("makes revocation effective on the next request", async () => {
      const before = await seed.db.asUser(INTERN_A1, "select id from public.data_sheet_rows");
      expect(before.length).toBeGreaterThan(0);

      await seed.db.asUser(
        ADMIN,
        "delete from public.data_sheet_memberships where sheet_id = $1 and user_id = $2",
        [IDS.sheetInfluencers, IDS.internA1],
      );

      const after = await seed.db.asUser(INTERN_A1, "select id from public.data_sheet_rows");
      expect(after).toHaveLength(0);

      const sheets = await seed.db.asUser(INTERN_A1, "select id from public.data_sheets");
      expect(sheets).toHaveLength(0);
    });
  });

  describe("activity logs", () => {
    it("refuses a log entry attributed to someone else", async () => {
      const message = await seed.db.expectDenied(
        INTERN_A1,
        `insert into public.activity_logs (actor_id, action, entity_type)
         values ($1, 'FORGED', 'profile')`,
        [IDS.admin],
      );
      expect(message).toMatch(/row-level security/i);
    });

    it("is append-only: application roles hold no UPDATE or DELETE privilege", async () => {
      await seed.db.asUser(
        INTERN_A1,
        `insert into public.activity_logs (actor_id, action, entity_type)
         values ($1, 'ATTENDANCE_CLOCK_IN', 'attendance_session')`,
        [IDS.internA1],
      );

      const updateMessage = await seed.db.expectDenied(
        INTERN_A1,
        "update public.activity_logs set action = 'TAMPERED' where actor_id = $1",
        [IDS.internA1],
      );
      expect(updateMessage).toMatch(/permission denied/i);

      const deleteMessage = await seed.db.expectDenied(
        ADMIN,
        "delete from public.activity_logs where actor_id = $1",
        [IDS.internA1],
      );
      expect(deleteMessage).toMatch(/permission denied/i);
    });

    it("scopes reads to the viewer's relationships", async () => {
      const otherManager = await seed.db.asUser(
        MANAGER_B,
        "select id from public.activity_logs where actor_id = $1",
        [IDS.internA1],
      );
      expect(otherManager).toHaveLength(0);

      const owningManager = await seed.db.asUser(
        MANAGER_A,
        "select id from public.activity_logs where actor_id = $1",
        [IDS.internA1],
      );
      expect(owningManager.length).toBeGreaterThan(0);
    });
  });
});
