# Checkpoint 3 acceptance: live integration, browser and final regression

Assessment date: 2026-10-24. Branch: `integration/local-takeover`.
Checkpoint 3C starting HEAD: `5875b6faa27e0f8112ea8fe582c80a0ee9db22dc`.
Checkpoint 3B starting HEAD: `a4875de26c59e977c6fd8e716c424d194d4295a8`.
Application source is unchanged from `d25208514f7a7c1d8317bfad2bae60e3ff65a2f2`.
The final documentation commit can be identified with
`git log -1 --format=%H -- docs/CHECKPOINT3_LIVE_VERIFICATION.md`; its SHA is also
reported in the completion message. A commit cannot embed its own resulting SHA.
This checkpoint changes documentation only. All work remains local.

## Outcome and scope

Real MongoDB-backed enrollment, ownership, authorization, fresh-session persistence,
and ten concurrent enrollment rounds passed. The original live harness recorded 58 expected
HTTP statuses with zero unexpected statuses; an additional authenticated admin
dashboard read also returned 200. No application defect or source correction was
required. Checkpoint 3B added nine missing real rounds and rendered acceptance in
installed Chrome. Checkpoint 3C then verified nonempty academic-history
preservation using one genuine completed Nmap attempt and generated PDF, and
freshly ran all six regression commands. The ten concurrency rounds and browser
matrix were **not repeated** in 3C. Remaining limits are listed at the end.

No enrollment UI, new API, security change, infrastructure change, deployment,
push, remote branch modification, or PR operation was performed. Checkpoints 3
and 3B did not execute labs. In 3C a controlled existing local Docker/Nmap workflow
created valid academic history; this was not a new lab implementation or a broad
runtime acceptance exercise.

## Services and isolation

| Service | Verified result |
| --- | --- |
| MongoDB | `cyberlabx-local-takeover-mongodb`, healthy; authenticated database ping passed |
| Database | `cyberlabx_local_takeover`; harness rejects another database or non-loopback host |
| API | `http://localhost:5000/health`, GET 200 |
| Vite | `http://localhost:5173`, HTTP availability and Chrome rendering verified |
| Storage | Existing dedicated volume `cyberlabx_local_takeover_mongodb_data` preserved |

The older Mongo container/volume were not reset or deleted. Services were already
running and did not require restart. MongoDB has the documented compound cohort
index `{teacherId: 1, role: 1, _id: 1}` and the `_id` identity index. The cohort
index supports queries; it is not a unique-owner constraint. Single ownership is
enforced by the existing atomic enrollment predicate on the student document.

## Accounts and preservation

Faculty A and admin used existing seeded accounts. A separate Faculty B and test
student were created through authorized `POST /api/admin/users` calls (201 each).
All relationship writes used application APIs; MongoDB access was read-only.

Before writes, all 11 pre-existing records (three users and eight experiments)
were snapshotted and hashed. Every original record matched afterward. The seeded
student was not used for enrollment writes. The test student's identity and
password hash remained unchanged through unenrollment. Its attempts, reports,
and lab-session counts remained zero. Preservation of **nonempty** student
history was therefore not exercised; no fabricated history was inserted.

Test relationships were removed through authorized DELETE endpoints. The two
new accounts remain intentionally: there is no account-deletion flow used here.
Checkpoint 3B inventory was five users, two active students, eight experiments (seven
published), zero lab sessions, and two real user-creation audit events. The test
student remains active and unassigned, with no `teacherId` or `enrolledAt`.

Checkpoint 3B reused these accounts without creating additional users or audit
events. All 15 existing documents (five users, eight experiments, two audit
events) were snapshotted before the additional rounds and verified afterward.
Only the dedicated test student's normal `updatedAt` changed; its other fields
and every other document were unchanged. The browser enrollment/cleanup cycle
independently repeated this preservation check for the same 15 records.

Credentials are retained only in ignored local `.env` entries. The local harness
`server/.env.checkpoint3.mjs` and sanitized evidence `.env.checkpoint3-results.json`
are ignored and are not part of this commit. Sessions were held in memory and
logged out. No credential, cookie, JWT, or connection secret is included here.

