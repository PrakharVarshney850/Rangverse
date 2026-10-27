"use server";

import { revalidatePath } from "next/cache";

import { recordActivity } from "@/lib/activity";
import { assertPermission, assertSignedIn, AuthorizationError } from "@/lib/auth/guards";
import type { TaskRow } from "@/lib/db/database.types";
import { createClient } from "@/lib/supabase/server";
import {
  changeTaskStatusSchema,
  createTaskSchema,
  taskCommentSchema,
  updateTaskSchema,
} from "@/lib/validation/task";

export type MutationResult =
  | { ok: true; message: string; id?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

function fieldErrorsFrom(error: { issues: { path: readonly PropertyKey[]; message: string }[] }) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    fieldErrors[key] ??= issue.message;
  }
  return fieldErrors;
}

function humanize(message: string): string {
  if (/row-level security/i.test(message)) {
    return "You are not allowed to do that.";
  }
  return message.replace(/^.*?:\s*/, "").trim() || "Something went wrong. Try again.";
}

function revalidateTaskSurfaces(taskId?: string) {
  revalidatePath("/tasks");
  revalidatePath("/overview");
  revalidatePath("/team");
  if (taskId) revalidatePath(`/tasks/${taskId}`);
}

export async function createTaskAction(formData: FormData): Promise<MutationResult> {
  try {
    const session = await assertSignedIn();

    // Mirrors the database policy: only administrators and managers create work.
    if (session.actor.role === "INTERN") {
      throw new AuthorizationError("Only administrators and managers can create tasks.");
    }

    const parsed = createTaskSchema.safeParse({
      title: formData.get("title"),
      description: formData.get("description"),
      assigneeId: formData.get("assigneeId"),
      priority: formData.get("priority") ?? "MEDIUM",
      dueDate: formData.get("dueDate"),
      campaign: formData.get("campaign"),
      client: formData.get("client"),
    });

    if (!parsed.success) {
      return { ok: false, message: "Check the highlighted fields.", fieldErrors: fieldErrorsFrom(parsed.error) };
    }

    const supabase = await createClient();

    // Inherit the assignee's team so team-scoped views stay consistent.
    const { data: assignee } = await supabase
      .from("profiles")
      .select("team_id")
      .eq("id", parsed.data.assigneeId)
      .maybeSingle();

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: parsed.data.title,
        description: parsed.data.description,
        assignee_id: parsed.data.assigneeId,
        created_by: session.id,
        team_id: assignee?.team_id ?? null,
        priority: parsed.data.priority,
        due_date: parsed.data.dueDate,
        campaign: parsed.data.campaign,
        client: parsed.data.client,
      })
      .select("id")
      .single();

    if (error) {
      return { ok: false, message: humanize(error.message) };
    }

    await recordActivity(supabase, session.id, {
      action: "TASK_CREATED",
      entityType: "task",
      entityId: data.id,
      subjectId: parsed.data.assigneeId,
      metadata: { title: parsed.data.title, priority: parsed.data.priority },
    });

    revalidateTaskSurfaces(data.id);
    return { ok: true, message: "Task created and assigned.", id: data.id };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, message: error.message };
    throw error;
  }
}

