# Stage 4B: remaining API contracts and local implementation plan

Review date: 2026-10-24. Branch: `integration/local-takeover`.
Reviewed HEAD: `d9ed56e306c6082222b3435f5524fa2fd0f95e0a`.
**Design proposal for review, not implemented or approved endpoint behavior.**
Stage 4A enrollment remains complete and unchanged. No application, schema,
database, infrastructure, authentication or remote changes are made in Stage 4B.

## 1. Verified current surface

The source, rather than old pending-integration text, is the authority for this
inventory. Relevant evidence: `server/src/routes/*`, the corresponding
controllers, `models/{User,Attempt,Report,Experiment,AuditEvent,LabSession}.ts`,
`services/{enrollmentService,reportService,labEngine}.ts`, and the frontend pages,
enrollment hooks and API client.

| Existing capability | Current contract and limitation |
| --- | --- |
| Teacher enrollment | Faculty-only `/api/teacher/students` GET/POST and `/:studentId` GET/DELETE; exact `/api/faculty/students` aliases; pagination and aggregate progress; connected in Stage 4A. Do not recreate it. |
| Admin enrollment | Explicit `/api/admin/teachers/:teacherId/students` and child routes already exist. Missing admin teacher-selection UI can reuse a future faculty-filtered user directory. |
| Own assignment | Student-only GET `/api/student/enrollment`; connected to Profile, independent of the unchanged public auth user shape. |
| Faculty overview | GET `/api/faculty/dashboard` and `/api/teacher/dashboard`: current enrolled cohort for faculty, platform-wide for admin. Active students counted separately; academic totals include inactive enrolled students and pre-enrollment work. |
| Student records | Student-only GET `/api/student/history`, GET `/api/attempts/:id`, GET `/api/student/dashboard`; own IDs enforced. No faculty attempt-history authorization is currently provided. |
| Reports | Student-only GET `/api/reports/:id`, GET `/:id/download`, POST `/api/reports/attempts/:id/generate`; owned report/completed-attempt checks. Teacher report count is not download permission. |
| Admin users | POST `/api/admin/users` creates accounts and audits it; PATCH `/api/admin/users/:id` changes role/isActive and audits it. No GET directory/lookup and no self/last-admin guard or optimistic concurrency in current PATCH. UI does not expose PATCH. |
| Admin overview/audit | GET `/api/admin/dashboard` returns counts and newest 20 audit documents. UI filtering affects only that snapshot, not a server search. |
| Catalogue | Authenticated GET `/api/experiments` returns all published summaries; projection omits category despite `Experiment.category` existing. GET `/:id` includes detail, excluding correct answers. No admin CRUD routes. |
| Account/auth | Password login/register, GET `/api/auth/me`, logout, Google login/callback and explicit linking exist. Current DB role/active status is checked on protected requests. No profile edit/password change/reset APIs. |

### Findings that affect the contracts

1. `Attempt.score` and dashboard averages are **raw points**, not percentages.
   The validated Nmap result is 75/75. Stage 4A corrected the faculty overview,
   but StudentDashboard/Progress/History still use `%` or `/100`; fix those as
   frontend correctness work, without silently changing existing numeric fields.
2. Attempt stores results, currentTaskIndex and score, but **no immutable maximum
   marks, task-count or experiment-version snapshot**. Report stores score,
   totalMarks, quizScore and filePath. Current Experiment definitions must not be
   substituted for historical assessment maxima after changes.
3. History's `reportAvailable` currently means a matching DB record, not proof
   that a safe readable PDF exists. A download can correctly return 404 afterward.
4. The current admin PATCH can deactivate/demote its own caller and lacks an
   active-admin invariant. This is an existing enforcement gap, not a missing
   endpoint. It was inspected, not exercised against real admin accounts.
5. Audit metadata is Mixed and the admin overview returns raw lean audit rows.
   A new search contract must explicitly project safe metadata, not serialize
   arbitrary nested values, credentials or filesystem/runtime configuration.
6. The checked-in Compose setup does not configure a replica set; do not assume
   multi-document transactions are available on the current local MongoDB.
   No topology change is authorized here.

## 2. Priority and explicit non-goals

| Priority | Necessary implementation for the remaining multi-role demo |
| --- | --- |
| N1 | Teacher-owned student attempt history and report metadata/download; keep student endpoints student-only. |
| N2 | Cohort/per-experiment participation and score breakdown, using existing data; existing dashboard remains the overview. |
| N3 | Admin paginated directory and ID lookup. Safe-update enforcement is mandatory before the already-existing PATCH is exposed. |
| N4 | Admin paginated audit filtering, separate from the compatible dashboard snapshot. |
| N5 | Include actual catalogue category; correct student score units and expose truthful supported progress fields. |
| N6 | Use existing auth/profile/own-enrollment for the essential account demo. No new account-write API is required. |

