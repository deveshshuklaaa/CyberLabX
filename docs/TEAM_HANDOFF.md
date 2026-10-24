# CyberLabX Team Handoff

## Current baseline

Repository: https://github.com/deveshshuklaaa/CyberLabX

Branch: `codex/real-kali-nmap-integration`

State:

- Real Kali integration implemented for Nmap; Docker fallback preserved.
- Google Authentication implemented using the existing backend/session model.
- Real Kali runtime validation pending due to host RAM.
- Google OAuth browser validation pending configured credentials.

This is the shared starting point for both developers. The baseline includes
the earlier experiment suite and existing portal pages; new dashboard/product
work belongs on separate branches. No deployment is part of this handoff.

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
- SSH terminal transport, resize/reconnect support and captured Nmap evidence.
- Infrastructure preflight/smoke commands and focused VM/protocol tests.
- Google authorization-code flow with state, nonce and S256 PKCE.
- Verified provider identity, unique subject storage and explicit account linking.
- Existing secure app session cookies, logout and role-aware protected routes.
- Automated authentication, authorization, route and regression tests.

Details: [Google authentication](google-auth.md) and
[Kali integration](../infrastructure/vm/README.md).

## Known limitations

- Real Kali has not been booted successfully on the current development machine
  because available RAM is below the **6,144 MiB** readiness requirement:
  4,096 MiB guest RAM plus 2,048 MiB host reserve. Do not weaken this check.
- Real Nmap execution inside Kali, target connectivity and actual VM lifecycle
  cleanup therefore remain unvalidated. Passing mocked/protocol tests does not
  establish real Kali runtime success. Further blockers may appear after boot
  becomes possible.
- Google OAuth has not been tested with real Google credentials or a live
  Google callback. Provider/database operations are mocked in the auth tests.
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

Developer 2 starts from `codex/real-kali-nmap-integration` and creates
`feature/frontend-dashboards`. Developer 1 uses a separate backend branch, such
as `feature/student-enrollment`. These are planned work branches; this handoff
does not implement their features.

1. Do not work directly on `main`.
2. Do not force-push.
3. Fetch and pull/rebase from the integration baseline before starting. Rebase
   only your own unshared work; do not rewrite a shared branch's history.
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
2. Implement controlled student enrollment.
3. Validate real Kali when sufficient RAM/environment is available.
4. Prepare cloud deployment.

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

Expected combined baseline: **207 backend tests and 43 frontend tests**, both
builds passing, frontend lint and relevant backend-file lint passing. Full
backend lint retains the three findings above. On a memory-constrained machine,
tests may use `-- --maxWorkers=2`; this does not change VM readiness requirements.
The existing per-topic reports list focused lint commands.

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

### 1–4. Clone, fetch, select the baseline and create the frontend branch

```powershell
git clone https://github.com/deveshshuklaaa/CyberLabX.git
Set-Location CyberLabX
git fetch origin
git switch --track origin/codex/real-kali-nmap-integration
git pull --ff-only
git switch -c feature/frontend-dashboards
```

For an existing clone, finish or safely preserve local work before switching.
If the local integration branch already exists, use
`git switch codex/real-kali-nmap-integration`, then `git pull --ff-only` and create
the frontend branch. Do not reset or discard another developer's changes.

Developer 1 can independently start with:

```powershell
git fetch origin
git switch -c feature/student-enrollment origin/codex/real-kali-nmap-integration
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

### 8–9. Test and begin dashboard work

Run the testing commands above, confirm the frontend branch with
`git branch --show-current`, and agree API contracts with Developer 1. Begin with
the existing student page, then teacher/admin pages and student management UI.
Do not change backend contracts, enrollment, authentication or VM infrastructure
without coordination. Push the frontend work branch normally and request review
before merging; do not push dashboard work onto the frozen integration baseline.
