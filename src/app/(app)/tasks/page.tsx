import type { Metadata } from "next";

import { PageHeader } from "@/components/common/page-header";
import { CreateTaskDialog } from "@/components/tasks/create-task-dialog";
import { TaskList } from "@/components/tasks/task-list";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/guards";
import { can } from "@/lib/auth/permissions";
import { listAssignablepeople } from "@/lib/data/people";
import { listTasks } from "@/lib/data/tasks";
import { createClient } from "@/lib/supabase/server";
import { taskFilterSchema, TASK_STATUS_LABELS } from "@/lib/validation/task";
import Link from "next/link";

export const metadata: Metadata = { title: "My tasks" };

const DUE_FILTERS = [
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Due today" },
  { value: "week", label: "Next 7 days" },
] as const;

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireUser();
  const supabase = await createClient();
  const params = await searchParams;

  const filters = taskFilterSchema.parse({
    status: single(params.status),
    priority: single(params.priority),
    assigneeId: single(params.assigneeId),
    due: single(params.due),
    q: single(params.q),
    page: single(params.page) ?? 1,
  });

  const canAssign = can(session.actor, "tasks.createForTeam");

  const [page, assignees] = await Promise.all([
    listTasks(supabase, filters),
    canAssign ? listAssignablepeople(supabase) : Promise.resolve([]),
  ]);

  const buildHref = (next: Partial<Record<string, string | number | undefined>>) => {
    const query = new URLSearchParams();
    const merged = {
      status: filters.status,
      priority: filters.priority,
      due: filters.due,
      q: filters.q,
      page: filters.page,
      ...next,
    };
    for (const [key, value] of Object.entries(merged)) {
      if (value !== undefined && value !== "" && !(key === "page" && value === 1)) {
        query.set(key, String(value));
      }
    }
    const search = query.toString();
    return search ? `/tasks?${search}` : "/tasks";
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Work"
        title={canAssign ? "Tasks" : "My tasks"}
        description={
          canAssign
            ? "Everything you have assigned, plus the work assigned to you."
            : "Everything assigned to you. Change a status as you go, and start a timer when you begin."
        }
        actions={
          canAssign ? (
            <CreateTaskDialog assignees={assignees.filter((p) => p.id !== session.id)} />
          ) : undefined
        }
      />

      <form className="bg-card border-border/70 flex flex-wrap items-end gap-3 rounded-xl border p-4">
        <div className="min-w-[12rem] flex-1">
          <label htmlFor="q" className="text-muted-foreground mb-1.5 block text-xs">
            Search titles
          </label>
          <input
            id="q"
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Search…"
            className="border-input bg-background h-9 w-full rounded-lg border px-3 text-sm"
          />
        </div>
        <Button type="submit" variant="outline" size="lg">
          Search
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <FilterChip href={buildHref({ status: undefined, due: undefined, page: 1 })} active={!filters.status && !filters.due}>
          All
        </FilterChip>
        {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
          <FilterChip
            key={value}
            href={buildHref({ status: value, due: undefined, page: 1 })}
            active={filters.status === value}
          >
            {label}
          </FilterChip>
        ))}
        {DUE_FILTERS.map((filter) => (
          <FilterChip
            key={filter.value}
            href={buildHref({ due: filter.value, status: undefined, page: 1 })}
            active={filters.due === filter.value}
          >
            {filter.label}
          </FilterChip>
        ))}
      </div>

      <TaskList
        page={page}
        buildHref={(pageNumber) => buildHref({ page: pageNumber })}
        emptyTitle={filters.q || filters.status || filters.due ? "No tasks match that" : "No tasks yet"}
        emptyDescription={
          filters.q || filters.status || filters.due
            ? "Try a different filter, or clear the search."
            : canAssign
              ? "Create the first task to get your team moving."
              : "When your manager assigns work it will show up here."
        }
      />
    </div>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={
        active
          ? "border-gold/40 bg-gold/12 text-gold rounded-full border px-3 py-1.5 text-xs font-medium"
          : "border-border text-muted-foreground hover:text-foreground hover:border-gold/30 rounded-full border px-3 py-1.5 text-xs transition-colors"
      }
    >
      {children}
    </Link>
  );
}

function single(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value && value.length > 0 ? value : undefined;
}
