# Stage 5: teacher academic monitoring — local delivery

Date: 2026-10-24. Branch: `integration/local-takeover`.
Starting HEAD: `3d1e930862d67123f1f5b55868b1b4abbd166f74`.
Backend commit: `ba3e5fad0b2c726467ef03fee20a7feea7fa73f1`.
Frontend commit: `4aa5f97c630f8b2406b1af44303275f7f8167b51`.
This acceptance document follows those code commits in a separate local commit.
No pushes, remote branch changes, PR actions, deployment or dependency installs.

The Stage 5 request authorizes the teacher reads T1/T2/T3/A1 from the reviewed
[Stage 4B plan](STAGE4B_API_IMPLEMENTATION_PLAN.md). Admin account/security policy,
new student APIs, schema changes, grading, terminal, lab engine and infrastructure
remain outside this implementation. Stage 4A enrollment is reused.

## Delivered endpoints and contracts

All four routes are faculty-only: authenticated current database role `faculty`
and active account, using the existing HttpOnly-cookie middleware. Each has an
exact `/api/faculty` alias. An administrator does not impersonate faculty.

| GET route | Implemented response and filters |
| --- | --- |
| `/api/teacher/students/:studentId/attempts` | `{studentId,scope:'current-enrollment-all-history',attempts,pagination}`. Rows include attempt ID, current experiment reference, real status, start/completion times, `assessmentScore`, `taskProgress`, consistent report ID/availability. Optional status, exact experimentId, from/to. |
| `/api/teacher/students/:studentId/reports` | `{studentId,reports,pagination}`. Rows contain report/attempt/experiment IDs, generatedAt, score, totalMarks, quizScore, genuine file availability and relative downloadUrl or null. Optional exact experimentId, from/to. |
| `/api/teacher/students/:studentId/reports/:reportId/download` | Original PDF, safe report-ID attachment filename, `application/pdf`, private/no-store. No query parameters or teacher generation. |
| `/api/teacher/analytics/experiments` | `{scope,cohort,experiments,pagination}` as A1. Membership/active/inactive counts, distinct participating/completing students, repeat-inclusive attempts/completions; per-experiment raw mean/best, normalized mean/coverage, cohort completion. Optional exact experimentId, from/to. |

Lists accept page 1..10000 (default 1), limit 1..100 (default 25). The UI uses
10 rows. Total is computed from the authorized filtered population before page
slicing; beyond-end pages return empty 200 with the true total. Unsupported,
repeated or malformed query fields fail 400. IDs are canonicalized to lowercase.
Attempt sort: startedAt descending, ID descending. Report sort: generatedAt
descending, ID descending. Analytics sort: experiment ID ascending.
Dates are UTC ISO instants in `[from,to)`, using attempt startedAt for history/
analytics and report generatedAt for reports. Filters reset the UI page; shrinking
result sets return to an available page. No fuzzy directory/search API is invented.

Current enrollment is checked before reads and again immediately before issuing
JSON/PDF headers. Every student attempt/report query is student-scoped. A report
must match its completed attempt, student, experiment and score; invalid/orphaned
reports are excluded before pagination/count and logged with a constant warning
without private fields. A missing file preserves the valid metadata with
`available:false`; it never becomes a successful download.

Downloads resolve the real configured report root, bind the deterministic
`cyberlabx-report-<attemptId>.pdf` filename to the matched attempt, reject a
different in-root file, traversal and symlink escape, require a regular file,
verify the opened descriptor's identity and stream that descriptor. Enrollment
is rechecked before PDF headers. A copied URL grants no future access after release.
Previously delivered bytes cannot be recalled.

New handlers return generic 404 for missing/foreign/released/mismatched/unavailable
academic resources, 400 `INVALID_REQUEST`, and sanitized 500 `INTERNAL_ERROR`.
Auth failures deliberately retain the existing middleware's message-only 401/403
body; authentication/security contracts were not changed. Analytics adds a
fail-closed 409 `COHORT_CHANGED` if the membership/active-state signature changes
during the read; the UI explains refresh rather than displaying stale scope or
misreporting an enrollment conflict.

