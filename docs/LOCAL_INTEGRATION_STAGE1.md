# Stage 1: safe local integration

Date: 2026-10-24 (Asia/Calcutta). Local branch: `integration/local-takeover`.
No push, PR update, remote branch modification, deployment or runtime setup.

## Integration provenance

- Backend parent: `cd8d6aff18c3a4398c3490796da65581ae5e0d8c`.
- Frontend parent: `979aa05d475c30ac8fb74f1e893e98ef6aa06625`.
- Common ancestor: `8103da11e94ee7c3cf6faa958d312ae879439e1a`.
- Local merge: `42c1adbd3d88a68c0da38d84eada4ff8c3baf172`.
- Merge used `--no-ff --no-commit`; it was reviewed and tested before the
  requested merge commit. No conflicts occurred.
- Backend had 12 changed files and frontend 46, with no changed-path overlap.
  The staged merge added the frontend's 46 files/changes over the backend parent.
- Original frontend branch and both remote-tracking baseline refs were preserved.

## Combined baseline results

Executed the six requested npm commands using existing installed dependencies.
No installation or local configuration change was needed for automated checks.

| Check | Result before correction | Result after correction |
| --- | --- | --- |
| Server tests | 262 passed, 33 files, 0 failed | Server unchanged; baseline retained |
| Client tests | 146 passed, 14 files, 0 failed | 147 passed, 14 files, 0 failed |
| Server build | Pass | Server unchanged |
| Client build | Pass | Pass |
| Server lint | 3 known errors | Server unchanged |
| Client lint | Pass | Pass |

Server lint findings remain `NMAP_LAB_DEFINITION` and `DOS_LAB_DEFINITION` in
`server/src/__tests__/allExperiments.test.ts` (lines 9/10), and `_next` in
`server/src/middleware/error.ts` (line 3). No new backend lint findings occurred.
Backend failure-path tests intentionally log simulated Docker/VM/PDF failures;
these tests passed. No real provider execution is established by those messages.
Client build retains the bundle advisory: 768.84 kB JavaScript, 218.14 kB gzip.
An initial revised text assertion matched two descriptions; its selector was
corrected and the complete client suite rerun successfully.

## Minimal semantic correction in a separate commit

Only teacher overview wording/accessible scope labels, its tests and integration
documentation changed after the merge. Faculty sees an enrolled-cohort scope;
admin retains platform scope through the same dashboard endpoint. The page
explains inactive enrolled history and unassigned accounts without changing data.
Enrollment notices now distinguish implemented backend routes from pending UI.
The historical frontend delivery report remains identified as historical evidence.

Enrollment routers, auth/session functions, report routes/ownership, student
pages/history, lab/Socket.IO implementation and shared API types were reviewed
and retained from the pinned parents. No backend code changes were made.

## Remaining work and runtime readiness

- Implement faculty list/detail/enrollment/removal UI using the actual enrollment
  contract; student own-enrollment display is also pending.
- Admin cohort requests require explicit teacher IDs. Faculty student endpoints
  are faculty-only, even though admin can view the teacher metrics page.
- General user/teacher directories, teacher reports and individual attempt history,
  experiment management/analytics and full audit search remain unavailable.
- Enrollment summaries count completed attempts including repeats; student
  dashboard averages use best completed scores per experiment.
- Preserve one-teacher ownership, atomic conflict handling, strict selectors and
  bodyless 204 removal responses when adding UI. No enrollment UI was added here.
- Source/build/test baseline is ready for the next local runtime-setup stage.
  `.env` is absent and no listener was observed on 5000/5173/27017. MongoDB,
  configuration, live enrollment concurrency/index checks, browser validation,
  real Google OAuth and Docker/Kali/Nmap acceptance still need dedicated work.
- Do not interpret code readiness as demo readiness. Do not lower VM readiness
  requirements or push anything until explicitly approved.
