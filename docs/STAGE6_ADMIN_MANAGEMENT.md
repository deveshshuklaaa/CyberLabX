# Stage 6: admin management — local acceptance and blocked account writes

Date: 2026-10-24. Branch: `integration/local-takeover`.
Starting HEAD: `f8f67ac27adeeeb07c1707304d5e61a15c3ed4c8`.
Backend commit: `4136ae98c6fc78463a46612c19b341336ee66de4`.
Frontend commit: `5fc57b318f68deb918a9facc4acf14c680c9cf0d`.
This document follows the two code commits in a separate local commit.
No remote Git operation, PR action, deployment, package installation, database
migration, infrastructure change or original-branch modification was performed.

**Delivered:** user directory/detail, teacher listing, explicit teacher-cohort
management, safe paginated full audit search, confirmation dialogs, responsive
states, and refresh/invalidation. **Blocked:** successful account creation and
role/status updates. Stage 6 is not fully complete while that gate remains closed.

## Reviewed policy and the actual blocker

[Stage 4B, U3 / POL-ADMIN-1](STAGE4B_API_IMPLEMENTATION_PLAN.md) explicitly requires
an approved transaction-capable topology and shared serialization guard spanning
the caller, account mutation and audit event. Teacher demotion also needs
serialization with enrollment, or it must remain unavailable. The plan states:

> If unavailable, fail privileged mutations closed

and requires separate approval for guard-document/schema/topology changes.
A live read-only MongoDB `hello` verified that `cyberlabx_local_takeover` is
**standalone** (`replicaSet:false`, `mongos:false`). No shared guard or versioned
management service exists. No count-then-update, process-local mutex or unsupported
transaction is substituted for that prerequisite.

The previously unsafe POST/PATCH writers are therefore closed on the server,
not merely hidden in React. Creation is also closed: its former create-then-audit
sequence could leave an unaudited account after audit failure and would not meet
the reviewed actor/account/audit atomicity requirement. Public student registration
and Google/password authentication remain unchanged.

- Self-demotion/deactivation: **409 `SELF_ADMIN_CHANGE_FORBIDDEN`**.
- Other valid existing-target updates, including no-op or stale-looking versions:
  **503 `ACCOUNT_UPDATE_UNAVAILABLE`**, with no write/audit/assignment side effect.
- Creation with an existing normalized email: **409 `DUPLICATE_EMAIL`**.
- Otherwise valid creation: **503 `ACCOUNT_UPDATE_UNAVAILABLE`**, no new account.
- Invalid IDs, queries or strict bodies: **400 `INVALID_REQUEST`**; missing
  existing-account target: **404 `NOT_FOUND`**.
- A missing/expired/inactive session is 401; faculty/student access is 403 using
  existing current-database-role middleware. Auth message-only bodies are retained.

Last-admin preservation currently follows from rejecting *every* account update,
not from a claimed successful concurrent mutation algorithm. Specific successful
version/no-op behavior, `STALE_USER`, `LAST_ACTIVE_ADMIN`, promotion cleanup,
teacher demotion policy and audit rollback remain pending the approved writer.
The server cannot demote/deactivate the final admin through POST/PATCH. Both
single-admin real rejection and two-admin competing rejection fixtures pass;
successful transaction concurrency is not claimed.

## Implemented API contracts

All reads below require an active admin; they recheck current admin authorization
before returning data and set `Cache-Control: private, no-store`. Page is 1..10000
(default 1), limit 1..100 (default 25), with `{page,limit,total}`. Unsupported or
repeated query keys and arrays/operators are rejected. Offset pages are read-time
views, not guaranteed snapshots across concurrent writes.

