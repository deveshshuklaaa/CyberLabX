# Checkpoint 3: Live enrollment and browser verification

Assessment date: 2026-10-24. Branch: `integration/local-takeover`.
Application source tested: `d25208514f7a7c1d8317bfad2bae60e3ff65a2f2`.
This checkpoint changes documentation only. All work remains local.

## Outcome and scope

Real MongoDB-backed enrollment, ownership, authorization, fresh-session persistence,
and one concurrent enrollment race passed. The live harness recorded 58 expected
HTTP statuses with zero unexpected statuses; an additional authenticated admin
dashboard read also returned 200. No application defect or source correction was
required. Browser acceptance remains **pending**, not passed.

No enrollment UI, new API, security change, lab execution, Docker/Kali validation,
deployment, push, remote branch modification, or PR operation was performed.

## Services and isolation

| Service | Verified result |
| --- | --- |
| MongoDB | `cyberlabx-local-takeover-mongodb`, healthy; authenticated database ping passed |
| Database | `cyberlabx_local_takeover`; harness rejects another database or non-loopback host |
| API | `http://localhost:5000/health`, GET 200 |
| Vite | `http://localhost:5173`, HTTP availability verified; rendering unverified |
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
Final inventory is five users, two active students, eight experiments (seven
published), zero lab sessions, and two real user-creation audit events. The test
student remains active and unassigned, with no `teacherId` or `enrolledAt`.

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
response. This is one observed live race, not a load or stress test.

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

## Browser acceptance: pending manual checklist

The available UI inventory returned no browsers. Opening the in-app browser
failed with `Browser is not available: iab`. No substantial browser dependency
was installed. HTTP checks and existing component tests do not establish browser
rendering, accessibility, console cleanliness, or browser session handling.

Run the following in a real local browser, recording pass/fail and any defect
without copying credentials, cookies, tokens, or sensitive network headers:

1. Open `http://localhost:5173` at desktop 1366x900. Inspect `/login`: branding,
   labels, keyboard focus, validation and disabled/submitting state. Use existing
   local credentials privately from ignored `.env`. Never add them to this report.
2. Log in as seeded student. Verify `/student` identity and real zero-history
   metrics, then refresh and confirm the session remains authenticated. In
   Network, confirm successful `/api/auth/me` and `/api/student/dashboard`.
3. Browse `/experiments`: expect seven published experiments. Exercise search,
   category filters, no-match state, keyboard activation, and an experiment's
   detail page. Do not start a lab during this checkpoint.
4. Visit `/progress`, `/history`, and `/profile`; verify informative empty states,
   consistent identity and navigation, no fabricated scores/reports, and no
   horizontal overflow. Check direct protected URLs and browser back/forward.
5. Log out. Refresh and revisit a protected URL and browser history. Verify private
   account data is not retained on screen and the login flow is required. Repeat
   with a different role to check cached-data separation.
6. In separate sessions/profiles, log in as faculty. Check both `/teacher` and
   `/faculty`: final cohort is empty and all four metrics are zero. Inspect
   unavailable/pending monitoring states. Enrollment UI is intentionally absent;
   its absence is not a runtime backend failure. Verify admin/student protected
   pages cannot expose data to faculty.
7. Log in as admin. Check `/admin`: five users, two active students, zero attempts,
   and two creation audit events in the current fixture. Check supported navigation
   without fake user listings. The backend's admin faculty-dashboard scope remains
   global (two students); faculty-only/student-only endpoints must stay forbidden.
8. Repeat each role's key pages at tablet 768x1024 and mobile 375x812, plus 320px
   width. Check menu toggle, Escape behavior, focus order/visibility, labels,
   readable cards/tables, touch targets and no clipped controls. Test keyboard-only
   navigation, including any skip link and menu focus behavior.
9. With DevTools open, inspect Console and Network through login, refresh,
   navigation, and logout. Record unexpected errors, failed requests, CORS failures,
   or unhandled rejections. Expected negative authorization responses are not
   defects. Confirm credentialed API traffic targets localhost:5000 and does not
   expose JWTs in localStorage. Do not capture secret header values in evidence.
10. Temporarily use browser offline mode and reload a data page to examine error
    and retry behavior; restore connectivity and retry. Record loading/empty and
    disabled states where observable. Do not simulate successful backend responses.

Every item above is pending. Browser console/network, rendered responsiveness,
keyboard usability, refresh persistence, and cached-data clearing are not claimed
as passed. HTTP fresh-session persistence was verified separately.

## Tests, changed files, and handoff

No application source changed, so full unit tests/build/lint were not repeated
for this documentation-only checkpoint. The previous verified baseline in
`docs/LOCAL_RUNTIME_STAGE2.md` remains:

- Server: 262 tests in 33 files passed; production build passed.
- Client: 147 tests in 14 files passed; production build and lint passed.
- Server lint: three existing unused-symbol findings (`NMAP_LAB_DEFINITION`,
  `DOS_LAB_DEFINITION`, and `_next`); not new checkpoint failures.
- Existing client bundle-size advisory and dependency audit findings remain;
  no dependency upgrades were attempted.

Tracked change: this report only. Ignored local changes: test credentials added
to `.env`, the local harness, and sanitized results. Database additions are the
two test accounts and their real creation audit events; all test enrollments
were cleaned up. No secrets, database files, generated reports or logs are staged.

The stack is ready for manual browser acceptance. Remaining evidence gaps are
browser validation, nonempty-history preservation/nonzero metric isolation,
and any later practical-runtime validation (outside this checkpoint). Avoid
repeated login loops: the existing login rate limiter can reject bursts.
No remote operation occurred. Stop here before enrollment UI or API development.
