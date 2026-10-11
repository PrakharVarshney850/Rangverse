/**
 * Shapes returned by the data layer and consumed by both server and client
 * components.
 *
 * They live outside `@/lib/data/*` because those modules are `server-only`:
 * importing a type from them would pull a server module into a client bundle.
 */

import type {
  AttendanceSessionRow,
  BreakRow,
  DailyWorkReportRow,
  DataSheetRecordRow,
  TaskCommentRow,
  TaskRow,
  TaskTimeEntryRow,
  TeamRow,
} from "@/lib/db/database.types";
import type { PersonSummary } from "@/lib/display";
import type { AggregateTotals, AttendanceState } from "@/lib/domain/time";

export type SessionWithBreaks = AttendanceSessionRow & { breaks: BreakRow[] };

export type RunningTaskTimer = TaskTimeEntryRow & {
  task: { id: string; title: string } | null;
};

export type TimeTrackerSnapshot = {
  state: AttendanceState;
  openSession: SessionWithBreaks | null;
  openBreak: BreakRow | null;
  runningTimer: RunningTaskTimer | null;
  today: AggregateTotals;
  week: AggregateTotals;
  recent: SessionWithBreaks[];
};

export type TaskWithPeople = TaskRow & {
  assignee: PersonSummary | null;
  creator: PersonSummary | null;
};

export type TaskComment = TaskCommentRow & { author: PersonSummary | null };

export type TaskPage = {
  tasks: TaskWithPeople[];
  total: number;
  page: number;
  pageCount: number;
};

export type ReportWithPeople = DailyWorkReportRow & {
  author: PersonSummary | null;
  reviewer: PersonSummary | null;
  tasks: { task: { id: string; title: string } | null }[];
};

export type SheetRecord = DataSheetRecordRow & {
  assignee: PersonSummary | null;
};

export type SheetRowPage = {
  rows: SheetRecord[];
  total: number;
  page: number;
  pageCount: number;
};

export type ProfileSummaryWithTeam = PersonSummary & {
  team: Pick<TeamRow, "id" | "name"> | null;
};
