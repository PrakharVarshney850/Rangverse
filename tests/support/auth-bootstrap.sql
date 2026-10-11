-- ============================================================================
-- Supabase-equivalent bootstrap for the PGlite test engine.
--
-- Supabase provides these objects out of the box; PGlite is a bare PostgreSQL,
-- so the tests recreate the minimum surface the migrations depend on:
--   * the anon / authenticated / service_role database roles
--   * the `auth` schema with users, uid(), role() and jwt()
--
-- The function bodies match Supabase's own definitions (claims are read from
-- the `request.jwt.claims` GUC), which is what makes the RLS results here
-- representative of the real deployment.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

create schema if not exists auth;

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  );
$$;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'role', 'anon');
$$;

create or replace function auth.email()
returns text
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'email', '');
$$;

create table if not exists auth.users (
  id         uuid primary key default gen_random_uuid(),
  email      text unique,
  created_at timestamptz not null default now()
);

grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
