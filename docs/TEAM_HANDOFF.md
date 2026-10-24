# CyberLabX Team Handoff

## Current baseline

Repository: https://github.com/deveshshuklaaa/CyberLabX

Shared baseline: **`origin/feature/student-enrollment`** (24 October 2026).

This branch includes these commits in order:

| Commit | Included work |
| --- | --- |
| `a1bfee8` | Existing student portal and teacher/admin foundations |
| `d58fc2b` | Expanded experiments and their Docker build sources |
| `8103da1` | Real Kali Nmap integration and Google authentication implementation |
| `7fdb777` | Controlled single-teacher enrollment APIs/tests |
| `cd8d6af` | JSON error-response fix discovered during real MongoDB validation |
| `75c1b1f` | OAuth configuration audit, database readiness and deployment preparation |

The handoff commit after `75c1b1f` updates documentation/ignore rules, removes
legacy generated test logs and removes a machine-path comment only. Resolve its
exact SHA with `git log origin/feature/student-enrollment -1 --oneline` after
fetching; use that SHA when pinning a checkout. No `develop` branch is used.

State:

- Real Kali integration implemented for Nmap; Docker fallback preserved.
- Google Authentication implemented using the existing backend/session model.
- Enrollment locally validated with real MongoDB and password sessions.
- Deployment preparation and real database-readiness outage/recovery probe complete.
- Real Kali runtime validation pending due to host RAM.
- Google OAuth browser validation pending configured credentials.

CyberLabX is a browser-based teaching platform for isolated cybersecurity
experiments, terminal interaction, task verification, quizzes, grading and reports.
This baseline contains the existing student dashboard, experiments, progress,
history and profile pages plus faculty/admin foundations. Further frontend work
already exists separately on `feature/frontend-dashboards`, owned by Developer 2;
it is not merged or changed by this handoff. No deployment occurred.

## Current architecture

```text
Frontend: React / Vite / TypeScript
  ↓
Backend API: Express / TypeScript + MongoDB
  ↓
Authentication / Authorization
  Google OIDC or password → existing HttpOnly-cookie JWT
  Current database role + active status + resource ownership
  ↓
Lab Engine
  ├── Docker provider — default/fallback
  └── Kali VM provider — explicitly selected for Nmap
        ↓
      Windows QEMU/WHPX
        ↓
      Real Kali Linux → controlled target inside the guest
```

`LAB_BACKEND=docker` remains the default. `LAB_BACKEND=qemu` selects the VM only
for the approved Nmap experiment; other experiments retain Docker. A failed VM
start is not silently presented as a Docker success. The browser terminal uses
Socket.IO and the selected provider's shell; VM access uses authenticated SSH.

Roles remain `student`, `faculty` (TEACHER), and `admin`. `/teacher` is an alias
for the existing faculty portal. New Google users receive the student role.
Existing accounts require an authenticated linking step; an email match alone
does not grant access. API authorization is independent of frontend guards.

## Completed work

- Minimal Nmap VM dispatch in the existing Lab Engine; Docker path retained.
- QEMU/WHPX startup/shutdown, disposable overlays and per-attempt credentials.
- Session expiry, recovery, cleanup retries and ownership checks.
- SSH terminal transport, resize/reconnect support and Nmap evidence capture code.
- Infrastructure preflight/smoke commands and focused VM/protocol tests.
- Google authorization-code flow with state, nonce and S256 PKCE.
- Verified provider identity, unique subject storage and explicit account linking.
- Existing secure app session cookies, logout and role-aware protected routes.
- Automated authentication, authorization, route and regression tests.
- One teacher per student, atomic enrollment, faculty aliases and admin management.
- Teacher-scoped cohorts/dashboard statistics and student own-enrollment endpoint.
- Existing experiment/attempt/session models, task verification, grading and reports.
- HTTPS-origin configuration, optional loopback proxy trust and database readiness.

Details: [Google authentication](google-auth.md) and
[Kali integration](../infrastructure/vm/README.md),
[enrollment API contract](student-enrollment.md), and
[deployment readiness](deployment-readiness.md).

