# Google OAuth and deployment readiness

Reviewed 24 October 2026 on `codex/google-oauth-deployment-readiness`, based on
the fetched backend commit `cd8d6af`. Enrollment and its live MongoDB validation
are preserved. Frontend/dashboard files and the Lab Engine are unchanged.

**Status: preparation only; nothing deployed or purchased. Real Google OAuth
is blocked by missing configuration.** A presence-only check found all three
Google settings absent from the effective local environment. No secrets were
printed, credentials created, or Google Console settings accessed. An actual
Console redirect-URI match therefore has not been verified.

## Authentication architecture and audit

Password and Google login both create the existing `cyberlabx_session` JWT
cookie. HTTP authorization reloads the active MongoDB user and checks its current
`student`, `faculty` or `admin` role. Enrollment remains one teacher per student.
Google does not replace this session or enrollment system.

| Code path | Audited behavior |
| --- | --- |
| `GET /api/auth/google` | Authorization code flow, basic `openid email profile` scopes, random state/nonce, S256 PKCE |
| Transaction cookie | Signed HS256 JWT with dedicated issuer/audience and ten-minute expiry; HttpOnly, SameSite=Lax, host-only, path `/api/auth/google` |
| `GET /api/auth/google/callback` | Validates signed transaction, expiry and timing-safe state comparison; exchanges code with backend secret and PKCE verifier |
| Identity verification | Installed official Google library verifies signature, issuer, audience and time bounds; app additionally validates nonce, expiry, audience, issuer, verified email and profile |
| Account resolution | Uses stable Google `sub` in `googleId`; new accounts are active students only |
| Linking | Authenticated `POST /api/auth/google/link` requires the configured frontend Origin; callback requires the same active account and matching verified email; no automatic email merge |
| Persistence races | Unique email and sparse unique Google-subject indexes; `User.init()` awaited; duplicate-subject winner reused only if valid, conflicting email/identity rejected |
| Callback success | Existing app cookie, then fixed role landing `/student`, `/teacher` or `/admin`; request fields cannot select a privileged role or redirect |
| Failure/replay | Fixed safe error codes; callback clears transaction cookie on success/failure. Google rejects used/invalid codes; state/nonce/PKCE and transaction expiry remain required |
| Logout | Clears session and transaction cookies; does not log out of Google SSO or add a JWT revocation store |

There is no server-side replay cache. Replaying a saved transaction cannot make
a Google authorization code reusable. The added replay test simulates Google's
`invalid_grant` response; it does not prove a live Google exchange. Previously
copied app JWTs retain the existing expiry/current-user checks after logout.

The audit inspected the installed `google-auth-library` implementation, including
its signature/certificate and issuer/audience/time checks. Provider calls and
database operations in the OAuth suites are mocked; no real Google ID token
was received or verified in this task. The prior live enrollment run validated
password sessions and indexes, not Google OAuth.

## Exact Google configuration and owner actions

Backend Google names: **`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`GOOGLE_CALLBACK_URL`**. Configure all three together or leave all three empty.
Store them privately on the backend; never put the secret in `VITE_*`, source,
chat, logs, or a committed environment file.

The owner must complete these actions in their Google Cloud project:

1. Open Google Auth Platform. Configure **Branding**, **Audience** and **Data
   Access**. Choose the appropriate audience; add the intended Google accounts
   as test users while the app is in testing. Request only the basic identity
   scopes used above. Complete domain/consent verification if Console requires it.
   See [Google's consent configuration guide](https://developers.google.com/workspace/guides/configure-oauth-consent).
2. Open **Clients**, create an OAuth client of type **Web application**, and
   register the authorized redirect URI. This is not a service account or an API
   key. Copy the client ID/secret into the private backend configuration.
   See [Google's credentials guide](https://developers.google.com/workspace/guides/create-credentials).
3. For local testing, register exactly
   `http://localhost:5000/api/auth/google/callback`. Use the same hostname in the
   browser/API configuration; do not mix localhost with 127.0.0.1 cookies.
