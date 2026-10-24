# Frontend API integration status and remaining requirements

## Stage 6 admin delivery and account-write blocker

Implemented locally: admin-only `GET /api/admin/users`, `GET /api/admin/users/:id`
and `GET /api/admin/audit-events`; paginated user/name/exact-email/role/status
filters, safe account detail, teacher listing and existing explicit teacher-cohort
GET/POST/DELETE UI, plus full server-side audit filtering. The overview's newest
20 events remain a separate labeled sample. Metrics/audits refresh after cohort
mutations; those existing enrollment APIs do not create audit events.

**Account creation and role/status submission are disabled.** The reviewed
POL-ADMIN-1 atomicity prerequisite is unmet: actual local MongoDB is standalone,
and no shared serialization guard/version/audit transaction service is approved
or deployed. POST/PATCH fail closed with 503; duplicate existing email returns
409, self-demotion/deactivation 409, invalid input 400. No successful account
mutation is claimed. Directory/detail expose `management.writesAvailable:false`
and `managementVersion:null`, not an invented persisted version.

See [Stage 6 report](../docs/STAGE6_ADMIN_MANAGEMENT.md) for exact delivered
contracts, real validation, tests and the work required before enabling writes.

## Stage 5 implementation status (local takeover)

Teacher academic monitoring is now connected on `/teacher` and `/faculty`:

- `GET /api/teacher/students/:studentId/attempts`: owned student history,
  status/exact experiment/date filters and server pagination.
- `GET /api/teacher/students/:studentId/reports`: owned report metadata and
  genuine PDF availability, exact experiment/date filters and pagination.
- `GET /api/teacher/students/:studentId/reports/:reportId/download`: separately
  authorized PDF download; no teacher report generation.
- `GET /api/teacher/analytics/experiments`: current-cohort and experiment
  participation/completion, recorded points, known-max normalized scores and
  pagination. Exact `/api/faculty` aliases are provided.

These routes require the stored `faculty` role; admin does not impersonate a
teacher. Existing student-only attempt/report routes remain student-only.
See [Stage 5 delivery and exact implemented semantics](../docs/STAGE5_TEACHER_MONITORING.md)
for ownership, score denominators, real API/browser validation and limitations.
Immutable task/assessment snapshots are still absent: historical required-task
totals and percentages remain unknown; valid persisted reports supply score maxima.

## Stage 4B review: remaining proposals

The exact remaining API proposal and implementation gates are in
[STAGE4B_API_IMPLEMENTATION_PLAN.md](../docs/STAGE4B_API_IMPLEMENTATION_PLAN.md).
It supersedes the open-ended future requirements below where it defines a
specific proposal. Stage 4A enrollment is already implemented and must not be
rebuilt. The Stage 5 teacher reads above are implemented under the Stage 5 request;
Stage 6 admin reads/cohort UI are implemented as listed above. Other proposals
retain their separate approval gates.

Remaining necessary proposals: approved atomic account management, persisted
management versions, category projection and
truthful additive score/progress fields on existing student reads. Student-only
attempt/report APIs stay student-only; admin teacher enrollment keeps explicit
teacher-scoped routes. PATCH now rejects self-demotion/deactivation and fails all
other account updates closed. A successful versioned writer preserving the global
last-admin invariant still requires the approved atomic design; it is not deployed.

Optional: name-only self-service profile correction and limited admin editorial/
status management if the demo scope explicitly requires them. Full assessment
authoring, new lab configuration and password recovery are outside this plan.
Remaining student `%` and `/100` displays must not be mistaken for verified
normalized scores: the current backend records raw points, including 75-point
experiments. Historical maxima must come from persisted reports or approved
attempt snapshots, not today's mutable experiment definition.

## Verified faculty overview contract

`GET /api/faculty/dashboard` is used by the frontend. The backend also exposes
`GET /api/teacher/dashboard` as an alias. Both require an authenticated `faculty`
or `admin` role. The UI preserves `/teacher` and `/faculty` and existing guards.

```ts
{ metrics: { students: number; completedAttempts: number; averageScore: number; reports: number } }
```

- `students`: active enrolled students for faculty; active students platform-wide for admin.
- `completedAttempts`: all completed attempts, including repeat experiments.
- `averageScore`: rounded mean recorded score of completed attempts, or zero when empty; not a normalized percentage.
- `reports`: count of report records.