## Enrollment contract and runtime evidence

Stored roles remain `student`, `faculty` (teacher), and `admin`. Students cannot
self-enroll. Faculty enroll existing active students by exact email or ID under
their own session identity; another owner or duplicate enrollment returns 409.
Unenrollment clears only the relationship. Admin endpoints name the managed
teacher explicitly and preserve the same single-owner constraint.

The UI can use `/api/teacher/students` (identical `/api/faculty/students` alias),
`/api/student/enrollment`, and `/api/admin/teachers/:teacherId/students`, with
detail/removal paths and JSON responses defined in the linked enrollment contract.
Use the existing cookie API client; never supply ownership or role from the UI.

Local real MongoDB 7.0.14 validation completed successfully: **110 requests / 21
groups**, including real password login/cookies, enrollment, ownership conflicts,
unenrollment, re-enrollment, authorization, admin operations and cohort dashboards.
Ten simultaneous enrollment rounds each produced one 201, one 409 and exactly
one stored owner. Physical indexes and preservation of accounts/sessions/academic
records were checked. Attempts/reports were synthetic fixtures; no lab or PDF
runtime is proved by this run. Temporary databases/server processes were cleaned.

The compiled API also passed a separate real MongoDB readiness probe: connected
200, actual service outage 503, disconnected 503 and restored 200. `/health`
measures API/database readiness only, not Docker/VM or OAuth availability.
These were local validations, not production tests. They were not re-run during
this Git-only handoff; the automated regression checks below were re-run.

## Known limitations

- Initial real Kali startup was blocked by host RAM below the **6,144 MiB** requirement:
  4,096 MiB guest RAM plus 2,048 MiB host reserve. Do not weaken this check.
- Real Nmap execution inside Kali, target connectivity and actual VM lifecycle
  cleanup therefore remain unvalidated. Passing mocked/protocol tests does not
  establish real Kali runtime success. Further blockers may appear after boot
  becomes possible.
- Google OAuth has not been tested with real Google credentials or a live
  Google callback. Provider/database operations are mocked in the auth tests.
- No cloud host, public HTTPS ingress, certificate, production backup/restore or
  deployed browser acceptance has been validated. Caddy is a prepared example,
  not a tested running proxy. The latest build retains localhost API/socket
  defaults; configure public build variables before deployment.
- Full backend lint has three existing unrelated findings: unused Nmap/DoS
  imports in `server/src/__tests__/allExperiments.test.ts`, and unused `_next`
  in `server/src/middleware/error.ts`. Relevant changed-file lint passes.
- The frontend build has an application bundle-size advisory; its build passes.
- VM images, private runtime files and secrets are intentionally absent from Git.

## Developer ownership

### Developer 1 — Platform/Backend/Infrastructure

- Real Kali VM, Lab Engine, Docker/VM providers.
- Authentication backend and student enrollment backend.
- Teacher APIs, admin APIs and experiment engine.
- Grading, reports and database.
- Cloud deployment and production configuration.
- Final integration and merge coordination.

### Developer 2 — Frontend/Product

- Student Dashboard, Teacher Dashboard and Admin Dashboard.
- Student management UI.
- Experiment listing, experiment details and lab workspace UI.
- Progress, history and profile pages.
- UI/UX polish and responsive design.
- Loading, error and empty states.
- Investor-facing polish.

## Parallel development rules

Developer 2 already owns `feature/frontend-dashboards`; do not recreate, reset,
force-push or edit it from another developer's task. Its fetched tip at handoff
was `a03440f` (responsive design system), branching from `8103da1`. Developer 2
should merge the new backend baseline into that branch as described below.
Developer 1 should branch subsequent backend work from the shared baseline.
The older `codex/real-kali-nmap-integration` and
`codex/google-oauth-deployment-readiness` branches remain historical checkpoints;
`main` remains unchanged pending frontend integration and final review.

