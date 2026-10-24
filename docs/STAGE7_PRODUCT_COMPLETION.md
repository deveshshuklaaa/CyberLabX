# Stage 7: remaining product completion — local delivery

Date: 2026-10-24. Branch: `integration/local-takeover`.
Starting HEAD: `cdf7a2d76721d4f1709b48b665a85a91668b2815`.
Code delivery commits, separated by concern:

- `ac3fbbf`: actual published catalogue categories.
- `48db444`: historical student score/progress and genuine PDF availability.
- `bc9db22`: account cache isolation and confirmed server logout.
- `b85098e`: supported student score, history, PDF and workspace presentation.
- `a06150f`: keyboard focus, responsive layout and admin navigation handoff.

This document follows those code commits in a separate local commit. No remote
Git operation, push, PR action, deployment, dependency install or infrastructure
change occurred. Original branches and all existing database records are preserved.

## Product gaps repaired

### Catalogue and calculations

GET `/api/experiments` still returns published summaries and real task counts,
without quiz/task/lab internals. It now selects `category` and returns the trimmed
stored value or null. Search/category intersection, no-match and reset now operate
on actual catalogue data. All seven current published entries legitimately share
`Network Security`; classification was not altered to invent filter diversity.
Regression fixtures cover other/blank categories. Malformed catalogue responses
now produce an error, rather than a fabricated empty list.

The reviewed Stage 4B C1/P1/P2/P3 changes are additive:

| Existing student endpoint | Added/strengthened behavior |
| --- | --- |
| GET `/api/student/dashboard` | `scoreUnit:'points'`, `stats.publishedExperimentsCompleted`, and recent-attempt assessmentScore/taskProgress plus truthful report availability |
| GET `/api/student/history` | Same complete owned history, with assessmentScore/taskProgress and file-checked availability |
| GET `/api/attempts/:id` | Existing owned attempt/instructions plus assessmentScore/taskProgress and distinct persisted passed `verifiedTaskIds` |
| GET `/api/reports/:id` | Existing metadata plus `available`; requires a consistent owning completed attempt |
| GET `/api/reports/:id/download` | Same student-only endpoint and original PDF; consistency and real contained-file/descriptor checks |

Existing raw stats/score fields retain their meanings. The rounded dashboard mean
is the mean of best completed **raw points per experiment**, including historical
experiments; best score remains highest raw completed points. No cross-experiment
normalized mean is invented. UI labels now say points, not `%` or `/100`.

Curriculum completion divides the distinct completed experiments still published
by the current published catalogue size. Archived/deleted completions remain in
historical totals/history but cannot inflate the current curriculum percentage.
The frontend validates a supplied published counter; an absent legacy counter is
shown as unknown, not silently inferred or clamped from historical totals.

Per-attempt assessmentScore is `{value,max,percentage,basis}`. A grade is non-null
only for a completed finite nonnegative score. Genuine zero stays zero. A
consistent report must match attempt, student, experiment and recorded score and
supply valid marks; its persisted totalMarks supplies the maximum. Otherwise the
raw points remain known but maximum/percentage are null. Positive known maxima
give `100 * value / max`, rounded to two decimals. Today's experiment marks are
never used to reconstruct a historical assessment maximum.

Task progress counts distinct passed task IDs in persisted taskResults. Historical
required-task counts and ratios stay null. The workspace labels its position as
an **instruction step**, and green verification badges use actual persisted task
IDs (updated after successful server verification), not a guessed percentage or
merely being earlier than currentTaskIndex. No grading/progression writer changed.

### History, reports and supported account information

Student history retains search, status and date/point sorting, with explicit raw
point sorting and ungraded running/failed/expired attempts. Per-experiment progress
shows the best completed recorded score with its genuine known maximum, or an
unknown maximum. Recent activity uses the same score display and safe date formatter.

Availability now means a consistent record and a readable regular attempt-bound
PDF inside the real report directory. Missing files keep valid report metadata and
marks, but availability is false. Foreign/inconsistent references cannot supply
marks or a usable report link. Student downloads reuse the existing teacher file
confinement helper: deterministic attempt filename, real-root containment, symlink
escape rejection, descriptor identity check and descriptor streaming. Role guards
remain student-only; faculty/admin still receive 403. No generation or repair is
triggered by listing/reading/downloading reports.

History/dashboard/completion downloads now catch errors inline, validate PDF
content type and allow deliberate retry through the canonical owned route. A 404
refreshes history/summary availability. Late responses after leaving the report
view cannot trigger a download. Completion does not follow arbitrary URLs or
promise a dashboard regeneration action that does not exist. A saved attempt with
no PDF clearly says so. Existing generation/grading behavior is untouched.

Profile displays only actual public account fields and own enrollment, with a
missing family name shown as not provided. No institution/class/contact details
are inferred from Somaiya branding, and no editing/password API is invented.

### Session boundaries, navigation and accessibility

- Login cancels in-flight queries and clears all role caches before accepting a
  new identity and routing to its existing role home. No browser-stored JWT is added.
- Student history/summary query keys now include the account ID, while prefix
  invalidation from task/quiz/enrollment flows continues to work.
