-- ============================================================================
-- Rangverse 0003 — tasks, comments and task-linked time entries
--
-- Guarantees enforced here rather than in application code:
--   * at most one running task timer per user            (partial unique index)
--   * a timer only runs inside an open attendance session and never on a break
--   * an assignee may change only the task status, never assignment or dates
--   * a manager may only create or assign work for people who report to them
--   * completed time entries cannot be re-timed by the person who logged them
-- ============================================================================

create type public.task_status as enum ('TO_DO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE');
create type public.task_priority as enum ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  assignee_id  uuid references public.profiles (id) on delete set null,
  created_by   uuid references public.profiles (id) on delete set null,
  team_id      uuid references public.teams (id) on delete set null,
  status       public.task_status not null default 'TO_DO',
  priority     public.task_priority not null default 'MEDIUM',
  due_date     date,
  campaign     text,
  client       text,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint tasks_title_not_blank check (length(btrim(title)) > 0),
  constraint tasks_title_length check (length(title) <= 200),
  constraint tasks_completed_requires_done
    check ((status = 'DONE') = (completed_at is not null))
);

create index tasks_assignee_status_idx on public.tasks (assignee_id, status);
create index tasks_team_idx on public.tasks (team_id);
create index tasks_due_date_idx on public.tasks (due_date);
create index tasks_created_by_idx on public.tasks (created_by);
create index tasks_status_priority_idx on public.tasks (status, priority);

create table public.task_comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks (id) on delete cascade,
  author_id  uuid references public.profiles (id) on delete set null,
  body       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_comments_body_not_blank check (length(btrim(body)) > 0),
  constraint task_comments_body_length check (length(body) <= 4000)
);

create index task_comments_task_created_idx on public.task_comments (task_id, created_at);