Existing `/api/attempts/:id` and `/api/reports/*` remain student-only. No public
storage redirects, filesystem paths, quiz answers, command logs, runtime IDs,
Google subjects, passwords or session credentials are returned by these reads.

## Scores, progress and cohort semantics

- A raw grade is shown only for a completed attempt with a finite nonnegative
  recorded score. Genuine zero remains zero; other states are ungraded.
- A consistent persisted report supplies the historical maximum. Percentage is
  `100 * score / totalMarks`, rounded to two decimals when totalMarks is positive.
  Legacy attempts without a valid maximum show points and unknown maximum;
  today's mutable experiment definition is never used as a historical maximum.
- Verified tasks count distinct passed task IDs in persisted taskResults.
  Required task count and task percentage remain null because the model has no
  immutable historical task-total snapshot. Completion never fabricates 100% tasks.
- Per-experiment raw mean and best use recorded completed-attempt scores,
  including repeats; raw means are rounded to the nearest integer. Empty is null.
  The normalized mean uses only completed attempts with known valid positive
  report maxima, and `normalizedScoreCount` displays denominator coverage.
- Per-experiment completion divides distinct completing students by all current
  enrolled students, including inactive accounts. Empty cohort denominator is
  null. Participation is distinct students; attempt counts include repeats.
- Cohort counters span all filtered results, not page rows or sums of per-row
  unique counts. Enrollment membership totals remain the full current cohort
  even with experiment/date filters. Pre-enrollment work is included.
- Rows include published experiments plus IDs referenced by authorized history.
  Deleted definitions retain the historical ID with null metadata. Unrelated
  draft/archived/deleted experiments are not exposed.
- Existing faculty dashboard semantics remain unchanged: active enrolled student
  count, academic totals also including enrolled inactive accounts, rounded raw
  completed-score average (zero when empty), and report-record count.

## Screens and cache behavior

`/teacher` and `/faculty` reuse Student monitoring → View student. The detail
contains Attempt history and Student reports controls, accessible labeled exact
filters, explicit retries, genuine empty states, status badges, recorded scores,
timestamps, pagination and available PDF downloads. The separate Experiment
performance section shows cohort totals and experiment cards with denominator
explanations. Admin viewing Teacher Portal sees scoped pending states and makes
no requests to the new faculty-only APIs.

React Query keys include teacher and student identities and all applied filters.
Enrollment mutations invalidate lists, detail, faculty dashboard, own enrollment,
academic reads and analytics. Successful removal cancels and evicts that student's
academic/detail cache before refreshed summaries complete. Existing logout/session
cache handling is unchanged. A separate browser must refresh/refocus to observe
another session's changes; no push synchronization is claimed.

## Actual MongoDB/API/browser acceptance

Only localhost database `cyberlabx_local_takeover` was used. No academic fixtures
were inserted or fabricated. Existing student `6adc9fa6ee7bf58417c1675a` had:

| Record | Before | After |
| --- | --- | --- |
| Attempts | 1: `6adca585ee7bf58417c16a13` | Same ID and entire document |
| Reports | 1: `6adca597d794932ab5c57736` | Same ID and entire document |
| Academic result | Completed Nmap, 75/75, quiz 15, four distinct verified tasks | Unchanged |
| Original PDF | 1,918 bytes | Identical file/hash |
| Current assignment | Unassigned | Unassigned after authorized cleanup |
| Existing database documents | 22 | All 22 preserved; only test student's enrollment-driven updatedAt changes |

Original/downloaded PDF SHA256:
`c19669e84c35e33a4b73c443e21ed36c027d4e0b9cb677388622ba8f278e8fa9`.
The entire original documents were compared by private in-memory digests, with
only the test student's legitimate updatedAt normalized. This verifies account,
password/Google identity, status, attempts, reports, sessions, commands, experiments,
audits and other users without printing sensitive fields. No new account remains.

Installed Chrome `155.0.8059.85` was driven with the already available temporary
Playwright tooling; no shared manifest changes. Four ordinary password logins
were used for Faculty A, Faculty B, Student and Admin; a final targeted API check
used one further Faculty A login. Rate limits were not changed or bypassed.

