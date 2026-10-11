# Data dictionary

All timestamps are `timestamptz` stored in UTC and displayed in `Asia/Kolkata`.
All primary keys are `uuid` defaulting to `gen_random_uuid()` unless stated otherwise.
Every table has row level security **enabled and forced**.

---

## Enums

| Type | Values |
|---|---|
| `app_role` | `ADMIN`, `MANAGER`, `INTERN` |
| `onboarding_status` | `INVITED`, `PROFILE_INCOMPLETE`, `ACTIVE`, `PAUSED`, `COMPLETED`, `OFFBOARDED` |
| `activity_outcome` | `SUCCESS`, `DENIED`, `FAILED` |
| `task_status` | `TO_DO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE` |
| `task_priority` | `LOW`, `MEDIUM`, `HIGH`, `URGENT` |
| `report_status` | `DRAFT`, `SUBMITTED` |
| `sheet_status` | `ACTIVE`, `ARCHIVED` |
| `sheet_access_level` | `VIEW`, `EDIT` |
| `sheet_column_type` | `TEXT`, `LONG_TEXT`, `NUMBER`, `DATE`, `EMAIL`, `URL`, `PHONE`, `SELECT`, `BOOLEAN` |

---

## `teams`

Grouping and display only. Manager authority does **not** flow through a team.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `name` | text | not blank |
| `slug` | text | unique, `^[a-z0-9]+(-[a-z0-9]+)*$` |
| `description` | text | nullable |
| `created_at` / `updated_at` | timestamptz | `updated_at` maintained by trigger |

---

## `profiles`

One row per person, keyed to `auth.users`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK → `auth.users(id)` ON DELETE CASCADE |
| `email` | text | unique on `lower(email)`, must contain `@` |
| `full_name`, `phone`, `college`, `course`, `avatar_url` | text | self-editable |
| `designation` | text | **administrator-only** |
| `role` | app_role | **administrator-only**, default `INTERN` |
| `onboarding_status` | onboarding_status | **administrator-only** except `PROFILE_INCOMPLETE → ACTIVE` |
| `team_id` | uuid | **administrator-only** → `teams(id)` ON DELETE SET NULL |
| `manager_id` | uuid | **administrator-only** → `profiles(id)` ON DELETE SET NULL |
| `joining_date`, `internship_end_date` | date | **administrator-only** |

**Constraints**
- `manager_id <> id`
- `internship_end_date >= joining_date` when both present
- `manager_id` must point at a `MANAGER` or `ADMIN` (`app.guard_profile_relationships`)

**Indexes** `manager_id`, `team_id`, `role`, `onboarding_status`, `lower(email)` unique

**Retention** Kept after offboarding so recorded hours and history stay attributable. Set
`OFFBOARDED` rather than deleting; deleting the auth user cascades and destroys the audit trail.

---

## `activity_logs`

Append-only. Application roles hold `SELECT` + `INSERT` only.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `actor_id` | uuid | → `profiles(id)` ON DELETE SET NULL; must equal `auth.uid()` |
| `action` | text | not blank, e.g. `ATTENDANCE_CLOCK_IN` |
| `entity_type` | text | e.g. `task`, `data_sheet_row` |
| `entity_id` | uuid | nullable |
| `subject_id` | uuid | the person acted upon, nullable |
| `outcome` | activity_outcome | default `SUCCESS` |
| `metadata` | jsonb | object only; scrubbed by `sanitizeMetadata` |
| `created_at` | timestamptz | |

**Indexes** `(actor_id, created_at desc)`, `(subject_id, created_at desc)`,
`(entity_type, entity_id)`, `(created_at desc)`

**Retention** Indefinite. Contains no credentials and no bulk personal data by construction.

---

## `attendance_sessions`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | → `profiles(id)` ON DELETE CASCADE |
| `clock_in_at` | timestamptz | **server-authored**; a client value is overwritten |
| `clock_out_at` | timestamptz | nullable while open; **server-authored** |
| `needs_review` | boolean | administrator-only |
| `review_reason` | text | administrator-only |
| `closed_by` | uuid | → `profiles(id)`, reserved for v2 corrections |

**Constraints** `clock_out_at > clock_in_at` when present
**Unique** partial unique on `(user_id) where clock_out_at is null` — one open session per person
**Indexes** `(user_id, clock_in_at desc)`, partial on `needs_review`

---

## `breaks`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `session_id` | uuid | → `attendance_sessions(id)` ON DELETE CASCADE |
| `user_id` | uuid | → `profiles(id)`; forced to the session owner by trigger |
| `started_at` / `ended_at` | timestamptz | **server-authored** |

**Constraints** `ended_at > started_at`; cannot start before the session or on a closed session
**Unique** partial unique on `(session_id) where ended_at is null` and on `(user_id) where ended_at is null`
**Indexes** `(session_id, started_at)`, `(user_id, started_at desc)`

---

## `tasks`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `title` | text | not blank, ≤ 200 |
| `description` | text | nullable |
| `assignee_id` | uuid | → `profiles(id)` ON DELETE SET NULL |
| `created_by` | uuid | → `profiles(id)` ON DELETE SET NULL |
| `team_id` | uuid | → `teams(id)` ON DELETE SET NULL; inherited from the assignee |
| `status` | task_status | default `TO_DO` |
| `priority` | task_priority | default `MEDIUM` |
| `due_date` | date | nullable |
| `campaign`, `client` | text | nullable |
| `completed_at` | timestamptz | **derived** — set when and only when status is `DONE` |

**Constraints** `(status = 'DONE') = (completed_at is not null)`
**Indexes** `(assignee_id, status)`, `team_id`, `due_date`, `created_by`, `(status, priority)`

An assignee may change **only** `status` (`app.guard_task_columns`).