create table public.task_time_entries (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  session_id uuid references public.attendance_sessions (id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at   timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_time_entries_interval_valid
    check (ended_at is null or ended_at > started_at)
);

create unique index task_time_entries_one_open_per_user
  on public.task_time_entries (user_id)
  where ended_at is null;

create index task_time_entries_task_idx on public.task_time_entries (task_id, started_at desc);
create index task_time_entries_user_started_idx
  on public.task_time_entries (user_id, started_at desc);
create index task_time_entries_session_idx on public.task_time_entries (session_id);

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function app.set_updated_at();

create trigger task_comments_set_updated_at
  before update on public.task_comments
  for each row execute function app.set_updated_at();

create trigger task_time_entries_set_updated_at
  before update on public.task_time_entries
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Authorization helpers
-- ---------------------------------------------------------------------------

-- Can the caller see this task at all?
create or replace function app.can_view_task(target_task uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_temp
as $$
  select app.is_active()
     and exists (
       select 1
       from public.tasks t
       where t.id = target_task
         and (
           app.is_admin()
           or t.assignee_id = auth.uid()
           or t.created_by = auth.uid()
           or app.manages(t.assignee_id)
         )
     );
$$;

-- Can the caller log time against this task? Assignees only (plus admins, who
-- may need to demonstrate the flow); managers review rather than track.
create or replace function app.can_track_task(target_task uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_temp
as $$
  select app.is_active()
     and exists (
       select 1
       from public.tasks t
       where t.id = target_task
         and (t.assignee_id = auth.uid() or app.is_admin())
     );
$$;

-- ---------------------------------------------------------------------------
-- Column guards
-- ---------------------------------------------------------------------------

create or replace function app.guard_task_columns()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
declare
  actor_is_admin boolean := app.is_admin();
begin
  -- `completed_at` is derived, never supplied.
  if new.status = 'DONE' then
    new.completed_at := coalesce(
      case when tg_op = 'UPDATE' and old.status = 'DONE' then old.completed_at end,
      now()
    );
  else
    new.completed_at := null;
  end if;

  if app.is_trusted_context() or actor_is_admin then
    return new;
  end if;

  -- A manager may only create or direct work for their own reports.
  if app.is_manager() then
    if new.assignee_id is not null
       and new.assignee_id <> auth.uid()
       and not app.manages(new.assignee_id) then
      raise exception 'A manager can only assign tasks to their own team members.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- Everyone else (interns) may only move the status of a task assigned to them.
  if tg_op = 'INSERT' then
    raise exception 'Only administrators and managers can create tasks.'
      using errcode = '42501';
  end if;

  if old.assignee_id is distinct from auth.uid() then
    raise exception 'You can only update tasks assigned to you.' using errcode = '42501';
  end if;

  if new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.assignee_id is distinct from old.assignee_id
     or new.created_by is distinct from old.created_by
     or new.team_id is distinct from old.team_id
     or new.priority is distinct from old.priority
     or new.due_date is distinct from old.due_date
     or new.campaign is distinct from old.campaign
     or new.client is distinct from old.client
  then
    raise exception 'You can only change the status of a task assigned to you.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger tasks_guard_columns
  before insert or update on public.tasks
  for each row execute function app.guard_task_columns();

create or replace function app.guard_task_time_entry()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
declare
  open_session uuid;
begin
  if tg_op = 'INSERT' then
    if not app.is_trusted_context() then
      new.user_id := coalesce(auth.uid(), new.user_id);
      new.started_at := now();
      new.ended_at := null;

      open_session := app.open_session_id(new.user_id);

      if open_session is null then
        raise exception 'Clock in before starting a task timer.' using errcode = '23514';
      end if;

      if app.is_on_break(new.user_id) then
        raise exception 'End your break before starting a task timer.' using errcode = '23514';
      end if;

      new.session_id := open_session;
    end if;

    return new;
  end if;

  if new.task_id is distinct from old.task_id
     or new.user_id is distinct from old.user_id then
    raise exception 'A time entry cannot be moved to another task or user.'
      using errcode = '42501';
  end if;

  if app.is_trusted_context() or app.is_admin() then
    return new;
  end if;

  if new.started_at is distinct from old.started_at then
    raise exception 'The start time of a recorded time entry cannot be changed.'
      using errcode = '42501';
  end if;

  if old.ended_at is not null then
    raise exception 'A completed time entry cannot be edited. Request a correction instead.'
      using errcode = '42501';
  end if;

  if new.ended_at is not null then
    new.ended_at := now();
  end if;

  return new;
end;
$$;

create trigger task_time_entries_guard
  before insert or update on public.task_time_entries
  for each row execute function app.guard_task_time_entry();

-- Closing an attendance session must also close any running task timer, so the
-- "one active timer" invariant can never outlive its session.
create or replace function app.close_timers_with_session()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
begin
  if old.clock_out_at is null and new.clock_out_at is not null then
    update public.task_time_entries
       set ended_at = new.clock_out_at
     where user_id = new.user_id
       and ended_at is null
       and started_at < new.clock_out_at;
  end if;

  return new;
end;
$$;

create trigger attendance_sessions_close_timers
  after update on public.attendance_sessions
  for each row execute function app.close_timers_with_session();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.tasks enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_time_entries enable row level security;
alter table public.tasks force row level security;
alter table public.task_comments force row level security;
alter table public.task_time_entries force row level security;

create policy tasks_select_scoped on public.tasks
  for select to authenticated
  using (
    app.is_active()
    and (
      app.is_admin()
      or assignee_id = auth.uid()
      or created_by = auth.uid()
      or app.manages(assignee_id)
    )
  );

create policy tasks_insert_privileged on public.tasks
  for insert to authenticated
  with check (
    app.is_active()
    and (app.is_admin() or app.is_manager())
    and created_by = auth.uid()
  );

create policy tasks_update_scoped on public.tasks
  for update to authenticated
  using (
    app.is_active()
    and (
      app.is_admin()
      or assignee_id = auth.uid()
      or created_by = auth.uid()
      or app.manages(assignee_id)
    )
  )
  with check (
    app.is_active()
    and (
      app.is_admin()
      or assignee_id = auth.uid()
      or created_by = auth.uid()
      or app.manages(assignee_id)
    )
  );

create policy tasks_delete_privileged on public.tasks
  for delete to authenticated
  using (app.is_admin() or (app.is_manager() and created_by = auth.uid()));

create policy task_comments_select_scoped on public.task_comments
  for select to authenticated
  using (app.can_view_task(task_id));

create policy task_comments_insert_scoped on public.task_comments
  for insert to authenticated
  with check (app.can_view_task(task_id) and author_id = auth.uid());

create policy task_comments_update_own on public.task_comments
  for update to authenticated
  using (app.is_active() and author_id = auth.uid())
  with check (app.is_active() and author_id = auth.uid());

create policy task_comments_delete_own_or_admin on public.task_comments
  for delete to authenticated
  using (app.is_admin() or (app.is_active() and author_id = auth.uid()));

create policy task_time_entries_select_scoped on public.task_time_entries
  for select to authenticated
  using (app.can_view_user(user_id));

create policy task_time_entries_insert_self on public.task_time_entries
  for insert to authenticated
  with check (
    app.is_active()
    and user_id = auth.uid()
    and app.can_track_task(task_id)
  );

create policy task_time_entries_update_self_or_admin on public.task_time_entries
  for update to authenticated
  using (app.is_active() and (user_id = auth.uid() or app.is_admin()))
  with check (app.is_active() and (user_id = auth.uid() or app.is_admin()));

create policy task_time_entries_delete_admin on public.task_time_entries
  for delete to authenticated
  using (app.is_admin());

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on public.tasks from anon, authenticated;
revoke all on public.task_comments from anon, authenticated;
revoke all on public.task_time_entries from anon, authenticated;

grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.task_comments to authenticated;
grant select, insert, update, delete on public.task_time_entries to authenticated;

grant all on public.tasks, public.task_comments, public.task_time_entries to service_role;

grant execute on function
  app.can_view_task(uuid),
  app.can_track_task(uuid)
to authenticated, service_role;