## Actual HTTP results

Paths below use placeholders rather than account identifiers. A/B denote the
two separate authenticated faculty sessions. All paths except `/health` have
the `/api` prefix.

| Actor/action | Method and path | Actual result |
| --- | --- | --- |
| Admin, A, B, test student, fresh student session | POST `/api/auth/login` | 200 each |
| Admin creates B and test student | POST `/api/admin/users` | 201 each |
| A enrolls by student ID | POST `/api/teacher/students` | 201 |
| A lists own cohort | GET `/api/teacher/students` | 200; student present |
| A reads own student | GET `/api/teacher/students/:studentId` | 200; correct teacher and zero progress |
| Student reads assignment | GET `/api/student/enrollment` | 200; Faculty A |
| B enrolls already assigned student | POST `/api/teacher/students` | 409 |
| B reads A's student | GET `/api/teacher/students/:studentId` | 404 |
| A repeats enrollment | POST `/api/teacher/students` | 409 |
| A unenrolls | DELETE `/api/teacher/students/:studentId` | 204 |
| Student session after release | GET `/api/auth/me` | 200 |
| Student enrollment after release | GET `/api/student/enrollment` | 200; null |
| A repeats removal | DELETE `/api/teacher/students/:studentId` | 404 |
| B enrolls released student with padded, uppercase exact email | POST `/api/teacher/students` | 201; normalized match |
| Fresh student session reads assignment | GET `/api/student/enrollment` | 200; Faculty B |
| Admin lists B's cohort | GET `/api/admin/teachers/:teacherBId/students` | 200; student present |
| Admin reads B's student | GET `/api/admin/teachers/:teacherBId/students/:studentId` | 200; correct relationship |
| Admin uses wrong teacher/student pair | GET `/api/admin/teachers/:teacherAId/students/:studentId` | 404 |
| Admin releases B relationship | DELETE `/api/admin/teachers/:teacherBId/students/:studentId` | 204 |
| A and B concurrently enroll same released student | POST `/api/teacher/students` twice | A 201; B 409 |
| Race winner removes relationship | DELETE `/api/teacher/students/:studentId` | 204 |
| All five authenticated sessions | POST `/api/auth/logout` | 204 each |
| Admin reads platform dashboard afterward | GET `/api/admin/dashboard` | 200; users 5, activeStudents 2, attempts 0, auditEvents 2 |

MongoDB reads after each successful enrollment confirmed one student document,
the response's teacher owner, and a stored enrollment timestamp. A fresh student
login independently restored B's assignment. This satisfies the fresh-session
persistence alternative; persistence through a process restart was not tested.

### Invalid requests and permissions

| Request | Actual result |
| --- | --- |
| Faculty POST `/api/teacher/students`: missing selector, both selectors, injected `teacherId`, or malformed student ID | 400 each; `Invalid request data.` |
| Faculty POST same route with valid but nonexistent student ID | 404; `Eligible student not found.` |
| Faculty GET `/api/teacher/students?page=0` | 400 |
| Faculty GET `/api/teacher/students/invalid` | 400 |
| Anonymous GET or POST `/api/teacher/students` | 401 each; `Authentication required.` |
| Student POST `/api/teacher/students` | 403 |
| Admin GET faculty-only `/api/teacher/students` | 403 |
| Faculty GET `/api/admin/teachers/:teacherId/students` | 403 |
| Faculty GET `/api/student/enrollment` | 403 |

409 responses were `Student is already enrolled.`; foreign or removed enrolled
student details returned `Enrolled student not found.`. Wrong-role requests used
the existing permission-denied response. No ownership or authorization rule was
changed.

## Concurrency and metric isolation

Two requests were issued concurrently with separate faculty sessions against
one eligible unassigned student. The observed distribution was exactly one 201
and one 409. MongoDB contained exactly one owner matching Faculty A's successful
response. The original evidence established **one** round, not ten. It is retained
as round 1; only the nine missing rounds were executed in Checkpoint 3B.

