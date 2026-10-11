-- ============================================================================
-- Rangverse 0001 — core identity model
--
-- Creates: the `app` helper schema, enums, teams, profiles, activity_logs.
-- Establishes the authorization primitives every later migration builds on.
--
-- Authorization design notes
--   * Policies on `profiles` cannot query `profiles` directly without causing
--     infinite recursion, so every relationship test lives in a SECURITY
--     DEFINER helper in the `app` schema with a pinned search_path.
--   * `manager_id` is the single source of truth for manager authority.
--     `team_id` is for grouping and display only.
--   * Privileged columns (role, manager, team, employment dates, email) are
--     protected by a trigger as well as by RLS, so a direct PostgREST request
--     cannot escalate privileges even if a policy is later loosened.
-- ============================================================================

create schema if not exists app;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.app_role as enum ('ADMIN', 'MANAGER', 'INTERN');

create type public.onboarding_status as enum (
  'INVITED',
  'PROFILE_INCOMPLETE',
  'ACTIVE',
  'PAUSED',
  'COMPLETED',
  'OFFBOARDED'
);

create type public.activity_outcome as enum ('SUCCESS', 'DENIED', 'FAILED');

-- ---------------------------------------------------------------------------
-- Request-context helpers
--
-- These intentionally are NOT security definer: they only read the request
-- claims that PostgREST attaches to the transaction.
-- ---------------------------------------------------------------------------

create or replace function app.jwt()
returns jsonb
language sql
stable
set search_path = pg_catalog, pg_temp
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  );
$$;

comment on function app.jwt() is
  'Decoded request claims, or an empty object outside an API request.';

-- True only for the service-role key or a direct (migration / server script)
-- database session. Used to let trusted server code bypass the column guard.
--
-- PostgREST always attaches `request.jwt.claims` to an API request — even an
-- anonymous one, which carries `{"role":"anon"}` — so an absent or empty claims
-- string can only mean a direct database session. Row level security still
-- applies independently in every case; this only relaxes the trigger guards.
create or replace function app.is_trusted_context()
returns boolean
language sql
stable
set search_path = app, pg_catalog, pg_temp
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '') = ''
      or coalesce(app.jwt() ->> 'role', '') = 'service_role';
$$;

comment on function app.is_trusted_context() is
  'True for the service-role key or a direct database session; never true for anon/authenticated API requests.';

-- ---------------------------------------------------------------------------
-- Teams
-- ---------------------------------------------------------------------------

create table public.teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint teams_name_not_blank check (length(btrim(name)) > 0),
  constraint teams_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create unique index teams_slug_key on public.teams (slug);

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id                   uuid primary key references auth.users (id) on delete cascade,
  email                text not null,
  full_name            text,
  phone                text,
  college              text,
  course               text,
  designation          text,
  role                 public.app_role not null default 'INTERN',
  onboarding_status    public.onboarding_status not null default 'INVITED',
  team_id              uuid references public.teams (id) on delete set null,
  manager_id           uuid references public.profiles (id) on delete set null,
  joining_date         date,
  internship_end_date  date,
  avatar_url           text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint profiles_email_format check (position('@' in email) > 1),
  constraint profiles_not_own_manager check (manager_id is null or manager_id <> id),
  constraint profiles_end_after_join check (
    internship_end_date is null
    or joining_date is null
    or internship_end_date >= joining_date
  )
);

create unique index profiles_email_lower_key on public.profiles (lower(email));
create index profiles_manager_id_idx on public.profiles (manager_id);
create index profiles_team_id_idx on public.profiles (team_id);
create index profiles_role_idx on public.profiles (role);
create index profiles_onboarding_status_idx on public.profiles (onboarding_status);

-- ---------------------------------------------------------------------------
-- Shared triggers
-- ---------------------------------------------------------------------------

create or replace function app.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger teams_set_updated_at
  before update on public.teams
  for each row execute function app.set_updated_at();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Authorization helpers (SECURITY DEFINER — pinned search_path)
-- ---------------------------------------------------------------------------

create or replace function app.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = app, public, pg_temp
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid();
$$;

-- An account that is paused or offboarded keeps its row but loses all access.
-- This is what makes revocation take effect on the next request.
create or replace function app.is_active()
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.onboarding_status not in ('PAUSED', 'OFFBOARDED')
  );
$$;

create or replace function app.is_admin()
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'ADMIN'
      and p.onboarding_status not in ('PAUSED', 'OFFBOARDED')
  );
$$;

create or replace function app.is_manager()
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'MANAGER'
      and p.onboarding_status not in ('PAUSED', 'OFFBOARDED')
  );
$$;

