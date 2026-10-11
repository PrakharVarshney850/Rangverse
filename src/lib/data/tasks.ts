import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, TaskRow } from "@/lib/db/database.types";
import { businessDateKey } from "@/lib/domain/time";
import type { TaskComment, TaskPage, TaskWithPeople } from "@/lib/view-models";
import type { TaskFilterInput } from "@/lib/validation/task";

export type { TaskComment, TaskPage, TaskWithPeople };

const TASK_SELECT =
  "*, assignee:profiles!tasks_assignee_id_fkey(id, full_name, email), creator:profiles!tasks_created_by_fkey(id, full_name, email)";

export const TASKS_PAGE_SIZE = 20;

/**
 * Lists tasks the caller is authorised to see.
 *
 * The filters narrow an already-authorised result set; they are not the access
 * control. Row level security decides which rows exist for this request.
 */
export async function listTasks(
  supabase: SupabaseClient<Database>,
  filters: TaskFilterInput,
): Promise<TaskPage> {
  const page = Math.max(1, filters.page);
  const from = (page - 1) * TASKS_PAGE_SIZE;
  const to = from + TASKS_PAGE_SIZE - 1;

  let query = supabase.from("tasks").select(TASK_SELECT, { count: "exact" });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.priority) query = query.eq("priority", filters.priority);
  if (filters.assigneeId) query = query.eq("assignee_id", filters.assigneeId);

  if (filters.q) {
    // `ilike` with the term escaped for PostgREST's pattern syntax.
    const term = filters.q.replace(/[%_,()]/g, " ").trim();
    if (term) {
      query = query.ilike("title", `%${term}%`);
    }
  }

  const today = businessDateKey();
  if (filters.due === "overdue") {
    query = query.lt("due_date", today).neq("status", "DONE");
  } else if (filters.due === "today") {
    query = query.eq("due_date", today);
  } else if (filters.due === "week") {
    const weekAhead = new Date();
    weekAhead.setDate(weekAhead.getDate() + 7);
    query = query.gte("due_date", today).lte("due_date", businessDateKey(weekAhead));
  }

  const { data, count } = await query
    .order("status", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  const total = count ?? 0;

  return {
    tasks: (data ?? []) as TaskWithPeople[],
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / TASKS_PAGE_SIZE)),
  };
}

export async function getTask(
  supabase: SupabaseClient<Database>,
  taskId: string,
): Promise<TaskWithPeople | null> {
  const { data } = await supabase.from("tasks").select(TASK_SELECT).eq("id", taskId).maybeSingle();
  return (data as TaskWithPeople | null) ?? null;
}

export async function getTaskComments(
  supabase: SupabaseClient<Database>,
  taskId: string,
): Promise<TaskComment[]> {
  const { data } = await supabase
    .from("task_comments")
    .select("*, author:profiles!task_comments_author_id_fkey(id, full_name, email)")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  return (data ?? []) as TaskComment[];
}

export type TaskTimeEntryWithTask = {
  id: string;
  task_id: string;
  started_at: string;
  ended_at: string | null;
  task: { id: string; title: string } | null;
};

export async function getTaskTimeEntries(
  supabase: SupabaseClient<Database>,
  options: { taskId?: string; userId?: string; limit?: number } = {},
): Promise<TaskTimeEntryWithTask[]> {
  let query = supabase
    .from("task_time_entries")
    .select("id, task_id, started_at, ended_at, task:tasks(id, title)")
    .order("started_at", { ascending: false })
    .limit(options.limit ?? 50);

  if (options.taskId) query = query.eq("task_id", options.taskId);
  if (options.userId) query = query.eq("user_id", options.userId);

  const { data } = await query;
  return (data ?? []) as TaskTimeEntryWithTask[];
}

/** Counts by status across everything the caller may see. */
export async function getTaskStatusCounts(supabase: SupabaseClient<Database>) {
  const { data } = await supabase.from("tasks").select("status, due_date").limit(5000);

  const rows = (data ?? []) as Pick<TaskRow, "status" | "due_date">[];
  const today = businessDateKey();

  return {
    TO_DO: rows.filter((r) => r.status === "TO_DO").length,
    IN_PROGRESS: rows.filter((r) => r.status === "IN_PROGRESS").length,
    IN_REVIEW: rows.filter((r) => r.status === "IN_REVIEW").length,
    DONE: rows.filter((r) => r.status === "DONE").length,
    overdue: rows.filter((r) => r.status !== "DONE" && r.due_date !== null && r.due_date < today)
      .length,
    dueToday: rows.filter((r) => r.status !== "DONE" && r.due_date === today).length,
    total: rows.length,
  };
}

/** Tasks assigned to one person, used by the dashboard and report form. */
export async function getOpenTasksForUser(
  supabase: SupabaseClient<Database>,
  userId: string,
  limit = 10,
): Promise<TaskWithPeople[]> {
  const { data } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("assignee_id", userId)
    .neq("status", "DONE")
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(limit);

  return (data ?? []) as TaskWithPeople[];
}