| Round | Evidence | A POST status | B POST status | Winner / stored owner | Stored owner count | Winner matches MongoDB | Winner DELETE | Unassigned before/after |
| --- | --- | ---: | ---: | --- | ---: | --- | ---: | --- |
| 1 | Original Checkpoint 3 | 201 | 409 | A | 1 | Yes | 204 | Yes / Yes |
| 2 | Checkpoint 3B | 201 | 409 | A | 1 | Yes | 204 | Yes / Yes |
| 3 | Checkpoint 3B | 409 | 201 | B | 1 | Yes | 204 | Yes / Yes |
| 4 | Checkpoint 3B | 201 | 409 | A | 1 | Yes | 204 | Yes / Yes |
| 5 | Checkpoint 3B | 409 | 201 | B | 1 | Yes | 204 | Yes / Yes |
| 6 | Checkpoint 3B | 201 | 409 | A | 1 | Yes | 204 | Yes / Yes |
| 7 | Checkpoint 3B | 409 | 201 | B | 1 | Yes | 204 | Yes / Yes |
| 8 | Checkpoint 3B | 201 | 409 | A | 1 | Yes | 204 | Yes / Yes |
| 9 | Checkpoint 3B | 409 | 201 | B | 1 | Yes | 204 | Yes / Yes |
| 10 | Checkpoint 3B | 201 | 409 | A | 1 | Yes | 204 | Yes / Yes |

Each round used two separately authenticated faculty sessions and concurrent
`Promise.all` POSTs to `/api/teacher/students` against the same dedicated student.
Request dispatch order alternated in the added rounds; either winner is valid.
All ten rounds returned exactly one 201 and one 409. Each successful response's
teacher ID matched the single stored owner and the timestamp existed. Every
round ended with the winner's authorized 204 DELETE and a read confirming both
enrollment fields absent. The documented cohort and identity indexes were
rechecked against the real database. This is repeated competing-request
validation, not a large-scale stress test or a mocked concurrency test.

At each phase, A, B, and admin called GET `/api/faculty/dashboard` (200 each).
Admin is deliberately allowed platform-wide metrics on this endpoint; faculty
metrics describe only their current enrolled cohort.

| Phase | A students | B students | Admin platform students |
| --- | ---: | ---: | ---: |
| A enrolled | 1 | 0 | 2 |
| Released then assigned to B | 0 | 1 | 2 |
| Concurrent winner A | 1 | 0 | 2 |
| Final cleanup | 0 | 0 | 2 |

`completedAttempts`, `averageScore`, and `reports` were zero in every response.
Empty-cohort values were correct, and student counts tracked ownership without
leaking the other faculty's count. Isolation of nonzero scores/report totals
cannot be established from this empty-history live fixture. No discrepancy was
observed in the exercised data.

## Checkpoint 3B: actual rendered browser acceptance

The original in-app browser was unavailable. Reinspection in Checkpoint 3B found
installed Chrome and Edge, and the bundled Windows computer-use tool could list
their windows. For exact viewport control, `playwright-core` was installed in
`%TEMP%/cyberlabx-checkpoint3b-browser`, outside the checkout, using
`--no-package-lock --ignore-scripts --no-audit --no-fund`. No browser download,
project dependency/manifest change, browser extension, or shared profile change
was needed. Tests launched the installed Chrome **155.0.8059.85**, headless, with
isolated browser contexts. Edge was detected but not tested.

These were rendered Chromium pages using the running Vite/Express/Mongo stack,
not HTML-availability checks or mocked component tests. Successful API responses
were never fabricated. A delayed real response exercised loading; intentionally
aborted dashboard requests exercised failure and recovery.

### Pages, states and viewport evidence

All eleven rows below were rendered and captured at **320x900, 375x900,
768x900, and 1280x900 CSS pixels**, device scale factor 1: 44 viewport/page-state
combinations. No combination had document/body width exceeding the viewport.
Screenshots cover headings, navigation, cards, wrapped copy and forms. Existing
history is empty, so populated history tables were not rendered.