| Endpoint | Delivered behavior |
| --- | --- |
| GET `/api/admin/users` | `{users,pagination,management}`; fixed ID-ascending order. Optional role `student/faculty/admin`, isActive `true/false`, exact normalized email (max 254), or q (trimmed 1..80, literal case-insensitive substring of first/last name). q and email are mutually exclusive. Regex metacharacters are escaped. |
| GET `/api/admin/users/:id` | `{user,management}` for the actual selected account, including inactive users; no query selectors. Malformed ID 400, missing account 404. |
| GET `/api/admin/audit-events` | `{events,pagination}` from the full stored collection. Exact action (1..80), actorId, resourceType `User/Experiment`, resourceId, from/to ISO UTC filters. Range `[from,to)` uses createdAt. Sort createdAt descending, ID descending. |
| POST `/api/admin/users` | Strict trimmed firstName/lastName 1..60, normalized email max 254, password 12..128, supported role. Validates/conflicts, then fails closed as above. No 201 is claimed. |
| PATCH `/api/admin/users/:id` | Strict `{role?,isActive?,expectedManagementVersion:integer>=0}`, at least one change selector; no query. Validates/self-protects, then fails closed. Unversioned old requests now return 400. |

User DTO: id, firstName, lastName, email, role, isActive, teacherId/enrolledAt or
null, createdAt/updatedAt (null for missing legacy timestamps), and
**managementVersion:null**. No persisted version exists, so zero is not invented
as a lock token. Directory/detail add
`management:{writesAvailable:false,code:'ACCOUNT_UPDATE_UNAVAILABLE',message}`.
This is an explicit partial U1/U2 delivery until approved version persistence is
implemented. It does not claim the historical proposed numeric version exists.

Audit DTO: id, action, createdAt, actorId or null, resource `{type,id}` with nullable
fields, and allowlisted `changes`. Role changes accept only known roles,
isActive only booleans, and experiment status only draft/published/archived (or
explicit nulls). Both before and after must be recorded; old metadata with only
a current value yields `changes:[]`. Raw Mixed metadata, credentials, Google
subjects, IP/user-agent and full User documents are not serialized. Historical
unknown action/resource labels and deleted actor IDs remain displayable.

The existing `/api/admin/dashboard` counts retain their meanings. Its most recent
20 events now use a safe projection and stable ID tie order. Its snapshot remains
separate from the new complete stored-audit search. No new indexes are created;
large-directory substring search and audit-filter plans need later scale review.

## UI and existing teacher-scoped routes

On `/admin`, User management now includes labeled name/exact-email/role/status
filters, server pagination, refresh, genuine empty/error/retry states and safe
fresh account lookup. **List teachers** applies the real faculty filter. Account
details show status, role, assignment and timestamps. Draft role/status review
opens a native modal, but Apply is disabled; self-demotion/deactivation cannot
even proceed to draft confirmation. The retained account-creation fields and
submission controls are disabled and do not request initial credentials.

Select a real faculty account to open its explicit cohort:

- GET/POST `/api/admin/teachers/:teacherId/students` for list/enrollment.
- GET/DELETE `/api/admin/teachers/:teacherId/students/:studentId` for aggregate
  detail and confirmed removal.

These are unchanged existing authorized APIs, not teacher-session impersonation.
Enrollment accepts exactly one exact email/studentId. A current assignment causes
409; no overwrite/implicit transfer. Inactive teachers allow list/detail/removal
but new enrollment is disabled and rejected by the backend. Removing a relationship
preserves accounts, academic records and identity; the pair must match the URL.
Admin cohort detail uses the existing aggregate progress, never faculty-only
academic/report routes. Admin access to faculty-only endpoints still returns 403.

Native confirmation dialogs contain focus/background interaction and support Escape
cancellation. Cohort deletion cannot be canceled mid-request. Successful cohort
mutations invalidate admin directory/detail/cohort/student, metrics, full audit,
faculty dashboard, teacher academic reads/analytics and own-enrollment queries.
Removed scoped detail/academic cache is canceled and evicted. Existing enrollment
routes do **not** create audit events: refresh does not fabricate an enrollment
audit. Other browser sessions must refresh/refocus; no live push synchronization.

## Real local MongoDB, API and browser outcomes

Installed Chrome `155.0.8059.85` was driven with existing temporary Playwright
tooling, using ordinary Admin, Faculty and Student logins. No auth limiter,
cookie/session rules or authorization checks were bypassed or weakened.

The main harness completed **92 passing assertions**. Additional anonymous
POST/PATCH checks each returned 401. Actual results:

