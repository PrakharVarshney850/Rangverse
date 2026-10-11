-- ============================================================================
-- Rangverse 0002 — attendance sessions and breaks
--
-- Guarantees enforced here rather than in application code:
--   * at most one open attendance session per user      (partial unique index)
--   * at most one open break per session and per user   (partial unique index)
--   * every interval ends after it starts               (check constraints)
--   * clock/break timestamps are written by the server, never by the client
--     (BEFORE triggers overwrite whatever the request supplied)
--   * a break cannot exist outside its session's window
-- ============================================================================

create table public.attendance_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  clock_in_at   timestamptz not null default now(),
  clock_out_at  timestamptz,
  needs_review  boolean not null default false,
  review_reason text,
  closed_by     uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint attendance_sessions_interval_valid
    check (clock_out_at is null or clock_out_at > clock_in_at)
);

create unique index attendance_sessions_one_open_per_user
  on public.attendance_sessions (user_id)
  where clock_out_at is null;

create index attendance_sessions_user_clock_in_idx
  on public.attendance_sessions (user_id, clock_in_at desc);

create index attendance_sessions_needs_review_idx
  on public.attendance_sessions (needs_review)
  where needs_review;

create table public.breaks (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.attendance_sessions (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint breaks_interval_valid check (ended_at is null or ended_at > started_at)
);

create unique index breaks_one_open_per_session
  on public.breaks (session_id)
  where ended_at is null;

create unique index breaks_one_open_per_user
  on public.breaks (user_id)
  where ended_at is null;

create index breaks_session_idx on public.breaks (session_id, started_at);
create index breaks_user_started_idx on public.breaks (user_id, started_at desc);

create trigger attendance_sessions_set_updated_at
  before update on public.attendance_sessions
  for each row execute function app.set_updated_at();

create trigger breaks_set_updated_at
  before update on public.breaks
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Server-authored timestamps
-- ---------------------------------------------------------------------------

create or replace function app.guard_attendance_timestamps()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    -- The clock-in instant is always the server's clock.
    if not app.is_trusted_context() then
      new.clock_in_at := now();
      new.clock_out_at := null;
      new.needs_review := false;
      new.review_reason := null;
      new.closed_by := null;
    end if;
    return new;
  end if;

  if app.is_trusted_context() or app.is_admin() then
    return new;
  end if;

  if new.clock_in_at is distinct from old.clock_in_at then
    raise exception 'The clock-in time of a recorded session cannot be changed.'
      using errcode = '42501';
  end if;

  if old.clock_out_at is not null and new.clock_out_at is distinct from old.clock_out_at then
    raise exception 'A completed attendance session cannot be re-timed.'
      using errcode = '42501';
  end if;

  -- Closing an open session always stamps the server clock.
  if old.clock_out_at is null and new.clock_out_at is not null then
    new.clock_out_at := now();
  end if;

  if new.needs_review is distinct from old.needs_review
     or new.review_reason is distinct from old.review_reason then
    raise exception 'Only an administrator can change the review state of a session.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger attendance_sessions_guard_timestamps
  before insert or update on public.attendance_sessions
  for each row execute function app.guard_attendance_timestamps();

create or replace function app.guard_break_integrity()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
declare
  session_row public.attendance_sessions%rowtype;
begin
  select * into session_row
  from public.attendance_sessions s
  where s.id = new.session_id;

  if session_row.id is null then
    raise exception 'A break must belong to an attendance session.' using errcode = '23503';
  end if;

  if tg_op = 'INSERT' then
    -- The break always belongs to the session owner, whatever was submitted.
    new.user_id := session_row.user_id;

    if session_row.clock_out_at is not null then
      raise exception 'A break cannot be started on a closed attendance session.'
        using errcode = '23514';
    end if;

    if not app.is_trusted_context() then
      new.started_at := now();
      new.ended_at := null;
    end if;

    if new.started_at < session_row.clock_in_at then
      raise exception 'A break cannot start before its attendance session.'
        using errcode = '23514';
    end if;

    return new;
  end if;

  if new.session_id is distinct from old.session_id
     or new.user_id is distinct from old.user_id then
    raise exception 'A break cannot be moved to another session or user.'
      using errcode = '42501';
  end if;

  if app.is_trusted_context() or app.is_admin() then
    return new;
  end if;

  if new.started_at is distinct from old.started_at then
    raise exception 'The start time of a recorded break cannot be changed.'
      using errcode = '42501';
  end if;

  if old.ended_at is not null and new.ended_at is distinct from old.ended_at then
    raise exception 'A completed break cannot be re-timed.' using errcode = '42501';
  end if;

  if old.ended_at is null and new.ended_at is not null then
    new.ended_at := now();
  end if;

  return new;
end;
$$;

create trigger breaks_guard_integrity
  before insert or update on public.breaks
  for each row execute function app.guard_break_integrity();

-- An attendance session must not be closed while a break is still running;
-- the application ends the break first, and the database enforces it.
create or replace function app.guard_session_close()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
begin
  if old.clock_out_at is null and new.clock_out_at is not null then
    if exists (
      select 1 from public.breaks b
      where b.session_id = new.id and b.ended_at is null
    ) then
      raise exception 'End the active break before clocking out.' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger attendance_sessions_guard_close
  before update on public.attendance_sessions
  for each row execute function app.guard_session_close();

-- ---------------------------------------------------------------------------
-- Convenience predicate reused by task timers in 0003
-- ---------------------------------------------------------------------------

create or replace function app.open_session_id(target uuid)
returns uuid
language sql
stable
security definer
set search_path = app, public, pg_temp
as $$
  select s.id
  from public.attendance_sessions s
  where s.user_id = target and s.clock_out_at is null
  limit 1;
$$;

create or replace function app.is_on_break(target uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_temp
as $$
  select exists (
    select 1 from public.breaks b
    where b.user_id = target and b.ended_at is null
  );
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.attendance_sessions enable row level security;
alter table public.breaks enable row level security;
alter table public.attendance_sessions force row level security;
alter table public.breaks force row level security;

create policy attendance_sessions_select_scoped on public.attendance_sessions
  for select to authenticated
  using (app.can_view_user(user_id));

create policy attendance_sessions_insert_self on public.attendance_sessions
  for insert to authenticated
  with check (app.is_active() and user_id = auth.uid());

-- Interns close their own sessions; administrators may additionally flag a
-- session for review. Managers deliberately cannot edit recorded time —
-- correction requests are a Version 2 workflow.
create policy attendance_sessions_update_self_or_admin on public.attendance_sessions
  for update to authenticated
  using (app.is_active() and (user_id = auth.uid() or app.is_admin()))
  with check (app.is_active() and (user_id = auth.uid() or app.is_admin()));

create policy attendance_sessions_delete_admin on public.attendance_sessions
  for delete to authenticated
  using (app.is_admin());

create policy breaks_select_scoped on public.breaks
  for select to authenticated
  using (app.can_view_user(user_id));

create policy breaks_insert_self on public.breaks
  for insert to authenticated
  with check (
    app.is_active()
    and session_id = app.open_session_id(auth.uid())
  );

create policy breaks_update_self_or_admin on public.breaks
  for update to authenticated
  using (app.is_active() and (user_id = auth.uid() or app.is_admin()))
  with check (app.is_active() and (user_id = auth.uid() or app.is_admin()));

create policy breaks_delete_admin on public.breaks
  for delete to authenticated
  using (app.is_admin());

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on public.attendance_sessions from anon, authenticated;
revoke all on public.breaks from anon, authenticated;

grant select, insert, update on public.attendance_sessions to authenticated;
grant select, insert, update on public.breaks to authenticated;
grant delete on public.attendance_sessions, public.breaks to authenticated;

grant all on public.attendance_sessions, public.breaks to service_role;

grant execute on function
  app.open_session_id(uuid),
  app.is_on_break(uuid)
to authenticated, service_role;
