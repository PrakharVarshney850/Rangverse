# Rangverse

**The Workspace Behind the Stage.**

Rangverse is the internal workspace for [Rangmanch](https://www.therangmanch.in) — an invite-only
platform for intern onboarding, attendance and working hours, breaks, task-linked timers, task
management, daily work reports and permission-scoped business databases.

It is an internal productivity application, not a public marketing site. There is no public
sign-up: accounts exist only because an administrator created them.

---

## What it does

| Area | What's in version 1 |
|---|---|
| **Identity** | Invite-only email/password auth, password reset, three roles (admin / manager / intern), onboarding lifecycle, account pause and offboarding |
| **Attendance** | Clock in/out, breaks, server-authored timestamps, net working time, midnight-crossing sessions, anomaly flagging |
| **Tasks** | Create, assign, filter, sort, paginate, comment, status workflow, overdue detection |
| **Task timers** | One running timer per person, bound to an open attendance session, never running during a break |
| **Daily reports** | Draft/submit, task links, evidence links, manager review, missing-report visibility |
| **Data Hub** | Configurable spreadsheet-style sheets with two-layer access control (sheet membership + record assignment) |
| **Dashboards** | Role-specific overviews, team status, hours and delivery reporting |
| **Audit** | Append-only activity history scoped by relationship |

Everything is enforced by PostgreSQL row level security, not only by the interface.

---

## Prerequisites

- **Node.js 20.9+** (developed and tested on 24.19)
- **npm 10+**
- A **Supabase** project — either the hosted service or the local CLI stack (which needs Docker)

> **Windows note.** If `npm` fails with *"running scripts is disabled on this system"*, PowerShell
> is blocking `npm.ps1`. Run npm through cmd instead:
> `& $env:ComSpec /c "npm install"`. Every command below works that way too.

> **OneDrive note.** If the repository lives inside a synced OneDrive folder, exclude
> `node_modules` and `.next` from sync. Otherwise installs and dev builds fight the sync client
> for file locks.

---

## Installation

```bash
git clone <your-remote> rangverse
cd rangverse
npm install
cp .env.example .env.local      # then fill it in
```

---

## Environment variables

| Variable | Where it is used | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | Your project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser + server | The anon/publishable key. Safe to expose — RLS still applies |
| `NEXT_PUBLIC_SITE_URL` | server | Origin used to build invitation and reset links |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Bypasses RLS. Never prefix with `NEXT_PUBLIC_`, never import from a client component |

Configuration is validated at startup with Zod. Missing or malformed values produce a readable
error and a `/setup-required` page — never a blank screen.

---

## Database setup

```bash
# Option A — Supabase CLI (needs Docker)
supabase start
supabase db reset           # applies supabase/migrations, then supabase/seed.sql

# Option B — hosted Supabase project
supabase link --project-ref <ref>
supabase db push
```

Then create the first administrator. This is interactive, reads the password without echoing it,
and refuses to run if an administrator already exists:

```bash
npm run db:bootstrap-admin
```

There is no default password and no seeded administrator anywhere in this repository.

`supabase/seed.sql` creates **structure only** — two teams and the four starter Data Hub sheets
with their columns. It creates no people and no business records, by design.

---

## Local development

```bash
npm run dev          # http://localhost:3000
```

Useful scripts:

| Script | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` with strict mode |
| `npm run test` | Unit + RLS + integration (Vitest) |
| `npm run test:unit` | Pure logic and validation |
| `npm run test:rls` | Database authorization matrix |
| `npm run test:integration` | Cross-boundary workflows |
| `npm run test:e2e` | Playwright, desktop + mobile |
| `npm run verify` | lint → typecheck → tests → build |
| `npm run db:bootstrap-admin` | Create the first administrator |
| `npm run db:types` | Regenerate database types from a local Supabase |

---

## Running the tests

The database tests do **not** need Docker. They apply the real migrations to
[PGlite](https://pglite.dev) — PostgreSQL compiled to WebAssembly — and exercise the genuine RLS
policies, triggers and constraints with seven fixture identities.

```bash
npm run test          # 123 unit + RLS + integration tests
npm run test:e2e      # 54 public browser tests, desktop and mobile
```

The authenticated Playwright specs require a running Supabase project. Without
`E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` they **skip with an explicit reason** — they are never
reported as passing. See [docs/testing.md](./docs/testing.md).

---

## Documentation

| Document | Contents |
|---|---|
| [AGENTS.md](./AGENTS.md) | Coding standards, security rules, architectural conventions |
| [docs/architecture.md](./docs/architecture.md) | Structure, data flow, permission boundaries |
| [docs/security-model.md](./docs/security-model.md) | Roles, authorization matrix, RLS design, secrets |
| [docs/data-dictionary.md](./docs/data-dictionary.md) | Tables, fields, relationships, constraints |
| [docs/testing.md](./docs/testing.md) | Commands, fixtures, coverage, known limitations |
| [docs/deployment.md](./docs/deployment.md) | Supabase setup, migrations, hosting, backups |
| [docs/roadmap.md](./docs/roadmap.md) | Version 1 / 2 / 3 and open decisions |

---

## Common issues

**"running scripts is disabled on this system"**
PowerShell is blocking `npm.ps1`. Use `& $env:ComSpec /c "npm <command>"`.

**The app redirects everything to `/setup-required`**
`.env.local` is missing or incomplete. Copy `.env.example` and fill in all four variables.

**`supabase start` fails**
It needs Docker Desktop. If you cannot install Docker, use a hosted Supabase project — the
database tests run without either.

**Database tests are slow on first run**
PGlite downloads and initialises a PostgreSQL image the first time. Subsequent runs are fast.

**Builds are slow or fail with EPERM inside OneDrive**
Exclude `node_modules` and `.next` from OneDrive sync.

---

## Licence and ownership

Internal software for Rangmanch. The Rangmanch name, mark and brand colours are theirs.
