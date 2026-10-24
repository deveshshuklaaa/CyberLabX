# CyberLabX Google authentication — setup and review

Implemented on `codex/real-kali-nmap-integration`, 24 October 2026.
Status: **automated verification passed; real Google OAuth not tested**.
No Google client ID, client secret or callback URL is configured in the local
process environment or `.env`. No real credentials were created or committed.

## 1. Existing architecture

CyberLabX already has a Mongoose User model, bcrypt password login/register,
backend-issued JWT sessions in the `cyberlabx_session` HttpOnly cookie,
`/api/auth/me`, logout, Zustand in-memory frontend user state, and protected
React routes. API middleware reloads the current active database user; role
authorization uses that user's role, not the role claim inside the JWT.
Lab, attempt and report ownership checks already exist and were preserved.

Stored roles remain `student`, `faculty`, and `admin`. **`faculty` is the
existing TEACHER role.** Pre-created teacher/admin accounts and their permissions
are preserved without a role migration. `/teacher` and `/api/teacher/dashboard`
are aliases for the existing faculty portal and API; `/faculty` still works.

## 2. What changed

- Added Google's official `google-auth-library` to the existing backend.
- Added OAuth authorization-code initiation, callback and authenticated account
  linking. No separate authentication platform or service was introduced.
- Added stable unique Google subject storage, optional profile image URL, and
  support for Google-only users without a fabricated password or family name.
- Added Continue with Google and safe callback-error messages on the existing
  login screen. Password login remains available.
- Added role-aware landing routes and student/teacher/admin route guards using
  the existing pages; no dashboard implementation or redesign was performed.
- Logout clears the app session and pending OAuth transaction cookies.
- VM implementation, lab authorization and Docker fallback were not changed.

## 3. Files changed for this task

Existing files modified:

```text
.env.example
server/package.json
server/package-lock.json
server/src/config/env.ts
server/src/models/User.ts
server/src/services/authService.ts
server/src/controllers/authController.ts
server/src/routes/authRoutes.ts
server/src/routes/dashboardRoutes.ts
client/src/App.tsx
client/src/routes/ProtectedRoute.tsx
client/src/pages/Login.tsx
```

New files:

```text
server/src/services/googleAuthService.ts
server/src/controllers/googleAuthController.ts
server/src/__tests__/googleIdentity.test.ts
server/src/__tests__/googleAuthFlow.test.ts
server/src/__tests__/googleUserModel.test.ts
server/src/__tests__/googleConfig.test.ts
server/src/__tests__/passwordAuthCompatibility.test.ts
client/src/routes/roleHome.ts
client/src/routes/RoleLanding.tsx
client/src/__tests__/Login.test.tsx
client/src/__tests__/AuthRouting.test.tsx
docs/google-auth.md
```

The authentication changes share the VM integration baseline. See
[TEAM_HANDOFF.md](TEAM_HANDOFF.md) for branch ownership and the shared handoff.
Machine-local artifacts and credentials are excluded from that baseline.

## 4. Google OAuth flow

```text
Continue with Google
  -> GET /api/auth/google
  -> random state + nonce + S256 PKCE challenge
  -> signed HttpOnly transaction cookie (10 minutes)
  -> Google account selection and consent (openid email profile)
  -> GET /api/auth/google/callback
  -> verify transaction signature, expiry and matching state
  -> exchange code using backend-only client secret and PKCE verifier
  -> verify Google ID-token signature, issuer, audience, expiry and nonce
  -> require verified email and a valid name/profile
  -> resolve stable Google subject / create student / explicit account link
  -> existing CyberLabX session cookie
  -> /student, /teacher or /admin based on database role
```