- The bootstrap ignores canceled/unmounted responses. A current protected-request
  401 clears private queries/session identity. Local request-config identity tags
  prevent a late old-account 401 from expiring a newer account; no tag is sent as
  a header or credential. Login rejection stays with the login form.
- Header/Profile share logout handling: confirmed server success cancels/clears
  queries and redirects. Failed logout retains the identity and explains that the
  server session may remain active, with explicit retry. It no longer claims a
  successful sign-out while leaving a valid cookie on the server.
- Route navigation focuses main content; the main column is explicitly width
  constrained. The horizontally scrollable recent-attempt table is keyboard
  focusable/labeled. Form keyboard focus retains a visible 3px blue outline;
  disabled controls have consistent visual states. Branding/logo/burgundy remain.
- Admin Teacher Portal now links to actual Admin cohort management instead of
  claiming selection is only a future feature. Student/teacher/admin route access
  and role home mappings are unchanged.

## Rendered local acceptance and preservation

Only localhost `cyberlabx_local_takeover` was used. No records were inserted,
deleted, reassigned or edited. Only read APIs plus login/logout were exercised.
The follow-up compared all **22 current original documents** by private in-memory
digests before/after, with **no updatedAt exemption**. The existing student remains
unassigned with the same completed attempt/report and stopped session. The original
PDF and UI-downloaded copy match SHA256
`c19669e84c35e33a4b73c443e21ed36c027d4e0b9cb677388622ba8f278e8fa9`.
No credentials, cookies, tokens or private document contents were printed.

Installed Chrome `155.0.8059.85` used existing temporary Playwright tooling.
There were **93 passing browser/API assertions across two runs**, **40 viewport
renders** and **44 masked screenshots**. Primary run: 52 passing assertions,
24 layouts, 27 screenshots. It stopped on a harness assumption that the completed
lab must have a disabled Verify Task button; the correct UI omits that action.
The evidence retains that TimeoutError and success:false, rather than erasing it.
The follow-up checked the correct absent-or-disabled behavior and the remaining
journeys: 41 passing assertions, 16 layouts, 17 screenshots, success:true. No
application defect caused that interruption and already-completed checks were
not repeated to inflate the evidence.

Every row below was rendered at **320, 375, 768 and 1280 × 900** with no horizontal
document overflow:

| Actual screen | Rendered behavior checked |
| --- | --- |
| Login | Institutional form/navigation at all widths |
| Student dashboard | 75 raw points, 75/75 (100%) recent grade, keyboard-scrollable table |
| Catalogue | Actual category/search intersection, no-match/reset |
| Experiment details | Real overview/instructions/tasks/safety; Start action visible, not invoked |
| Progress | 1 of 7 published completions = 14%; historical 75-point denominator |
| History | Real completed attempt, score, task count, available PDF and filters |
| Stopped lab workspace | Existing saved completion/instructions; actual task verification IDs, no terminal input or regrading |
| Profile | Real identity and unassigned-teacher state |
| Faculty dashboard | Real empty enrolled cohort; role-correct navigation |
| Admin dashboard | Real directory/audit reads and honest disabled account/experiment writes |

Additional actual checks:

- History loading was rendered by pausing a read and then forwarding it to the
  real API; no successful response was fabricated. Aborted history read showed
  error (not empty) and Retry recovered from the real API.
- Aborted PDF download showed inline failure; retry saved the exact existing PDF.
  Metadata GET returned available:true/75 marks, missing-ID download returned 404.
- API dashboard returned points, published-completed 1, total 7, average 75;
  own history returned one attempt, max 75, four distinct verified tasks and null
  historical task total. No report path, answer or container details leaked.
- Mobile menu Escape restored its toggle focus for Student, Faculty and Admin.
  Catalogue navigation focused main content; keyboard category focus was visible;
  the 320px recent table scrolled through keyboard input.
- An aborted logout kept Profile and an actual GET `/auth/me` 200. Explicit retry
  confirmed logout, followed by `/auth/me` 401 and refresh remaining signed out.
- The same browser context then signed into Faculty, logged out, and signed into
  Admin. No previous student's score table appeared. Faculty/Admin student-page
  visits redirected to their own homes; both received 403 on student history/PDF.
  Final anonymous student history returned 401. Validation sessions were logged out.
- Admin Teacher Portal → Manage teacher cohorts → Admin works. Account creation
  stays disabled and experiment authoring remains explicitly unavailable.

Zero uncaught browser page errors occurred across both runs. Console evidence
contains six expected unauthenticated-bootstrap 401 resource messages in total
and three deliberate network-abort messages (history, PDF, logout). A completely
empty console is not claimed. Two small-screen screenshots were visually inspected.

Ignored local evidence, kept out of Git:

- `.env.stage7-evidence/results.json` (primary checks and retained harness timeout).
- `.env.stage7-evidence/followup.json` (remaining successful acceptance).
- `{login,student-dashboard,catalogue,experiment-details,student-progress,
  student-history,stopped-lab-workspace,student-profile,faculty,admin}-{320,375,768,1280}.png`
  in that folder, plus history-loading/error, pdf-download-error and logout-error.