---

## `task_comments`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `task_id` | uuid | → `tasks(id)` ON DELETE CASCADE |
| `author_id` | uuid | → `profiles(id)` ON DELETE SET NULL; must equal `auth.uid()` |
| `body` | text | not blank, ≤ 4000 |

**Index** `(task_id, created_at)`

---

## `task_time_entries`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `task_id` | uuid | → `tasks(id)` ON DELETE CASCADE |
| `user_id` | uuid | → `profiles(id)` ON DELETE CASCADE |
| `session_id` | uuid | → `attendance_sessions(id)` ON DELETE SET NULL; set by trigger |
| `started_at` / `ended_at` | timestamptz | **server-authored** |

**Constraints** `ended_at > started_at`; cannot start without an open session or during a break
**Unique** partial unique on `(user_id) where ended_at is null`
**Indexes** `(task_id, started_at desc)`, `(user_id, started_at desc)`, `session_id`

A completed entry cannot be edited by the person who logged it. Corrections are a v2 workflow.

> These minutes are reported **against tasks**. They are never added to an attendance total —
> doing so would count the same minutes twice.

---

## `daily_work_reports`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | → `profiles(id)` ON DELETE CASCADE |
| `report_date` | date | unique with `user_id` |
| `summary`, `progress`, `blockers`, `next_steps` | text | nullable |
| `evidence_links` | text[] | ≤ 10, each `^https?://\S+$` |
| `status` | report_status | default `DRAFT` |
| `submitted_at` | timestamptz | set when and only when `SUBMITTED` |
| `reviewed_by` / `reviewed_at` | uuid / timestamptz | written by the trigger, never by the client |
| `manager_feedback` | text | reviewing manager only |

**Constraints** submitted ⇔ `submitted_at` present; a submitted report needs a summary;
`reviewed_at` and `reviewed_by` are set together
**Unique** `(user_id, report_date)`
**Indexes** `(user_id, report_date desc)`, `(status, report_date desc)`

Drafts are private to the author. A manager sees a report only once submitted, and a submitted
report is locked for its author.

---

## `daily_report_tasks`

| Column | Type | Notes |
|---|---|---|
| `report_id` | uuid | → `daily_work_reports(id)` ON DELETE CASCADE |
| `task_id` | uuid | → `tasks(id)` ON DELETE CASCADE |

**PK** `(report_id, task_id)` · **Index** `task_id`

A report may only reference tasks assigned to its author.

---

## `data_sheets`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `title` | text | not blank |
| `slug` | text | unique, kebab-case |
| `description` | text | nullable |
| `status` | sheet_status | default `ACTIVE` |
| `created_by` | uuid | → `profiles(id)` ON DELETE SET NULL |

---

## `data_sheet_columns`

The schema for a sheet's JSONB records.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `sheet_id` | uuid | → `data_sheets(id)` ON DELETE CASCADE |
| `column_key` | text | `^[a-z][a-z0-9_]{0,48}$`, unique per sheet |
| `label` | text | not blank |
| `data_type` | sheet_column_type | default `TEXT` |
| `is_required` | boolean | default false |
| `display_order` | integer | default 0 |
| `options` | text[] | required and non-empty when `data_type = 'SELECT'` |

**Unique** `(sheet_id, column_key)` · **Index** `(sheet_id, display_order)`

A column key cannot be renamed once records exist, and a column holding data cannot be dropped
until it is cleared — so stored records can never silently stop matching their schema.

> `column_key` is **data**, never a SQL identifier. Nothing here is interpolated into DDL.

---

## `data_sheet_memberships`

Layer 1: *may you open this sheet?*

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `sheet_id` | uuid | → `data_sheets(id)` ON DELETE CASCADE |
| `user_id` | uuid | → `profiles(id)` ON DELETE CASCADE |
| `access_level` | sheet_access_level | `VIEW` or `EDIT` |
| `created_by` | uuid | → `profiles(id)` ON DELETE SET NULL |

**Unique** `(sheet_id, user_id)` · **Index** `user_id`

Deleting the row revokes access on the next request.

---

## `data_sheet_rows`

Layer 2: *may you see this record?*

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `sheet_id` | uuid | → `data_sheets(id)` ON DELETE CASCADE; immutable after insert |
| `assigned_to_user_id` | uuid | → `profiles(id)` ON DELETE SET NULL; admin/manager only |
| `row_data` | jsonb | object; validated against `data_sheet_columns` |
| `created_by` / `updated_by` | uuid | → `profiles(id)`; stamped by trigger |

**Constraints** `jsonb_typeof(row_data) = 'object'` plus full validation by
`app.validate_sheet_row_data` (unknown keys, required columns, per-type checks)
**Indexes** `(sheet_id, created_at desc)`, `(sheet_id, assigned_to_user_id)`,
`assigned_to_user_id`, GIN on `row_data`

**Retention** Company contact data. Treat as confidential; interns have no bulk export.

---

## Relationship summary

```
auth.users ─1:1─ profiles ─┬─ manager_id ──▶ profiles (self-referential)
                           ├─ team_id ─────▶ teams
                           ├─1:N─ attendance_sessions ─1:N─ breaks
                           ├─1:N─ tasks (as assignee / creator)
                           ├─1:N─ task_time_entries ──▶ tasks, attendance_sessions
                           ├─1:N─ daily_work_reports ─N:M─ tasks
                           ├─1:N─ data_sheet_memberships ──▶ data_sheets
                           ├─1:N─ data_sheet_rows (as assignee)
                           └─1:N─ activity_logs (as actor / subject)

data_sheets ─1:N─ data_sheet_columns
            ─1:N─ data_sheet_rows
            ─1:N─ data_sheet_memberships
```