Optional, separately approved: self-service name corrections (O1); admin catalogue
visibility/editorial/status management (O2). **Experiment management is not a
demo prerequisite**: seeded published content and read-only admin catalogue
already support the validated practical. Full assessment authoring, new lab
profiles, invitations/classes, fuzzy teacher student search, teacher report
generation, password recovery, OAuth unlink and session-architecture redesign
are not included. Do not expose placeholder routes as though they exist.

## 3. Common proposed wire rules

These rules apply to new APIs below; existing callers keep their current shapes
unless an explicit additive extension or coordinated PATCH change is specified.

- JSON uses camelCase; IDs are 24 hexadecimal characters; UTC ISO timestamps.
  Nullable values are explicit `null`. GET/DELETE have no request body.
- Existing HttpOnly-cookie authentication and current DB role/active checks.
  Faculty means the stored role `faculty`. Neither an admin nor a student may
  call a faculty-only API, and no teacherId/studentId in a body changes scope.
- Strict allowlisted query/body fields; reject repeated keys, arrays/objects
  where scalars are expected, Mongo operators, malformed IDs/dates, unsupported
  sorts, unknown keys and invalid ranges with 400. No raw regex is accepted.
- New page-number lists: `page` integer 1..10000, default 1; `limit` integer
  1..100, default 25. Response `pagination: {page,limit,total}`; total counts
  the filtered authorized result, not just the current page. A valid page beyond
  the end returns an empty array and the real total, not 404. No body selectors.
- Stable sort with `_id` tie-breaker; pages are read-time views, not frozen
  snapshots. Inserts between page requests can shift offset pagination. No
  false guarantee of snapshot-stable pagination under concurrent writes.
- Where accepted, `from` and `to` must be ISO instants with `from < to`;
  ranges are **[from,to)**. Dates, dimensions and scope are echoed in analytics.
  Omitted bounds mean unbounded; no browser-local timezone interpretation.
- New JSON errors: `{message: string, code: string}`; `code` is additive for
  updated existing routes. Common codes: 400 `INVALID_REQUEST`, 401
  `AUTH_REQUIRED`, 403 `FORBIDDEN`, 404 `NOT_FOUND`, 500 `INTERNAL_ERROR`.
  Existing message-only responses remain valid for unchanged routes.
- Authenticate/authorize role before data access. For faculty resources, missing,
  foreign, mismatched and no-longer-enrolled records all return the same generic
  404. Never return another teacher's identity in a conflict/not-found message.
- Sensitive academic/admin JSON and PDFs: `Cache-Control: private, no-store`.
  No public download URL, JWT-in-query, client-chosen path, storage key, raw
  command log, correct answer, lab credential or Google subject is returned.
- Membership is authorized at the server's read/response authorization point,
  not by a frontend list cached earlier. Scope the actual database joins and
  recheck enrollment before issuing scoped JSON/file headers when a transfer
  may have raced the read. New requests after release must be denied. No API
  can retract previously delivered responses or PDF bytes from a former teacher.
- Every mutation is JSON with explicit authorization and strict writable fields;
  preserve the approved local origin/cookie protections. Do not silently widen
  CORS or weaken rate limits to make a new flow work.

### Shared proposed response types

```ts
type AttemptStatus = 'running' | 'completed' | 'expired' | 'failed';
type ExperimentRef = {
  id: string; title: string | null; category: string | null;
  status: 'draft' | 'published' | 'archived' | null;
}; // Names/status describe the current definition; null if deleted.
type Score = {
  value: number | null; max: number | null; percentage: number | null;
  basis: 'report' | 'attempt-snapshot' | 'unknown';
};
type TaskProgress = {
  verifiedTaskCount: number; requiredTaskCount: number | null;
  percentage: number | null; basis: 'attempt-snapshot' | 'unknown';
};
type Page = { page: number; limit: number; total: number };
```

`Score.value` is non-null for completed attempts only; a genuine zero stays zero.
For completed attempts, use a consistent matching persisted Report.totalMarks
when present, otherwise a future attempt assessment snapshot, otherwise max and
percentage are null. A report must match student, attempt and experiment and its
score must agree; an inconsistent record must not supply a fabricated denominator.
If max <= 0, percentage is null. Otherwise round `100 * value / max` to two
decimal places. Do not clamp invalid scores or silently combine conflicting
records. `basis: unknown` can still carry the known raw value.