| Session / URL | Actual rendered verification |
| --- | --- |
| Anonymous `/login` | Somaiya branding, labeled email/password controls, keyboard Tab from email to password |
| Student `/student` | Authenticated identity, real summary and catalogue cards; session survives refresh |
| Student `/experiments` | Seven real published experiments; Nmap search, no-match state, clear filters and returned-category selection |
| Student `/experiments/:id` for returned Nmap ID | Overview, objectives, procedure, tasks, theory, safety and Start Experiment Lab controls; no lab started |
| Student `/progress` | Real zero completion, progress indicator and experiment-wise not-started cards |
| Student `/history` | Real empty attempt history and filter/sort controls |
| Student `/profile` | Authenticated account information and session controls |
| Student `/labs/000000000000000000000001` | Real 404 safe error, retry and exit to catalogue; not a terminal session |
| Faculty `/teacher`, alias `/faculty` | Empty cohort, four zero metrics, explicit currently-enrolled scope and pending monitoring/enrollment sections |
| Faculty `/faculty` after actual enrollment | One active enrolled student, zero completed attempts, meaningful no-completed-attempts message |
| Admin `/admin` | Users 5, active students 2, attempts 0; two real creation audit events, published experiments and expanded account-creation form |

At 320 and 375 widths, mobile navigation opened; Escape from a focused mobile
link closed it and restored focus to the toggle, for every authenticated matrix
row. Student refresh restored the cookie-backed session. Student access to
`/teacher` and `/admin` returned to `/student`; faculty access to `/admin` and
`/student` returned to `/teacher`; admin access to `/student` returned to `/admin`.
Anonymous `/student` redirected to `/login`. Admin Teacher Portal and Admin
Dashboard links were clicked and reached their respective rendered pages.

Logout was exercised for all three roles. Subsequent authenticated-session
lookup returned 401; back navigation and refresh stayed on login without private
main content. This verifies rendered cache/session clearing on these paths, not
revocation of a previously copied JWT. Student localStorage contained no JWT.

The faculty populated state used a real authenticated POST through the browser
context (201), MongoDB owner verification, and the UI's Refresh overview action.
Authorized DELETE returned 204 afterward. A follow-up read and rendered view
confirmed all faculty metrics returned to zero. Admin Teacher Portal copy
correctly describes platform-wide scope. Teacher enrollment UI remains absent
by design; it was not implemented here.

The admin form was opened at every width. Empty submission invoked native
required-field validation. Valid local review-only input reached the review
step with `Teacher (faculty)` and returned to the form. **Confirm create account
was not submitted**: account creation itself was already verified through the
real API in Checkpoint 3, and this browser pass created no account. Audit search
produced a no-match state and Clear audit filters restored both real events.

The loading screenshot shows an actual query held before its real network
response. Aborting only `/api/student/dashboard` produced the learning-progress
error and Try again control. Removing the failure and clicking Try again restored
real dashboard data. Other catalogue content remained usable during this error.

### Console, network and harness limitations

Three retained browser evidence files contain 141 assertion samples: 138 true
samples and three premature `isVisible` false samples. The latter checked faculty
empty-state/scope copy and the admin audit heading immediately after navigation;
screenshots already showed the expected final content. A focused follow-up
explicitly awaited those elements and passed all three, plus seven additional
metric/audit/navigation checks. There is no unresolved failed application check.

Earlier temporary-harness interruptions involved an ambiguous Start Lab locator,
a route-handler release race, and an incorrect expected error string. These were
test-harness issues, corrected without touching application code. The retained
first-pass JSON has `success: false` because it stopped on the incorrect string;
its preceding 68 successful observations remain valid. Remaining checks resumed
separately rather than claiming that interrupted run was a full pass.

Across retained evidence: **zero uncaught browser page errors, zero console
warnings, and zero observed API 5xx/CORS failures**. Resource-error console entries
were expected: 20 unauthenticated 401s, eight deliberately aborted dashboard
requests, and four nonexistent-lab 404s (including query retries). This is not a
claim that the console emitted no errors at all.

The browser response listeners recorded the following actual API traffic. This
table excludes direct APIRequestContext helper calls and interrupted earlier
exploratory runs; no request/response headers, credentials or session values are
retained in evidence.