After local integration, faculty requests are scoped to currently enrolled students;
admin requests retain platform-wide aggregates. The student count includes active
enrolled accounts; attempts, scores and reports include enrolled inactive students
and history before enrollment. There are
no student rows, experiment breakdowns, report identifiers or enrollment actions
in this response. Enrollment data is requested separately through the routes below.
Existing attempt, student-history and report routes are student-only; teacher
screens must not reuse them to request another student's records.

## Local integration contract update

`docs/student-enrollment.md` is now authoritative for the implemented enrollment
contract. Teacher/faculty list, aggregate student detail, enrollment by ID/exact
email and removal are implemented. Admin equivalents require an explicit teacher
ID; faculty endpoints do not accept admin impersonation. Student own-enrollment
lookup is implemented at `GET /api/student/enrollment`.

Stage 4A connects the faculty-only student list (page/limit), enrollment by exactly
one selector, student aggregate detail and confirmed removal on `/teacher` and
`/faculty`. Student Profile consumes the own-enrollment endpoint, including
unassigned, inactive and unavailable-teacher states. These are implemented UI
features, not missing enrollment APIs. The list requests ten students per page;
there is no fuzzy search. Successful mutations invalidate the list, student
details, faculty metrics and any cached student enrollment. Removed detail data
is evicted. A student in another browser context can use Refresh enrollment or
return focus to refetch; no cross-browser push synchronization is assumed.

Admins viewing Teacher Portal never call faculty-only enrollment routes. Explicit
teacher selection and teacher-scoped management are now on the admin page.
Admin user/teacher directories are implemented; experiment CRUD remains missing.
Individual teacher attempt/report access and experiment analytics are now implemented
as listed above. Enrollment lists accept page/limit only; the new academic reads
also support their documented exact filters. No fuzzy search or class model
is provided. Enrollment progress averages completed attempts, not best-per-experiment
scores. Do not substitute student-only history/report routes.

The original requirements below describe broader future functionality and are
partially satisfied by this contract; unsupported portions remain proposals.

## Historical requirements and remaining extensions

The following is the original broader requirements inventory. Stage 4A enrollment
and Stage 5 teacher reads satisfy their respective portions; additional search,
class/invitation, snapshot and admin capabilities remain proposals.
Use existing cookie authentication; teacher UI cannot grant itself access.

### Student listing

- Authenticated faculty/admin access with an explicit authorized cohort scope;
  clarify whether any role may access all students.
- Stable student ID, name, email, active status and authoritative enrollment/cohort
  metadata where supported. Never infer enrollment from an email address.
- Server pagination with stable ordering, supported search/status/cohort filters,
  total or cursor metadata, and clear empty results.
- Define summary counts (distinct experiments versus attempts), score denominator,
  time range and visibility rules. Do not expose secrets or unnecessary personal data.

### Student detail and monitoring

- Student ID as the lookup key; enforce authorization and scope on every request.
- Authorized identity/enrollment details, experiment-level completion, attempt IDs,
  statuses, scores/maximum marks, start/completion timestamps and report availability.
- Paginated attempt history, documented sort order, deleted/unpublished experiment
  behavior and any supported time filters.
- Partial task completion requires authoritative completed/total task fields;
  experiment completion alone cannot stand in for task percentages.
- Consistent not-found/forbidden and failed-request behavior; no unauthenticated
  fallback or data from a different student.

### Student enrollment

- Confirm which faculty/admin roles can enroll into which cohorts and who creates
  accounts. Define required fields, approved student identity and enrollment states.
- Define validation, duplicate-account/enrollment handling, invitation/activation
  lifecycle if supported, idempotency and authorized success/error responses.
- Student role must be enforced server-side; never accept unrestricted role changes.
- Document audit behavior and permissions for any future deactivation/removal.
- The original Stage 5 had no enrollment controls. Stage 4A now implements only
  the existing single-teacher assignment contract; no invitation/class lifecycle
  or student account creation is inferred.

### Experiment performance

- Authorized scope and optional time/cohort filters, stable experiment ID/title,
  attempted/completed student counts, attempt count and score aggregates.
- Specify repeat-attempt handling, score scales, empty values, date boundaries and
  denominators before showing percentages or comparison charts.

### Teacher reports

- Teacher-authorized paginated report metadata: report/attempt/student/experiment
  identifiers, titles, timestamps, score/maximum marks and genuine availability.
- An agreed teacher-authorized download contract with ownership/cohort checks,
  unavailable/expired behavior and permitted file types.
- Listing/count access must not imply permission to download every report.

## Shared response conventions