Task verified count is the distinct passed task IDs in persisted taskResults,
not currentTaskIndex, elapsed time or a completed flag. Required count and ratio
need an immutable valid attempt snapshot. Legacy required count/percentage stay
null; do not backfill them from today's mutable Experiment. Inconsistent results
have unknown basis/percentage and a logged integrity issue, not invented 100%.

## 4. N1: teacher attempt history and reports

### T1 — GET `/api/teacher/students/:studentId/attempts`

**Status:** proposed new read; faculty only. No admin/global variant in N1.
**Request:** common page/limit, optional `status: AttemptStatus`,
`experimentId: ID`, `from`, `to`; range filters Attempt.startedAt.
Sort fixed `startedAt desc, _id desc`; no custom sort or fuzzy search.

**200 response:**

```ts
{
  studentId: string;
  scope: 'current-enrollment-all-history';
  attempts: Array<{
    id: string; experiment: ExperimentRef; status: AttemptStatus;
    startedAt: string; completedAt: string | null;
    assessmentScore: Score; taskProgress: TaskProgress;
    report: { id: string; available: boolean } | null;
  }>;
  pagination: Page;
}
```

**Ownership:** first require `User{_id:studentId,role:student,teacherId:req.user._id}`,
including currently assigned inactive students, then constrain every attempt
query/count/join to that same student. Include pre-enrollment history, as the
existing aggregate detail does. Recheck current enrollment for each request;
previously cached enrollment is not authorization. Removed/deleted experiments
do not remove attempts; preserve their ID with null current metadata. No quiz
answers, command logs or runtime session IDs.

**Errors:** common 400/401/403/404/500. Foreign experiment filters must not leak
another student's activity: valid ID with no scoped matches yields empty 200.
**Tests:** A sees only A's student, B/admin/student denied; release/reassignment
revokes old teacher; inactive assigned student, pre-enrollment attempts, repeats,
zero/unknown maxima, deleted experiment, filters, tie ordering, page bounds,
empty list, and response secret/answer projection. Revalidate against real MongoDB.

### T2 — GET `/api/teacher/students/:studentId/reports`

**Status:** proposed new read; faculty only.
**Request:** common page/limit, optional `experimentId`, `from`, `to`;
range filters Report.generatedAt. Sort `generatedAt desc, _id desc`.

**200 response:**

```ts
{
  studentId: string;
  reports: Array<{
    id: string; attemptId: string; experiment: ExperimentRef;
    generatedAt: string; score: number; totalMarks: number; quizScore: number;
    available: boolean;
    downloadUrl: string | null;
  }>;
  pagination: Page;
}
```

**Ownership:** same live enrollment check as T1; Report.studentId and its owning
completed Attempt.studentId/experimentId must all match the path student and
report reference. Exclude inconsistent/orphaned records from data and total,
log internally without returning private paths. A missing/deleted Experiment
does not alone invalidate a consistent historical report. `available` means a
regular readable file within the real report root, not merely a DB record.
`downloadUrl` is null when unavailable; otherwise it is only the relative T3 URL.
Pagination total counts report records passing authorization/integrity checks,
including unavailable files. A missing file is a real unavailable row, not a
successful download. Listing does not generate or repair reports.

**Errors:** common 400/401/403/404/500. **Tests:** ownership/reassignment as T1,
missing file, orphan/mismatched attempt, deleted experiment, real report/zero
scores, exact field projection, no filePath, ordering/filter/page totals and
live generated PDF metadata. Never insert pretend completion to make this pass.

### T3 — GET `/api/teacher/students/:studentId/reports/:reportId/download`

**Status:** proposed new binary read; faculty only. **Request:** two IDs, no
query parameters/body; no pagination. **200:** original PDF bytes,
`Content-Type: application/pdf`, safe attachment name
`CyberLabX-report-<reportId>.pdf`, private/no-store. No redirects to public storage.

**Ownership:** resolve report with both IDs; validate the current enrolled student
and matching completed attempt again immediately before opening the file. Resolve
the real report root and real file path; require a contained regular file and
reject symlink escape/traversal. Bind the path to the matched attempt's existing
deterministic `cyberlabx-report-<attemptId>.pdf` filename; an in-root path pointing
at a different student's report is not acceptable either. Use the opened
file/descriptor for streaming.
Do not trust a prefix string or supplied filename. Listing permission/availability
is not a reusable download grant. Already delivered bytes cannot be revoked;
requests after release must fail, including a copied old URL.