| Method | Path | Status | Observations |
| --- | --- | ---: | ---: |
| GET | `/api/auth/me` | 401 | 20 |
| POST | `/api/auth/login` | 200 | 6 |
| GET | `/api/auth/me` | 200 | 36 |
| GET | `/api/student/dashboard` | 200 | 6 |
| GET | `/api/experiments` | 200 | 12 |
| GET | `/api/experiments/:id` | 200 | 1 |
| GET | `/api/student/history` | 200 | 2 |
| GET | `/api/labs/:id` | 404 | 4 |
| POST | `/api/auth/logout` | 204 | 3 |
| GET | `/api/faculty/dashboard` | 200 | 8 |
| GET | `/api/admin/dashboard` | 200 | 4 |

### Local artifacts

There are **49 PNG screenshots** in ignored `.env.checkpoint3b-evidence/`: the
44 matrix screenshots plus student loading/error, admin review, and settled
faculty/admin confirmations. Matrix names are `<page>-<width>.png`, with pages
`login`, `student-dashboard`, `catalogue`, `nmap-details`, `progress`, `history`,
`profile`, `lab-unavailable`, `faculty-empty`, `faculty-enrolled`, and `admin`.
Password/email form inputs were masked in screenshots. Development account names
and IDs may appear in rendered views; artifacts are local, not committed/uploaded.
Representative screenshots were visually reviewed in addition to DOM checks.

Sanitized local evidence:

- `.env.checkpoint3-results.json`: original round 1 and enrollment flows.
- `.env.checkpoint3b-results.json`: rounds 2-10, index and preservation assertions.
- `.env.checkpoint3b-evidence/browser-results.json`: student matrix/loading, then
  harness interruption described above.
- `.env.checkpoint3b-evidence/browser-results-remaining.json`: recovery, lab error,
  logout, faculty/admin matrix and preservation checks.
- `.env.checkpoint3b-evidence/browser-results-followup.json`: ten successful
  settled-state and navigation/audit confirmations.

Representative screenshot SHA-256 fingerprints:

| File | SHA-256 |
| --- | --- |
| `login-320.png` | `F1B56AD6107779E6EEFAD2FF8AC3FB5B5141BBC69AE271B5AC83BB9EAC438BCD` |
| `catalogue-1280.png` | `ECDDBBD7DDFF242F2327F4962BC5B5B73B944E2210B974D990FA3865F01D2E4F` |
| `faculty-enrolled-320.png` | `788FAA08126222D68B859D85AB0FB5FB8913521FD4605A4200FC569D92CA8786` |
| `admin-768.png` | `C413306C0F80D756FA945DD2F356122EFD539760DCB769773DE7F065DC8E32A8` |
| `student-error.png` | `6154649ECC717110DA153B65EC59532ECA77440C1BCA6F702013E6A90282C7EF` |

### Unverified behavior and remaining manual acceptance

No browser-availability blocker remains. Chrome headless was tested; headed
Chrome/Edge, real touch hardware, screen-reader output and a full keyboard-only
audit remain pending. The subset of keyboard/menu checks above passed.

The live catalogue list omits `category` in the existing server projection,
although detail responses include it. Cards therefore show `Uncategorized` and
the only returned-data category choice is that fallback. Search and selecting
the available fallback work; meaningful multi-category filtering needs the
existing list contract to supply category. This is a recorded dependency, not an
API change made in this checkpoint.

At Checkpoint 3B the isolated database had no attempts/reports for the dedicated
student. Creating nonempty academic history would have required labs or
unsupported inserted fixtures; neither was done in 3B. Nonempty-history
preservation and nonzero score/report metric isolation were then unverified.
No actual terminal was mounted in that browser pass: terminal width,
input/output, resize, reconnect, Socket.IO, grading and report download remain
pending a separately authorized real lab session. The nonexistent-lab error
matrix must not be counted as terminal or Kali validation. These are the
limitations recorded at 3B: the 3C section below supersedes the nonempty-history
and basic real Socket.IO command/report-download gaps only. Browser terminal
rendering, resize and reconnection remain untested.

For a headed Chrome/Edge manual follow-up:

The following optional checklist originated in 3B. Its zero-history expectations
still apply to the untouched seed student. For the dedicated test student after
3C, expect one completed attempt/report instead; platform attempt count is now 1.