1. Do not work directly on `main`.
2. Do not force-push.
3. Fetch before starting. Merge the baseline into an existing shared work branch;
   rebase only your own unshared work. Do not rewrite a shared branch's history.
4. Keep frontend and backend changes separate where practical. Developer 2
   primarily owns `client/src/pages`, layouts and UI components. Developer 1
   owns `server`, `docker` and `infrastructure`.
5. Communicate API request/response contracts before implementing dependent UI.
   Coordinate changes to `client/src/types/api.ts`, shared auth/routing, package
   manifests and root configuration before either developer edits them.
6. Do not modify real-Kali infrastructure from the frontend branch.
7. Do not rewrite shared authentication components unnecessarily.
8. Keep commits small and descriptive.
9. Merge only after tests and relevant checks pass; document existing lint debt.
10. Resolve conflicts intentionally rather than accepting one side blindly.

Use separate local databases/runtimes when running independent backends on one
host. Do not run two backend managers against the same lab database or VM runtime.

## Immediate next tasks

Developer 1:

1. Configure and test real Google OAuth credentials.
2. Coordinate the implemented enrollment API with the frontend teammate.
3. Validate real Kali when sufficient RAM/environment is available.
4. Review the prepared deployment plan; validate the chosen host before release.

Developer 2:

1. Build Student Dashboard from the existing pages and agreed API contracts.
2. Build Teacher Dashboard.
3. Build Admin Dashboard.
4. Build student management UI.
5. Polish investor-facing UI.

## Testing expectations

Every branch should run from the repository root:

```powershell
npm --prefix server test
npm --prefix client test
npm --prefix server run build
npm --prefix client run build
npm --prefix server run lint
npm --prefix client run lint
```

Verified handoff baseline: **285 backend tests (34 files) and 43 frontend tests
(6 files)**, both
builds passing, frontend lint and relevant backend-file lint passing. Full
backend lint retains the three findings above. On a memory-constrained machine,
tests may use `-- --maxWorkers=2`; this does not change VM readiness requirements.
The earlier `cd8d6af` baseline had 262 backend tests; `75c1b1f` adds 23 focused
OAuth/configuration/readiness tests. The existing per-topic reports list focused
lint commands. Unit/protocol suites mock Google, hypervisor and persistence where
documented; passing them does not establish real VM or Google provider success.

Real-runtime acceptance is separate from unit/integration tests. Developer 1
should run `npm --prefix server run vm:check` and only run `vm:smoke` after the
unchanged preflight passes. These checks need an approved prepared image and
Windows WHPX; the frontend branch should not attempt to bypass those requirements.

## Important security rules

- Never commit OAuth secrets or `.env` files containing credentials.
- Never expose Google client secrets to frontend code.
- Never weaken backend authorization or allow students to assign roles.
- Never expose Docker/QEMU credentials to the browser.
- Keep lab isolation intact; real Kali may interact only with controlled
  CyberLabX targets.
- Keep tokens out of localStorage and preserve HttpOnly session cookies.
- Do not commit VM images, runtime keys/metadata, logs or machine-local artifacts.

## Handoff instructions

Prerequisites: Git, Node.js 22+ and npm. Use Windows PowerShell. Normal Docker
development additionally needs Docker Desktop; frontend work does not require
starting a real Kali VM.

### 1–4. Clone, fetch and use the existing frontend branch

```powershell
git clone https://github.com/deveshshuklaaa/CyberLabX.git
Set-Location CyberLabX
git fetch origin
git switch --track origin/feature/frontend-dashboards
git merge origin/feature/student-enrollment
```

For an existing clone with the local frontend branch, finish or safely preserve
local work, then run:

```powershell
git fetch origin
git switch feature/frontend-dashboards
git merge --ff-only origin/feature/frontend-dashboards
git merge origin/feature/student-enrollment
```

If the fast-forward step refuses because local/remote frontend commits diverge,
stop and coordinate with its owner; do not reset or force-push. Resolve any
baseline merge conflicts deliberately, re-run checks and push the frontend branch
normally after review. These commands are instructions; this handoff did not
merge, switch to or push the teammate's branch.