Google access/refresh/ID tokens are neither returned to the frontend nor stored
as app sessions. Only basic identity scopes are requested; no offline access or
Google API permissions are needed. Redirect destinations are fixed server-side.
The flow follows [Google's OpenID Connect documentation](https://developers.google.com/identity/openid-connect/openid-connect)
and the installed official library's authorization-code/ID-token APIs.

## 5. Session mechanism

Both login methods call the same existing session-cookie function. The cookie
is HttpOnly, SameSite=Lax, host-only, path `/`, and Secure in production.
The existing JWT expiry configuration is retained. Frontend state contains a
public user object in memory; no authentication tokens are put in localStorage.
`/api/auth/me` bootstraps user state after the OAuth redirect.

The OAuth transaction cookie is separately scoped to `/api/auth/google`, signed
with a dedicated audience/issuer, HttpOnly, SameSite=Lax, and Secure in production.
It contains state, nonce, PKCE verifier and (only when explicitly linking) the
authenticated user's ID. Callback and logout clear it. Callback responses use
no-store and no-referrer headers.

Logout expires both cookies. This preserves the repository's stateless JWT
model; it does not add a server-side session blacklist or revoke Google SSO.
Previously copied app JWTs remain subject to their existing expiry and current
database user/role/status checks. No session infrastructure was redesigned.

## 6. User creation, linking and duplicate prevention

- Returning users are found by the signed Google token's stable `sub`, stored
  as `googleId`; email is not the primary provider identity.
- New Google identities create active students only, with first/last name,
  normalized email, optional HTTPS profile image URL, role and timestamps.
- Google-only accounts do not have a local password. Password login rejects
  them cleanly rather than comparing against an absent password hash.
- A matching existing email **does not automatically link or grant access**.
  This protects pre-created privileged accounts and existing password accounts.
- To link an existing account, sign in with its password, return to `/login`,
  and choose **Link Google to this account**. The authenticated POST requires
  the configured frontend Origin. The callback requires the same active app
  account to remain authenticated and the verified Google email to match.
- Linking cannot transfer a subject already owned by another user, replace an
  already-linked different subject, or change the user's password or role.
- Unique email and sparse unique Google-subject indexes arbitrate concurrent
  callbacks. The service waits for `User.init()` before resolution. A duplicate
  subject returns the winning active account; conflicting identities fail.
- If a linked Google account changes email, the stable subject still identifies
  it. The existing app contact email is not silently overwritten.

The current repository uses Mongoose's default index creation. Ensure these
indexes are deployed before enabling OAuth if production disables automatic
indexes. No live MongoDB write/index build was performed in this task; account
resolution tests mock database operations, and schema/index definitions are tested.

## 7. Role assignment

| Product role | Stored value | Landing | Assignment |
| --- | --- | --- | --- |
| STUDENT | `student` | `/student` | New ordinary Google users |
| TEACHER | `faculty` | `/teacher` | Existing administrator-controlled account |
| ADMIN | `admin` | `/admin` | Existing administrator-controlled account |

Browser query parameters, callback fields, Google profile extras and login
inputs cannot select teacher/admin. Existing admin account-management endpoints
remain the authority for role changes. Existing admin access to the faculty
portal is preserved.

## 8–9. Protected routes and security

Unauthenticated users are redirected to `/login` after session bootstrap.
Student pages, including established experiment/lab links, require `student`.
Teacher routes require `faculty` or `admin`; admin routes require `admin`.
Wrong-role navigation redirects to the current user's own landing page.
Existing student URLs remain available, with `/student/*` aliases where useful.

Backend endpoints independently use existing `requireAuth` and `allowRoles`.
Teacher API aliases use the same middleware as the existing faculty endpoint.
Tests explicitly send an admin JWT role claim while returning a student or
teacher database user, confirming that the claim cannot elevate permissions.

Malformed/expired state, missing code/profile, consent denial, invalid identity,
duplicate/link conflicts, disabled accounts and provider failures fail safely.
OAuth errors expose fixed friendly codes/messages, not provider errors, tokens,
client secrets or stacks. Login initiation, linking and callback use the existing
login rate limiter. PKCE and Google's one-use authorization code protect code
exchange; an ID-token nonce binds the identity response to its transaction.

For production, serve frontend/backend on the same site (or proxy `/api` under
the frontend origin) so the existing SameSite=Lax session cookie works. Separate
unrelated frontend/API sites require an explicit cookie/CSRF deployment design
outside this change; do not solve that by weakening the cookie flags.

## 10–12. Tests and verification

| Check | Result |
| --- | --- |
| Backend suite | PASS: 31 files, 207 tests |
| Frontend suite | PASS: 6 files, 43 tests |
| Added coverage | 55 backend tests, 23 frontend tests |
| Backend build | PASS |
| Frontend build | PASS; application chunk-size advisory remains |
| Authentication backend files lint | PASS |
| Frontend lint | PASS |
| Full backend lint | FAIL: same three existing findings outside this task |

Focused coverage includes successful callbacks and role redirects, existing/new
users, unique-index race handling, explicit linking, state/nonce/issuer/audience/
expiry/email/profile rejection, provider errors, Secure/HttpOnly cookie flags,
logout, invalid/disabled sessions, current-DB-role authorization, protected app
routes, local password compatibility, Google-only user validation and config.
Google OAuth and database calls are mocked. HTTP and cookie integration tests
use an actual local Express/HTTP server; rate limiting is bypassed in those
focused tests to avoid coupling callback cases to the shared request quota.

Commands executed from the repository root:

```powershell
npm --prefix server test -- --maxWorkers=2
npm --prefix client test -- --maxWorkers=2
npm --prefix server run build
npm --prefix client run build
npm --prefix server run lint
npm --prefix client run lint
```

Focused lint from `server/`:

```powershell
npx --no-install eslint src/config/env.ts src/controllers/authController.ts src/controllers/googleAuthController.ts src/models/User.ts src/routes/authRoutes.ts src/routes/dashboardRoutes.ts src/services/authService.ts src/services/googleAuthService.ts 'src/__tests__/google*.test.ts' src/__tests__/passwordAuthCompatibility.test.ts --max-warnings=0
```

Full backend lint findings are unchanged: unused `NMAP_LAB_DEFINITION` and
`DOS_LAB_DEFINITION` imports in `allExperiments.test.ts`, and unused `_next`
in `middleware/error.ts`. They were not suppressed or changed.

## 13. Real Google OAuth status

**Not tested.** No real Google OAuth credentials or live Google callback were
used. Passing mocked tests is not a live Google-login acceptance result.
The remaining acceptance step is to configure credentials and test real
student signup/login, explicit teacher/admin linking, returning login, role
restrictions and logout in a browser against the running app/database.

## 14. Required environment and setup

Leave all three Google fields empty to keep password-only login working.
To enable Google, configure all three in the uncommitted backend `.env`:

```dotenv
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
```

Fill the two empty values from an OAuth **Web application** client in Google
Cloud Console. Configure its consent screen and add test users if the consent
screen is in testing mode. Register the exact callback URL above as an
authorized redirect URI. Production uses the deployed HTTPS backend URL ending
in `/api/auth/google/callback`; configure the matching HTTPS `CLIENT_URL` too.
The environment validator rejects partial Google configuration, unsafe callback
URLs and HTTP production frontend/callback URLs. Keep all client secrets on the
backend; no `VITE_GOOGLE_CLIENT_SECRET` or frontend OAuth SDK is needed.

The existing `JWT_SECRET`, `MONGO_URI`, `CLIENT_URL`, and password configuration
remain required as before. Run the existing app/database normally; this auth
task did not start Docker Desktop, provision a VM or perform any network scan.

## 15. Remaining blocker and scope

The blocker for **real Google verification** is the missing Google OAuth client
configuration and a live application/database callback run. No code-level or
authentication-test failure remains. Full backend lint still has its existing
unrelated findings. The earlier Kali runtime RAM blocker remains a separate
unvalidated task; this change neither attempted nor claimed VM validation.