1. Open `http://localhost:5173/login`, use local credentials privately, and repeat
   the exact role URLs in the matrix. In DevTools responsive mode set widths
   320, 375, 768 and 1280, height 900, zoom 100%. Expect wrapped copy, usable forms,
   no page-level horizontal scroll, and the mobile menu below 768px.
2. At `/student`, refresh, then use navigation to `/experiments`, Nmap's real
   detail link, `/progress`, `/history` and `/profile`. Expect seven catalogue
   entries, zero completion, empty history and the current account. Sign out;
   browser Back, refresh and direct `/student` must not reveal private content.
3. Faculty: visit `/teacher` and `/faculty`; after cleanup expect zero cohort
   metrics and enrolled-cohort descriptions. A populated-cohort repeat requires
   authorized API enrollment of the dedicated test student, Refresh overview,
   and API cleanup; do not invent UI controls. Admin: visit `/admin`, inspect
   five users/two active students/two audit events and the expandable creation
   form; do not confirm creation merely to repeat form rendering.
4. Inspect Console/Network while navigating. A deliberate offline/failing API
   should show an error/retry state; restore connectivity before retry. Record
   actual statuses and unexpected errors without copying sensitive headers.
5. Only after separate lab authorization and a real successful Start Lab, use
   the returned `/labs/:labSessionId` URL. At all four widths inspect instructions,
   task verification, terminal containment and internal scrolling. Run only an
   authorized harmless lab command, resize, test reconnect and use existing stop
   functionality. Until then mark all terminal/runtime/report checks pending.

## Checkpoint 3C: nonempty academic-history preservation

### Fixture assessment and supported creation

Read-only inspection confirmed both development students initially had zero
attempts and reports. The seeded student was left untouched. The existing
dedicated test student `6adc9fa6ee7bf58417c1675a` was active and unassigned.
The checked-in seeder supplies users/experiments, not academic history; enrollment
and completion unit-test fixtures mock MongoDB and are not live history evidence.

The configured `LAB_BACKEND=docker` and both required images
`cyberlabx-kali:latest` / `cyberlabx-target:latest` were already available locally.
No image pull/build, package upgrade, VM setup, infrastructure or security change
was required. The existing controlled application workflow was therefore usable:

| Real action | Result |
| --- | --- |
| Student POST `/api/auth/login` | 200 |
| GET `/api/experiments` and returned Nmap detail | 200 each |
| POST `/api/labs/start` | 201; real running Docker lab |
| Authenticated Socket.IO connection and `terminal:join` | Real terminal ready; original cookie/origin authorization retained |
| Host discovery task POST `/api/tasks/live-host/submit` | 200, passed, 10 marks |
| SYN task POST `/api/tasks/syn-scan/submit` | 200, passed, 15 marks |
| OS task POST `/api/tasks/os-detection/submit` | 200, passed, 15 marks |
| Service task POST `/api/tasks/service-detection/submit` | 200, passed, 20 marks |
| POST `/api/quizzes/:experimentId/submit` | 200; completed attempt, recorded total score 75, real report generated |
| GET `/api/reports/:reportId/download` | 200; 1,918 bytes beginning with `%PDF-` |
| POST `/api/labs/:labSessionId/stop` after completion | 204; session stopped |

Commands went through the existing Socket.IO terminal bridge, never direct
database writes or fabricated command evidence. Each real scan completed and
reported a reachable host; server-created command logs contained its output
before task verification. Targets were restricted to the lab's private
`nmap-target`, with bounded port/time settings where applicable:

```text
nmap -sn nmap-target
nmap -sS -p 80 --max-retries 1 --host-timeout 20s nmap-target
nmap -O -p 80 --max-retries 1 --host-timeout 25s nmap-target
nmap -sV -p 80 --version-light --max-retries 1 --host-timeout 25s nmap-target
```

The quiz used the existing submission contract and options from the actual
experiment; no grade, completion index, attempt or report was inserted manually.
This proves one genuine Docker-backed academic-history workflow, not OS-detection
accuracy, every experiment, browser xterm rendering, VM/QEMU, reconnect or resize.