**Errors:** 400 malformed selectors; 401/403 as common; generic 404 for foreign,
missing, mismatched or unavailable file, including a file deleted after listing;
500 for internal errors without path disclosure. **Tests:** real PDF signature
and file hash, every cross-student/teacher ID pairing, release between list and
download, file disappearance/symlink escape, no secrets in headers/errors, and
faculty/admin still receiving 403 from all existing student-only report routes.

Do not add teacher POST generation or broaden `/api/attempts` or `/api/reports`
roles. If admin academic access is later approved, use separately reviewed
explicit `/api/admin/teachers/:teacherId/...` scope; it is not implicit here.

## 5. N2: cohort and per-experiment analytics

### A1 — GET `/api/teacher/analytics/experiments`

**Status:** proposed new faculty-only read. Existing faculty dashboard remains
unchanged; this adds the missing breakdown and additional cohort participation,
not another competing dashboard API.
**Request:** common page/limit, optional exact `experimentId`, `from`, `to`.
Dates filter Attempt.startedAt; completed metrics include completed attempts in
that selected start-time range. No implicit academic term/class model.
Sort rows `experimentId asc` with one row per experiment ID.

**200 response:**

```ts
type Performance = {
  attemptedStudents: number; completedStudents: number;
  attemptCount: number; completedAttemptCount: number;
  averageScore: number | null; bestScore: number | null;
  normalizedScoreCount: number; averagePercentage: number | null;
  completionPercentage: number | null;
};
{
  scope: { teacherId: string; membership: 'current'; includeInactive: true;
           history: 'includes-before-enrollment'; from: string | null; to: string | null };
  cohort: {
    enrolledStudents: number; activeStudents: number; inactiveStudents: number;
    attemptedStudents: number; completedStudents: number;
    attemptCount: number; completedAttemptCount: number;
  };
  experiments: Array<{ experiment: ExperimentRef; performance: Performance }>;
  pagination: Page;
}
```

**Semantics/ownership:** every pipeline begins from current students assigned to
the authenticated faculty (including inactive), never the platform attempt set
followed by client filtering. Cohort unique-student counts are across the whole
selected attempt population, not summed per-experiment counts or page counts.
An experimentId filter applies to both cohort attempt counters and rows; enrolled
membership counts remain the full current cohort. With no filter, row universe
is published experiments plus any experiment IDs referenced by scoped history,
including archived/deleted ones. Never reveal unrelated draft/archived content.
A specific unrelated unpublished/deleted ID yields no row, not an existence leak.

Per row, attempted/completed students are distinct IDs, not repeat attempts;
completed count includes all repeats. Raw average/best use completed attempts
only (round raw mean to nearest integer); empty score averages/best are null.
`averagePercentage` is a two-decimal mean of per-attempt known percentages only;
`normalizedScoreCount` exposes its coverage. Unknown maxima are excluded, not
assumed /100. `completionPercentage` is completed distinct students divided by
all currently enrolled students (including inactive), times 100, rounded to two
decimals; null for a zero cohort. Do not confuse it with task completion or the
existing active-student metric. No report-based participation or fake charts.

**Errors:** common 400/401/403/500; empty cohort is 200 with zero membership/
participation, null score ratios and safe published experiment rows.
**Tests:** two teachers with different nonzero records, inactive membership,
pre-enrollment history, transfer/removal, repeats, zero scores, mixed 75/100
maxima, missing maxima, date boundaries, no-attempt published rows, archived and
deleted scoped history, hidden unrelated drafts, distinct totals vs page totals,
and regression of existing dashboard scope. Validate a real nonzero fixture.

## 6. N3: admin directory, lookup and safe existing account updates

### U1 — GET `/api/admin/users`

**Status:** proposed admin-only read. **Request:** common page/limit;
optional `role: student|faculty|admin`, `isActive: 'true'|'false'`,
`email` (trimmed/lowercased exact match, max 254), `q` (trimmed 1..80 characters).
`q` is a literal case-insensitive substring of firstName/lastName only, never a
regex or email/global teacher search. Reject supplying both `q` and `email`.
Sort fixed `_id asc` for deterministic account selection.

```ts
type AdminUser = {
  id: string; firstName: string; lastName: string; email: string;
  role: 'student' | 'faculty' | 'admin'; isActive: boolean;
  teacherId: string | null; enrolledAt: string | null;
  createdAt: string; updatedAt: string; managementVersion: number;
};
// 200:
{ users: AdminUser[]; pagination: Page }
```

