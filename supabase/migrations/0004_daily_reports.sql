-- ============================================================================
-- Rangverse 0004 — daily work reports
--
-- One report per person per day. Drafts are private to their author; a manager
-- sees a report only once it has been submitted. Submitted reports are locked
-- for the author so the record stays auditable; managers add feedback in
-- dedicated review columns they alone can write.
-- ============================================================================

create type public.report_status as enum ('DRAFT', 'SUBMITTED');

-- Check constraints cannot contain subqueries, so the array-wide URL test is
-- expressed as an immutable helper instead.
create or replace function app.text_array_all_match(entries text[], pattern text)
returns boolean
language sql
immutable
set search_path = pg_catalog, pg_temp
as $$
  select coalesce(bool_and(entry ~ pattern), true) from unnest(entries) as entry;
$$;

create table public.daily_work_reports (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  report_date      date not null,
  summary          text,
  progress         text,
  blockers         text,
  next_steps       text,
  evidence_links   text[] not null default '{}',
  status           public.report_status not null default 'DRAFT',
  submitted_at     timestamptz,
  reviewed_by      uuid references public.profiles (id) on delete set null,
  reviewed_at      timestamptz,
  manager_feedback text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint daily_work_reports_submitted_consistency
    check ((status = 'SUBMITTED') = (submitted_at is not null)),
  constraint daily_work_reports_submitted_needs_summary
    check (status = 'DRAFT' or length(btrim(coalesce(summary, ''))) > 0),
  constraint daily_work_reports_evidence_count
    check (array_length(evidence_links, 1) is null or array_length(evidence_links, 1) <= 10),
  constraint daily_work_reports_evidence_are_urls
    check (app.text_array_all_match(evidence_links, '^https?://[^[:space:]]+$')),
  constraint daily_work_reports_review_consistency
    check ((reviewed_at is null) = (reviewed_by is null))
);

create unique index daily_work_reports_user_date_key
  on public.daily_work_reports (user_id, report_date);

create index daily_work_reports_user_date_idx
  on public.daily_work_reports (user_id, report_date desc);

create index daily_work_reports_status_date_idx
  on public.daily_work_reports (status, report_date desc);

create table public.daily_report_tasks (
  report_id uuid not null references public.daily_work_reports (id) on delete cascade,
  task_id   uuid not null references public.tasks (id) on delete cascade,
  primary key (report_id, task_id)
);

create index daily_report_tasks_task_idx on public.daily_report_tasks (task_id);

create trigger daily_work_reports_set_updated_at
  before update on public.daily_work_reports
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Column guards
-- ---------------------------------------------------------------------------

create or replace function app.guard_daily_report()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
declare
  is_author boolean;
begin
  if tg_op = 'INSERT' then
    if not app.is_trusted_context() then
      new.user_id := coalesce(auth.uid(), new.user_id);
      new.reviewed_by := null;
      new.reviewed_at := null;
      new.manager_feedback := null;
    end if;

    new.submitted_at := case when new.status = 'SUBMITTED' then now() end;
    return new;
  end if;

  if new.user_id is distinct from old.user_id
     or new.report_date is distinct from old.report_date then
    raise exception 'A report cannot be moved to another person or date.'
      using errcode = '42501';
  end if;

  if app.is_trusted_context() or app.is_admin() then
    return new;
  end if;

  is_author := old.user_id = auth.uid();

  if is_author then
    if new.reviewed_by is distinct from old.reviewed_by
       or new.reviewed_at is distinct from old.reviewed_at
       or new.manager_feedback is distinct from old.manager_feedback then
      raise exception 'Only a reviewing manager can record feedback on a report.'
        using errcode = '42501';
    end if;

    if old.status = 'SUBMITTED' then
      raise exception 'A submitted report cannot be edited. Ask an administrator to reopen it.'
        using errcode = '42501';
    end if;

    new.submitted_at := case when new.status = 'SUBMITTED' then now() end;
    return new;
  end if;

  -- Reviewing manager: feedback columns only.
  if not app.manages(old.user_id) then
    raise exception 'You cannot modify this report.' using errcode = '42501';
  end if;

  if new.status is distinct from old.status
     or new.summary is distinct from old.summary
     or new.progress is distinct from old.progress
     or new.blockers is distinct from old.blockers
     or new.next_steps is distinct from old.next_steps
     or new.evidence_links is distinct from old.evidence_links
     or new.submitted_at is distinct from old.submitted_at then
    raise exception 'A manager can only add review feedback to a report.'
      using errcode = '42501';
  end if;

  if old.status <> 'SUBMITTED' then
    raise exception 'Only submitted reports can be reviewed.' using errcode = '42501';
  end if;

  new.reviewed_by := auth.uid();
  new.reviewed_at := now();
  return new;