### Non-sensitive identities and before/after evidence

| Record | Identifier |
| --- | --- |
| Dedicated student | `6adc9fa6ee7bf58417c1675a` |
| Faculty A | `6adc9cf2ed9b029f30c28bb0` |
| Faculty B | `6adc9fa5ee7bf58417c16754` |
| Completed attempt | `6adca585ee7bf58417c16a13` |
| Report | `6adca597d794932ab5c57736` |
| Stopped lab session | `6adca585ee7bf58417c16a15` |

The completed attempt/report existed **before** either preservation-test
enrollment. The complete academic documents and PDF byte hashes were compared
after every transition, rather than comparing only counts.

| State | Active account | Teacher / enrollment timestamp | Attempts | Reports | Academic documents / PDF |
| --- | --- | --- | ---: | ---: | --- |
| Before enrollment | Yes | Both fields absent | 1 | 1 | Preservation baseline captured |
| A enrolled | Yes | A / `2026-10-24T12:33:28.124Z` | 1 | 1 | Identical to baseline |
| A removed | Yes | Both fields absent | 1 | 1 | Identical to baseline |
| B enrolled after release | Yes | B / `2026-10-24T12:33:28.201Z` | 1 | 1 | Identical to baseline |
| B removed / final cleanup | Yes | Both fields absent | 1 | 1 | Identical to baseline |

Attempt/report IDs in every row were exactly the IDs above. PDF SHA-256 before
and after every transition:
`c19669e84c35e33a4b73c443e21ed36c027d4e0b9cb677388622ba8f278e8fa9`.
Student identity/account fields, including password hash, Google ID, avatar,
role, active status and creation time, were compared privately and unchanged.
This student has password authentication and no linked Google ID; unchanged
absence was verified, not a real Google OAuth flow or linked-account test.
No identity secret or password hash is printed in evidence.

### Ownership and removal HTTP evidence

Both faculty logins returned 200, in separate real authenticated sessions.
These are the new nonempty-history checks, not repeated concurrency rounds:

| Actor / action | Method and route | Actual status |
| --- | --- | ---: |
| A enrolls history-bearing student | POST `/api/teacher/students` | 201 |
| B reads A-owned relationship | GET `/api/teacher/students/:studentId` | 404 |
| B attempts takeover before release | POST `/api/teacher/students` | 409 |
| A releases student | DELETE `/api/teacher/students/:studentId` | 204 |
| A reads after losing relationship | GET `/api/teacher/students/:studentId` | 404 |
| B enrolls only after release | POST `/api/teacher/students` | 201 |
| A reads B-owned relationship | GET `/api/teacher/students/:studentId` | 404 |
| B removes test relationship | DELETE `/api/teacher/students/:studentId` | 204 |

MongoDB confirmed the expected owner after each successful POST. Both optional
fields were absent after each removal. All 20 workflow/preservation assertions
passed. The harness recorded 23 expected HTTP statuses plus the successful
binary report-download response. All three sessions logged out with 204.

### Database preservation and cleanup

All 15 pre-existing documents were snapshotted and compared after this workflow.
Fourteen were byte-equivalent after JSON serialization; the dedicated student's
only allowed change was its normal `updatedAt`. Its identity fields remained
identical. The seed student, other accounts, experiments and two existing audit
events were unchanged. Neither database collections nor Docker volumes were
reset, and no academic record was removed.

Final database inventory: five users, eight experiments, two existing audit
events, **one completed attempt, one report, one stopped lab session, and four
real terminal command logs**. The dedicated student remains active and
unassigned. These seven new, internally consistent workflow records and the PDF
are intentionally retained as development history for demo/future acceptance.
The existing API has no academic-record deletion flow; direct deletion merely
to restore empty counts would remove useful validated evidence. No additional
account was created. Existing Faculty B/test-student development accounts remain.

Normal application completion/stop removed the test containers and internal
network. Docker queries filtered by this exact attempt label returned no
remaining container/network. The dedicated MongoDB container remains healthy.
The reaper and unrelated Docker resources were not altered.

