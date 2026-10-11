# Copilot instructions — Rangverse

Rangverse is Rangmanch's internal workspace: interns, attendance, tasks, daily reports and
permission-scoped business data. Next.js App Router + TypeScript (strict) + Tailwind 4 +
Supabase PostgreSQL.

Read [AGENTS.md](../AGENTS.md) for the full conventions. The essentials:

## Permission and security rules

- **The database is the security boundary.** Row level security must make every permission hold
  even for a direct PostgREST request. Hiding a button is never sufficient.
- Every new table needs: RLS enabled *and* forced, explicit per-verb policies, least-privilege
  grants, and an RLS test covering both the allowed and the denied path.
- Three roles: `ADMIN`, `MANAGER`, `INTERN`. A manager's authority flows only through
  `profiles.manager_id` — never through a team, and never across managers.
- Role, manager, team, designation and employment dates are administrator-only and are protected
  by a database trigger as well as by policy.
- A `PAUSED` or `OFFBOARDED` account loses all access on its next request.
- `SUPABASE_SERVICE_ROLE_KEY` is used only in `lib/supabase/admin.ts` (`server-only`), only after
  an explicit authorization check.
- Never commit a credential. Never log a password, token or key. `sanitizeMetadata` redacts audit
  payloads — keep its deny-list current.
- No user-supplied string may become a SQL identifier.

## Architectural conventions

- Server actions live in `lib/actions/`, reads in `lib/data/` (`server-only`), pure logic in
  `lib/domain/`, schemas in `lib/validation/`.
- Client components may import `lib/display.ts`, `lib/view-models.ts`, `lib/redact.ts` and
  `lib/validation/*` — never `lib/data/*` or `lib/activity.ts`.
- A `"use server"` module may export only async functions.
- Mutation order is always: authorize → Zod parse → act under RLS → audit → revalidate.
- Timestamps are UTC `timestamptz`, displayed in `Asia/Kolkata`. Durations come from recorded
  timestamps, never from the browser.
- **Task-timer minutes are reported against tasks and must never be added to attendance totals.**

## UI conventions

- Dark theme only, using the tokens in `src/app/globals.css`. Cinzel headings, Inter body, gold
  as the single accent.
- Status indicators always pair colour with a text label.
- Designed empty states, loading skeletons, confirmation dialogs for destructive actions, and a
  toast for every mutation.
- Mobile must work; nothing essential behind hover.
- Unbuilt features appear as disabled items labelled `v2`, never as dead buttons.

## Testing expectations

Run before claiming completion:

```bash
npm run lint && npm run typecheck && npm run test && npm run build
```

- Never state that a test passed unless it was executed and observed.
- Tests that cannot run in the current environment must skip with a visible reason.
- Fix failures rather than weakening strictness, assertions or lint rules.
- Database tests use PGlite (real PostgreSQL in WebAssembly) and need no Docker.

## Dependency conventions

- Prefer the existing stack. Do not add Prisma, a second database, a second auth provider or a
  global state library.
- Keep `package-lock.json` committed.
- On Windows, invoke npm through cmd: `& $env:ComSpec /c "npm <command>"`.
