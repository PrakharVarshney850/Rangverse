# Roadmap

## Version 1 — shipped

The working MVP.

- **Identity** — invite-only email/password auth, secure sign-out, forgot/reset password,
  session restoration, protected routes, sign-in activity history, three roles, onboarding
  lifecycle (`INVITED → PROFILE_INCOMPLETE → ACTIVE → PAUSED / COMPLETED / OFFBOARDED`),
  interactive first-administrator bootstrap.
- **Attendance** — clock in/out, breaks, server-authored timestamps, net working time, sessions
  crossing midnight, anomaly flagging, idempotent transitions, recent history.
- **Tasks** — create, assign, update, status workflow, deadlines, filter by status / priority /
  assignee / due window, title search, sorting, pagination, overdue detection, comments.
- **Task timers** — one running timer per person, bound to an open session, blocked during a
  break, closed automatically on clock-out, per-task history.
- **Daily reports** — draft and submit, linked tasks, evidence links, manager review with
  attributed feedback, report history, missing-report visibility.
- **Data Hub** — configurable sheets with typed columns, two-layer permissions (membership plus
  record assignment), search, sort, pagination, record create/edit, attribution, four starter
  templates, administrator access management.
- **Dashboards** — intern, manager and administrator overviews computed from authorised data.
- **Reports** — hours and delivery with date-range selectors and explained metrics.
- **Audit** — append-only activity history scoped by relationship.
- **Quality** — 123 unit/RLS/integration tests, 54 public browser tests with axe, strict
  TypeScript, CI.

---

## Version 2 — planned

Items already visible in the interface as disabled entries labelled `v2`, plus the rest.

### Time corrections and approvals
- Manual time-correction requests with a reason
- Manager approval or rejection, preserving the original event
- Weekly timesheet submission and approval
- **Optional** automatic clock-out: configurable, **disabled by default**, must preserve the
  original event history and record the reason for a system-generated closure

### Leave and requests
- Leave requests and an approval workflow
- Attendance calendar with holidays
- The `Leave and requests` navigation entry becomes live

### Notifications
- Email and in-app notifications
- Deadline reminders
- Announcements

### Resources
- Resource library backed by Supabase Storage with private buckets, storage policies and signed
  URLs
- Task attachments
- The `Resources` navigation entry becomes live

### Data Hub
- CSV import
- **Scoped** CSV export — never unrestricted contact-data export for interns
- Bulk record assignment

### Reporting
- Expanded reports and saved views
- Improved audit-history browsing and filtering

**Dependencies.** Storage work needs bucket policies designed alongside the existing RLS model.
Notifications need a mail transport decision (Supabase Auth emails are transactional only).

---

## Version 3 — planned

### Analytics
- Advanced team analytics
- Excel and PDF exports

### Documents
- Certificate and offer-letter generation

### Security
- Optional multi-factor authentication
- Fine-grained sensitive-column permissions — **must** be built with server-side projections,
  database views or restricted functions. Hiding a JSON field in the interface is not a
  permission and will not be accepted as one.
- Stronger contact-data leak controls and watermarking

### Integrations
- Google Sheets sync
- WhatsApp notifications via an authorised business API
- Advanced business-data import tooling

**Dependencies.** Column-level permissions require a redesign of how `row_data` is projected;
the current JSONB model is deliberately scoped to sheet-level and record-level permissions.

---

## Deliberately out of scope

Not "later" — **not planned**, because they conflict with the product's principles:

| Excluded | Why |
|---|---|
| Public self-registration | Rangverse is invite-only by design |
| Performance scores or leaderboards | An unvalidated productivity metric does more harm than good |
| GPS or location tracking | Surveillance, not management |
| Webcam, screenshot or keystroke monitoring | Same |
| Covert monitoring of any kind | Same |
| Treating a missing report as proof of no work | The interface reports a missing report as exactly that |

If location or IP controls are ever introduced, they must be explicit, configurable and covered
by a privacy notice.

---

## Open decisions

| Decision | Notes |
|---|---|
| Mail transport for notifications | Supabase Auth covers transactional auth mail only |
| Hosting region | `ap-south-1` recommended for an India-based team |
| Retention policy for offboarded profiles | Currently indefinite, so hours stay attributable. Needs a documented retention period |
| Rate limiting beyond Supabase defaults | Edge rate limiting in front of `/login` before wider exposure |
| Whether managers should see draft reports | Currently no, deliberately — drafts are private until submitted |

---

## Extending without replacing the foundation

The structure is designed so later versions add rather than rewrite:

- **New entity** → a migration with RLS + grants, a `lib/data` reader, a `lib/actions` writer, a
  `lib/validation` schema, and an RLS test covering allowed and denied.
- **New permission** → add it to `PERMISSIONS` in `lib/auth/permissions.ts` *and* to the policy
  that enforces it. The interface model and the database must stay in step.
- **New navigation item** → add it to `lib/navigation.ts` with its `permission`, or with
  `comingIn: "v2"` to render it as a labelled, inert entry.
- **New time rule** → put it in `lib/domain/time.ts` as a pure function with unit tests, then
  mirror it in a database constraint or trigger.