Agree field nullability, ISO timestamps, pagination, validation errors and 401/403/
404 handling. Coordinate shared API type changes separately. Loading, error,
empty and pending-integration states must stay distinct; do not replace missing
contracts with fabricated records, charts or successful mutations.


## Stage 6: admin overview and management

Verified existing admin-only routes, protected by session authentication and
`allowRoles('admin')`:

- `GET /api/admin/dashboard` returns `{ metrics: { users, activeStudents, attempts },
  events }`. Users counts all accounts; activeStudents counts active student
  accounts; attempts counts all attempt records. Events are the newest 20 by
  creation time, with `_id`, `action`, `createdAt` and optional `userId`,
  `resourceType` and `resourceId`. Stage 6 removes raw metadata/IP/user-agent
  from this response. The UI displays action,
  time and actor/resource IDs without assuming resolved names or live streaming.
- `POST /api/admin/users` validates strict firstName/lastName (trimmed 1..60),
  exact email (max 254), password (12..128) and role (`student`, `faculty`, `admin`).
  Existing-email duplication is 409; otherwise valid creation is currently 503.
  The unsafe create-then-audit writer is closed under POL-ADMIN-1. The retained
  form is disabled in the admin page and requests no initial credentials.
- `PATCH /api/admin/users/:id` requires optional role and/or isActive (at least
  one) and integer expectedManagementVersion >= 0, with no other fields/query.
  Self-demotion/deactivation is 409; all other valid existing-target updates,
  including no-ops, are currently 503. Invalid data is 400; missing account 404.
  No version matching, successful mutation or success audit is invented.
- Authenticated `GET /api/experiments` is permitted for admins and returns the
  published catalogue; it excludes drafts, archived entries and management actions.
  Student-protected frontend detail/workspace routes are not linked from admin UI.

### Delivered admin user listing and detail; pending account writes

Directory and lookup now use U1/U2 filters and safe DTOs, ID-ascending sort and
page/limit/total. Teacher role remains `faculty`; users are not inferred from audit
actors. Account-change review is available, but Apply is disabled. Approve and
implement shared transaction serialization, persisted versions, audit rollback and
enrollment-race coordination before enabling guarded account writes. A count or
process-local lock is not sufficient. See the Stage 6 report for precise limits.

### Delivered explicit teacher-cohort management

Filter the directory to faculty, select an actual account and use the existing
`/api/admin/teachers/:teacherId/students` list/enrollment and child detail/removal
routes. Confirm removal explicitly; do not transfer ownership implicitly. Inactive
teachers permit reviewing/removing assignments, not new enrollment. No class,
invitation, admin academic-report or teacher impersonation feature is inferred.

### Missing experiment management contracts

Agree admin-only list/detail access across published/draft/archived statuses,
authoritative experiment schema, validation and permitted fields. Specify creation,
editing, publishing and archival operations; version/concurrency rules; references
to historical attempts/reports; audit behavior and safe allowed lab profiles.
No frontend write should supply arbitrary lab images, commands or infrastructure
configuration. Existing catalogue data is read-only; no CRUD routes are assumed.

### Delivered complete stored-audit search

`GET /api/admin/audit-events` now provides independent server pagination, exact
action/actor/resource/date filters and createdAt/ID-descending ordering. Only safe
structured changes are returned; raw Mixed metadata/IP/user-agent are excluded.
The older client-side snapshot filters remain under an explicitly labeled overview
sample and do not filter the full stored collection. No retention deletion is added.


## Final delivery boundary

Implemented API consumers are the student dashboard/history, published catalogue
and detail, existing lab/task/quiz/report flows, faculty/admin aggregates,
faculty enrollment/list/detail/removal and student own enrollment. The retained
admin creation form is now disabled under the account-management gate.
Stage 5 adds teacher student-history/report metadata/PDF reads and cohort experiment
analytics through the faculty-only endpoints listed at the top of this document.
User directory/detail, admin teacher-cohort controls and full audit search are now
implemented. Account creation and PATCH submission remain blocked by the reviewed
atomic-management prerequisite despite reliable selection now existing.
All requirements above are pending unless listed as a verified existing
route; proposed contract descriptions do not imply server implementations.
See `FRONTEND_DELIVERY_REVIEW.md` for test evidence and environment limitations.
See `../docs/STAGE4A_ENROLLMENT_UI.md` for current local enrollment acceptance.
See `../docs/STAGE5_TEACHER_MONITORING.md` for teacher academic monitoring acceptance.
See `../docs/STAGE6_ADMIN_MANAGEMENT.md` for current admin acceptance and blockers.
