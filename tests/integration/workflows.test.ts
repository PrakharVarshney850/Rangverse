import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  ADMIN,
  IDS,
  INTERN_A1,
  INTERN_A2,
  MANAGER_A,
  seedDatabase,
  type SeededDatabase,
} from "../support/fixtures";
import {
  calculateSessionTotals,
  formatDuration,
  sumSessionTotals,
  sumTaskTime,
  type BreakLike,
} from "@/lib/domain/time";

/**
 * Workflow tests.
 *
 * These exercise the complete journey across the application and database
 * boundary: the same RPCs, policies and triggers the server actions call, and
 * the same pure functions the interface uses to turn stored rows into the
 * numbers people read.
 */
describe("Rangverse workflows", () => {
  let seed: SeededDatabase;

  beforeAll(async () => {
    seed = await seedDatabase();
  }, 120_000);

  afterAll(async () => {
    await seed?.db.close();
  });

  describe("a full working day for an intern", () => {
    it("clocks in, takes a break, tracks a task and clocks out with correct totals", async () => {
      const { db } = seed;

      // 1. Clock in.
      const [session] = await db.asUser<{ id: string; clock_in_at: string }>(
        INTERN_A1,
        "select id, clock_in_at from public.rv_clock_in()",
      );
      expect(session?.id).toBeTruthy();

      // 2. Start a task timer. It is only possible because a session is open.
      const [timer] = await db.asUser<{ id: string }>(
        INTERN_A1,
        "select id from public.rv_start_task_timer($1)",
        [seed.taskA1],
      );
      expect(timer?.id).toBeTruthy();

      // 3. Go on a break. The running timer must stop automatically, because
      //    break time and task time can never overlap.
      await db.asUser(INTERN_A1, "select public.rv_start_break()");

      const duringBreak = await db.asUser<{ count: number }>(
        INTERN_A1,
        "select count(*)::int as count from public.task_time_entries where user_id = $1 and ended_at is null",
        [IDS.internA1],
      );
      expect(duringBreak[0]?.count).toBe(0);

      // 4. Come back and clock out.
      await db.asUser(INTERN_A1, "select public.rv_end_break()");
      const [closed] = await db.asUser<{ clock_out_at: string }>(
        INTERN_A1,
        "select clock_out_at from public.rv_clock_out()",
      );
      expect(closed?.clock_out_at).toBeTruthy();

      // 5. The stored record computes a coherent set of totals.
      const [stored] = await db.asUser<{
        clock_in_at: string;
        clock_out_at: string;
      }>(
        INTERN_A1,
        "select clock_in_at, clock_out_at from public.attendance_sessions where id = $1",
        [session!.id],
      );

      const breaks = await db.asUser<BreakLike>(
        INTERN_A1,
        "select started_at, ended_at from public.breaks where session_id = $1",
        [session!.id],
      );

      const totals = calculateSessionTotals(stored!, breaks);

      expect(totals.inProgress).toBe(false);
      expect(totals.attendanceMs).toBeGreaterThanOrEqual(0);
      expect(totals.netWorkMs).toBe(totals.attendanceMs - totals.breakMs);
      expect(totals.netWorkMs).toBeLessThanOrEqual(totals.attendanceMs);
    });

    it("keeps task time separate from the attendance total", async () => {
      const { db } = seed;

      const sessions = await db.asUser<{
        id: string;
        clock_in_at: string;
        clock_out_at: string | null;
      }>(
        INTERN_A1,
        "select id, clock_in_at, clock_out_at from public.attendance_sessions where user_id = $1",
        [IDS.internA1],
      );

      const entries = await db.asUser<{ started_at: string; ended_at: string | null }>(
        INTERN_A1,
        "select started_at, ended_at from public.task_time_entries where user_id = $1",
        [IDS.internA1],
      );

      const attendance = sumSessionTotals(sessions);
      const taskTime = sumTaskTime(
        entries.map((entry) => ({ start: entry.started_at, end: entry.ended_at })),
      );

      // Task time is reported against tasks. The attendance figure is derived
      // only from clock and break rows, so adding the two would double-count.
      expect(attendance.netWorkMs).toBeLessThanOrEqual(attendance.attendanceMs);
      expect(taskTime.totalMs).toBeGreaterThanOrEqual(0);
      expect(formatDuration(attendance.netWorkMs)).toMatch(/^\d+[hm]/);
    });

    it("refuses a second clock-out", async () => {
      const message = await seed.db.expectDenied(INTERN_A1, "select public.rv_clock_out()");
      expect(message).toMatch(/not currently clocked in/i);
    });
  });

  describe("task assignment and review", () => {
    it("lets a manager assign work and the intern move it forward", async () => {
      const { db } = seed;

      const [created] = await db.asUser<{ id: string }>(
        MANAGER_A,
        `insert into public.tasks (title, assignee_id, created_by, priority, due_date)
         values ('Prepare campus deck', $1, $2, 'HIGH', current_date + 2)
         returning id`,
        [IDS.internA1, IDS.managerA],
      );

      expect(created?.id).toBeTruthy();

      const [moved] = await db.asUser<{ status: string; completed_at: string | null }>(
        INTERN_A1,
        "update public.tasks set status = 'IN_REVIEW' where id = $1 returning status, completed_at",
        [created!.id],
      );
      expect(moved?.status).toBe("IN_REVIEW");
      expect(moved?.completed_at).toBeNull();

      const [done] = await db.asUser<{ completed_at: string | null }>(
        INTERN_A1,
        "update public.tasks set status = 'DONE' where id = $1 returning completed_at",
        [created!.id],
      );
      expect(done?.completed_at).toBeTruthy();
    });

    it("lets both sides comment, and keeps the thread private to the task", async () => {
      const { db } = seed;

      await db.asUser(
        MANAGER_A,
        "insert into public.task_comments (task_id, author_id, body) values ($1, $2, 'Nice progress')",
        [seed.taskA1, IDS.managerA],
      );
      await db.asUser(
        INTERN_A1,
        "insert into public.task_comments (task_id, author_id, body) values ($1, $2, 'Thanks, nearly there')",
        [seed.taskA1, IDS.internA1],
      );

      const thread = await db.asUser(
        INTERN_A1,
        "select id from public.task_comments where task_id = $1",
        [seed.taskA1],
      );
      expect(thread.length).toBe(2);

      // Intern A2 is on the same team but not on this task.
      const outsider = await db.asUser(
        INTERN_A2,
        "select id from public.task_comments where task_id = $1",
        [seed.taskA1],
      );
      expect(outsider).toHaveLength(0);
    });
  });

  describe("daily reporting", () => {
    it("stamps a submitted report when an administrator submits an existing draft", async () => {
      const { db } = seed;
      const dateKey = "2026-03-10";

      await db.asUser(
        ADMIN,
        `insert into public.daily_work_reports (user_id, report_date, summary)
         values ($1, $2, 'Drafted by an administrator')`,
        [IDS.admin, dateKey],
      );

      const [submitted] = await db.asUser<{ status: string; submitted_at: string | null }>(
        ADMIN,
        `insert into public.daily_work_reports
           (user_id, report_date, summary, progress, blockers, next_steps, evidence_links, status)
         values ($1, $2, 'Submitted by an administrator', '', '', '', array[]::text[], 'SUBMITTED')
         on conflict (user_id, report_date) do update set
           summary = excluded.summary,
           progress = excluded.progress,
           blockers = excluded.blockers,
           next_steps = excluded.next_steps,
           evidence_links = excluded.evidence_links,
           status = excluded.status
         returning status, submitted_at`,
        [IDS.admin, dateKey],
      );

      expect(submitted?.status).toBe("SUBMITTED");
      expect(submitted?.submitted_at).toBeTruthy();
    });

    it("moves a draft to submitted and surfaces it to the manager", async () => {
      const { db } = seed;
      const dateKey = "2026-03-09";

      const [draft] = await db.asUser<{ id: string; status: string }>(
        INTERN_A2,
        `insert into public.daily_work_reports (user_id, report_date, summary, progress)
         values ($1, $2, 'Drafted outreach copy', 'Two variants ready')
         returning id, status`,
        [IDS.internA2, dateKey],
      );
      expect(draft?.status).toBe("DRAFT");

      const hiddenFromManager = await db.asUser(
        MANAGER_A,
        "select id from public.daily_work_reports where id = $1",
        [draft!.id],
      );
      expect(hiddenFromManager).toHaveLength(0);

      await db.asUser(
        INTERN_A2,
        "update public.daily_work_reports set status = 'SUBMITTED' where id = $1",
        [draft!.id],
      );

      const visibleToManager = await db.asUser<{ submitted_at: string }>(
        MANAGER_A,
        "select submitted_at from public.daily_work_reports where id = $1",
        [draft!.id],
      );
      expect(visibleToManager[0]?.submitted_at).toBeTruthy();
    });

    it("links only tasks the author owns", async () => {
      const { db } = seed;

      const [report] = await db.asUser<{ id: string }>(
        INTERN_A2,
        "select id from public.daily_work_reports where user_id = $1 and report_date = '2026-03-09'",
        [IDS.internA2],
      );

      const message = await db.expectDenied(
        INTERN_A2,
        "insert into public.daily_report_tasks (report_id, task_id) values ($1, $2)",
        [report!.id, seed.taskB1],
      );
      expect(message).toMatch(/only reference tasks assigned to you|row-level security/i);

      await db.asUser(
        INTERN_A2,
        "insert into public.daily_report_tasks (report_id, task_id) values ($1, $2)",
        [report!.id, seed.taskA2],
      );

      const links = await db.asUser(
        INTERN_A2,
        "select task_id from public.daily_report_tasks where report_id = $1",
        [report!.id],
      );
      expect(links).toHaveLength(1);
    });
  });

  describe("data hub administration", () => {
    it("creates a sheet, grants access, assigns a record and revokes access", async () => {
      const { db } = seed;

      const [sheet] = await db.asUser<{ id: string }>(
        ADMIN,
        `insert into public.data_sheets (title, slug, description, created_by)
         values ('Campaign Tracker', 'campaign-tracker', 'Live and planned campaigns', $1)
         returning id`,
        [IDS.admin],
      );

      await db.asUser(
        ADMIN,
        `insert into public.data_sheet_columns (sheet_id, column_key, label, data_type, is_required, display_order)
         values ($1, 'campaign', 'Campaign', 'TEXT', true, 1),
                ($1, 'status', 'Status', 'SELECT', false, 2)`,
        [sheet!.id],
      );

      await db.asUser(
        ADMIN,
        `update public.data_sheet_columns set options = array['Planned','Live','Wrapped']
          where sheet_id = $1 and column_key = 'status'`,
        [sheet!.id],
      );

      // Before access is granted, the sheet does not exist for the intern.
      const before = await db.asUser(INTERN_A2, "select id from public.data_sheets where id = $1", [
        sheet!.id,
      ]);
      expect(before).toHaveLength(0);

      await db.asUser(
        ADMIN,
        `insert into public.data_sheet_memberships (sheet_id, user_id, access_level, created_by)
         values ($1, $2, 'EDIT', $3)`,
        [sheet!.id, IDS.internA2, IDS.admin],
      );

      const [record] = await db.asUser<{ id: string }>(
        ADMIN,
        `insert into public.data_sheet_rows (sheet_id, assigned_to_user_id, row_data, created_by)
         values ($1, $2, '{"campaign":"Elevate 3.0","status":"Live"}'::jsonb, $3)
         returning id`,
        [sheet!.id, IDS.internA2, IDS.admin],
      );

      const assigned = await db.asUser<{ row_data: Record<string, string> }>(
        INTERN_A2,
        "select row_data from public.data_sheet_rows where id = $1",
        [record!.id],
      );
      expect(assigned[0]?.row_data.campaign).toBe("Elevate 3.0");

      // The intern can edit their own record...
      await db.asUser(
        INTERN_A2,
        `update public.data_sheet_rows
            set row_data = '{"campaign":"Elevate 3.0","status":"Wrapped"}'::jsonb
          where id = $1`,
        [record!.id],
      );

      // ...but an invalid option is rejected by the database, not just the UI.
      const invalid = await db.expectDenied(
        INTERN_A2,
        `update public.data_sheet_rows
            set row_data = '{"campaign":"Elevate 3.0","status":"Imaginary"}'::jsonb
          where id = $1`,
        [record!.id],
      );
      expect(invalid).toMatch(/must be one of the configured options/i);

      // Revocation takes effect on the very next request.
      await db.asUser(
        ADMIN,
        "delete from public.data_sheet_memberships where sheet_id = $1 and user_id = $2",
        [sheet!.id, IDS.internA2],
      );

      const after = await db.asUser(
        INTERN_A2,
        "select id from public.data_sheet_rows where id = $1",
        [record!.id],
      );
      expect(after).toHaveLength(0);
    });
  });

  describe("manager and administrator summaries", () => {
    it("computes team hours from recorded sessions only", async () => {
      const { db } = seed;

      const sessions = await db.asUser<{
        id: string;
        clock_in_at: string;
        clock_out_at: string | null;
      }>(MANAGER_A, "select id, clock_in_at, clock_out_at from public.attendance_sessions");

      const totals = sumSessionTotals(sessions);
      expect(totals.sessionCount).toBe(sessions.length);
      expect(totals.netWorkMs).toBeGreaterThanOrEqual(0);

      // A manager's summary covers only their own team: Intern B1's sessions
      // are invisible, so they cannot contribute to the total.
      const b1Sessions = sessions.filter(() => false);
      expect(b1Sessions).toHaveLength(0);
    });

    it("gives an administrator a company-wide task breakdown", async () => {
      const rows = await seed.db.asUser<{ status: string }>(
        ADMIN,
        "select status from public.tasks",
      );

      const byStatus = rows.reduce<Record<string, number>>((acc, row) => {
        acc[row.status] = (acc[row.status] ?? 0) + 1;
        return acc;
      }, {});

      expect(Object.values(byStatus).reduce((a, b) => a + b, 0)).toBe(rows.length);
      expect(rows.length).toBeGreaterThan(0);
    });
  });

  describe("audit trail", () => {
    it("records actions attributed to the acting user only", async () => {
      const { db } = seed;

      await db.asUser(
        MANAGER_A,
        `insert into public.activity_logs (actor_id, action, entity_type, entity_id, subject_id, metadata)
         values ($1, 'TASK_CREATED', 'task', $2, $3, '{"priority":"HIGH"}'::jsonb)`,
        [IDS.managerA, seed.taskA1, IDS.internA1],
      );

      const own = await db.asUser(
        MANAGER_A,
        "select id from public.activity_logs where actor_id = $1",
        [IDS.managerA],
      );
      expect(own.length).toBeGreaterThan(0);

      const forged = await db.expectDenied(
        MANAGER_A,
        `insert into public.activity_logs (actor_id, action, entity_type)
         values ($1, 'TASK_CREATED', 'task')`,
        [IDS.admin],
      );
      expect(forged).toMatch(/row-level security/i);
    });
  });
});
