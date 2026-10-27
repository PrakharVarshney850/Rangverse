# Rangverse project and deployment context

This document is a handoff of the project and deployment context gathered during
the Rangverse hosting and testing discussion. It contains no passwords, API keys,
tokens, or contents of local environment or credential files.

## Project overview

Rangverse is Rangmanch's internal workspace for interns, attendance, tasks,
daily reports, teams, and permission-scoped business data.

- Framework: Next.js App Router, Next.js 16.4.0, React 19, TypeScript strict.
- Styling: Tailwind CSS 4.
- Backend: Supabase Auth and PostgreSQL.
- Hosting target: Vercel.
- Domain provider: GoDaddy; the user owns a `.in` domain. The exact domain name
  has not been provided here.
- Repository: `PrakharVarshney850/Rangverse`.
- Working directory used in this session: `C:\Rangverse\Rangverse`.
- Git state observed while preparing this document: clean worktree on `main`,
  commit `484306c` (`fixes in the authentication`).

Architecture and security conventions are documented in the root `AGENTS.md`
and repository docs. The database is the authorization boundary: keep RLS,
privilege triggers, and least-privilege grants in migrations. The service-role
key must stay server-only and must only be used after explicit authorization.
Do not enable public self-registration.

## Current hosting/backend context

### Supabase

The Supabase dashboard screenshot supplied in the conversation showed:

- Project region: **Oceania (Sydney)**.
- Organization plan: **Free**.
- Compute: **Nano**.
- No migration and no backup were shown on the project overview at that time.
- The project General Settings page displayed Sydney as its region. That page
  does not provide an in-place region switch.
- Security Advisor displayed a warning that leaked-password protection was
  disabled. The dashboard assistant said this protection requires Pro or higher.

The configured project URL was checked without displaying keys or credentials;
it referred to the same Supabase project shown in the supplied dashboard. No
authenticated E2E credentials were configured in the inspected process.

For an India-based user group, Mumbai (`ap-south-1`) is the preferred database
region when creating a new project if Supabase offers it in the region picker.
Do not assume the generic “Asia-Pacific” region choice means Mumbai: confirm the
specific region after project creation.

Supabase projects cannot normally be moved between regions by changing the
existing General Settings region field. To move to Mumbai, create a new project
in the target region, apply the repository migrations, create the initial admin,
update application environment variables, and verify the new app before
retiring the old project. Auth users/passwords are not automatically copied by
applying SQL migrations. Preserve any data that must be retained using a planned
backup/migration.

The project’s database API configuration should follow the repository's least
privilege approach:

- Data API must remain enabled for this `supabase-js` application.
- “Automatically expose new tables” should be off; define grants and policies
  explicitly in migrations.
- Automatic RLS can be a helpful additional safeguard, but does not replace
  explicit policies, grants, forced RLS, or RLS tests. Verify the actual setting
  in the Supabase dashboard; this document does not assert which value was saved.

### Vercel and GoDaddy domain

The app's required production environment variable names are defined in
`src/lib/env.ts` and `docs/deployment.md`:

| Variable | Purpose | Handling |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Public config |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable/anon key | Public config; RLS still protects data |
| `NEXT_PUBLIC_SITE_URL` | Exact canonical deployed origin, including `https://` | Must match the chosen domain; used for auth links |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side administrative Supabase access | Secret; never add `NEXT_PUBLIC_` |

Recommended deployment sequence:

1. Decide whether production will use the existing Sydney Supabase project or a
   newly created Mumbai project. Do not mix the two projects' keys.
2. Ensure code is pushed to GitHub and checks pass. Check `git status --short`
   before staging; never commit `.env.local`, `usernamepassword.txt`, or other
   credential files.
3. If using a new Supabase project, link the Supabase CLI to its exact project
   ref and run `npx supabase db push` after verifying the target. For a new empty
   production project, create its initial admin with
   `npm run db:bootstrap-admin`; do not rerun this if an admin already exists.
4. Import `PrakharVarshney850/Rangverse` in Vercel. Keep the root directory at
   the repository root, use the Next.js framework preset, and use `main` as the
   production branch.
5. Add the four environment variables above in Vercel. Use the production
   Supabase project's values only in Production. Prefer a separate staging
   project for Preview deployments; never unintentionally connect Preview
   builds to production data.
6. Deploy first to the default `vercel.app` URL and smoke-test login, overview,
   tasks, time, reports, and callback links.
7. In Vercel project **Settings → Domains**, add the apex `.in` domain and
   optionally `www`. Follow the exact DNS records Vercel displays for this
   project; values can vary, so do not copy guessed A/CNAME values from another
   deployment.
8. In GoDaddy DNS management, update only conflicting website records needed
   for Vercel. Preserve MX and mail-related TXT records if the domain is used
   for email.
9. Wait for Vercel to report a valid domain configuration and active HTTPS.
   Choose one canonical host (apex or `www`) and redirect the other to it.
10. Set Vercel's `NEXT_PUBLIC_SITE_URL` to that exact canonical HTTPS origin,
    then redeploy.
11. In Supabase Auth → URL Configuration, set the Site URL to the canonical
    origin and allow the exact callback URL:
    `https://YOUR-DOMAIN.in/auth/callback`. Add the `www` callback too only if
    that host is intentionally used for auth redirects.
