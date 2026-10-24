# Controlled student enrollment API

Backend branch: `feature/student-enrollment`, based on integration commit `8103da1`.
This contract is for `feature/frontend-dashboards`; no frontend files or types
are changed by this implementation.

## Ownership and storage

A student may have **one teacher at a time**, as confirmed for this release.
The existing `User` stores optional `teacherId: ObjectId` and `enrolledAt: Date`.
There is no new collection, class, invitation, or self-enrollment system.

The student document's unique `_id` and scalar teacher reference represent one
current relationship. Enrollment uses a single conditional `findOneAndUpdate`
requiring `role: student`, `isActive: true`, and an absent/null `teacherId`.
Concurrent requests cannot overwrite an assignment. The losing request receives
409. A compound `{ teacherId: 1, role: 1, _id: 1 }` index supports cohort lists;
it is deliberately not unique because a teacher can have many students.

Existing accounts and seed accounts remain unassigned; no data migration or
automatic enrollment runs. Mongoose creates the new index through the existing
index configuration. No new service or infrastructure is required.

Unenrollment unsets only `teacherId` and `enrolledAt`. It does not delete users,
attempts, reports, lab sessions, Google identity, or session credentials. There
is no enrollment history collection. Re-enrollment creates a new timestamp.
Another teacher cannot take over, including from an inactive teacher; the owner
or an admin must first remove the existing assignment.

## Authentication and authorization

Every endpoint requires the existing `cyberlabx_session` HttpOnly cookie. Use
`credentials: 'include'` with the existing API client; do not store JWTs in
localStorage. Google and password login continue using the same session.
`requireAuth` reloads the current database account and rejects missing, expired,
invalid, or inactive sessions. `allowRoles` checks its current role, rather than
trusting a role claim or request body.

- Teacher APIs require `faculty`. The owner always comes from the session.
- Students can read only their own enrollment; they cannot create, remove,
  transfer, or change roles through these APIs.
- Admin APIs require `admin` and explicitly identify the managed teacher in the
  URL. They use the same eligibility and single-owner constraints; reassignment
  requires explicit removal followed by enrollment.
- There is no platform student directory or fuzzy email search. An authorized
  teacher/admin can identify an existing student by ID or exact email only.
- Missing, non-student, and inactive candidate accounts share the same generic
  404 response. A conflict never identifies the other teacher.

## Endpoints

All paths below include the `/api` prefix. `/faculty/students` is an exact alias
of `/teacher/students`, including its child routes.

| Method | Endpoint | Required role | Purpose / request |
| --- | --- | --- | --- |
| GET | `/api/teacher/students` | faculty | List own students; optional `page`, `limit` query parameters |
| POST | `/api/teacher/students` | faculty | Enroll an existing student; JSON selector below |
| GET | `/api/teacher/students/:studentId` | faculty | Own enrolled student's basic info and progress |
| DELETE | `/api/teacher/students/:studentId` | faculty | Remove own enrollment; no body |
| GET | `/api/faculty/students` | faculty | Alias of teacher list |
| POST | `/api/faculty/students` | faculty | Alias of teacher enrollment |
| GET | `/api/faculty/students/:studentId` | faculty | Alias of teacher detail |
| DELETE | `/api/faculty/students/:studentId` | faculty | Alias of teacher removal |
| GET | `/api/student/enrollment` | student | View own relationship; no body or student selector |
| GET | `/api/admin/teachers/:teacherId/students` | admin | List specified teacher's students |
| POST | `/api/admin/teachers/:teacherId/students` | admin | Enroll for specified active faculty account; same JSON selector |
| GET | `/api/admin/teachers/:teacherId/students/:studentId` | admin | Specified teacher's enrolled student and progress |
| DELETE | `/api/admin/teachers/:teacherId/students/:studentId` | admin | Remove that exact relationship, including stale teacher references |

GET and DELETE requests have no request body. IDs must be 24 hexadecimal
characters. Admin list/detail require an existing faculty account, including an
inactive one. Admin enrollment requires an active faculty account. Admin DELETE
does not require the teacher still to exist or still to be faculty, so stale
assignments can be released; the exact teacher-student relationship must match.

### Enroll: request and response

Supply **exactly one** selector:

```json
{ "studentId": "00000000000000000000000c" }
```

or:

```json
{ "email": "student@example.test" }
```

Email is trimmed, lowercased, validated, and limited to 254 characters. Unknown
body properties are rejected, including `teacherId`, `role`, `isActive`, and
`enrolledAt`. Supplying both selectors or neither returns 400. The selected
account must already exist and be an active student; no account is created.

201 response (same shape as a list item):

```json
{
  "student": {
    "id": "00000000000000000000000c",
    "firstName": "Demo",
    "lastName": "Student",
    "email": "student@example.test",
    "role": "student",
    "isActive": true
  },
  "enrollment": {
    "teacherId": "000000000000000000000001",
    "status": "active",
    "enrolledAt": "2026-10-24T10:00:00.000Z"
  }
}
```

`enrollment.status` is derived, not another stored authorization field. It is
`active` when both the student and current faculty owner are active; otherwise
it is `inactive`. List/detail include inactive enrolled students so the teacher
can see their status and remove them. Inactive students cannot authenticate or
be newly enrolled. Dates serialize as ISO 8601 strings (`enrolledAt` is nullable
only for incomplete legacy data).

