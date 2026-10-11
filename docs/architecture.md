# Architecture

## Overview

Rangverse is a single Next.js application talking to a single Supabase PostgreSQL database.
There is no separate API service: pages render on the server, mutations are server actions, and
every database request carries the signed-in user's identity so row level security applies.

```
┌──────────────┐     cookies      ┌─────────────────────────────┐
│   Browser    │ ───────────────▶ │  Next.js (App Router)       │
│  (dark UI)   │ ◀─────────────── │  • server components        │
└──────────────┘    HTML / RSC    │  • server actions           │
                                  │  • proxy (session refresh)  │
                                  └──────────────┬──────────────┘
                                                 │ publishable key
                                                 │ + user JWT
                                                 ▼
                                  ┌─────────────────────────────┐
                                  │  Supabase PostgreSQL        │
                                  │  • RLS policies (deny first)│
                                  │  • trigger guards           │
                                  │  • state-machine functions  │
                                  └─────────────────────────────┘
```

The service-role key is used in exactly one place — inviting a user — and never leaves the
server.

---

## Directory structure

```
src/
  app/
    (public)/            login, forgot-password, reset-password, setup-required
      actions.ts         auth server actions
      action-state.ts    form state shape (not a "use server" module)
    (app)/               authenticated routes, guarded by layout + page
      overview/ tasks/ time/ daily-reports/ data/ team/ reports/ settings/
      onboarding/ not-authorized/ admin/{users,sheets,activity}
    auth/callback/       code → session exchange
    account-suspended/   outside (app) so the redirect cannot loop
    layout.tsx           fonts, theme, toaster
    globals.css          design tokens
  proxy.ts               session refresh + authenticated boundary

  components/
    brand/               Rangmanch mark and lockup
    layout/              sidebar, topbar, mobile drawer and bottom nav
    common/              status pill, empty state, metric card, section card
    ui/                  shadcn/Radix primitives, re-themed
    time/ tasks/ reports/ data/ people/

  lib/
    actions/             server actions        ("use server")
    data/                read queries          ("server-only")
    domain/time.ts       pure time logic       (no I/O)
    validation/          Zod schemas           (client + server)
    auth/                permissions, guards, session
    supabase/            browser, server, proxy, admin clients
    db/database.types.ts hand-written schema types
    display.ts           presentation helpers  (client-safe)
    view-models.ts       shared result shapes  (client-safe)
    redact.ts            audit metadata scrubbing (client-safe)
    activity.ts          audit writer          ("server-only")
    navigation.ts        role-aware nav definition

supabase/
  migrations/            0001…0006, ordered and reproducible
  seed.sql               local structure only — no people, no records

tests/
  unit/                  pure logic, validation, permissions
  rls/                   authorization matrix against real PostgreSQL
  integration/           cross-boundary workflows
  support/               PGlite harness, auth shim, fixtures
e2e/                     Playwright, desktop + mobile, axe
```

### The client/server split

`lib/data/*` and `lib/activity.ts` import `server-only`, so importing them from a client
component is a build error rather than a silent leak. Anything a client component genuinely
needs lives in a neutral module:

| Need | Module |
|---|---|
| Result shapes (types) | `lib/view-models.ts` |
| Name formatting, label maps | `lib/display.ts` |
| Sheet column presets | `lib/sheet-templates.ts` |
| Zod schemas | `lib/validation/*` |
| Redaction | `lib/redact.ts` |

---

## Request flow

### Reading a page

1. `proxy.ts` refreshes the Supabase session and redirects anonymous requests to `/login`.
2. The `(app)` layout re-resolves the session and redirects paused accounts to
   `/account-suspended`. The boundary therefore does not depend on the proxy alone.
3. The page calls `requireUser()` or `requirePermission(...)`, both deduplicated per request
   with React `cache()`.
4. Data functions issue broad queries — `select * from tasks` — and the database returns only
   the authorised rows. **There is no client-side filtering of private data anywhere.**

### Performing a mutation