| Live outcome | Result |
| --- | --- |
| A empty cohort/experiment overview | Rendered real empty membership and unknown score/denominator states |
| A UI enrollment and history | 201; completed Nmap rendered as 75/75 (100%), real task count and unknown task total |
| A academic reads, analytics, PDF | 200; mean/best 75 points, normalized mean 100%, coverage 1, completion 100%; UI download hash matches original |
| Anonymous → all four new routes | 401 |
| Student/Admin → all four new routes | 403 |
| B → A's student history/report metadata/PDF | Generic 404 for each; B analytics contains no A cohort activity |
| A → nonexistent student/report IDs | 404; invalid page 400 |
| Faculty → unchanged student attempt/report download routes | 403 |
| UI failed-status filter and running/failed/expired API filters | Real empty 200; no such records exist in this database |
| Failed history request and Retry | Request deliberately aborted; stale rows hidden; Retry recovered through actual API |
| UI unenrollment | 204; detail closes and analytics invalidates to the real empty cohort |
| A's copied history/metadata/PDF URLs after removal | 404 for all three |
| B enrolls after release, then reads history/PDF | 201 and 200; A remains denied 404; B cleanup 204 |
| Final report integrity facet, date filter and pagination | 200; future-date empty total 0; page 2 empty with real total 1 |
| Final analytics using uppercase experiment ID | 200, one correct normalized Nmap row |

Primary run: **70 passing assertions**, 76 captured response status entries,
12 masked screenshots and eight viewport renders. Targeted final backend follow-up:
**9 passing assertions**, including unchanged document digests after cleanup.
Actual pages visited: `/login`, `/teacher`, `/student`, `/admin`.
Teacher history and teacher reports were each rendered at **320, 375, 768 and
1280 × 900**; all document scroll widths fit their viewport. Their renders also
include the cohort performance cards, forms and existing navigation. This does
not replace the earlier full-platform browser acceptance or concurrency evidence.

Local, ignored evidence (not committed):

- `.env.stage5-evidence/results.json`: sanitized checks, actual API DTOs, response
  statuses, viewport measurements, page/console observations and record IDs.
- `.env.stage5-evidence/followup.json`: final report/analytics/cleanup assertions.
- `.env.stage5-evidence/teacher-attempts-{320,375,768,1280}.png` and
  `teacher-reports-{320,375,768,1280}.png`.
- `teacher-empty.png`, `teacher-filter-empty.png`, `teacher-history-error.png`,
  `admin-academic-guard.png` in the same directory; account email text is masked.
- `teacher-authorized-download.pdf`: the matching UI-downloaded PDF, kept local.
- Ignored local harnesses: `server/.env.stage5-browser.mjs` and
  `server/.env.stage5-followup.mjs`; no secrets are embedded in them.

There were **zero uncaught browser page errors**. Console evidence contains eight
expected unauthenticated-bootstrap 401 resource messages (before the four logins)
and one deliberately aborted-request resource error. A perfectly empty browser
console is not claimed.

## Fresh regression results

| Check | Actual result |
| --- | --- |
| `npm --prefix server test` | PASS: 34 files, **293/293 tests**; includes 31 new teacher academic tests |
| `npm --prefix client test` | PASS: 17 files, **194/194 tests**; includes 20 new academic UI tests and updated enrollment/overview regressions |
| `npm --prefix server run build` | PASS |
| `npm --prefix client run build` | PASS; existing >500 kB chunk warning remains (about 798 kB main chunk) |
| `npm --prefix client run lint` | PASS, no findings |
| `npm --prefix server run lint` | FAIL: exactly the three pre-existing unused-variable findings below; no new findings |
| ESLint on all four new backend source/test files | PASS, zero warnings/errors |
| `git diff --check` | PASS |