**Ownership:** active admin may select platform accounts; `role=faculty` reuses
this directory for explicit teacher selection and the already-existing admin
enrollment routes. Students/faculty receive 403, never a reduced directory.
Do not expose passwordHash, Google subject, tokens, IP, or raw User documents.
Teacher reference is an assignment, not verified department/class information.
`managementVersion` is a proposed new persisted integer, not present today.
**Errors:** common 400/401/403/500; no matches is empty 200.
**Tests:** filters combined with active state/role, literal metacharacters,
case-normalized exact email, unsupported keys/sort, deterministic pagination,
inactive users, safe projection, wrong roles and real directory reads without
changing accounts.

### U2 — GET `/api/admin/users/:userId`

**Status:** proposed admin-only lookup; no query/body/pagination.
**200:** `{user: AdminUser}` from U1. **Ownership:** active admin, any account;
no account ID inferred from audit display names. Missing account 404; invalid
ID 400; other common errors apply. No secrets/auth method internals added.
**Tests:** existing/missing/inactive IDs, guards, exact safe projection and
management version. Use this lookup immediately before preparing an update.

### U3 — PATCH `/api/admin/users/:userId` (existing route, proposed hardening)

**Current:** role/isActive updates exist, but the protections below do not.
**Proposed request:** strict JSON
`{role?: 'student'|'faculty'|'admin', isActive?: boolean,
expectedManagementVersion: integer >= 0}`; at least one of role/isActive.
No name/email/password/teacherId/Google fields. No query/pagination.
The required version is a coordinated change for existing API consumers;
today's admin UI does not call this endpoint. Do not claim it is enforced now.
**200 response:** `{user: AdminUser, changed: boolean}`. Actual role/active changes
atomically increment managementVersion; a no-op with matching version returns
changed false, leaves version unchanged and emits no user.updated event.

**POL-ADMIN-1 — proposed policy requiring explicit agreement before implementation:**

1. Reject deactivation or demotion of the requesting admin's own account:
   409 `SELF_ADMIN_CHANGE_FORBIDDEN`. Maintaining the current role/active status
   is not a demotion. Do not provide a self-bypass checkbox/parameter.
2. Never permit an operation leaving zero active admin accounts:
   409 `LAST_ACTIVE_ADMIN`. Guard every writer of role/isActive, not just the UI.
3. Recheck caller authorization within the serialized update, not only middleware,
   because another admin can deactivate the caller concurrently.
4. Version mismatch: 409 `STALE_USER`; re-read/review, never automatic overwrite.
5. Student promotion clears that student's teacherId/enrolledAt as today, without
   deleting academic history. Student deactivation retains assignment. Faculty
   deactivation retains assignments (inactive to students); no automatic transfer.
   **New proposed additional guard:** faculty demotion while any student references
   it returns 409 `TEACHER_HAS_ENROLLED_STUDENTS`; require explicit admin releases
   through existing teacher-scoped routes first. This is a policy change to review,
   not a description of current PATCH behavior. Do not mutate students implicitly.

**Atomicity gate:** count-then-update is unsafe. Two transactions that independently
count admins and update different users can also suffer write skew. Recommended
design is a transaction-capable MongoDB topology plus a shared admin-policy guard
document written by every privileged account mutation in the same transaction;
recheck caller/target, invariant, version, write and safe audit event there.
Retry transaction conflicts in a bounded manner, re-evaluating all guards; a
stale target version still returns 409. Teacher demotion/enrollment races also
need serialization with the assignment writer or the demotion must remain
unavailable: a prior empty-cohort read alone is not sufficient.

The current local Compose configuration does not establish transaction support.
An approved topology/serialization design is therefore a **prerequisite**, not
an infrastructure task in this stage. If unavailable, fail privileged mutations
closed (proposed 503 `ACCOUNT_UPDATE_UNAVAILABLE`) and keep updates disabled in
the frontend; directory/lookup can ship independently. Do not claim a process-local
mutex, plain count, or optimistic updates on different documents prove the global
invariant. Any guard document/schema/topology change needs separate approval.

**Audit:** success logs `user.updated`, actor/target IDs and allowlisted old/new
role/isActive; exclude versions/credentials/private identity fields unless needed
for safe diagnostics. Audit failure must not silently produce an untracked
privilege change. Existing POST creation should be routed through the reviewed
management service when this safety work ships; preserve its UI and auth behavior.
**Errors:** common plus policy/version 409 and atomicity-service 503. No change
and no success audit on rejected requests.
**Tests:** self-demotion/deactivation, sole admin, two admins concurrently removing
each other's access, caller losing admin mid-request, two updates of one version,
audit failure rollback, privilege update through every service path, stale
versions/no-op, inactive target, student promotion preserving history, teacher
deactivation retention, teacher demotion racing enrollment, role/auth checks,
strict field rejection and confirmation UI. Global invariant needs real MongoDB
concurrency on the approved topology, not only mocked route tests.