12. Verify auth links, invite/password reset email delivery, permissions, and
    the production domain. Do not run mutation-heavy authenticated browser tests
    against production.

For India, placing Vercel Functions near the Supabase database can reduce
server-to-database round trips. Vercel lists Mumbai as `bom1`. If Supabase
remains in Sydney, moving compute to Mumbai does not eliminate the database
network distance; the database region is the key decision. Confirm availability
and plan constraints in the current Vercel dashboard.

Primary repository guides: `docs/deployment.md` and
`docs/SETUP-GUIDE-HINDI.md`.

## Performance evidence and interpretation

The user supplied logs from `npm run dev`, with examples including:

- Initial `/login`: 13.6 seconds, including 12.5 seconds of Next compilation.
- `/overview`: about 4.9–20.5 seconds in different requests.
- `/tasks`: about 4.1–23.1 seconds in different requests.
- `/time`: about 2.0–16.1 seconds in different requests.
- Server actions such as clock-in, break start/end, and clock-out took about
  1.7 seconds each in the displayed log.
- Proxy and application-code durations varied significantly between requests.

These are development-mode timings. First-request compilation, Turbopack,
browser extensions, and dev HMR affect them, so they are not production
benchmarks and do not by themselves prove Supabase is the sole bottleneck.
Repeated auth/database calls and the Sydney region can contribute. Measure a
production deployment with extensions disabled and inspect Vercel function
duration, Supabase request/query timing, and browser document/API timing
separately.

The browser console messages shared included a `content.js` CSP `unsafe-eval`
violation and an `HTMLMediaElement.play()` `AbortError`. The CSP message
referenced a Chrome extension origin and was likely extension-injected, not
proof of an app defect. The media abort can occur when playback is paused before
the play promise resolves; its source was not established. Recheck in a clean
browser profile with extensions disabled before attributing either message to
Rangverse.

## Test status and limitations

Repository test commands are documented in `package.json` and
`docs/testing.md`:

- `npm run verify`: lint, typecheck, unit/RLS/integration tests, and production
  build.
- `npm run test:e2e`: Playwright desktop and mobile suites.
- Database RLS/integration tests use PGlite and do not require a live Supabase
  project.

Most recent test results observed in the conversation on 2026-10-28:

- `npm run verify`: passed; 253 tests across 13 files and production build
  succeeded after adding the administrator report-submission regression case.
- `npm run test:e2e`: 54 passed, 28 skipped, 0 failed against the local app.
- Authenticated E2E skips were deliberate: E2E credentials were unset to avoid
  mutation-heavy tests against the connected Supabase project.
- A prior run against a staging server was reported as 78 passed, 4 skipped,
  0 failed. That run changed staging data (attendance events and a test report).
  It is historical evidence, not a result re-executed while creating this
  document.

The authenticated Playwright suite mutates data, including attendance and
daily reports. Run it only against an isolated staging Supabase project with
dedicated test users and fixtures. Do not put credentials in chat or source
control; use local process environment variables or CI secrets.

Passing these checks does not prove every feature works in production. The
repository's documented limitations include:

- Invitation and password-reset email delivery require a real mail transport
  and are not fully asserted end to end by local tests.
- Authenticated admin/user-management, manager report review, and sheet
  administration do not all have full browser E2E coverage.
- Automated accessibility scans cover only selected screens; manual keyboard
  and screen-reader testing remains useful.
- No load/concurrency test has been run.
- Production behavior depends on correct environment configuration, migrations,
  DNS, SMTP, Supabase policies, and plan availability.

During the fresh audit, two follow-ups were identified but not changed:

1. Some reads in `src/lib/data/people.ts` ignore Supabase `error` and can return
   empty-looking results instead of clearly surfacing a database failure.
2. `saveDailyReportAction` in `src/lib/actions/reports.ts` updates the report
   and then replaces task links in separate database operations. A partial
   failure can leave the report and links inconsistent; task-link deletion
   errors are not checked. This should be reviewed and made atomic or handled
   with an appropriate database transaction/RPC before relying on failure
   recovery.

## Account and secret hygiene

- A real password was shared in the conversation previously. Treat it as
  compromised and rotate it. The replacement must not be shared in chat.
- A local `usernamepassword.txt` file was mentioned and was added to `.gitignore`
  in an earlier session. Ignore rules do not delete the file or remove it from
  any prior commit. Delete it after securing anything needed in a password
  manager, and check repository history if it was ever committed.
- `.env.local` contains local Supabase configuration. Do not display or copy its
  values into documentation or commit it.
- If a service-role key or other secret was exposed, rotate it in Supabase and
  update Vercel/local environments securely.

## External references consulted

- Vercel: [Add and configure a custom domain](https://vercel.com/docs/domains/working-with-domains/add-a-domain)
- Vercel: [Deployment environments](https://vercel.com/docs/deployments/environments)
- Vercel: [Global network and regions](https://vercel.com/docs/regions)
- Vercel: [Hobby plan](https://vercel.com/docs/plans/hobby)
- Supabase: [Auth redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- Supabase: [Billing and plans](https://supabase.com/docs/guides/platform/billing-on-supabase)
- Supabase: [Production checklist](https://supabase.com/docs/guides/deployment/going-into-prod)