The server's existing lint findings are `NMAP_LAB_DEFINITION` at
`server/src/__tests__/allExperiments.test.ts:9`, `DOS_LAB_DEFINITION` at line 10,
and `_next` at `server/src/middleware/error.ts:3`, all
`@typescript-eslint/no-unused-vars`. They were not suppressed or modified.
Existing mocked failure-path regression logs (unavailable Docker, failed cleanup,
PDF generation failure) occur in passing tests; they are not live runtime results.

The final full suites were freshly run. Affected tests/builds were rerun after
fixes, including a TypeScript test-mock typing issue, report integrity filtering,
UTC range comparison, uppercase IDs, cohort-change messaging and page shrinkage.
No test/security rule was weakened.

Backend coverage includes current-role enforcement, generic ownership denials,
revocation between read/header checks, report consistency, bounded filters/pages,
ungraded states, zero/unknown/mixed maxima, repeat/inactive/deleted-experiment
denominators and file confinement. Frontend coverage includes real contract
fixtures for all attempt states, filters, errors/retries, pagination/shrinkage,
metadata/downloads, unavailable PDFs, admin guards and mutation invalidation/
eviction. Those fixtures are mocks, clearly distinct from the live checks above.

## Remaining limits and separate approvals

- Only one real completed attempt/report exists locally. Nonempty running,
  failed and expired histories and mixed-score cohorts are regression-tested
  with fixtures; their live filters return genuine empty data. No unrelated
  lab runs or artificial academic records were created just to populate screens.
- No fresh Kali/Docker practical was started. Existing academic records and
  existing PDF were validated; lab runtime availability is not certified here.
- Historical required-task/max snapshots are absent. Task percentages remain
  unknown, and score normalization coverage is explicit. Immutable snapshots
  would require separately approved model/grading coordination.
- Analytics uses fixed-count scoped database reads and groups minimal academic
  projections in memory; only the output is paginated. Large-cohort load testing
  and database aggregation/streaming optimization remain future work. No
  platform-wide attempt scan or per-student query loop is used.
- Offset pages are read-time views and can shift under concurrent academic writes;
  ownership is checked at response authorization, not a historical snapshot.
  No concurrent-transfer browser race or filesystem replacement attack was
  staged live; targeted regressions cover final ownership and path checks.
- Semantic HTML, native controls, labels, focus/disabled behavior and responsive
  layouts are used. A full assistive-technology/manual keyboard audit is not
  claimed by these automated tests.
- Existing student-facing `%`/`/100` assumptions and catalogue category projection
  remain Stage 4B follow-ups; this stage does not silently expand student APIs.
- Admin directory/lookup, safe account-update policy, audit search, admin academic
  routes, profile mutations and experiment authoring remain unimplemented proposals.
  No new security-sensitive admin policy is selected by this stage.

The changed files are limited to five backend API/test files, ten frontend
component/service/test files and three documentation files. No model, existing
student report/auth controller, shared API type, lab/Socket.IO, dependency,
database configuration or infrastructure file is changed. Original development
branches are preserved. Stage 5 stops here, with local commits only.

## Changed-file inventory

Backend:

- `server/src/app.ts`
- `server/src/routes/teacherAcademicRoutes.ts`
- `server/src/controllers/teacherAcademicController.ts`
- `server/src/services/teacherAcademicService.ts`
- `server/src/__tests__/teacherAcademics.test.ts`

Frontend:

- `client/src/pages/FacultyDashboard.tsx`
- `client/src/components/faculty/TeacherEnrollment.tsx`
- `client/src/components/faculty/StudentAcademics.tsx`
- `client/src/components/faculty/CohortPerformance.tsx`
- `client/src/components/faculty/AcademicControls.tsx`
- `client/src/services/enrollment.ts`
- `client/src/services/teacherAcademics.ts`
- `client/src/__tests__/TeacherAcademics.test.tsx`
- `client/src/__tests__/TeacherEnrollment.test.tsx`
- `client/src/__tests__/FacultyDashboard.test.tsx`

Documentation:

- `docs/STAGE5_TEACHER_MONITORING.md`
- `docs/STAGE4B_API_IMPLEMENTATION_PLAN.md`
- `client/FRONTEND_API_REQUIREMENTS.md`
