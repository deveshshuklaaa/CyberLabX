# Frontend implementation plan

## Stage 0 baseline — 2026-10-24

- Repository: `https://github.com/deveshshuklaaa/CyberLabX.git`.
- Source: latest fetched `origin/codex/real-kali-nmap-integration` at
  `8103da11e94ee7c3cf6faa958d312ae879439e1a`.
- Work branch: `feature/frontend-dashboards`, newly created from that source.
  Existing checkout was clean on `main`; no existing work was changed.
- Reviewed root README, `docs/TEAM_HANDOFF.md`, client structure, routes,
  API service/types, session handling, pages, layouts and common/lab/terminal components.
- Stage 0 adds this plan only. Implementation below is future work.

## Existing frontend and contracts

- React 19, TypeScript, Vite, Tailwind, React Query, Zustand and Axios.
  `AppLayout` wraps the institutional header/footer; shared styles are in `index.css`.
- `App.tsx` and `routes/` enforce login and role landing. Student routes include
  `/student`, `/experiments`, `/experiments/:id`, `/labs/:labSessionId`,
  `/progress`, `/history`, `/profile`, plus existing student aliases.
  `/teacher` and `/faculty` serve faculty/admin; `/admin` is admin-only.
- `services/api.ts` supplies credentialed Axios using `VITE_API_URL` (default
  `http://localhost:5000/api`). Session bootstrap uses `/auth/me`; login,
  Google login/linking and logout retain the existing HttpOnly-cookie model.
- Student pages consume `/student/dashboard`, `/student/history`, `/experiments`
  and report downloads. Teacher uses `/faculty/dashboard` metrics; admin uses
  `/admin/dashboard` metrics and recent audit events.
- Experiment detail starts labs through `/labs/start`. Workspace restores labs
  and attempts, submits tasks/quizzes, stops labs and displays reports.
  `Terminal` uses credentialed Socket.IO via `VITE_SOCKET_URL`; preserve its
  Docker/QEMU transport and cleanup behavior. Reuse `RuleResults` and `CompletionPanel`.

## Proposed implementation order (requires subsequent stage authorization)

1. **Student dashboard and shared UI:** evolve existing pages, reuse stat cards
   and loading/error/empty states, make desktop/mobile navigation role-aware,
   and preserve route aliases. Check resume behavior against real session IDs.
2. **Teacher dashboard:** improve the existing aggregate metrics with explicit
   loading, failure/retry and empty states. Agree cohort/detail/report contracts
   before presenting data unavailable from the current aggregate endpoint.
3. **Admin dashboard:** improve metrics and audit presentation, add safe failure
   handling and accessible responsive layouts. Do not imply live event streaming
   when the API supplies a fetched snapshot.
4. **Student management UI:** coordinate authorized listing, pagination/filtering,
   enrollment, validation and mutation contracts with Developer 1 first. Do not
   invent endpoints or implement enrollment/role assignment in the frontend.
5. **Learning flow and polish:** refine catalogue, details, workspace, progress,
   history and profile; verify keyboard access, focus, contrast and narrow screens.
   Align Docker-only copy with provider metadata. Consider route-based splitting
   after measuring the existing bundle.

## Findings and boundaries

- Faculty/admin pages dereference `data.metrics` without an error branch;
  experiment detail/workspace can remain in loading UI when requests fail.
- Progress and history share `student-history` but use different cached data
  shapes; agree one contract. History fallbacks can hide failures as empty data.
- Header includes student-only links for other roles; footer uses page anchors
  that may not exist on the current route. Review during navigation work.
- Coordinate changes to `types/api.ts`, shared auth/routing, manifests and root
  configuration. Keep implementation primarily in client pages/layouts/components.
- Preserve backend authorization, cookie sessions, role names (`faculty` means
  teacher), lab isolation and infrastructure. No secrets, backend changes,
  deployment, force pushes or commits to main/integration.
- Real Kali runtime and live Google OAuth remain unvalidated as documented in
  the handoff; frontend unit/build success does not validate those integrations.

## Baseline validation and future acceptance

Environment: Node `v24.19.0`, npm `11.17.0`.

| Command | Stage 0 result |
| --- | --- |
| `npm --prefix client ci` | Passed; 361 packages installed; lockfile unchanged |
| `npm --prefix client test` | Passed: 6 files, 43 tests |
| `npm --prefix client run lint` | Passed, zero warnings |
| `npm --prefix client run build` | Passed; JS bundle 763.05 kB (213.92 kB gzip), existing >500 kB advisory |

Installation audit reported 13 vulnerabilities (4 moderate, 7 high, 2 critical).
Dependency remediation is separate coordinated work; no automatic fixes applied.
Backend tests/build/lint and live browser/Docker/VM/OAuth checks were not run in
this frontend-only Stage 0; handoff records existing backend lint debt.

For implementation stages, add meaningful tests for role navigation, dashboard
success/failure/empty states and agreed management operations; retain existing
auth, terminal, grading and report regressions. Run client tests/lint/build and
the handoff's backend regression checks before merge, then perform browser checks
with authorized role accounts and an available controlled lab runtime.