### List

GET `/api/teacher/students?page=1&limit=25`:

```json
{
  "students": [
    {
      "student": {
        "id": "00000000000000000000000c",
        "firstName": "Demo",
        "lastName": "Student",
        "email": "student@example.test",
        "role": "student",
        "isActive": true
      },
      "enrollment": {
        "teacherId": "000000000000000000000001",
        "status": "active",
        "enrolledAt": "2026-10-24T10:00:00.000Z"
      }
    }
  ],
  "pagination": { "page": 1, "limit": 25, "total": 1 }
}
```

Defaults: page 1, limit 25. Page must be an integer from 1 through 10,000; limit
must be an integer from 1 through 100. Unknown query keys are rejected. Results
sort by student `_id` ascending. An empty cohort returns `students: []` and total
0. Neither the list nor the count includes another teacher's students.

### Detail and progress

GET `/api/teacher/students/00000000000000000000000c` returns the same
`student` and `enrollment` objects plus:

```json
{
  "progress": {
    "attempts": 3,
    "completedAttempts": 2,
    "averageScore": 85,
    "bestScore": 90
  }
}
```

This example shows the additional field; the actual response includes all three
top-level fields. `attempts` counts all attempts. Scores use completed attempts
only; the average is rounded to an integer. All values are zero with no relevant
attempts. The current teacher can monitor the student's full academic summary,
including attempts made before enrollment. Removal immediately excludes that
student from subsequent teacher detail and cohort requests.

This endpoint exposes no individual quiz answers, raw command logs, report file
paths, lab credentials, or runtime metadata. Existing student-only attempt,
history and report routes remain student-only.

### Student's own enrollment

GET `/api/student/enrollment` returns:

```json
{
  "enrollment": {
    "teacherId": "000000000000000000000001",
    "status": "active",
    "enrolledAt": "2026-10-24T10:00:00.000Z",
    "teacher": {
      "id": "000000000000000000000001",
      "firstName": "Lab",
      "lastName": "Instructor",
      "email": "teacher@example.test",
      "isActive": true
    }
  }
}
```

Unassigned: `{ "enrollment": null }`. An inactive teacher makes status inactive.
A deleted or no-longer-faculty teacher yields `teacher: null` and inactive status;
the reference stays assigned until explicitly removed by an admin. Request
parameters never select a different student.

### Removal and existing dashboard behavior

Successful DELETE returns **204 with no body**. Repeated removal, nonexistent
students and relationships owned by another teacher return 404.

`/api/teacher/dashboard` and `/api/faculty/dashboard` retain their response:
`{ metrics: { students, completedAttempts, averageScore, reports } }`. Faculty
metrics now use only currently enrolled students. `students` counts active
students; attempts/scores/reports include enrolled inactive students' history.
Admins retain platform-wide metrics. An unassigned seed cohort therefore gives
a faculty user zero cohort metrics until explicit enrollment.

Existing admin role changes to faculty/admin clear that account's former
student assignment. Disabling an account keeps its assignment for explicit
management; disabling/demoting a teacher does not silently transfer students.
The existing public auth user shape is unchanged, with no new frontend type edits.

## Error contract

Errors retain the existing `{ "message": "..." }` shape.

| Status | Important cases / messages |
| --- | --- |
| 400 | Invalid IDs/body/pagination, unknown body/list-query fields: `Invalid request data.` |
| 401 | Missing, invalid, expired or inactive session: `Authentication required.` |
| 403 | Wrong current role: `You do not have permission to perform this action.` |
| 404 | Ineligible candidate: `Eligible student not found.`; unowned/missing relationship: `Enrolled student not found.` |
| 404 | Admin teacher lookup: `Teacher not found.` or `Active teacher not found.` |
| 409 | Already enrolled to any teacher, including a duplicate request: `Student is already enrolled.` |
| 500 | Unexpected persistence failure: existing generic server-error response |

Authorization runs before request validation. Missing and foreign relationships
are intentionally indistinguishable. Unenrollment never grants access to another
student or deletes their account.

## Validation and frontend coordination

The implementation adds 53 focused tests: 49 HTTP/session/ownership/integrity/
progress tests with mocked MongoDB and four real Mongoose schema/serialization
tests. Concurrent HTTP requests test the conditional update contract against a
mocked store; live MongoDB concurrency/index creation is a separate manual check.
The regression baseline was 207 backend tests and 43 frontend tests.

Run from the repository root:

```powershell
npm --prefix server test
npm --prefix client test
npm --prefix server run build
npm --prefix client run build
npm --prefix server run lint
npm --prefix client run lint
```

Validation on 2026-10-24: all 260 backend tests and 43 frontend tests passed,
both builds passed, and frontend lint plus changed-backend-file lint passed.
Full backend lint failed with only the three pre-existing findings: unused
Nmap/DoS test imports and unused error-handler `_next`. The frontend build also
retains its existing bundle-size advisory. No unrelated lint debt was changed.

Before release, validate these endpoints against an isolated MongoDB database,
confirm the cohort index exists, and submit simultaneous enrollment requests
from two faculty sessions (one 201 and one 409; exactly one stored owner). Check
the new UI against this contract using real student/faculty/admin sessions. No
live Google OAuth, Docker or real Kali runtime validation is claimed here.
No frontend, authentication architecture, lab engine, VM, or deployment changes
are part of this branch.