end;
$$;

create trigger daily_work_reports_guard
  before insert or update on public.daily_work_reports
  for each row execute function app.guard_daily_report();

-- A report may only reference tasks its author can actually see.
create or replace function app.guard_daily_report_tasks()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
declare
  report_owner uuid;
begin
  select r.user_id into report_owner
  from public.daily_work_reports r
  where r.id = new.report_id;

  if report_owner is null then
    raise exception 'Report not found.' using errcode = '23503';
  end if;

  if app.is_trusted_context() then
    return new;
  end if;

  if report_owner <> auth.uid() and not app.is_admin() then
    raise exception 'You can only attach tasks to your own report.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.tasks t
    where t.id = new.task_id
      and (t.assignee_id = report_owner or app.is_admin())
  ) then
    raise exception 'You can only reference tasks assigned to you.' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger daily_report_tasks_guard
  before insert or update on public.daily_report_tasks
  for each row execute function app.guard_daily_report_tasks();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.daily_work_reports enable row level security;
alter table public.daily_report_tasks enable row level security;
alter table public.daily_work_reports force row level security;
alter table public.daily_report_tasks force row level security;

-- Authors see everything of their own. Managers see submitted reports of their
-- own reports only. Interns never see another intern's report.
create policy daily_work_reports_select_scoped on public.daily_work_reports
  for select to authenticated
  using (
    app.is_active()
    and (
      user_id = auth.uid()
      or app.is_admin()
      or (app.manages(user_id) and status = 'SUBMITTED')
    )
  );

create policy daily_work_reports_insert_self on public.daily_work_reports
  for insert to authenticated
  with check (app.is_active() and user_id = auth.uid());

create policy daily_work_reports_update_scoped on public.daily_work_reports
  for update to authenticated
  using (
    app.is_active()
    and (user_id = auth.uid() or app.is_admin() or app.manages(user_id))
  )
  with check (
    app.is_active()
    and (user_id = auth.uid() or app.is_admin() or app.manages(user_id))
  );

create policy daily_work_reports_delete_scoped on public.daily_work_reports
  for delete to authenticated
  using (
    app.is_admin()
    or (app.is_active() and user_id = auth.uid() and status = 'DRAFT')
  );

create policy daily_report_tasks_select_scoped on public.daily_report_tasks
  for select to authenticated
  using (
    exists (
      select 1 from public.daily_work_reports r
      where r.id = report_id
        and (
          r.user_id = auth.uid()
          or app.is_admin()
          or (app.manages(r.user_id) and r.status = 'SUBMITTED')
        )
    )
    and app.is_active()
  );

create policy daily_report_tasks_write_own on public.daily_report_tasks
  for insert to authenticated
  with check (
    app.is_active()
    and exists (
      select 1 from public.daily_work_reports r
      where r.id = report_id and (r.user_id = auth.uid() or app.is_admin())
    )
  );

create policy daily_report_tasks_delete_own on public.daily_report_tasks
  for delete to authenticated
  using (
    app.is_active()
    and exists (
      select 1 from public.daily_work_reports r
      where r.id = report_id and (r.user_id = auth.uid() or app.is_admin())
    )
  );

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on public.daily_work_reports from anon, authenticated;
revoke all on public.daily_report_tasks from anon, authenticated;

grant select, insert, update, delete on public.daily_work_reports to authenticated;
grant select, insert, delete on public.daily_report_tasks to authenticated;

grant all on public.daily_work_reports, public.daily_report_tasks to service_role;

grant execute on function app.text_array_all_match(text[], text) to authenticated, service_role;