To inspect/run only the shared baseline in a fresh clone, use
`git switch --track origin/feature/student-enrollment` instead. For another new
work branch, select a new unique name rather than recreating the frontend branch.

Developer 1 can independently start with:

```powershell
git fetch origin
git switch -c codex/next-backend-task origin/feature/student-enrollment
```

### 5–6. Install dependencies and configure the local environment

```powershell
npm --prefix server ci
npm --prefix client ci
if (!(Test-Path -LiteralPath .env)) {
    Copy-Item -LiteralPath .env.example -Destination .env
}
notepad .env
```

Set a strong local `JWT_SECRET`, database credentials and matching `MONGO_URI`.
For the supplied local authenticated MongoDB container, the URI must use the
configured mapped port/database and root authentication database (`authSource=admin`)
as shown in `.env.example`. Do not print expanded Compose configuration when it
would expose secrets; use `docker compose config --quiet` to validate it.
Set strong local seed passwords if seed accounts are needed. Keep
`LAB_BACKEND=docker` for normal frontend development. Default frontend/API
addresses are `http://localhost:5173` and `http://localhost:5000`.

Keep all three Google variables empty until Developer 1 provides the OAuth
setup. When enabled, configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and
`GOOGLE_CALLBACK_URL` on the backend. The development callback is
`http://localhost:5000/api/auth/google/callback`; production requires the actual
HTTPS callback and matching HTTPS `CLIENT_URL`. Register the exact callback in
Google Cloud Console. Never share `.env` through Git or put secrets in `VITE_*`.

### 7. Run the existing backend and frontend

For the normal local Docker database setup, start Docker Desktop manually and
then run:

```powershell
docker compose up -d mongodb
docker compose ps
npm --prefix server run seed
npm --prefix server run dev
```

Run the frontend from a second PowerShell in the repository root:

```powershell
npm --prefix client run dev
```

Open `http://localhost:5173` and use the configured local account. Existing
teacher accounts use the `faculty` role; admin/teacher access is controlled by
the backend. Follow the root README to build Docker lab images when testing
Docker labs. UI/API development does not require downloading a VM image.

The root README lists original Nmap/DoS image builds. Expanded experiments also
have versioned Dockerfiles in `docker/recon`, `docker/recon-target`,
`docker/keylogger`, `docker/email-forensics`, `docker/file-forensics` and
`docker/disk-forensics`. Build the relevant image with the exact server-configured
tag before running that experiment; inspect `server/src/config/env.ts` for defaults.
Use only controlled CyberLabX targets. This handoff did not run Docker lab scans.

### Optional real Kali and deployment setup

For real Kali, follow the complete image preparation/manifest, QEMU and WHPX
instructions in [the VM report](../infrastructure/vm/README.md). An approved
prepared base image, private runtime directory, required disk space and unchanged
6,144 MiB free RAM guard are prerequisites. Images/keys are not distributable via
Git; every host must provision these private prerequisites. Run `vm:check` before
`vm:smoke`; never report a unit-test pass as a real boot. No approved VM image is
required for frontend or default Docker work.

For production configuration, same-origin HTTPS, public `VITE_API_URL` /
`VITE_SOCKET_URL`, private MongoDB/API ports and backups, follow the readiness
document. Vite loads client configuration at build time; root `.env` alone does
not configure the frontend bundle. A normal Linux cloud host supports the Docker
plan, not this Windows/WHPX-only VM provider. The existing app cannot control a
remote Kali host; run the complete app on the compatible host for that demo.

### 8–9. Test and begin dashboard work

Run the testing commands above, confirm the frontend branch with
`git branch --show-current`, and agree API contracts with Developer 1. Begin with
the existing student page, then teacher/admin pages and student management UI.
Do not change backend contracts, enrollment, authentication or VM infrastructure
without coordination. Push the frontend work branch normally and request review
before merging; do not push dashboard work onto the frozen integration baseline.
