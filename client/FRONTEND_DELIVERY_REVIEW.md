> Historical frontend-only delivery evidence for commit 979aa05. The local takeover
> now includes the enrollment backend: faculty metrics are enrolled-cohort scoped,
> and enrollment APIs exist but are not wired into the UI. See
> `../docs/LOCAL_INTEGRATION_STAGE1.md` and `../docs/student-enrollment.md`.

# Frontend delivery review

Date: 2026-10-24 (Asia/Calcutta)
Branch: `feature/frontend-dashboards`
Target: `codex/real-kali-nmap-integration`
Integration source: `8103da11e94ee7c3cf6faa958d312ae879439e1a`

## Delivered scope

| Area | Implemented |
| --- | --- |
| Shared layout | Somaiya branding, burgundy design primitives, responsive role navigation, real footer routes, skip link, visible focus, reduced-motion support |
| Student dashboard | Authenticated identity, five real metrics, catalogue-based Continue Learning, available experiments, recent attempts/reports |
| Catalogue/details | Search/category controls, real cards, overview, aim/objectives, theory/procedure/tasks, safety guidance, start-lab flow and request recovery |
| Lab workspace | API-driven lifecycle states, actual xterm/Socket.IO transport, task progression/verification, server rule feedback and points, quiz/results, stop/exit behavior |
| Progress/history/profile | Full-history ID matching, best completed scores, completion indicator, status/search/sort filters, genuine report availability, read-only account details and logout |
| Teacher | Four platform aggregate metrics, refresh and honest pending states for individual monitoring, performance breakdowns, enrollment and teacher reports |
| Admin | Real counts, latest-20 audit snapshot with filters, reviewed account creation via POST, read-only published catalogue and pending unsupported management actions |

## Final corrections

- Invalidate student dashboard/history after grading, completion and stop; update
  cached attempt progression from authoritative submission responses.
- Remount local workspace state when the lab session route changes. Prefer the
  loaded lab's attempt ID to navigation state. Restore saved completed status and
  score without inviting a second quiz submission.
- Clear React Query records on both logout paths. Existing cookie authentication,
  backend role guards, role names, Google entry/linking and HTTP routes are retained.
- Remove the unused duplicate terminal-output buffer; xterm continues rendering
  real output, and its optional output callback remains supported.
- Remove embedded development credential shortcuts and unused imports. Associate
  login labels with controls, preserve focus on disclosures and improve footer
  contrast and narrow form sizing.

## Verification performed

Environment: Windows, Node 24.19.0, npm 11.17.0.

| Check | Result |
| --- | --- |
| `npm --prefix client test` | PASS: 146 tests / 14 files |
| `npm --prefix client run lint` | PASS |
| `npm --prefix client run build` | PASS; JS 767.60 kB, gzip 217.75 kB; existing >500 kB advisory |
| Strict TypeScript unused-symbol check | PASS with `--noUnusedLocals --noUnusedParameters` |
| `npm --prefix server ci` | PASS; no manifest/lockfile change |
| `npm --prefix server test -- --maxWorkers=2` | PASS: 207 tests / 31 files |
| `npm --prefix server run build` | PASS |
| `npm --prefix server run lint` | FAIL: the same 3 documented baseline findings |
| Backend/infrastructure diff against target | No changes |

Existing backend lint findings: unused `NMAP_LAB_DEFINITION` and
`DOS_LAB_DEFINITION` in `server/src/__tests__/allExperiments.test.ts`, plus unused
`_next` in `server/src/middleware/error.ts`. They were not changed on this branch.
Backend tests deliberately emit simulated provider/report/cleanup failure logs;
those cases pass and do not establish runtime readiness.

The integrated DOM test uses the real App/layout/pages and existing API shapes,
with mocked API responses and an isolated terminal boundary. It traverses
Dashboard -> Catalogue -> Details -> Start -> Task verification -> Quiz/results
-> History -> Progress -> Dashboard. It checks refreshed records and report URLs,
and records no React console errors during that test. Separate terminal tests
check Socket.IO rejoin, resize, input/output routing and disposal with mocks.
Forty-eight routing tests cover anonymous, student, faculty and admin entry points,
including both teacher aliases and student page restrictions.

Loading/error/empty/disabled/retry paths, report gating, account-creation review,
mutation failures, mobile-menu Escape/focus and skip targets have DOM coverage.
Source review covered mobile single-column layouts, tablet `sm`/`md` layouts,
desktop grids, wrapping headings/actions, minimum-width constraints and the
terminal's `minmax(0,1fr)` column. These are source/DOM checks, not pixel validation.

## Checks still required in an equipped environment

- Browser inventory was empty and opening an in-app browser returned
  `Browser is not available: iab`. Actual desktop/tablet/mobile screenshots,
  overflow measurements, keyboard interaction in a rendering browser and browser
  console/network inspection could not be completed. Recheck at 320/375, 768 and
  1280+ pixel widths, with long names/IDs and large text.
- No API or MongoDB listener was available during review. No real account was
  created, and no actual Docker lab, Kali VM, Nmap scan or Google callback was
  exercised. A passing UI test is not real Kali runtime validation.
- Follow the existing unchanged VM preflight and readiness requirements; the
  handoff documents the 6,144 MiB readiness threshold. Do not weaken it.
- Dependency audit issues remain out of scope: frontend installation previously
  reported 13; this server installation reported 16 (5 moderate, 8 high, 3 critical).
  Coordinate dependency remediation separately; no automatic fixes were applied.
- The application bundle-size advisory remains. Route splitting is future work.

## Backend dependencies and teammate integration

`FRONTEND_API_REQUIREMENTS.md` separates verified existing endpoints from required,
unimplemented contracts. `STUDENT_ACCOUNT_REQUIREMENTS.md` records profile and
partial-progress dependencies. Main gaps: admin user listing/lookup and safe update
selection; teacher directory/details/cohort assignments/enrollment; teacher report
access; experiment performance breakdowns and administrative CRUD; full audit
pagination/search; account editing/password flows and task-progress aggregates.
The catalogue currently omits category, so missing values show Uncategorized.

1. Review the PR against the named integration target; this branch changes client
   code/docs only. No deployment or merge was performed.
2. Install both lockfiles, configure local-only secrets and matching frontend/API
   origins using the root README and team handoff. Existing auth/types and backend
   contracts were not edited.
3. Run client tests/lint/build and backend tests/build. Account for the existing
   backend lint debt separately rather than hiding failures.
4. Start an authorized development API/database and approved lab runtime. Test all
   roles and aliases, real report downloads, lab expiry/stop/reconnect and refresh
   after completion. Use only controlled CyberLabX targets.
5. Confirm browser layouts/console and real Google/Kali behavior before release.
   Enable pending management areas only after agreeing contracts with backend owners.