| Check | Result |
| --- | --- |
| Directory pages with limit 2 | 200; distinct IDs across pages, total 5 |
| Faculty/active filter | 200; two real teachers |
| Inactive filter | 200; genuinely empty (no inactive original user) |
| Literal `.*` name search | 200 empty, not all accounts |
| Uppercase exact-email filter | 200; the correct single existing student |
| Invalid/repeated/unbounded directory requests | 400; absent account 404 |
| Platform metrics vs direct MongoDB counts | Exactly users 5, active students 2, attempts 1 |
| Audit pages with limit 1 | 200; distinct original event IDs, correct total 2 |
| Audit combined action/actor/resource filter | 200; persisted matching event |
| Audit future UTC range | 200 empty; malformed actor 400 |
| Admin self-demotion/deactivation | 409, account still active admin |
| Existing student role/status and enrolled teacher demotion | 503, no changes |
| Duplicate account / fresh valid account / invalid password | 409 / 503 / 400, no new user |
| Admin UI teacher enrollment | 201; selected teacher owns the student |
| Admin cohort progress | Actual completed Nmap history: 1 attempt, 1 completion, mean/best 75 raw points |
| Wrong teacher-student detail / competing assignment | 404 / 409, no takeover |
| Dialog Escape cancellation | Both account review and cohort release cancel; assignment preserved |
| Confirmed UI release | 204; refreshed empty cohort and full audit refetch observed |
| Other teacher enrollment after release, cleanup | 201, then authorized 204 |
| Anonymous reads and POST/PATCH | 401 |
| Faculty/student admin reads, account writes, cohort mutation | 403 |
| Admin faculty-only enrollment endpoint | 403 |

Rendered pages visited: `/login`, `/admin`, `/teacher`, `/student`.
Directory filters, cohort student detail and full audit filters were each rendered
at **320, 375, 768 and 1280 × 900** (12 layouts), with no horizontal document
overflow. **15 masked screenshots** include those 12 elements, blocked account
review, the native release dialog at 375px, and disabled account creation.
Two screenshots were visually inspected for the small-screen form/dialog layout.
There were zero uncaught page errors. Console captured six expected 401 bootstrap
resource messages before the three logins; a completely empty console is not claimed.

Local ignored evidence:

- `.env.stage6-evidence/results.json`: sanitized assertions, response statuses,
  viewport measurements, counts, browser/console outcomes and screenshot filenames.
- `.env.stage6-evidence/directory-filters-{320,375,768,1280}.png`.
- `.env.stage6-evidence/admin-cohort-student-{320,375,768,1280}.png`.
- `.env.stage6-evidence/full-audit-filters-{320,375,768,1280}.png`.
- `account-review-blocked.png`, `cohort-removal-dialog-375.png`,
  `creation-unavailable.png` in the same folder. Inputs/account emails are masked.
- `server/.env.stage6-browser.mjs`: local harness, loading credentials only from
  ignored environment configuration; no embedded credentials or saved sessions.

## Preservation and audit persistence

Only the isolated localhost `cyberlabx_local_takeover` database was used. All
**22 original documents** were compared before/after with in-memory digests,
normalizing only the dedicated student's legitimate enrollment-driven updatedAt.
No account, role/status, password/Google identity, attempt, report, lab session,
command log, experiment or original audit was changed or deleted. No new account
or artificial academic/audit fixture was inserted. Both original audit records
remain identical; blocked account writes produce no false user.created/updated
event. The sole active admin remains active.

Student `6adc9fa6ee7bf58417c1675a` was unassigned before/after, with the same
attempt `6adca585ee7bf58417c16a13` and report `6adca597d794932ab5c57736` (1 each).
The original PDF retained SHA256
`c19669e84c35e33a4b73c443e21ed36c027d4e0b9cb677388622ba8f278e8fa9`.
Temporary relationships were removed through authorized admin APIs only. All
validation sessions were logged out. No original academic history was created
anew or modified to populate the screens.

## Exact regression commands and outcomes

