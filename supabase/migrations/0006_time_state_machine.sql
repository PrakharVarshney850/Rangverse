-- ============================================================================
-- Rangverse 0006 — attendance and timer state machine
--
-- Every clock/break/timer transition goes through one of these functions, so
-- there is exactly one authoritative place where a transition is validated.
--
-- They run SECURITY INVOKER: row level security still applies, a caller can
-- only ever act on their own records, and the partial unique indexes from
-- 0002/0003 make the operations race-free. Start operations are idempotent so
-- a double-click or a retried request never produces a duplicate record.
-- ============================================================================

create or replace function public.rv_clock_in()
returns public.attendance_sessions
language plpgsql
volatile
security invoker
set search_path = public, app, pg_temp
as $$
declare
  existing public.attendance_sessions;
  created  public.attendance_sessions;
begin
  select * into existing
  from public.attendance_sessions s
  where s.user_id = auth.uid() and s.clock_out_at is null
  limit 1;

  -- Idempotent: a retry returns the session that is already open.
  if existing.id is not null then
    return existing;
  end if;

  insert into public.attendance_sessions (user_id)
  values (auth.uid())
  returning * into created;

  return created;
exception
  when unique_violation then
    select * into existing
    from public.attendance_sessions s
    where s.user_id = auth.uid() and s.clock_out_at is null
    limit 1;
    return existing;
end;
$$;

create or replace function public.rv_clock_out()
returns public.attendance_sessions
language plpgsql
volatile
security invoker
set search_path = public, app, pg_temp
as $$
declare
  updated public.attendance_sessions;
begin
  -- End any break first; clocking out with a break running is rejected by the
  -- database, and leaving it open would corrupt the working-time maths.
  update public.breaks
     set ended_at = now()
   where user_id = auth.uid() and ended_at is null;

  update public.attendance_sessions
     set clock_out_at = now()
   where user_id = auth.uid() and clock_out_at is null
  returning * into updated;

  if updated.id is null then
    raise exception 'You are not currently clocked in.' using errcode = 'P0002';
  end if;

  return updated;
end;
$$;

create or replace function public.rv_start_break()
returns public.breaks
language plpgsql
volatile
security invoker
set search_path = public, app, pg_temp
as $$
declare
  open_session uuid;
  existing     public.breaks;
  created      public.breaks;
begin
  select * into existing
  from public.breaks b
  where b.user_id = auth.uid() and b.ended_at is null
  limit 1;

  if existing.id is not null then
    return existing;
  end if;

  select s.id into open_session
  from public.attendance_sessions s
  where s.user_id = auth.uid() and s.clock_out_at is null
  limit 1;

  if open_session is null then
    raise exception 'Clock in before starting a break.' using errcode = 'P0002';
  end if;

  -- A break and a task timer must not run at the same time.
  update public.task_time_entries
     set ended_at = now()
   where user_id = auth.uid() and ended_at is null;

  insert into public.breaks (session_id, user_id)
  values (open_session, auth.uid())
  returning * into created;

  return created;
exception
  when unique_violation then
    select * into existing
    from public.breaks b
    where b.user_id = auth.uid() and b.ended_at is null
    limit 1;
    return existing;
end;
$$;

create or replace function public.rv_end_break()
returns public.breaks
language plpgsql
volatile
security invoker
set search_path = public, app, pg_temp
as $$
declare
  updated public.breaks;
begin
  update public.breaks
     set ended_at = now()
   where user_id = auth.uid() and ended_at is null
  returning * into updated;

  if updated.id is null then
    raise exception 'You are not currently on a break.' using errcode = 'P0002';
  end if;

  return updated;
end;
$$;

create or replace function public.rv_start_task_timer(target_task uuid)
returns public.task_time_entries
language plpgsql
volatile
security invoker
set search_path = public, app, pg_temp
as $$
declare
  existing public.task_time_entries;
  created  public.task_time_entries;
begin
  if not app.can_track_task(target_task) then
    raise exception 'You cannot track time against this task.' using errcode = '42501';
  end if;

  select * into existing
  from public.task_time_entries e
  where e.user_id = auth.uid() and e.ended_at is null
  limit 1;

  if existing.id is not null then
    if existing.task_id = target_task then
      return existing;
    end if;

    -- Switching tasks closes the previous entry, preserving the invariant of
    -- at most one running timer per person.
    update public.task_time_entries
       set ended_at = now()
     where id = existing.id;
  end if;

  insert into public.task_time_entries (task_id, user_id)
  values (target_task, auth.uid())
  returning * into created;

  return created;
end;
$$;

create or replace function public.rv_stop_task_timer()
returns public.task_time_entries
language plpgsql
volatile
security invoker
set search_path = public, app, pg_temp
as $$
declare
  updated public.task_time_entries;
begin
  update public.task_time_entries
     set ended_at = now()
   where user_id = auth.uid() and ended_at is null
  returning * into updated;

  if updated.id is null then
    raise exception 'You do not have a running task timer.' using errcode = 'P0002';
  end if;

  return updated;
end;
$$;

revoke all on function
  public.rv_clock_in(),
  public.rv_clock_out(),
  public.rv_start_break(),
  public.rv_end_break(),
  public.rv_start_task_timer(uuid),
  public.rv_stop_task_timer()
from public, anon;

grant execute on function
  public.rv_clock_in(),
  public.rv_clock_out(),
  public.rv_start_break(),
  public.rv_end_break(),
  public.rv_start_task_timer(uuid),
  public.rv_stop_task_timer()
to authenticated, service_role;
