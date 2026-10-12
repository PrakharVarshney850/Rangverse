# AGENTS.md — working on Rangverse

Conventions for anyone (human or AI) changing this codebase.

---

## 1. The one rule that matters

**The database is the security boundary. The interface is a convenience.**

Every permission decision must hold when someone bypasses the UI entirely and calls PostgREST
directly with a valid session token. If a change can only be defended by "the button is hidden",
it is not done.

Concretely, for any new table or column:

1. `alter table ... enable row level security;` **and** `force row level security;`
2. Explicit `SELECT` / `INSERT` / `UPDATE` / `DELETE` policies — default deny, nothing implicit.
3. Explicit `GRANT`s at least privilege for `authenticated`; `anon` gets nothing.
4. A test in `tests/rls/` proving both the allowed and the denied case.

---

## 2. Architectural conventions

### Layering

```
app/          route handlers, pages, layouts        (may read session, must guard)
lib/actions/  server actions                        ("use server", async exports only)
lib/data/     read queries                          ("server-only")
lib/domain/   pure business logic                   (no I/O, fully unit tested)
lib/validation/ Zod schemas                         (shared client + server)
lib/display.ts, lib/view-models.ts, lib/redact.ts   (neutral — safe in client bundles)
components/   presentation
```

**Never import `@/lib/data/*` or `@/lib/activity` from a client component.** They carry
`server-only`, and the build will fail. If a client component needs a type, put it in
`lib/view-models.ts`; if it needs a helper, put it in `lib/display.ts`.

**A `"use server"` file may only export async functions.** Constants like `IDLE` live in a
sibling non-action module (see `app/(public)/action-state.ts`).

### Mutations

Every mutation follows the same shape:

```ts
export async function doThingAction(formData: FormData): Promise<MutationResult> {
  try {
    const session = await assertPermission("the.permission");   // 1. authorize
    const parsed = theSchema.safeParse({ ... });                 // 2. validate
    if (!parsed.success) return { ok: false, fieldErrors: ... };

    const supabase = await createClient();                       // 3. act under RLS
    const { data, error } = await supabase.from("...")...;
    if (error) return { ok: false, message: humanize(error.message) };

    await recordActivity(supabase, session.id, { ... });         // 4. audit
    revalidatePath("/...");                                      // 5. refresh
    return { ok: true, message: "..." };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, message: error.message };
    throw error;
  }
}
```

Never skip step 2 because the client already validated. Never skip step 1 because a policy
"would catch it" — defence in depth is the point.

### Time

- Store `timestamptz`, always UTC.
- Display in `Asia/Kolkata` via `@/lib/domain/time`.
- Durations are computed from recorded timestamps. A duration submitted by a browser is never
  trusted and never stored.
- **Task-timer time is reported against tasks. It is never added to an attendance total.**
  Those are the same minutes; adding them double-counts.
- Open intervals render as "in progress", never as a final number.

---

## 3. Security rules

### Absolute

- No credential, key, token or password in source, tests, fixtures or documentation.
- `SUPABASE_SERVICE_ROLE_KEY` is reachable only from `lib/supabase/admin.ts`, which carries
  `import "server-only"`.
- Never trust a role, user id or permission from a client request payload.
- Role, manager, team, designation and employment dates are administrator-only; the
  `profiles_guard_privileged_columns` trigger enforces this independently of RLS.
- `activity_logs` is append-only: application roles hold no `UPDATE` or `DELETE` grant. Do not
  add one.
- Never log passwords, tokens, keys or bulk personal data. `sanitizeMetadata` strips them; keep
  its deny-list current.

### Crypto and dependencies

This repository follows `.github/instructions/codeguard-*`. In particular: no MD5/SHA-1/DES/RC4,
no hand-rolled password hashing or session handling — Supabase Auth owns all of it.

Do not add a dependency without a concrete technical need. Specifically out of scope: Prisma,
a second database, a second auth provider, Redux.

### Validation

- All user input is parsed with Zod on the server before it touches the database.
- JSONB `row_data` in the Data Hub is validated twice: by `buildRowSchema` on the server and by
  `app.validate_sheet_row_data` in the database.
- **No user-supplied string ever becomes a SQL identifier.** Sheet columns are data, not DDL.

---

## 4. UI conventions

- Dark theme only. Tokens live in `src/app/globals.css`; use them, never raw hex.
- **Cinzel** for headings (`font-heading`), **Inter** for everything else.
- Gold (`--gold`) is the only accent. The Rangmanch rainbow appears only in the logo mark and as
  status semantics.
- Every status indicator pairs colour with a text label.
- Every list, table and panel has a designed empty state — never render nothing.
- Every destructive action gets a confirmation dialog.
- Every mutation produces a toast: success or a readable failure.
- Nothing essential may depend on hover. Mobile must work.
- Planned features are shown as disabled entries labelled `v2` — never as buttons that silently
  do nothing.

---

## 5. Required test workflow

Before claiming a change is done:

```bash
npm run lint
npm run typecheck
npm run test          # unit + RLS + integration
npm run test:e2e      # when UI or routing changed
npm run build
```

or simply `npm run verify` (everything except E2E).

### Rules

- **Never report a test as passing unless you ran it and saw it pass.**
- If a test cannot run here (for example the authenticated Playwright specs without Supabase
  credentials), it must `skip` with a visible reason — never be quietly removed or marked green.
- Fix failures. Do not weaken TypeScript strictness, delete assertions or silence lint rules to
  get a green run.
- New authorization behaviour requires a new case in `tests/rls/authorization.test.ts` covering
  both the allowed and the denied path.
- New time logic requires unit tests including the failure and edge cases (midnight crossing,
  open intervals, invalid transitions).

---

## 6. Things that are deliberately absent

Do not add these without an explicit decision — their absence is a design choice:

- Public self-registration
- Employee performance scores or leaderboards
- GPS, webcam or any covert monitoring
- Automatic clock-out (planned for v2, disabled by default, must preserve original events)
- Unrestricted CSV export of company contact data for interns
- Dummy buttons for unbuilt features

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