4. For the recommended single-origin deployment, register exactly
   `https://<chosen-public-host>/api/auth/google/callback`. Configure that same
   URL in `GOOGLE_CALLBACK_URL`. Scheme, hostname, port, path and trailing slash
   must match Console exactly. No wildcard, query, fragment or credentials.
   [Google documents exact redirect matching](https://developers.google.com/identity/protocols/oauth2/web-server).
5. Set `CLIENT_URL` to the chosen HTTPS frontend origin. This origin also governs
   linking, CORS and terminal Origin checks. The backend authorization-code flow
   needs no frontend Google SDK; a JavaScript-origin entry is not a substitute
   for the required authorized redirect URI.
6. Use a separate isolated local/staging database for browser validation. Do not
   modify production accounts or share callback codes, cookies or tokens.

The validator enforces the callback path above, HTTPS in production, HTTP only
on loopback for development callbacks, and complete Google configuration.
`CLIENT_URL` must be an HTTP(S) origin without embedded credentials, subpath,
query or fragment; it is normalized for consistent origin comparisons.
Production requires HTTPS even when Google login is disabled.

## Cookies, CORS and reverse proxy

Keep frontend and backend under **one public HTTPS origin**. Serve the built SPA
at `/`, proxy `/api/*`, `/socket.io/*` and `/health` to the existing Node server,
and preserve their paths. This avoids unrelated-site cookies and extra hosting
coordination.

- Session: HttpOnly, host-only, path `/`, SameSite=Lax, Secure in production.
- Transaction: same security flags, narrower OAuth path and ten-minute lifetime.
- Cookies deliberately have no Domain attribute. Google returns by a top-level
  GET callback, compatible with Lax. Do not change SameSite to None for this plan.
- Express CORS uses exactly `CLIENT_URL` with credentials enabled. Axios and
  Socket.IO already send credentials; the terminal separately validates Origin.
  CORS is a browser response policy, not a replacement for authorization.
- Build the frontend with `VITE_API_URL` pointing to the public origin plus
  `/api`, and `VITE_SOCKET_URL` pointing to the public origin. These are public
  build-time settings. The current development fallbacks point to localhost;
  never publish a build relying on them. No frontend source edits are required.
- Production cookie Secure flags come from `NODE_ENV`, not a caller-supplied
  forwarding header. Proxy TLS termination may use private HTTP to Node.

`TRUST_PROXY` defaults to `false`. For the provided native Caddy-on-the-same-host
arrangement, explicitly choose `loopback`. Broader boolean/numeric trust values
are rejected. This lets the existing login limiter identify clients behind the
proxy instead of putting all users into the proxy's shared IP bucket. Keep the
API port private; the trusted proxy must handle forwarding headers correctly.
Different proxy networks/topologies need review rather than enabling trust-all.
[Express documents these trust boundaries](https://expressjs.com/en/guide/behind-proxies/).

`infrastructure/deploy/Caddyfile.example` prepares the same-origin routes,
WebSocket proxying and SPA fallback. It uses `handle`, preserving the API prefix.
Caddy handles WebSocket upgrades and forwarding headers; see its
[reverse-proxy documentation](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy).
Its environment substitutions follow the documented
[Caddyfile syntax](https://caddyserver.com/docs/caddyfile/concepts).
Set the public hostname, static build directory and backend port before using
it. Use an absolute static build directory (forward slashes work for Windows
paths). It was not loaded into a running proxy or used to obtain a certificate here.

## Minimal hosting arrangement

### Cloud application and Docker labs

For an initial cloud deployment, use **one dedicated Linux VM** with:

```text
Public HTTPS origin
  -> native Caddy: built client/dist + reverse proxy
  -> one persistent native Node API/Socket.IO process
  -> local MongoDB container + persistent volume
  -> local Docker Engine: existing isolated experiment containers
```

Use the existing Docker provider as the default. Do not place this backend on a
short-lived/serverless host without local Docker access, persistent report
storage and WebSocket support. No separate frontend service, Redis, queue,
orchestration layer, remote lab service or multi-process API is required.

Run Node under the host's service supervisor using the existing production
`npm --prefix server start` command. Use an unprivileged dedicated OS account
with the access this app requires; Docker API access is highly privileged, so
dedicate the host to CyberLabX rather than unrelated workloads. Keep MongoDB/API
ports private and expose only the HTTPS ingress plus restricted administration.
Size the host from measured API/database overhead and the existing per-lab
memory/CPU limits; no capacity, SLA or cloud price is promised by this plan.

The production Compose override binds MongoDB only to loopback, retaining the
existing image, volume and lab behavior. Explicitly merge it with the root file;
ports use `!override`, requiring Compose 2.24.4 or later, so the development
all-interface binding is replaced rather than appended.
[Docker documents this merge behavior](https://docs.docker.com/compose/how-tos/multiple-compose-files/merge/).
Do not expose the unmodified development Compose MongoDB port on a public host.

After explicit owner approval of a host/domain and configuration, build using
the existing manifests (there is no root package manifest or deployment CI):

```powershell
npm --prefix server ci --include=dev
npm --prefix client ci --include=dev
# Supply the public VITE_API_URL and VITE_SOCKET_URL in the build environment first.
npm --prefix server run build
npm --prefix client run build
docker compose -f docker-compose.yml -f infrastructure/deploy/compose.production.yml config --quiet
# Deployment commands below are instructions only; not executed in this task.
docker compose -f docker-compose.yml -f infrastructure/deploy/compose.production.yml up -d mongodb
npm --prefix server start
```

The cloud host's service supervisor should run Node persistently, not a shell
watch process or Vite dev server. Build the existing approved lab images from
the repository's Dockerfiles with the configured image tags. First validate
the existing Nmap Docker golden path; do not expose target ports publicly.
Do not seed production with demo passwords. Create approved initial privileged
accounts deliberately using the existing account/seed mechanisms.

### Real Kali constraint and smallest viable demonstration

The current VM manager explicitly rejects non-Windows hosts and starts QEMU
with `-accel whpx`. A normal Linux cloud VM cannot run this provider as written.
It also cannot use a Kali VM on a different machine through the current local
Lab Engine. Do not imply that a Docker cloud demo satisfies the real-Kali P0.

For the real-Kali demonstration, run the **same complete app** on a validated
Windows/WHPX-capable host, with the same-origin proxy and its local MongoDB and
Docker fallback. Use the local browser for a rehearsal, or approved HTTPS
ingress if remote access is required. A cloud Windows workstation is an option
only after verifying WHPX, nested virtualization, licensing and Linux-container
support on that exact offering. Do not purchase one based only on its RAM size.
Docker Desktop does not support Windows Server; a generic Windows Server image
is not a validated substitute.
[Docker's Windows requirements](https://docs.docker.com/desktop/setup/install/windows-install/).

Do not run a Linux cloud backend and claim it controls the current local Kali
provider. Deploy the entire app on the chosen compatible host; do not introduce
a remote VM service for this deadline. The Linux cloud plan and the Windows
Kali demonstration are alternative deployments, not a new combined architecture.

Keep the unchanged minimum **6,144 MiB free host RAM** requirement (4,096 guest
plus 2,048 reserve), approved prepared image/manifest, disk headroom and private
runtime directory. Docker fallback and other experiments still need their local
Docker runtime/images. Run `vm:check`, then `vm:smoke` only after readiness passes.
Real Kali boot, SSH, controlled target/Nmap and cleanup remain unvalidated here.

## Environment inventory — names only

| Names | Purpose |
| --- | --- |
| `NODE_ENV`, `SERVER_PORT`, `CLIENT_URL`, `TRUST_PROXY` | Runtime mode, local API listener and public/trusted origins |
| `MONGO_URI` | Private authenticated application database connection |
| `JWT_SECRET`, `JWT_EXPIRES_IN`, `BCRYPT_ROUNDS` | Existing session/password settings |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` | Optional all-or-none Google backend configuration |
| `VITE_API_URL`, `VITE_SOCKET_URL` | Public frontend build-time API/terminal destinations |
| `REPORT_DIR` | Persistent private report directory outside disposable releases |
| `MONGO_ROOT_USERNAME`, `MONGO_ROOT_PASSWORD`, `MONGO_DATABASE`, `MONGO_PORT` | Local MongoDB container bootstrap; app should use a database-scoped account in production |
| `LAB_BACKEND`, `LAB_NETWORK_PREFIX`, `LAB_TTL_MINUTES`, `LAB_MEMORY_MB`, `LAB_CPU_NANOS` | Existing lab dispatch, expiry and resource settings |
| `LAB_IMAGE`, `TARGET_IMAGE`, `DOS_ATTACKER_IMAGE`, `DOS_VICTIM_IMAGE`, `DOS_CLIENT_IMAGE`, `RECON_STUDENT_IMAGE`, `RECON_TARGET_IMAGE`, `KEYLOGGER_IMAGE`, `EMAIL_FORENSICS_IMAGE`, `FILE_FORENSICS_IMAGE`, `DISK_FORENSICS_IMAGE` | Approved existing Docker image tags |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_FACULTY_EMAIL`, `SEED_FACULTY_PASSWORD`, `SEED_STUDENT_EMAIL`, `SEED_STUDENT_PASSWORD` | Optional controlled initial accounts, not public demo credentials |
| `PUBLIC_DOMAIN`, `STATIC_ROOT` | Public proxy hostname and static build location for the prepared Caddy example |
| `QEMU_BINARY`, `QEMU_IMG_BINARY`, `VM_BASE_IMAGE`, `VM_RUNTIME_DIR`, `VM_CPUS`, `VM_MEMORY_MB`, `VM_HOST_RESERVE_MB`, `VM_MAX_CONCURRENT`, `VM_MIN_FREE_DISK_GB`, `VM_NETWORK_MODE`, `VM_TAP_ADAPTER`, `VM_ALLOW_INTERNET`, `VM_BOOT_TIMEOUT_MS` | Existing optional Windows VM settings; keep current safety limits |

Runtime variables take precedence over the root uncommitted `.env`. The frontend
variables must exist when Vite builds, not merely when the Node server starts.
Vite runs in `client/`: adding public frontend settings only to the root `.env`
does not configure its bundle. Export them in the build environment or use an
uncommitted `client/.env.local` containing public settings only.
The build inspected here still contains the existing localhost API/socket
fallbacks. Rebuild with the chosen public destinations before publishing it;
a passing build alone does not make this artifact deployment-configured.
Keep server credentials out of the static directory and public build output.
No production domain, secrets, cloud credentials or resource allocation was set.

## Health, persistence and operations

`GET /health` now measures **API/database readiness**. It returns uncached
`200 {"status":"ok"}` only when Mongoose is connected and a database ping
succeeds, bounded by a 1.5-second driver timeout. Disconnected, connecting,
disconnecting, missing-handle and failed-ping cases return
`503 {"status":"unavailable"}`. It exposes no environment, URI, driver error,
stack, Docker detail or credentials. Use process supervision for liveness;
do not restart an otherwise running API repeatedly during a database outage.

This is not an OAuth-provider or lab-capability certificate: Google availability,
valid Console configuration, images, Docker availability, VM capacity and target
connectivity still require their dedicated checks before a demo/release. Lab
starts retain their existing provider readiness and provisioning checks.

MongoDB and reports require persistent storage. Before enabling Google, verify
the real `users` indexes: `_id_` (implicit unique), `email_1` (unique),
`googleId_1` (unique, sparse), `role_1`, and
`teacherId_1_role_1__id_1` (non-unique). The single-teacher constraint remains the
conditional update on the student document. Default Mongoose index creation is
used; if operations disables it, provision and verify indexes explicitly before
traffic. Resolve conflicting data deliberately; do not blindly drop indexes or
run destructive synchronization. Rehearse startup migrations on an isolated copy.

Back up MongoDB and report files off-host with access control, encryption,
retention and a tested restore procedure. For the current standalone MongoDB,
quiesce writes for a consistent logical backup; do not assume replica-set oplog
backup features apply or copy a live data directory casually.
[MongoDB backup guidance](https://www.mongodb.com/docs/manual/tutorial/backup-and-restore-tools/).
Test restoration and report path mapping on the chosen OS. Store session secrets
and approved immutable Kali images through separate private operational controls.

Run only one backend manager per database/Docker daemon/VM runtime. Startup and
shutdown recovery deliberately reclaim managed labs; overlapping instances or
rolling restarts can interrupt experiments. Drain/finish labs before restarting.
Schedule backups and upgrades around this behavior. Review the pinned database
image and dependencies for supported security updates before public release;
this task does not upgrade or migrate them.

Capture bounded application/service logs and readiness failures. Never record
passwords, secrets, session cookies, Google tokens or callback authorization
codes. The proxy example does not enable access logs; if added, redact callback
query strings and sensitive headers. Do not place logs/runtime keys in Git.

## Owner browser acceptance and remaining gates

After private Google configuration and HTTPS/staging setup:

1. Verify `/health`, database/indexes and the frontend's public API/socket build
   destinations. Validate the proxy template locally before starting it. Check
   externally that MongoDB and the backend port are not publicly reachable.
2. Use a real test Google account in a normal browser: complete login/callback,
   verify new student creation, then repeat returning login without duplicates.
3. For teacher/admin linking, first use an approved password account with the
   same email as its intended Google identity (demo `.local` addresses cannot
   match a real Google account). Confirm Google login does not auto-link by
   email; password-login, explicitly link, then verify the preserved role/landing.
4. Check consent denial, failed/replayed callback, inactive account rejection,
   wrong-role API denial and logout. Inspect actual cookie flags and cleanup in
   browser developer tools without sharing cookie/token values.
5. Verify HTTPS login, callback, logout, terminal WebSocket routing, lab target
   isolation and provider-specific golden paths on the exact selected host.
6. Approve a hosting account, host type, region, budget, domain/DNS and backup
   owner before any provisioning. Nothing in this document authorizes a purchase
   or deployment. The frontend teammate should consume this configuration on
   their branch; no dashboard files were edited here.

## Validation record

Focused automated checks cover Google code flow, identity-claim rejection,
cookie flags, linking/session mismatch, simulated used-code rejection, production
origin/proxy configuration and database readiness failure cases. Google/DB calls
are mocked in these suites; HTTP routing and cookies use local HTTP servers.

Commands from the repository root:

```powershell
npm --prefix server test
npm --prefix client test
npm --prefix server run build
npm --prefix client run build
npm --prefix server run lint
npm --prefix client run lint
```

Focused lint from `server/`:

```powershell
npx --no-install eslint src/app.ts src/config/env.ts src/controllers/healthController.ts src/controllers/googleAuthController.ts src/services/googleAuthService.ts src/services/authService.ts src/routes/authRoutes.ts src/__tests__/googleAuthFlow.test.ts src/__tests__/googleConfig.test.ts src/__tests__/healthReadiness.test.ts --max-warnings=0
```

Actual results on 24 October 2026:

| Check | Result |
| --- | --- |
| Backend regression | PASS: 34 files, 285 tests (baseline 262 plus 23 focused additions) |
| Frontend regression | PASS: 6 files, 43 tests; no frontend edits |
| Focused auth/config/readiness run | PASS: 4 files, 73 tests; provider/driver calls mocked |
| Backend and frontend builds | PASS; existing frontend chunk-size advisory remains |
| Focused authentication/configuration lint | PASS |
| Frontend lint | PASS |
| Full backend lint | FAIL: only the same three existing unused Nmap/DoS imports and `_next` findings |
| Compiled API + real isolated MongoDB | PASS: connected 200, actual service outage 503, disconnected 503, restored 200 |
| Google route without credentials | PASS: safe `not_configured` redirect, no session created; not a Google login |

The real readiness probe used a fresh local database, synthetic production
frontend origin and no Google credentials. It did not use a production database
or a public HTTPS ingress. The temporary database/server were removed and the
MongoDB service returned to its original stopped state. No indexes or users in
the development database were modified. The two-file error-response fix from
the previous enrollment validation remains intact.

Compose merge configuration was validated without starting containers: exactly
one MongoDB port binding on loopback, with the persistent data volume retained.
Caddy is not installed in this environment, so its parser, certificate issuance,
HTTPS ingress and browser cookie behavior have not been validated here.
Real Google login/callback, Google Console URI equality, cloud provisioning,
production backups/restore and Windows Kali runtime remain unvalidated.
