# Deployment

## Overview

Rangverse needs two things: a Supabase project (PostgreSQL + Auth) and a Node host for the
Next.js application. Vercel is the assumed host; anything that runs Next.js 16 works.

---

## 1. Create the Supabase project

1. Create a project at [supabase.com](https://supabase.com). Choose a region close to your
   users — `ap-south-1` (Mumbai) for a team working in India Standard Time.
2. From **Project Settings → API**, note:
   - the **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - the **publishable / anon key** → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - the **service role key** → `SUPABASE_SERVICE_ROLE_KEY` (**secret**)
3. Under **Authentication → Providers**, enable **Email** and **disable sign-ups**. Rangverse is
   invite-only; public registration must not exist.
4. Under **Authentication → URL Configuration**, set the Site URL to your deployed origin and add
   `https://your-domain/auth/callback` to the redirect allow-list.

---

## 2. Apply the migrations

```bash
npm install -g supabase       # or use npx
supabase link --project-ref <your-project-ref>
supabase db push              # applies supabase/migrations in order
```

Migrations are ordered and reproducible:

| File | Creates |
|---|---|
| `0001_core.sql` | enums, `app` helpers, teams, profiles, activity log, privilege guards |
| `0002_attendance.sql` | sessions, breaks, single-active indexes, timestamp guards |
| `0003_tasks.sql` | tasks, comments, time entries, column guards |
| `0004_daily_reports.sql` | reports and task links |
| `0005_data_hub.sql` | sheets, columns, memberships, records, JSONB validation |
| `0006_time_state_machine.sql` | the clock/break/timer RPCs |

> **Never** make undocumented changes in the Supabase dashboard. Anything not in
> `supabase/migrations/` will be lost on the next environment rebuild and will drift from the
> test suite.

Optionally load the structural seed (two teams, four starter sheets, no people and no records):

```bash
psql "$DATABASE_URL" -f supabase/seed.sql
```

---

## 3. Create the first administrator

```bash
# with .env.local pointing at the target project
npm run db:bootstrap-admin
```

It prompts for an email, a name and a password (read without echo), enforces the password
policy, and refuses to run if an administrator already exists.

There is no default password and no seeded administrator. Every other account is created by
invitation from the People screen.

---

## 4. Configure the host

Set these in your hosting provider:

| Variable | Scope | Secret |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | build + runtime | no |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | build + runtime | no |
| `NEXT_PUBLIC_SITE_URL` | build + runtime | no — must match the deployed origin exactly |
| `SUPABASE_SERVICE_ROLE_KEY` | **runtime only** | **yes** |

Deploy:

```bash
npm run build
npm start          # or let Vercel build from the repository
```

### Security precautions at deploy time

- `SUPABASE_SERVICE_ROLE_KEY` must be a secret, must not be exposed to the build log, and must
  never be given a `NEXT_PUBLIC_` prefix.
- `NEXT_PUBLIC_SITE_URL` must match the real origin, or password-reset and invitation links will
  point somewhere else.
- Serve over HTTPS only. Auth cookies are `httpOnly` and `secure` in production.
- Security headers (`nosniff`, `DENY` framing, `strict-origin-when-cross-origin`, a restrictive
  `Permissions-Policy`) are set in `next.config.ts` — keep them.
- The app sends `robots: noindex, nofollow`. Keep it off search engines.
- Enable Supabase's auth rate limiting, and consider edge rate limiting in front of `/login`.

---

## 5. Staging and production

Use **two separate Supabase projects**. Never point staging at production data.

| | Staging | Production |
|---|---|---|
| Supabase project | `rangverse-staging` | `rangverse` |
| Seed | `supabase/seed.sql` | structure only, or nothing |
| Test accounts | fine | **never** |
| Service role key | separate | separate |

Production must not depend on test users or seed data. The application works from an empty
database plus one bootstrapped administrator.

---

## 6. Backup and recovery

**Supabase provides** automated daily backups on paid plans and point-in-time recovery on higher
tiers. Enable PITR before the platform holds real intern records.

**Additionally**, take your own periodic logical dump:

```bash
supabase db dump --db-url "$DATABASE_URL" -f backup-$(date +%F).sql
```

Store dumps encrypted and access-controlled: they contain intern personal data and company
contact databases, with no row level security applied.

**Recovery drill** — rehearse before you need it:

1. Create a scratch Supabase project.
2. Restore the dump.
3. Point a local `.env.local` at it and run `npm run test:rls` to confirm the policies survived.
4. Sign in and verify an administrator, a manager and an intern each see what they should.

---

## 7. Upgrades

```bash
npm run verify        # lint, typecheck, unit + RLS + integration, build
npm run test:e2e      # with E2E_ADMIN_* set against staging
supabase db push      # apply any new migrations to staging first
```

Always apply migrations to staging and run `npm run test:rls` before touching production. The
RLS suite is the fastest way to catch a policy regression.

---

## 8. Monitoring

Not configured in version 1, deliberately — the spec says to add monitoring variables only when
the functionality exists. When you add it:

- Watch the Supabase **Auth** logs for repeated failures.
- Watch for sessions flagged `needs_review` (`attendance_sessions.needs_review`).
- Alert on `activity_logs` entries with `outcome = 'DENIED'`, which indicate attempted access
  beyond someone's permissions.

---

## 9. Running the whole stack locally with Docker

If Docker is available, the full Supabase stack runs locally:

```bash
supabase start        # prints the local URL and keys
supabase db reset     # migrations + seed
npm run db:bootstrap-admin
npm run dev
```

Copy the URL and keys printed by `supabase status` into `.env.local`.

Without Docker you can still develop and run every database test — they use PGlite. Only the
authenticated browser suite and a live sign-in need a real Supabase project. See
[testing.md](./testing.md).
