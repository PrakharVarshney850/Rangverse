-- ============================================================================
-- Rangverse 0005 — Data Hub (configurable business-data sheets)
--
-- Authorization is deliberately two-layer:
--   1. `data_sheet_memberships` answers "may this person open this sheet?"
--   2. `data_sheet_rows.assigned_to_user_id` answers "may they see this record?"
--
-- An intern therefore sees only records assigned to them inside sheets they
-- have been granted. A manager additionally sees records belonging to their own
-- reports plus unassigned records they can triage. Administrators see all.
--
-- `row_data` is JSONB, but it is never free-form: a trigger rejects unknown
-- keys, missing required columns and values that do not match the column's
-- declared type. No user-supplied string ever becomes a SQL identifier.
-- ============================================================================

create type public.sheet_status as enum ('ACTIVE', 'ARCHIVED');
create type public.sheet_access_level as enum ('VIEW', 'EDIT');
create type public.sheet_column_type as enum (
  'TEXT', 'LONG_TEXT', 'NUMBER', 'DATE', 'EMAIL', 'URL', 'PHONE', 'SELECT', 'BOOLEAN'
);

create table public.data_sheets (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  slug        text not null,
  description text,
  status      public.sheet_status not null default 'ACTIVE',
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint data_sheets_title_not_blank check (length(btrim(title)) > 0),
  constraint data_sheets_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create unique index data_sheets_slug_key on public.data_sheets (slug);
create index data_sheets_status_idx on public.data_sheets (status);

create table public.data_sheet_columns (
  id            uuid primary key default gen_random_uuid(),
  sheet_id      uuid not null references public.data_sheets (id) on delete cascade,
  column_key    text not null,
  label         text not null,
  data_type     public.sheet_column_type not null default 'TEXT',
  is_required   boolean not null default false,
  display_order integer not null default 0,
  options       text[] not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint data_sheet_columns_key_format check (column_key ~ '^[a-z][a-z0-9_]{0,48}$'),
  constraint data_sheet_columns_label_not_blank check (length(btrim(label)) > 0),
  constraint data_sheet_columns_select_has_options
    check (data_type <> 'SELECT' or array_length(options, 1) >= 1)
);

create unique index data_sheet_columns_sheet_key_key
  on public.data_sheet_columns (sheet_id, column_key);
create index data_sheet_columns_sheet_order_idx
  on public.data_sheet_columns (sheet_id, display_order);

create table public.data_sheet_memberships (
  id           uuid primary key default gen_random_uuid(),
  sheet_id     uuid not null references public.data_sheets (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  access_level public.sheet_access_level not null default 'VIEW',
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index data_sheet_memberships_sheet_user_key
  on public.data_sheet_memberships (sheet_id, user_id);
create index data_sheet_memberships_user_idx on public.data_sheet_memberships (user_id);

create table public.data_sheet_rows (
  id                  uuid primary key default gen_random_uuid(),
  sheet_id            uuid not null references public.data_sheets (id) on delete cascade,
  assigned_to_user_id uuid references public.profiles (id) on delete set null,
  row_data            jsonb not null default '{}'::jsonb,
  created_by          uuid references public.profiles (id) on delete set null,
  updated_by          uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint data_sheet_rows_data_is_object check (jsonb_typeof(row_data) = 'object')
);

create index data_sheet_rows_sheet_created_idx
  on public.data_sheet_rows (sheet_id, created_at desc);
create index data_sheet_rows_sheet_assignee_idx
  on public.data_sheet_rows (sheet_id, assigned_to_user_id);
create index data_sheet_rows_assignee_idx on public.data_sheet_rows (assigned_to_user_id);
create index data_sheet_rows_data_gin on public.data_sheet_rows using gin (row_data);

create trigger data_sheets_set_updated_at
  before update on public.data_sheets
  for each row execute function app.set_updated_at();

create trigger data_sheet_columns_set_updated_at
  before update on public.data_sheet_columns
  for each row execute function app.set_updated_at();

create trigger data_sheet_memberships_set_updated_at
  before update on public.data_sheet_memberships
  for each row execute function app.set_updated_at();

create trigger data_sheet_rows_set_updated_at
  before update on public.data_sheet_rows
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------

create or replace function app.sheet_access(target_sheet uuid)
returns public.sheet_access_level
language sql
stable
security definer
set search_path = app, public, pg_temp
as $$
  select m.access_level
  from public.data_sheet_memberships m
  join public.data_sheets s on s.id = m.sheet_id
  where m.sheet_id = target_sheet
    and m.user_id = auth.uid()
    and s.status = 'ACTIVE';
$$;

create or replace function app.can_view_sheet(target_sheet uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_temp
as $$
  select app.is_active()
     and (app.is_admin() or app.sheet_access(target_sheet) is not null);
$$;

create or replace function app.can_edit_sheet(target_sheet uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_temp
as $$
  select app.is_active()
     and (app.is_admin() or app.sheet_access(target_sheet) = 'EDIT');
$$;

-- Record-level visibility inside a sheet the caller may already open.
create or replace function app.can_view_sheet_row(target_sheet uuid, assignee uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_temp
as $$
  select case
    when not app.is_active() then false
    when app.is_admin() then true
    when app.sheet_access(target_sheet) is null then false
    when assignee = auth.uid() then true
    -- Managers can triage their team's records and records nobody owns yet.
    when app.is_manager() and (assignee is null or app.manages(assignee)) then true
    else false
  end;
$$;

-- ---------------------------------------------------------------------------
-- Row validation against the sheet's configured columns
-- ---------------------------------------------------------------------------

create or replace function app.validate_sheet_row_data(target_sheet uuid, data jsonb)
returns void
language plpgsql
stable
security definer
set search_path = app, public, pg_temp
as $$
declare
  col record;
  unknown_key text;
  value jsonb;
  text_value text;
begin
  if jsonb_typeof(data) <> 'object' then
    raise exception 'Row data must be a JSON object.' using errcode = '22023';
  end if;

  select key into unknown_key
  from jsonb_object_keys(data) as key
  where not exists (
    select 1 from public.data_sheet_columns c
    where c.sheet_id = target_sheet and c.column_key = key
  )
  limit 1;

  if unknown_key is not null then
    raise exception 'Unknown column "%" for this sheet.', unknown_key using errcode = '22023';
  end if;

  for col in
    select * from public.data_sheet_columns c where c.sheet_id = target_sheet
  loop
    value := data -> col.column_key;
    text_value := nullif(btrim(coalesce(data ->> col.column_key, '')), '');

    if col.is_required and text_value is null then
      raise exception 'Column "%" is required.', col.label using errcode = '23514';
    end if;

    if text_value is null then
      continue;
    end if;

    case col.data_type
      when 'NUMBER' then
        if jsonb_typeof(value) <> 'number' and text_value !~ '^-?[0-9]+(\.[0-9]+)?$' then
          raise exception 'Column "%" must be a number.', col.label using errcode = '22023';
        end if;
      when 'BOOLEAN' then
        if jsonb_typeof(value) <> 'boolean' and lower(text_value) not in ('true', 'false') then
          raise exception 'Column "%" must be true or false.', col.label using errcode = '22023';
        end if;
      when 'DATE' then
        if text_value !~ '^\d{4}-\d{2}-\d{2}$' then
          raise exception 'Column "%" must be a date in YYYY-MM-DD form.', col.label
            using errcode = '22023';
        end if;
      when 'EMAIL' then
        if text_value !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
          raise exception 'Column "%" must be an email address.', col.label
            using errcode = '22023';
        end if;
      when 'URL' then
        if text_value !~ '^https?://[^[:space:]]+$' then
          raise exception 'Column "%" must be an http(s) URL.', col.label using errcode = '22023';
        end if;
      when 'SELECT' then
        if not (text_value = any (col.options)) then
          raise exception 'Column "%" must be one of the configured options.', col.label
            using errcode = '22023';
        end if;
      else
        if length(text_value) > 8000 then
          raise exception 'Column "%" is too long.', col.label using errcode = '22001';
        end if;
    end case;
  end loop;
end;
$$;

create or replace function app.guard_sheet_row()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.sheet_id is distinct from old.sheet_id then
    raise exception 'A record cannot be moved to another sheet.' using errcode = '42501';
  end if;

  perform app.validate_sheet_row_data(new.sheet_id, new.row_data);

  if app.is_trusted_context() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.updated_by := auth.uid();
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.updated_by := auth.uid();

    -- Only administrators and managers decide who owns a record.
    if new.assigned_to_user_id is distinct from old.assigned_to_user_id
       and not (app.is_admin() or app.is_manager()) then
      raise exception 'Only an administrator or manager can reassign a record.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger data_sheet_rows_guard
  before insert or update on public.data_sheet_rows
  for each row execute function app.guard_sheet_row();

-- Changing a sheet's columns must not invalidate stored records silently.
create or replace function app.guard_sheet_column_changes()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    if exists (
      select 1 from public.data_sheet_rows r
      where r.sheet_id = old.sheet_id and r.row_data ? old.column_key
    ) then
      raise exception
        'Column "%" still holds data. Clear the column from existing records first.',
        old.label using errcode = '23514';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and new.column_key is distinct from old.column_key then
    raise exception 'A column key cannot be renamed once records exist. Create a new column.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger data_sheet_columns_guard
  before update or delete on public.data_sheet_columns
  for each row execute function app.guard_sheet_column_changes();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.data_sheets enable row level security;
alter table public.data_sheet_columns enable row level security;
alter table public.data_sheet_memberships enable row level security;
alter table public.data_sheet_rows enable row level security;
alter table public.data_sheets force row level security;
alter table public.data_sheet_columns force row level security;
alter table public.data_sheet_memberships force row level security;
alter table public.data_sheet_rows force row level security;

create policy data_sheets_select_members on public.data_sheets
  for select to authenticated
  using (app.can_view_sheet(id));

create policy data_sheets_insert_admin on public.data_sheets
  for insert to authenticated
  with check (app.is_admin());

create policy data_sheets_update_admin on public.data_sheets
  for update to authenticated
  using (app.is_admin())
  with check (app.is_admin());

create policy data_sheets_delete_admin on public.data_sheets
  for delete to authenticated
  using (app.is_admin());

create policy data_sheet_columns_select_members on public.data_sheet_columns
  for select to authenticated
  using (app.can_view_sheet(sheet_id));

create policy data_sheet_columns_write_admin on public.data_sheet_columns
  for insert to authenticated
  with check (app.is_admin());

create policy data_sheet_columns_update_admin on public.data_sheet_columns
  for update to authenticated
  using (app.is_admin())
  with check (app.is_admin());

create policy data_sheet_columns_delete_admin on public.data_sheet_columns
  for delete to authenticated
  using (app.is_admin());

-- A member can see that they themselves have access; only admins see the
-- full membership list of a sheet.
create policy data_sheet_memberships_select_scoped on public.data_sheet_memberships
  for select to authenticated
  using (app.is_active() and (app.is_admin() or user_id = auth.uid()));

create policy data_sheet_memberships_insert_admin on public.data_sheet_memberships
  for insert to authenticated
  with check (app.is_admin());

create policy data_sheet_memberships_update_admin on public.data_sheet_memberships
  for update to authenticated
  using (app.is_admin())
  with check (app.is_admin());

create policy data_sheet_memberships_delete_admin on public.data_sheet_memberships
  for delete to authenticated
  using (app.is_admin());

create policy data_sheet_rows_select_scoped on public.data_sheet_rows
  for select to authenticated
  using (app.can_view_sheet_row(sheet_id, assigned_to_user_id));

create policy data_sheet_rows_insert_scoped on public.data_sheet_rows
  for insert to authenticated
  with check (
    app.can_edit_sheet(sheet_id)
    and app.can_view_sheet_row(sheet_id, assigned_to_user_id)
  );

create policy data_sheet_rows_update_scoped on public.data_sheet_rows
  for update to authenticated
  using (
    app.can_edit_sheet(sheet_id)
    and app.can_view_sheet_row(sheet_id, assigned_to_user_id)
  )
  with check (
    app.can_edit_sheet(sheet_id)
    and app.can_view_sheet_row(sheet_id, assigned_to_user_id)
  );

create policy data_sheet_rows_delete_privileged on public.data_sheet_rows
  for delete to authenticated
  using (
    app.is_admin()
    or (
      app.is_manager()
      and app.can_edit_sheet(sheet_id)
      and app.can_view_sheet_row(sheet_id, assigned_to_user_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on public.data_sheets from anon, authenticated;
revoke all on public.data_sheet_columns from anon, authenticated;
revoke all on public.data_sheet_memberships from anon, authenticated;
revoke all on public.data_sheet_rows from anon, authenticated;

grant select, insert, update, delete on public.data_sheets to authenticated;
grant select, insert, update, delete on public.data_sheet_columns to authenticated;
grant select, insert, update, delete on public.data_sheet_memberships to authenticated;
grant select, insert, update, delete on public.data_sheet_rows to authenticated;

grant all on
  public.data_sheets,
  public.data_sheet_columns,
  public.data_sheet_memberships,
  public.data_sheet_rows
to service_role;

grant execute on function
  app.sheet_access(uuid),
  app.can_view_sheet(uuid),
  app.can_edit_sheet(uuid),
  app.can_view_sheet_row(uuid, uuid),
  app.validate_sheet_row_data(uuid, jsonb)
to authenticated, service_role;