export async function updateTaskAction(formData: FormData): Promise<MutationResult> {
  try {
    const session = await assertSignedIn();

    const parsed = updateTaskSchema.safeParse({
      taskId: formData.get("taskId"),
      title: formData.get("title") ?? undefined,
      description: formData.get("description") ?? undefined,
      assigneeId: formData.get("assigneeId") ?? undefined,
      priority: formData.get("priority") ?? undefined,
      dueDate: formData.get("dueDate") ?? undefined,
      campaign: formData.get("campaign") ?? undefined,
      client: formData.get("client") ?? undefined,
      status: formData.get("status") ?? undefined,
    });

    if (!parsed.success) {
      return {
        ok: false,
        message: "Check the highlighted fields.",
        fieldErrors: fieldErrorsFrom(parsed.error),
      };
    }

    const { taskId, ...changes } = parsed.data;
    const supabase = await createClient();

    const patch: Partial<TaskRow> = {};
    if (changes.title !== undefined) patch.title = changes.title;
    if (changes.description !== undefined) patch.description = changes.description;
    if (changes.assigneeId !== undefined) patch.assignee_id = changes.assigneeId;
    if (changes.priority !== undefined) patch.priority = changes.priority;
    if (changes.dueDate !== undefined) patch.due_date = changes.dueDate;
    if (changes.campaign !== undefined) patch.campaign = changes.campaign;
    if (changes.client !== undefined) patch.client = changes.client;
    if (changes.status !== undefined) patch.status = changes.status;

    if (Object.keys(patch).length === 0) {
      return { ok: false, message: "Nothing to change." };
    }

    const { data, error } = await supabase
      .from("tasks")
      .update(patch)
      .eq("id", taskId)
      .select("id")
      .maybeSingle();

    if (error) return { ok: false, message: humanize(error.message) };
    if (!data) return { ok: false, message: "That task is not available to you." };

    await recordActivity(supabase, session.id, {
      action: "TASK_UPDATED",
      entityType: "task",
      entityId: taskId,
      metadata: { fields: Object.keys(patch) },
    });

    revalidateTaskSurfaces(taskId);
    return { ok: true, message: "Task updated." };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, message: error.message };
    throw error;
  }
}

export async function changeTaskStatusAction(formData: FormData): Promise<MutationResult> {
  try {
    const session = await assertSignedIn();

    const parsed = changeTaskStatusSchema.safeParse({
      taskId: formData.get("taskId"),
      status: formData.get("status"),
    });

    if (!parsed.success) {
      return { ok: false, message: "That status is not valid." };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tasks")
      .update({ status: parsed.data.status })
      .eq("id", parsed.data.taskId)
      .select("id, status")
      .maybeSingle();

    if (error) return { ok: false, message: humanize(error.message) };
    if (!data) return { ok: false, message: "That task is not available to you." };

    await recordActivity(supabase, session.id, {
      action: "TASK_STATUS_CHANGED",
      entityType: "task",
      entityId: parsed.data.taskId,
      metadata: { status: parsed.data.status },
    });

    revalidateTaskSurfaces(parsed.data.taskId);
    return { ok: true, message: "Status updated." };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, message: error.message };
    throw error;
  }
}

export async function addTaskCommentAction(formData: FormData): Promise<MutationResult> {
  try {
    const session = await assertSignedIn();

    const parsed = taskCommentSchema.safeParse({
      taskId: formData.get("taskId"),
      body: formData.get("body"),
    });

    if (!parsed.success) {
      return {
        ok: false,
        message: "Write a comment first.",
        fieldErrors: fieldErrorsFrom(parsed.error),
      };
    }

    const supabase = await createClient();
    const { error } = await supabase.from("task_comments").insert({
      task_id: parsed.data.taskId,
      author_id: session.id,
      body: parsed.data.body,
    });

    if (error) return { ok: false, message: humanize(error.message) };

    await recordActivity(supabase, session.id, {
      action: "TASK_COMMENTED",
      entityType: "task",
      entityId: parsed.data.taskId,
    });

    revalidateTaskSurfaces(parsed.data.taskId);
    return { ok: true, message: "Comment added." };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, message: error.message };
    throw error;
  }
}

export async function deleteTaskAction(taskId: string): Promise<MutationResult> {
  try {
    const session = await assertPermission("tasks.createForTeam");
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId)
      .select("id")
      .maybeSingle();

    if (error) return { ok: false, message: humanize(error.message) };
    if (!data) return { ok: false, message: "You cannot delete that task." };

    await recordActivity(supabase, session.id, {
      action: "TASK_UPDATED",
      entityType: "task",
      entityId: taskId,
      metadata: { deleted: true },
    });

    revalidateTaskSurfaces();
    return { ok: true, message: "Task deleted." };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, message: error.message };
    throw error;
  }
}
