# Security model

## Threat model

Rangverse holds intern personal data and Rangmanch's commercial contact databases. The
assumptions it is built against:

1. **A signed-in user may craft any request.** They can read the publishable key from the browser
   and call PostgREST directly. Every control must survive that.
2. **Role claims in a request are untrusted.** Changing a value in local storage, a payload or
   client code must never increase privilege.
3. **A valid id is not permission.** Guessing or copying another person's record id must return
   nothing.
4. **Revocation must be immediate.** Pausing an account or revoking sheet access takes effect on
   the next request, not when the other person next refreshes.

---

## Roles

| Role | Scope |
|---|---|
| `ADMIN` | The whole workspace |
| `MANAGER` | Only people whose `profiles.manager_id` is their own id |
| `INTERN` | Only themselves and what has been explicitly assigned to them |

Manager authority flows through **`manager_id` alone**. `team_id` is for grouping and display,
deliberately, so there is one source of truth and no contradictory paths to the same data.

---

## Authorization matrix

Legend: ● full · ◐ own team · ○ own only · — none

| Capability | Admin | Manager | Intern |
|---|:--:|:--:|:--:|
| Invite users | ● | — | — |
| Change a role / manager / team | ● | — | — |
| Pause or offboard an account | ● | — | — |
| Read profiles | ● | ◐ | ○ (+ own manager) |
| Edit own name, phone, college, course | ● | ● | ● |
| Create teams | ● | — | — |
| Create tasks | ● | ◐ | — |
| Assign tasks | ● | ◐ | — |
| Edit task fields | ● | ◐ | — |
| Change task status | ● | ◐ | ○ |
| Comment on a task | ● | ◐ | ○ |
| Read attendance | ● | ◐ | ○ |
| Clock in / out, breaks | ● | ● | ● |
| Edit recorded time | ● | — | — |
| Task timers | ● | ● | ● |
| Read daily reports | ● | ◐ submitted only | ○ |
| Review a report | ● | ◐ | — |
| Create or configure sheets | ● | — | — |
| Grant or revoke sheet access | ● | — | — |
| Read sheet records | ● | ◐ + unassigned | ○ assigned only |
| Edit sheet records | ● | ◐ (with EDIT) | ○ (with EDIT) |
| Reassign a record | ● | ● | — |
| Read activity history | ● | ◐ | ○ |

A `PAUSED` or `OFFBOARDED` account has **no** capabilities regardless of role: `app.is_active()`
is consulted by every policy.

---

## RLS policy design

### Default deny

Every table has RLS **enabled and forced**. `force` matters: without it the table owner bypasses
its own policies. `anon` holds no grant on any application table.

A structural test asserts that every public table has RLS enabled, forced, and at least one
policy — so a new table cannot be added silently open.

### Avoiding recursion

A policy on `profiles` that queries `profiles` recurses forever. Every relationship test
therefore lives in a `SECURITY DEFINER` function in the `app` schema, each with
`set search_path = app, public, pg_temp` so it cannot be hijacked by a shadowed object. A test
asserts that every `SECURITY DEFINER` function in `app` pins its `search_path`.

### Trusted context

`app.is_trusted_context()` is true only for the service-role key or a direct database session
(migrations, the bootstrap script). PostgREST always attaches `request.jwt.claims` — even an
anonymous request carries `{"role":"anon"}` — so an absent claims string can only mean a direct
session. It relaxes **trigger guards only**; RLS applies independently in every case.

### Two-layer Data Hub access

Deliberately separate questions:

1. *May you open this sheet?* → `data_sheet_memberships`
2. *May you see this record?* → `data_sheet_rows.assigned_to_user_id`

| Viewer | Sees |
|---|---|
| Admin | Everything |
| Manager with access | Records owned by their reports, by themselves, or unassigned |
| Intern with access | Records assigned to them only |

This is why a sheet member cannot read a colleague's record in the same sheet.

---

## Privilege escalation defences

`app.guard_profile_privileged_columns` runs `BEFORE UPDATE` on `profiles` and rejects any change
by a non-administrator to: `id`, `email`, `role`, `manager_id`, `team_id`, `designation`,
`joining_date`, `internship_end_date`.