-- True when the caller is an active MANAGER and `target` reports to them.
create or replace function app.manages(target uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_temp
as $$
  select target is not null
     and exists (
       select 1
       from public.profiles target_profile
       join public.profiles me on me.id = auth.uid()
       where target_profile.id = target
         and target_profile.manager_id = me.id
         and me.role = 'MANAGER'
         and me.onboarding_status not in ('PAUSED', 'OFFBOARDED')
     );
$$;

-- Caller can see this person's work: themselves, their reports, or anyone if admin.
create or replace function app.can_view_user(target uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_temp
as $$
  select app.is_active()
     and (
       target = auth.uid()
       or app.is_admin()
       or app.manages(target)
     );
$$;

create or replace function app.current_team_id()
returns uuid
language sql
stable
security definer
set search_path = app, public, pg_temp
as $$
  select p.team_id
  from public.profiles p
  where p.id = auth.uid();
$$;

-- A policy on `profiles` must never query `profiles` directly, so resolving the
-- caller's own manager goes through a definer helper instead of a subquery.
create or replace function app.my_manager_id()
returns uuid
language sql
stable
security definer
set search_path = app, public, pg_temp
as $$
  select p.manager_id
  from public.profiles p
  where p.id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Privilege-escalation guard
--
-- Blocks a non-administrator from editing any column that confers authority,
-- regardless of which UPDATE policy allowed the row through.
-- ---------------------------------------------------------------------------

create or replace function app.guard_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
begin
  if app.is_trusted_context() or app.is_admin() then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.email is distinct from old.email
     or new.role is distinct from old.role
     or new.manager_id is distinct from old.manager_id
     or new.team_id is distinct from old.team_id
     or new.designation is distinct from old.designation
     or new.joining_date is distinct from old.joining_date
     or new.internship_end_date is distinct from old.internship_end_date
  then
    raise exception
      'Only an administrator can change role, manager, team, designation, employment dates or email.'
      using errcode = '42501';
  end if;

  -- The only self-service lifecycle transition is finishing onboarding.
  if new.onboarding_status is distinct from old.onboarding_status
     and not (
       old.onboarding_status = 'PROFILE_INCOMPLETE'
       and new.onboarding_status = 'ACTIVE'
     )
  then
    raise exception 'Only an administrator can change onboarding status.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger profiles_guard_privileged_columns
  before update on public.profiles
  for each row execute function app.guard_profile_privileged_columns();

-- A manager must never be pointed at a non-manager, and only interns may
-- report to someone. Enforced in the database so bad data cannot be written
-- through any path.
create or replace function app.guard_profile_relationships()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
declare
  manager_role public.app_role;
begin
  if new.manager_id is null then
    return new;
  end if;

  select p.role into manager_role from public.profiles p where p.id = new.manager_id;

  if manager_role is null then
    raise exception 'Assigned manager does not exist.' using errcode = '23503';
  end if;

  if manager_role not in ('MANAGER', 'ADMIN') then
    raise exception 'Assigned manager must hold the MANAGER or ADMIN role.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger profiles_guard_relationships
  before insert or update on public.profiles
  for each row execute function app.guard_profile_relationships();

-- ---------------------------------------------------------------------------
-- Activity log (append-only for application roles)
-- ---------------------------------------------------------------------------

create table public.activity_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  subject_id  uuid references public.profiles (id) on delete set null,
  outcome     public.activity_outcome not null default 'SUCCESS',
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  constraint activity_logs_action_not_blank check (length(btrim(action)) > 0),
  constraint activity_logs_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create index activity_logs_actor_created_idx on public.activity_logs (actor_id, created_at desc);
create index activity_logs_subject_created_idx on public.activity_logs (subject_id, created_at desc);
create index activity_logs_entity_idx on public.activity_logs (entity_type, entity_id);
create index activity_logs_created_at_idx on public.activity_logs (created_at desc);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.teams enable row level security;
alter table public.profiles enable row level security;
alter table public.activity_logs enable row level security;

alter table public.teams force row level security;
alter table public.profiles force row level security;
alter table public.activity_logs force row level security;

-- Teams: every active member can read the directory of teams; only admins write.
create policy teams_select_active on public.teams
  for select to authenticated
  using (app.is_active());

create policy teams_insert_admin on public.teams
  for insert to authenticated
  with check (app.is_admin());

create policy teams_update_admin on public.teams
  for update to authenticated
  using (app.is_admin())
  with check (app.is_admin());

create policy teams_delete_admin on public.teams
  for delete to authenticated
  using (app.is_admin());

-- Profiles: self, own reports, or admin.
create policy profiles_select_scoped on public.profiles
  for select to authenticated
  using (
    app.is_active()
    and (
      id = auth.uid()
      or app.is_admin()
      or app.manages(id)
      -- A member can resolve their own manager's name for display.
      or id = app.my_manager_id()
    )
  );

-- Profiles are created by the invitation flow (service role) only.
create policy profiles_insert_admin on public.profiles
  for insert to authenticated
  with check (app.is_admin());

create policy profiles_update_self_or_admin on public.profiles
  for update to authenticated
  using (
    app.is_active()
    and (id = auth.uid() or app.is_admin())
  )
  with check (
    app.is_active()
    and (id = auth.uid() or app.is_admin())
  );

create policy profiles_delete_admin on public.profiles
  for delete to authenticated
  using (app.is_admin());

-- Activity logs: insert-only for app roles; reads are scoped by relationship.
-- No UPDATE or DELETE policy exists, which makes the table append-only.
create policy activity_logs_insert_self on public.activity_logs
  for insert to authenticated
  with check (app.is_active() and actor_id = auth.uid());

create policy activity_logs_select_scoped on public.activity_logs
  for select to authenticated
  using (
    app.is_active()
    and (
      app.is_admin()
      or actor_id = auth.uid()
      or app.manages(actor_id)
      or app.manages(subject_id)
      or subject_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Grants (least privilege, explicit rather than inherited)
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema app to anon, authenticated, service_role;

revoke all on public.teams from anon, authenticated;
revoke all on public.profiles from anon, authenticated;
revoke all on public.activity_logs from anon, authenticated;

grant select, insert, update, delete on public.teams to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert on public.activity_logs to authenticated;

grant all on public.teams, public.profiles, public.activity_logs to service_role;

grant execute on function
  app.jwt(),
  app.is_trusted_context(),
  app.current_role(),
  app.is_active(),
  app.is_admin(),
  app.is_manager(),
  app.manages(uuid),
  app.can_view_user(uuid),
  app.current_team_id(),
  app.my_manager_id()
to authenticated, service_role;