## 7. N4: admin audit search and pagination

### L1 — GET `/api/admin/audit-events`

**Status:** proposed admin-only read, separate from unchanged overview.
**Request:** common page/limit, optional exact `action` (1..80 characters),
`actorId: ID`, `resourceType: 'User'|'Experiment'`, `resourceId: ID`, `from`, `to`.
Range filters createdAt; fixed `createdAt desc, _id desc`. No free-form metadata
or regex search; resourceId can be used without resourceType.

**200 response:**

```ts
{
  events: Array<{
    id: string; action: string; createdAt: string;
    actorId: string | null;
    resource: { type: string | null; id: string | null };
    changes: Array<{ field: 'role' | 'isActive' | 'status';
                     before: string | boolean | null;
                     after: string | boolean | null }>;
  }>;
  pagination: Page;
}
```

**Ownership:** active admin only, platform audit scope; disabled/deleted actor
IDs remain historical IDs, not a reason to discard events. Do not join full User
or return raw metadata, IP/userAgent, cookies, passwords or OAuth subject. Existing
old records lacking before/after produce `changes: []`; never invent a prior
state from the current user. Unknown legacy action/resource strings remain
displayable in the response; accepted filter resourceType enum is deliberately
limited to supported management resources. Future allowed resource filters need
an explicit contract extension, not raw Mixed-field queries.

**Errors:** common 400/401/403/500; empty result 200. **Tests:** more than 20
events, equal-timestamp sorting, every filter/date boundary, combined filters,
total vs page, empty result, deleted actors, legacy/malformed metadata and
secret-containing metadata redaction. Existing `/admin/dashboard` shape stays
compatible. Index review: current actor/createdAt index is insufficient for
every new query; propose `{createdAt:-1,_id:-1}` and evaluate action/date and
resource indexes from query plans before adding them. No index is added here.

## 8. N5: catalogue and truthful student progress

### C1 — GET `/api/experiments` (existing route, additive projection fix)

**Request/roles:** unchanged authenticated GET; no new accepted selectors/body.
Still returns the complete small published catalogue without server pagination.
Do not introduce a second category-directory or fuzzy-search API just to support
the current seven-item client filter.
**200:** existing `{experiments:[{_id,title,slug,description,difficulty,
estimatedTimeMinutes,taskCount}]}` with additive `category: string | null` on each
row. Trim existing values; null for absent/blank category, no invented label.
The client can display its current Uncategorized label for null. Use exact
returned category values for its existing filter; all records may legitimately
share the same category. Model defaults do not prove editorial classification.

**Ownership:** published records only for all authenticated roles; no drafts,
verification rules, lab config or quiz answers added to the list. Existing detail
continues to remove correctOption. Errors unchanged 401/500; GET `/:id` 404 for
unpublished/missing. **Tests:** actual projection includes category, blank/null,
multiple category fixtures, no invented categories, published-only, unchanged
taskCount/list consumers, working frontend search/category intersection and
no-match/reset. Server pagination/search is optional future scale work, not a
proposed essential API in this plan.

### P1 — GET `/api/student/history` (existing, additive score/progress fields)

**Request/roles:** existing student-only GET, no selector/body, no new pagination;
keep today's complete own history and deterministic sort. **200:** retain every
existing attempt field and `{attempts:[...]}` envelope; add
`assessmentScore: Score` and `taskProgress: TaskProgress` to each attempt.
Existing raw `score` and report flags are not reinterpreted or removed.
**Ownership:** current authenticated student's attempts and joined reports only.
Maxima come only from consistent persisted report/snapshot, never current marks.
No teacher/admin access and no synthetic report availability.
**Errors:** existing 401/403/500; empty history 200. **Tests:** legacy unknown
maxima, completed zero, 75/75 -> 100 percentage in the new explicit field,
running/failed raw display rules, mixed maxima, multiple experiments, deleted
definition, failed report generation, strict ownership and old consumers.

### P2 — GET `/api/attempts/:id` (existing, additive verified progress)

**Request/roles:** unchanged student-only own ID; no query/body/pagination.
**200:** existing `{attempt:{id,status,currentTaskIndex,score,experiment}}` plus
`attempt.assessmentScore: Score` and `attempt.taskProgress: TaskProgress`.
No new teacher detail alias is required: T1 is their safe academic projection.
No lab credentials or guessed resumable session URL is added.
**Ownership/errors:** existing own-student filter; 401/403, 404 missing/foreign;
explicit new ID validation may return 400 if coordinated with old consumers.
**Tests:** real stored task results, deduplication, expired/failed attempts,
unknown legacy denominator, definition changes, no correctOption leakage and
unchanged terminal/workspace consumption. No grading/progression mutation here.