1. A server action calls `assertPermission(...)` or `assertSignedIn()`.
2. Input is parsed with the same Zod schema the form used.
3. The write goes through the request-scoped Supabase client, so RLS and the trigger guards
   apply.
4. An audit entry is appended with redacted metadata.
5. Affected paths are revalidated and a typed result drives a toast.

---

## Permission boundaries

There are four independent layers. A bug in any one of them is caught by the next:

| Layer | Where | What it stops |
|---|---|---|
| Navigation | `lib/navigation.ts` | Showing links a role cannot use |
| Page guard | `lib/auth/guards.ts` | Rendering a page a role cannot use |
| Server action | `assertPermission` + Zod | Forged or malformed requests |
| **Database** | RLS policies + triggers | **Everything, including direct API calls** |

Only the last one is load-bearing. The first three exist so people get a clear explanation
instead of an opaque error.

### Helper functions

Policies on `profiles` cannot query `profiles` without infinite recursion, so every relationship
test lives in a `SECURITY DEFINER` function in the `app` schema with a pinned `search_path`:

| Function | Answers |
|---|---|
| `app.is_active()` | Is this account usable at all? |
| `app.is_admin()` / `app.is_manager()` | What role is the caller? |
| `app.manages(target)` | Does `target` report to the caller? |
| `app.can_view_user(target)` | Self, own report, or admin? |
| `app.my_manager_id()` | Who is the caller's manager? |
| `app.open_session_id(user)` / `app.is_on_break(user)` | Attendance state |
| `app.can_view_task` / `app.can_track_task` | Task visibility and timer rights |
| `app.sheet_access` / `app.can_view_sheet` / `app.can_edit_sheet` / `app.can_view_sheet_row` | Data Hub, two-layer |

---

## Time model

- Stored as `timestamptz`, always UTC.
- Displayed in `Asia/Kolkata`.
- `net working time = (clock_out − clock_in) − Σ completed breaks`.
- Sessions crossing midnight are one interval; the maths never touches calendar days.
- Clock and break timestamps are written by database triggers, so a client cannot choose them.
- Task-timer minutes are reported against **tasks only**. Adding them to attendance would
  double-count the same minutes, and a unit test asserts they stay separate.
- Open intervals are rendered as "in progress", never as a completed total.

---

## Invariants enforced by the database

| Invariant | Mechanism |
|---|---|
| One open attendance session per person | partial unique index |
| One open break per session and per person | partial unique indexes |
| One running task timer per person | partial unique index |
| An interval always ends after it starts | check constraints |
| A break belongs to its session's owner and window | `app.guard_break_integrity` |
| Clocking out ends the running break and timer | `rv_clock_out`, `app.close_timers_with_session` |
| A timer cannot start outside a session or during a break | `app.guard_task_time_entry` |
| An assignee may change only a task's status | `app.guard_task_columns` |
| A manager may assign only to their own reports | `app.guard_task_columns` |
| A submitted report is locked for its author | `app.guard_daily_report` |
| Only a reviewing manager writes feedback, attributed to themselves | `app.guard_daily_report` |
| Sheet records match their configured columns and types | `app.validate_sheet_row_data` |
| Nobody can escalate their own privileges | `app.guard_profile_privileged_columns` |
| The audit log is append-only | no UPDATE/DELETE grant |

---

## State machine

`supabase/migrations/0006_time_state_machine.sql` provides the only transition surface:

| Function | Behaviour |
|---|---|
| `rv_clock_in()` | Idempotent — returns the open session if one exists |
| `rv_clock_out()` | Ends the running break, closes the session, stops timers |
| `rv_start_break()` | Idempotent; stops any running task timer |
| `rv_end_break()` | Errors clearly if no break is running |
| `rv_start_task_timer(task)` | Idempotent for the same task; switching closes the previous entry |
| `rv_stop_task_timer()` | Errors clearly if nothing is running |

They run `SECURITY INVOKER`, so RLS still applies and a caller can only ever act on themselves.
Because the "start" operations are idempotent, a double-click or a retried request after a
dropped connection cannot create a duplicate record.