| Command | Fresh actual result |
| --- | --- |
| `npm --prefix server test` | PASS: 35 files, **334/334 tests**, including 41 new admin tests |
| `npm --prefix client test` | PASS: 18 files, **220/220 tests**, including 24 new admin workflow tests and two new creation-error cases |
| `npm --prefix server run build` | PASS |
| `npm --prefix client run build` | PASS; existing chunk-size warning, main bundle approximately 822 kB |
| `npm --prefix server run lint` | FAIL: exactly three pre-existing findings, no new findings |
| `npm --prefix client run lint` | PASS |
| ESLint on all seven changed backend files with `--max-warnings=0` | PASS |
| `git diff --check` | PASS |

Existing lint findings: `NMAP_LAB_DEFINITION` and `DOS_LAB_DEFINITION` at
`server/src/__tests__/allExperiments.test.ts:9/10`, and `_next` at
`server/src/middleware/error.ts:3`, all unused variables. Nothing was suppressed.
Full suites were freshly rerun; affected suites/build/lint were rerun after test
updates. Passing failure-path backend fixtures still emit their established mocked
Docker/cleanup/PDF warning logs, not new live runtime failures.

Backend HTTP tests cover guards, active-admin recheck, exact/literal filters,
invalid IDs, strict query/body/version validation, safe projections, 27-event
pagination/tie ordering, date boundaries, legacy/secret metadata, self protection,
sole-admin preservation and concurrent mutual-removal rejection with no writes.
Existing enrollment tests now assert the new fail-closed account contract and
unchanged assignment/removal behavior. No tests/security conditions were weakened.

Frontend tests cover directory search/selection/pagination, explicit faculty
scope, status/empty/error/retry, blocked self/account changes, confirmation/cancel,
enrollment conflict/removal/cache eviction, query invalidation, server-side audit
filters/pages beyond 20 fixtures, legacy change uncertainty and error recovery.
Retained form success-handler tests are isolated **legacy contract mocks**;
they are not evidence of successful account creation against this backend.

## What remains blocked or unverified

1. Approve a transaction/serialization design and any required topology/schema
   changes before implementing the real account-management service. It must cover
   every privileged writer, recheck the caller, persist managementVersion, handle
   conflicts/stale/no-op rules, preserve the last active admin, coordinate teacher
   demotion with enrollment and atomically persist audit or roll back.
2. Then coordinate real U1/U2 numeric versions and enable reviewed UI submission;
   run genuine multi-admin concurrent writes, stale versions, actor revocation,
   audit-failure rollback, student promotion/history preservation, faculty
   deactivation/retained ownership and teacher-demotion/enrollment races. None of
   those successful mutation paths is certified by the current denial tests.
3. Only two real audits and five users exist locally. Multi-page reads were tested
   with limit 1/2; greater-than-20 audits, inactive account detail and large user
   pagination use regression fixtures. No fake records were added to MongoDB.
4. New success-audit persistence cannot be live-tested while account writes are
   closed. Existing audit persistence/redaction/pagination were verified; enrollment
   audit creation is not an existing contract and was not invented.
5. No query load/index tuning, retention deletion, fresh Kali practical or full
   screen-reader audit was performed. Existing unrelated catalogue/student-score,
   profile and experiment-authoring proposals remain outside Stage 6.

## Changed files

Backend (7): `controllers/adminController.ts`, `controllers/adminManagementController.ts`,
`controllers/dashboardController.ts`, `routes/adminRoutes.ts`,
`services/adminManagementService.ts`, `__tests__/adminManagement.test.ts`,
`__tests__/studentEnrollment.test.ts`, all under `server/src`.

Frontend (9): `pages/AdminDashboard.tsx`, `services/adminManagement.ts`,
`components/admin/{UserDirectory,AdminTeacherCohort,AdminAuditSearch,CreateUserForm}.tsx`,
`components/common/ConfirmDialog.tsx`, `__tests__/{AdminManagement,AdminDashboard}.test.tsx`,
all under `client/src`.

Documentation (3): this report, `docs/STAGE4B_API_IMPLEMENTATION_PLAN.md`,
`client/FRONTEND_API_REQUIREMENTS.md`. No auth, shared API type, model, lab engine,
Socket.IO, dependency or infrastructure files were changed. Stop at this stage;
the account-write blocker requires review before proceeding.