`onboarding_status` has exactly one self-service transition —
`PROFILE_INCOMPLETE → ACTIVE` — so finishing onboarding works and nothing else does.

The trigger is independent of RLS. Even if an `UPDATE` policy were loosened by mistake, an
intern still could not make themselves an administrator.

`app.guard_profile_relationships` additionally refuses to point `manager_id` at anyone who is not
a `MANAGER` or `ADMIN`.

Tests covering this live in `tests/rls/authorization.test.ts`:

- an intern cannot set their own role to `ADMIN`
- an intern cannot change their own manager
- a manager cannot grant themselves `ADMIN`
- a manager cannot edit another manager's intern

---

## Secure administrator bootstrap

`npm run db:bootstrap-admin`:

- reads the email and name interactively,
- reads the password **without echoing it**, so it never enters shell history or process
  arguments,
- enforces the password policy (12+ characters, mixed case, a digit),
- reads the service-role key from the environment and never prints it,
- **refuses to run if an administrator already exists.**

There is no default password anywhere in this repository, and no seeded administrator. Further
administrators are invited through the application.

---

## Secret management

| Secret | Lives in | Rules |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local`, CI secret, host secret | Server only. Reachable solely via `lib/supabase/admin.ts`, which carries `server-only` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env.local`, build env | Public by design — RLS still governs every request it makes |
| User passwords | Supabase Auth | Never stored, hashed or handled by this application |
| Session tokens | httpOnly cookies | Managed by `@supabase/ssr`; never read into application state |

`.gitignore` excludes `.env*` apart from `.env.example`, which contains placeholder names only.
No authenticated Playwright storage state is ever committed.

---

## Audit trail

`activity_logs` records actor, action, entity type and id, subject, outcome, a small metadata
object and a timestamp.

- **Append-only for application roles**: they hold `SELECT` and `INSERT` grants and nothing else.
  There is no `UPDATE` or `DELETE` policy, so entries cannot be rewritten through the API.
- `actor_id = auth.uid()` is enforced by policy, so an action cannot be attributed to someone
  else.
- Reads are scoped: admins see everything, managers see their own team's activity, everyone sees
  their own.
- `sanitizeMetadata` drops any key containing `password`, `token`, `secret`, `key`, `auth`,
  `cookie`, `session` or `credential`, truncates long strings, caps arrays and discards nested
  objects — so the audit trail cannot become a secondary store of credentials or bulk personal
  data.

---

## Transport and browser hardening

Set in `next.config.ts` for every response:

| Header | Value |
|---|---|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), interest-cohort=()` |

`poweredByHeader` is disabled. `robots: noindex, nofollow` — this is an internal tool.

Redirect targets from `?next=` and the auth callback are restricted to in-app paths, so neither
can be turned into an open redirect.

---

## Privacy defaults

Deliberately **not** implemented:

- IP address logging
- Location or GPS tracking
- Webcam, screenshot or keystroke monitoring
- Any covert monitoring whatsoever

Data minimisation: profiles hold only what onboarding needs. Missing daily reports are reported
as *missing reports* — the interface never presents an absent report as evidence that no work
happened.

If location or IP controls are ever added, they must be transparent, configurable and covered by
a privacy notice.

---

## Known limitations

| Limitation | Status |
|---|---|
| Rate limiting on authentication | Relies on Supabase Auth's built-in limits. Add provider-level or edge rate limiting before public exposure |
| Column-level permissions inside a sheet | Not implemented. Version 1 uses sheet-level and record-level permissions only, and sensitive fields needing separate visibility must not be stored in `row_data`. Fine-grained column permissions are a Version 3 item and must be built with server-side projections or restricted database functions — never by hiding JSON fields in the UI |
| Multi-factor authentication | Version 3 |
| Private file storage | Version 2, with Supabase Storage policies and signed URLs |
| Contact-data exfiltration controls | Interns have no bulk export. Watermarking and stronger leak controls are Version 3 |