Ignored local evidence: `.env.checkpoint3c-inspection.json` (initial record
fingerprints/counts), `.env.checkpoint3c-history-results.json` (statuses,
non-sensitive IDs, preservation results), and the two `.env.checkpoint3c*.mjs`
validation scripts under `server/`. The generated PDF is in ignored
`server/reports/cyberlabx-report-6adca585ee7bf58417c16a13.pdf`.

## Checkpoint 3C: mandatory fresh regression

All six requested commands were newly executed against unchanged application
source on 2026-10-24. These are actual 3C results, not reused baseline claims.

| Command | Exit code | Fresh outcome |
| --- | ---: | --- |
| `npm --prefix server test` | 0 | **262 passed**, 33 test files passed, zero failures; Vitest 3.2.7 |
| `npm --prefix client test` | 0 | **147 passed**, 14 test files passed, zero failures; Vitest 3.2.7 |
| `npm --prefix server run build` | 0 | TypeScript production build passed |
| `npm --prefix client run build` | 0 | TypeScript/Vite production build passed; Vite 6.4.3, 1,766 modules |
| `npm --prefix server run lint` | **1** | **Failed: exactly three pre-existing errors**, no new lint finding |
| `npm --prefix client run lint` | 0 | Passed with `--max-warnings=0` |

Known server lint failures, reported without suppression or code changes:

- `server/src/__tests__/allExperiments.test.ts:9:3`:
  `NMAP_LAB_DEFINITION` defined but unused, `@typescript-eslint/no-unused-vars`.
- `server/src/__tests__/allExperiments.test.ts:10:3`:
  `DOS_LAB_DEFINITION` defined but unused, same rule.
- `server/src/middleware/error.ts:3:67`: `_next` defined but unused, same rule.

Server tests emitted expected diagnostics for mocked Docker-unavailable,
cleanup-retry, PDF-failure and VM-monitor-failure paths; the associated tests
passed. Those messages are not new live runtime failures. These regression
suites remain distinct from the real MongoDB/Socket.IO workflow above.

Client build retains its existing >500 kB chunk advisory: JavaScript 768.84 kB /
218.14 kB gzip; CSS 35.38 kB / 7.61 kB gzip. No warning threshold, test, security
rule, dependency or application file was changed. Dependency audit findings
were not rescanned or repaired in this stage.

## Final acceptance classification and local handoff

| Classification | Evidence / remaining scope |
| --- | --- |
| **Passed** | Ten real competing enrollment rounds, documented individually above; not repeated in 3C |
| **Passed** | 3B rendered browser matrix: 44 combinations, 49 screenshots in the recorded ignored directory; not repeated in 3C |
| **Passed** | Real nonempty attempt/report/PDF preservation, unchanged identity, ownership restrictions, authorized removal and reassignment |
| **Passed** | Fresh 262 server / 147 client tests, both builds and client lint |
| **Failed (known baseline)** | Server lint: the three exact existing unused-symbol errors above |
| **Blocked** | No requested history/regression check was blocked. Meaningful category filtering has a later API/UI dependency because the list response omits category; no fix attempted |
| **Not tested** | Headed Edge/Chrome, real touch hardware, screen-reader/full keyboard audit, populated-history browser rendering after 3C |
| **Not tested** | Browser xterm containment, resize/reconnection, QEMU/Kali VM, other experiment runtime flows and broad lab security/runtime acceptance |
| **Not tested** | Linked Google account flow and nonzero faculty-score/report metric isolation (the new fixture now enables later checks) |

No blocker remains for the requested nonempty-history preservation test. The
known server lint failure prevents an all-green six-command result; no new
application regression was found. Existing category behavior remains documented
for later work and was not changed here.

Tracked change: this report only. `git diff --check` passed; the local commit
contains no application/backend/infrastructure changes, generated reports,
runtime scripts, logs, secrets or database files. The tracked worktree is clean
after the documentation commit; ignored runtime/evidence files remain local.
Branch is `integration/local-takeover`; starting HEAD is recorded at the top and
the resulting documentation commit SHA is supplied in the completion report.

Services remain running; no GitHub push, PR action, remote branch change or
deployment occurred. Stop after Checkpoint 3C for review before teacher enrollment
UI integration or additional API development.