### P3 — GET `/api/student/dashboard` (existing, compatible summary extension)

**Request/roles:** unchanged student-only own scope, no body/query/pagination;
the existing five recent attempts stay a sample, not a substitute for history.
**200:** retain existing stats and recentAttempts, add `scoreUnit: 'points'`,
`stats.publishedExperimentsCompleted: integer >= 0`, and
`recentAttempts[*].assessmentScore: Score` as in P1. The new published-completed count is the intersection
of current published experiment IDs and the student's completed experiment IDs,
bounded by totalExperiments. Existing experimentsCompleted retains its historical
distinct-completed meaning. This avoids silently dividing archived completions
by today's catalogue size or masking overflow with a frontend clamp.

Best/average existing scores stay best-per-completed-experiment **raw points**;
no cross-experiment percentage is fabricated. Frontend uses raw labels until an
explicit normalized aggregate with denominator coverage is separately approved.
**Errors:** existing 401/403/500; zero summaries reflect actual empty scope.
**Tests:** archived/deleted completions, repeats, current published denominator,
real zero scores, 75-point scale, raw averages unchanged and no other student's
recent attempts. Update StudentDashboard/Progress/History `/100`/`%` assumptions
and tests together; do not modify assessment records to fit the old UI.

**Future-write prerequisite for precise task percentages:** if the product needs
them, add an immutable Attempt assessmentSnapshot on creation with experiment
revision, task IDs/orders/marks, quiz IDs/marks, requiredTaskCount and totalMarks.
No correct answers are included in public snapshots. Version new snapshots;
legacy remains unknown. Coordinate with grading/report generation before any
assessment editing; do not insert/backfill fabricated historical snapshots in
this documentation stage. Without that coordinated work, show verified counts
and unknown totals rather than a task-completion percentage.

## 9. N6 and O1: account/profile boundary

Essential account demonstration needs **no missing API**: GET `/api/auth/me`,
existing session/logout and GET `/api/student/enrollment` already cover identity
and assignment. Google configuration/live-provider validation is an environment
dependency, not a reason to invent an OAuth endpoint. No department, university
enrollment, phone or class fields should be inferred from branding.

### O1 — optional PATCH `/api/account/profile`

**Only if self-service name correction is approved.** Any active authenticated
role, self only; no userId selector/query/pagination. Strict body
`{firstName?: string, lastName?: string}`, at least one; trim firstName 1..60,
lastName 0..60 (Google-only accounts may have no family name). No arbitrary avatar
URL, email, password, role, active state, teacher assignment or Google fields.
**200:** `{user: PublicUser}` using the existing safe public shape. Name-only
updates use documented last-write-wins semantics; they must not replace other
User fields or reset an assignment/managementVersion. Preserve passwordHash,
Google subject and role exactly; no new session is issued. Existing auth/me
reflects the saved names and frontend refreshes its session store from response.
**Errors:** 400/401/500; no writes on invalid request. **Tests:** own-only writes,
each role, Google account empty last name, trimming/lengths, rejected sensitive
fields, unchanged identity/auth/assignment, disabled session, and no secret
projection. Pagination is not applicable.

Password change/reset, email/Google identity changes and logout-all/revocation
need separate identity verification/recovery/session policies. No route for them
is proposed as demo-essential; do not bolt them onto the existing admin PATCH.

## 10. O2: admin experiment management only if demo scope expands

**Recommendation: defer.** Published read-only admin overview already works.
If a reviewer specifically requires editorial/status management, limit it to
existing approved experiments; do not implement arbitrary experiment creation
or assessment/grading edits for this demo.

| Proposed route | Request | 200 response / pagination |
| --- | --- | --- |
| GET `/api/admin/experiments` | Admin; page/limit; optional status draft/published/archived and exact category | `{experiments: AdminExperiment[], pagination: Page}`, `_id asc` |
| GET `/api/admin/experiments/:id` | Admin; ID only | `{experiment: AdminExperiment}`, no pagination |
| PATCH `/api/admin/experiments/:id` | Admin; strict JSON `{title?, description?, category?, status?, expectedContentVersion}`, at least one editorial/status field | `{experiment: AdminExperiment, changed: boolean}`, no pagination |

`AdminExperiment = {id,title,slug,description,category:string|null,status,
taskCount,quizQuestionCount,labProfile:string,createdAt,updatedAt,contentVersion}`.
labProfile is read-only and server-derived. Proposed contentVersion is persisted
integer >= 0, advanced atomically on a real update; stale expected value is 409
`STALE_EXPERIMENT`. Title 1..160, description 1..2000, category 1..80 after trim;
status enum only. No slug/task/quiz/mark/verification/lab/image/hostname/resource/
port/volume/command fields accepted. These are exact limited editorial contracts,
not a generic schema patch mechanism.

