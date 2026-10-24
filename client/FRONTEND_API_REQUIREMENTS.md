# Frontend API requirements: teacher monitoring

## Verified Stage 5 integration

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
teacher selection and the admin teacher-scoped management UI remain deferred.
General admin user/teacher directories,
individual teacher attempt/report access, per-experiment analytics and experiment
CRUD remain missing. Lists accept page/limit only; no fuzzy search or class model
is provided. Enrollment progress averages completed attempts, not best-per-experiment
scores. Do not substitute student-only history/report routes.

The original requirements below describe broader future functionality and are
partially satisfied by this contract; unsupported portions remain proposals.

## Contracts to agree before enabling features

The following are requirements, not implemented routes or agreed endpoint names.
Backend owners must define paths, request/response schemas and authorization.
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
  `resourceType`, `resourceId`, metadata, IP and user-agent. The UI displays action,
  time and actor/resource IDs without assuming resolved names or live streaming.
- `POST /api/admin/users` accepts firstName/lastName (nonempty), email, password
  (minimum 12 characters) and role (`student`, `faculty`, `admin`); returns 201
  `{ user: { id, firstName, lastName, email, role, isActive } }`. The UI defaults
  to student, validates required inputs, reviews role/identity before submitting,
  hides the password, prevents repeat submissions and clears it after the request.
  Success uses only the returned account and refreshes overview queries. Account
  creation does not imply invitation delivery or class enrollment.
- `PATCH /api/admin/users/:id` accepts optional role and/or isActive (at least
  one), returns `{ user }`, and records an audit event. Stage 6 does not call it:
  there is no reliable user directory/lookup flow to identify an existing target.
- Authenticated `GET /api/experiments` is permitted for admins and returns the
  published catalogue; it excludes drafts, archived entries and management actions.
  Student-protected frontend detail/workspace routes are not linked from admin UI.

### Missing admin user listing and detail contracts

Agree admin-only paginated directory and ID lookup, authoritative identity/role/
active-state fields, supported role/status/search filters, stable sort, timestamps
and total/cursor metadata. Specify invalid IDs, duplicates, forbidden/not-found
responses and refresh behavior. Do not infer a user directory from audit actors.
Before enabling PATCH controls, agree self-demotion/deactivation and last-admin
safeguards, concurrency handling and intentional confirmation of privilege changes.
No GET user listing route is assumed or requested by Stage 6.

### Missing teacher management contracts

Agree faculty-filtered directory/details, authorized cohort/class assignments,
enrollment relationships and supported assignment mutations. Define whether teacher
account creation alone has any teaching scope (none is inferred by the UI).
Existing admin creation supports role faculty. Separate teacher-scoped enrollment
APIs now establish a single student-teacher relationship; the frontend teacher
selection and enrollment flow remains unimplemented. Class/cohort models are not supplied.

### Missing experiment management contracts

Agree admin-only list/detail access across published/draft/archived statuses,
authoritative experiment schema, validation and permitted fields. Specify creation,
editing, publishing and archival operations; version/concurrency rules; references
to historical attempts/reports; audit behavior and safe allowed lab profiles.
No frontend write should supply arbitrary lab images, commands or infrastructure
configuration. Existing catalogue data is read-only; no CRUD routes are assumed.

### Missing complete audit search

For activity beyond the most recent 20, agree admin-only server pagination,
action/actor/resource/date filters, deterministic ordering and retention policy.
The current client-side filters apply only to the fetched snapshot.


## Final delivery boundary

Implemented API consumers are the student dashboard/history, published catalogue
and detail, existing lab/task/quiz/report flows, faculty/admin aggregates and admin
account creation, faculty enrollment/list/detail/removal and student own enrollment.
PATCH user updates remain unexposed without reliable target
selection. All requirements above are pending unless listed as a verified existing
route; proposed contract descriptions do not imply server implementations.
See `FRONTEND_DELIVERY_REVIEW.md` for test evidence and environment limitations.
See `../docs/STAGE4A_ENROLLMENT_UI.md` for current local enrollment acceptance.
