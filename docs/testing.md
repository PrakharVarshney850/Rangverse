# Testing

## Commands

| Command | Covers | Needs |
|---|---|---|
| `npm run test` | unit + RLS + integration | nothing |
| `npm run test:unit` | pure logic, validation, permissions | nothing |
| `npm run test:rls` | database authorization matrix | nothing |
| `npm run test:integration` | cross-boundary workflows, seed | nothing |
| `npm run test:e2e` | Playwright, desktop + mobile, axe | Chromium (`npm run test:e2e:install`) |
| `npm run verify` | lint → typecheck → tests → build | nothing |

> On Windows run npm through cmd if PowerShell blocks `npm.ps1`:
> `& $env:ComSpec /c "npm run test"`.

---

## How the database tests work without Docker

The Supabase CLI local stack needs Docker. These tests do not.

`tests/support/test-database.ts` boots [PGlite](https://pglite.dev) — **real PostgreSQL 17
compiled to WebAssembly** — applies `tests/support/auth-bootstrap.sql` (the `anon`,
`authenticated` and `service_role` roles plus the `auth` schema with `uid()`, `role()` and
`jwt()` defined exactly as Supabase defines them), then applies every migration in
`supabase/migrations/` in order.

Acting as a user means doing what PostgREST does:

```sql
select set_config('request.jwt.claims', '{"sub":"…","role":"authenticated"}', false);
set role authenticated;
```

So the assertions run against the genuine policies, triggers, constraints and indexes. Nothing
is mocked, and a migration that would fail in production fails here.

---

## Fixture identities

`tests/support/fixtures.ts` builds the seven identities the security model is specified against:

| Identity | Role | Reports to |
|---|---|---|
| `ADMIN` | ADMIN | — |
| `MANAGER_A` | MANAGER | — |
| `MANAGER_B` | MANAGER | — |
| `INTERN_A1` | INTERN | Manager A |
| `INTERN_A2` | INTERN | Manager A |
| `INTERN_B1` | INTERN | Manager B |
| `PAUSED_INTERN` | INTERN (`PAUSED`) | Manager A |
| `ANON` | unauthenticated | — |

Plus two teams, two sheets with columns and memberships, three tasks and four records.

---

## What is covered

### Unit (`tests/unit/`) — 107 tests

- **Time** — interval duration, completed vs running breaks, net working time, sessions crossing
  midnight (including across the Asia/Kolkata boundary), aggregation, the attendance state
  machine, legal and illegal transitions, anomaly detection, formatting, decimal hours, business
  day and week bounds. Includes the explicit assertion that **task-timer time is never added to
  an attendance total**.
- **Permissions** — every role × permission pair, suspended accounts losing everything,
  cross-manager isolation, task assignment rules.
- **Validation** — password policy, invite rules, slugs, task and report schemas, evidence-link
  rules, dynamic sheet-row schemas (unknown keys, required columns, per-type checks), audit
  metadata redaction, role-aware navigation.

### Database authorization (`tests/rls/`) — 74 tests

Structural checks: every public table has RLS enabled and forced and at least one policy; the
four single-active partial unique indexes exist; `activity_logs` has no UPDATE/DELETE policy;
every `SECURITY DEFINER` helper pins its `search_path`.

Behavioural checks, each asserting both the allowed and the denied path:

| Requirement | Covered |
|---|---|
| Intern A1 cannot read Intern A2's private reports | ✅ |
| Intern A1 cannot read Intern B1's attendance or tasks | ✅ |
| Manager A cannot access Manager B's team | ✅ |
| An intern cannot modify their own role or manager | ✅ |
| A manager cannot grant themselves administrator | ✅ |
| An unassigned intern cannot access a restricted sheet | ✅ |
| A sheet member cannot access another user's record | ✅ |
| A user cannot update or delete another user's time entries | ✅ |
| An unauthenticated request cannot read private company data | ✅ |
| Revoked access stops working on the next request | ✅ |

Plus: client-supplied clock-in times being overwritten, duplicate sessions and breaks rejected,
clock-out refused while a break runs, timers blocked without a session or during a break, timers
closed when a session ends, completed entries locked, submitted reports locked, manager feedback
attributable only to the reviewer, JSONB validation, and append-only audit enforcement.

### Integration (`tests/integration/`) — 16 tests

Full journeys across the application/database boundary: a complete working day (clock in → timer
→ break → clock out) with coherent totals; task assignment and the status workflow; comment
visibility; draft → submitted report flow and task linking; sheet creation, access grant, record
assignment, validation and revocation; manager and administrator summaries; audit attribution.
Plus the seed: idempotent, creates the four starter sheets with options, and creates **no people
and no business records**.

### End-to-end (`e2e/`) — 54 public tests

Desktop (1440×900) and mobile (Pixel 7):

- Every protected route redirects an anonymous visitor to sign-in, preserving the intended
  destination.
- Sign-in shows the brand lockup, states that accounts are invite-only, and offers no sign-up
  link.
- All fields are labelled; the form is keyboard-operable; recovery is reachable.
- Password policy is stated on the reset screen.
- No horizontal overflow on either viewport.
- **axe-core** (WCAG 2.0/2.1 A and AA) on sign-in, forgot-password and reset-password, failing
  on any serious or critical violation.
- Every focusable control has a visible focus indicator — outline or ring.

---

## Known limitation: the authenticated browser suite

`e2e/authenticated.spec.ts` (13 specs × 2 viewports = **26 specs**) needs a running Supabase
project with a bootstrapped administrator. Without credentials they **skip with this reason**:

> Requires a running Supabase project. Set `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD` to run this
> spec. See docs/testing.md.

**They have not been executed in an environment without Supabase, and are not claimed to pass
there.** A skip is reported as a skip.

To run them:

```bash
# 1. Point .env.local at a Supabase project and apply the migrations
supabase db push

# 2. Create an administrator
npm run db:bootstrap-admin

# 3. Supply the credentials and run
E2E_ADMIN_EMAIL=you@rangmanch.in E2E_ADMIN_PASSWORD='…' npm run test:e2e
```

They cover: sign-in and sign-out, role-aware navigation, v2 items rendering as labelled and
inert, the full clock/break cycle, the timer being unavailable while clocked out, writing a
daily report, a forbidden direct URL, and axe on the overview, time tracker, tasks and Data Hub.

### Why not simulate it?

An authenticated run could be faked with a mock auth layer. That is explicitly rejected: a mock
authorization system would make the suite green while testing nothing that resembles production.
An honest skip is more useful than a dishonest pass.

---

## Other limitations

| Limitation | Why |
|---|---|
| Password-reset email delivery is not asserted end to end | Needs a real mail transport. The request path and the generic non-enumerating response are covered |
| Invitation email delivery is not asserted | Same |
| axe coverage of authenticated pages | Written, runs only with credentials |
| Automated accessibility checks are not proof of accessibility | Axe catches a subset. Manual keyboard and screen-reader review is still required before launch |
| No load or concurrency testing | The single-active invariants are enforced by partial unique indexes, which are correct under concurrency by construction, but this has not been load-tested |

---

## Adding tests

- **New authorization behaviour** → a case in `tests/rls/authorization.test.ts` asserting both
  the allowed and the denied path.
- **New time logic** → unit tests including edge and failure cases.
- **New workflow** → an integration test that walks it end to end.
- **New screen** → a Playwright spec plus an axe check.

Never mark an unexecuted test as passing. Never weaken an assertion to get a green run.