- `.env.stage7-evidence/student-report.pdf`, matching the original artifact.
- `server/.env.stage7-browser.mjs` and `.env.stage7-followup.mjs`, loading only
  ignored local credential configuration. No stored sessions or embedded secrets.

## Exact regression results

| Command | Actual fresh outcome |
| --- | --- |
| `npm --prefix server test` | PASS: **345/345 tests**, 36 files; includes 11 new student read/report cases |
| `npm --prefix client test` | PASS: **237/237 tests**, 20 files; includes 10 product, six session-lifecycle and one extra login isolation cases |
| `npm --prefix server run build` | PASS |
| `npm --prefix client run build` | PASS; existing chunk warning (main JS about 827 kB) |
| `npm --prefix server run lint` | FAIL: exactly the three pre-existing unused variables below |
| `npm --prefix client run lint` | PASS |
| ESLint on all seven changed backend files, `--max-warnings=0` | PASS |
| `git diff --check` | PASS |

Existing server findings remain NMAP_LAB_DEFINITION/DOS_LAB_DEFINITION at
`server/src/__tests__/allExperiments.test.ts:9/10`, and `_next` at
`server/src/middleware/error.ts:3`. They are not suppressed. A copied unused test
variable introduced during development was removed; no new lint finding remains.
Existing mocked Docker/cleanup/PDF failure-path logs accompany passing tests and
are not claims about fresh runtime execution. Full suites were rerun, and affected
tests/build/lint reran after fixes. Old tests asserting `/100`, `%` or successful
failed-network logout were updated to truthful behavior, not weakened authorization.

New backend HTTP tests use mocked MongoDB and temporary unit PDFs for missing
files, path substitution, deleted/unpublished completion fixtures, zero/unknown
marks, ungraded states, answer projection and ownership/role guards. They are
distinct from the real MongoDB/browser evidence above. Frontend fixtures cover
known/legacy scores, published denominators, PDF/non-PDF/errors/retry, unmounting,
account cache isolation, late 401/bootstrap responses and in-flight cancellation.

## Remaining feature gaps and exact manual checks

1. **Fresh active Kali practical and terminal behavior — not rerun here.**
   Log in to `http://localhost:5173/login` with the authorized isolated development
   student. Open `/experiments`, select Nmap and Start Lab. This creates additional
   test academic/session records; record their returned IDs and preserve all
   original history. In the returned `/labs/<new-session-id>` UI, run each displayed
   instruction against the assigned target only, verify tasks and complete the
   quiz. Check actual input/output, resize desktop/mobile panes, briefly disconnect/
   reconnect the browser network and verify terminal restoration without duplicate
   input. Confirm real grading/results, saved progress/history and PDF. Exercise
   confirmed Stop/Exit with another authorized test session if needed. If the lab
   provider is unavailable, record the actual failure; do not change infrastructure
   or fabricate success. Existing stopped workspace was rendered, while xterm/
   Socket.IO wiring has passing unit regressions; fresh runtime is not certified.
2. **Google provider flow — only if used in the demo.** From `/login`, use Continue
   with Google with the institution-approved account and configured callback.
   Verify correct role landing, refresh persistence and logout. For an existing
   password account, use the existing explicit linking flow after password login;
   verify no duplicate account or changed role/teacher assignment. The live provider
   consent/link flow was not exercised and no OAuth configuration was changed.
3. **Assistive technology and demo browser/device.** On the intended Windows demo
   setup, keyboard-only Tab/Shift+Tab through login, skip link, navigation, catalogue
   controls, history PDF action and admin cohort modal. Check main focus after
   navigation, Escape cancellation and modal focus containment with NVDA/your
   screen reader. At 200% zoom and on the actual mobile/tablet device, confirm
   labels/status announcements, table scrolling and all actions remain reachable.
   Chrome viewport/keyboard automation passed; a full screen-reader, hardware or
   Edge-specific audit is not claimed.

Other open dependencies are **not tasks silently started by Stage 7**:

- Stage 6 account creation/role/status writes remain blocked by POL-ADMIN-1 atomic
  management/serialization/version prerequisites. No safe successful admin writer
  or live mutation concurrency is claimed. Separate approved work is required.
- Immutable historical assessment/task snapshots are still absent. Task totals/
  percentages and legacy score normalization remain honestly unknown; no backfill
  or mutable-definition inference was performed.
- Catalogue editorial category diversity is a content decision, not fake data.
  Large histories/cohorts, query plans, chunk splitting and cross-browser load
  behavior were not benchmarked. No student history pagination is invented.
- Name/password/profile editing and admin experiment authoring are not approved
  essential demo contracts. Read-only profile and published catalogue remain the
  supported product; the experiment-management pending state is intentional.
- Missing-file UI was covered with temporary regression files and network failure
  rendering, without deleting/moving the original live PDF. No manual destruction
  of original artifacts is needed to repeat that test.

All changes are limited to coordinated additive read contracts, frontend product/
session/accessibility behavior, tests and delivery documentation. No models,
authentication/authorization backend, grading, lab engine, terminal transport,
dependencies, database configuration or infrastructure were modified. Stop after
this stage; no push or automatic follow-on development.