Admin-only platform scope. Publication validates the stored entire definition
against server-controlled allowlisted profiles/resources and assessment shape;
invalid definition returns 409 `EXPERIMENT_NOT_PUBLISHABLE`. Archive/publish affects
future catalogue/start eligibility; existing attempts/reports are not deleted
or rescored. Task/quiz mutation is forbidden, preserving existing attempt grading
until snapshot/version work is agreed. Record allowlisted experiment.updated
audit metadata, with audit/write failure behavior agreed before enabling PATCH.
GET missing ID 404, malformed input 400, 401/403 guards, 500 generic. Use 503
`EXPERIMENT_UPDATE_UNAVAILABLE` rather than claim a write succeeded when reliable
version/audit persistence is not ready.

Tests: every role, directory status/category filters and pagination, stale/no-op
updates, publication validation, injected Docker/image/verification fields,
archiving with existing completed/running attempts, preserved PDFs/scores,
allowlisted audit fields, write/audit failure, and student published-only access.
No POST/DELETE or new lab template/config endpoint is proposed. Server allowlists
remain authoritative even for admins; seeded content is not edited in Stage 4B.

## 11. Implementation order, gates and acceptance

1. **Review this proposal first.** Agree POL-ADMIN-1, current-cohort all-history
   visibility, score/max rules, analytics denominator, optional scope, and audit
   privacy projection. They are proposals, not already agreed policy.
2. Implement teacher T1/T2/T3 using a shared live enrollment guard, safe DTOs and
   report file resolver; leave student routes unchanged. Add focused unit/HTTP
   authorization tests, then real MongoDB enrollment/release/report-download tests.
3. Deliver C1 and raw student score-label corrections. Add only truthful P1/P2/P3
   fields with backward-compatible tests. Coordinate snapshot work separately if
   percentages beyond supported legacy data are required.
4. Add A1 over scoped attempts, with precise aggregate definitions, indexes and
   nonzero two-teacher real-database validation. No fabricated comparison charts.
5. Add U1/U2 and L1; frontend teacher selection reuses existing explicit admin
   enrollment routes. These reads do not require activating unsafe account updates.
6. Implement U3 only after policy and transaction/serialization design approval.
   Test last-admin and enrollment/demotion races on the real approved topology
   before enabling the UI. No local infrastructure conversion happens implicitly.
7. O1/O2 only if explicitly selected after essential acceptance; no automatic
   progression into profile or experiment-management privileged writes.

New teacher queries should key cache entries by authenticated faculty, student,
filters and page. Invalidate/revoke lists, histories, reports and analytics after
assignment changes. Admin caches include selected teacher/user scope; account
updates invalidate directory/lookup/overview and require fresh confirmation on
409. Session/role changes clear private caches as today. A cache never authorizes
a request, and another browser needs a refresh/refocus to retrieve changed data.

Index candidates for review, not automatic additions: existing Attempt
student/status and student/startedAt indexes should be measured for T1/A1;
consider `_id` sort tie-breaker and Report student/generatedAt. U1 exact email
uses the existing unique index; bound literal name search rather than assuming
unindexed substring queries scale. Add only indexes justified by query plans.

Each implementation slice runs affected client/server tests, lint and builds.
Keep known baseline lint debt separate. Privileged ownership/concurrency tests
need real MongoDB plus valid reports; browser UI tests alone or mocked stores
cannot prove isolation or the last-admin invariant. Do not re-run already-passed
ten-round enrollment/49-screenshot checks unless a code change affects them.

## 12. Stage 4B validation and delivery

This stage inspected source/contracts only. No live privileged requests, account
updates, database writes, installs, migrations or service restarts were needed.
No endpoint above was implemented or claimed to return live responses. No tests,
builds or lint were rerun for this documentation-only review; latest Stage 4A
evidence remains 174 passing client tests, client lint/build passed and 64 relevant
server tests passed. Full Checkpoint 3C baseline and its three server lint errors
remain separately documented.

Only this plan and the API-requirements index are committed locally. Existing
development branches, Stage 4A code, data and ignored runtime evidence remain
unchanged. Final local SHA is reported at delivery; obtain the document's commit
with `git log -1 --format=%H -- docs/STAGE4B_API_IMPLEMENTATION_PLAN.md`.
Stop after Stage 4B; no push, PR action or deployment is authorized.
