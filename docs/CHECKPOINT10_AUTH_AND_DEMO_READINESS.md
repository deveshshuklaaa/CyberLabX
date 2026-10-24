# Checkpoint 10: authentication and manual demo readiness

Assessment date: 24 October 2026. Branch: `integration/local-takeover`.
Authentication implementation commit: `45b78db`.
All work and commits are local; no push, PR action or deployment occurred.

## Acceptance status

| Capability | Status | Evidence / limit |
| --- | --- | --- |
| Public email/password Student registration | PASS | Rendered Chrome registration returned 201, opened `/student`, and persisted one normalized Student in the isolated MongoDB |
| Password hashing and response privacy | PASS | Stored account has a bcrypt hash; password/hash absent from API/browser evidence; focused regression covers bcrypt comparison |
| Public privileged-role prevention | PASS | Extra `role: admin` request returned 400 and created no account; strict schema also rejects faculty/enrollment fields |
| Duplicate registration | PASS | Existing email returned 409 with an actionable message; unit regression covers Mongo duplicate-key race 11000 |
| Input validation | PASS | Client inline name/email/password/confirmation checks; malformed API request returned 400 |
| Immediate authenticated registration | PASS | Existing HttpOnly-cookie design retained; success notice and Student dashboard rendered only after backend success |
| Password login / wrong password | PASS | Fresh registered account logged in; wrong password returned useful 401 without session |
| `/api/auth/me` / refresh persistence | PASS | Reload retained the new Student session and protected Student page |
| Logout / protected route | PASS | Sign Out returned to `/login`; direct `/student` returned to login afterward |
| Query-cache/account isolation | PASS | Registration/login clear existing React Query cache; fresh and existing regression coverage passes; prior Stage 9 cross-role browser evidence retained |
| Disabled account | PASS (automated regression) | Password and Google identity tests reject inactive users; live temporary status mutation was intentionally avoided while the shared limiter window was active |
| Rate limit and recovery | PASS | Existing 10 requests/15 minutes limiter preserved. Live run returned 429 with limit 10, remaining 0 and `Retry-After: 711`; after natural expiry the next request succeeded with remaining 9 |
| Google implementation/security | PASS (code/tests) | Real authorization-code flow, state, nonce, S256 PKCE, verified ID token/email, stable subject, explicit linking and role preservation are covered |
| Unconfigured Google fallback | PASS | After natural limiter expiry, real GET returned 303 to `/login?oauth_error=not_configured` with `Cache-Control: no-store`; no transaction cookie was issued |
| Real Google provider login | BLOCKED | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` absent; no provider account selection/callback success claimed |
| Google account linking | BLOCKED (live) | Backend/UI and tests are ready; requires the same external credentials and a real matching Google account |

Password registration does not establish email ownership. The project has no
email verification or password-reset delivery service, and no address is marked
verified without a provider assertion.

## Live database and HTTP evidence

Database was confirmed as `cyberlabx_local_takeover`; MongoDB container
`cyberlabx-local-takeover-mongodb` was healthy. Before testing: 5 users,
8 attempts, 2 reports and 8 lab sessions. After testing: 6 users, 8 attempts,
2 reports and 8 lab sessions. The only new record is:

```text
checkpoint10.student.1792865920660@example.test
role=student, active=true, unassigned, bcrypt password=true, Google identity=false
```

The account ID is retained in the database/evidence but is unnecessary for
manual login. No password is published. The role-escalation request created zero
records. Existing users, attempts, reports, labs and PDF files were not changed;
no enrollment relationship or lab was created.

Rendered Chrome covered `/register`, `/login`, `/student`, `/experiments`,
`/progress`, `/history` and `/profile`; dashboard API failure/retry was exercised.
Registration and login were rendered at 320, 375, 768 and 1280 pixels without
document-wide horizontal overflow. The new success banner, password visibility
control, inline errors and keyboard-addressable native controls were exercised.

Local screenshots are outside the repository at:

```text
%LOCALAPPDATA%\CyberLabX\evidence\checkpoint10
```

The directory contains `register-{320,375,768,1280}.png`,
`login-{320,375,768,1280}.png` and `student-registration-success.png`. They do
not contain passwords, cookies or tokens. Prior complete role/product evidence
remains in the ignored repository directory `.env.stage9-evidence/`; Stage 8
terminal evidence remains in `.env.stage8-evidence/` and is indexed by
`docs/STAGE8_RUNTIME_VALIDATION.md`.

## Faculty, Admin and practical demo readiness

Existing development accounts remain active and their configured credentials
were usable in the most recent live role acceptance:

| Role | Email | Current supported journey |
| --- | --- | --- |
| Faculty | `faculty@cyberlabx.local` | Teacher dashboard, exact enrollment, student detail/attempts/reports, cohort analytics, removal |
| Admin | `admin@cyberlabx.local` | Dashboard, user directory/details, teacher cohort management, full audit search; account mutations remain gated |

No fixture script or credentials file was created because existing credentials
are known locally and usable. `dbSeeder` is not safe to rerun merely for accounts:
it conditionally inserts missing accounts but also upserts every experiment with
`$set`, which can rewrite catalogue definitions.

Stage 8 already live-validated the real Docker Nmap practical: provisioning 201,
real xterm/Socket.IO Kali input/output, four controlled scans against
`nmap-target`, four grading verifications, 75/75 completion, quiz, genuine PDF,
resize, refresh/reconnect, stop and resource cleanup. This task did not rerun the
lab because registration did not change lab code and the user requested data and
runtime preservation. Natural 45-minute expiry remains NOT TESTED. Other lab
images are not all runtime-validated. Real Kali/QEMU remains BLOCKED by missing
prepared qcow2 image/QEMU prerequisites.

Admin user creation and role/status writes remain BLOCKED behind the approved
replica-set/shared-guard transactional design. No bypass or mutation was added.

## Fresh quality results

| Command | Result |
| --- | --- |
| `npm --prefix server test` | PASS: 36 files, 348 tests |
| `npm --prefix client test` | PASS after updating one stale label assertion: 21 files, 243 tests |
| `npm --prefix server run build` | PASS |
| `npm --prefix client run build` | PASS; existing large-chunk advisory |
| `npm --prefix client run lint` | PASS |
| `npm --prefix server run lint` | Expected nonzero: same 3 pre-existing unused-symbol findings; no new finding |

Fresh audit counts are unchanged:

| Scope | Moderate | High | Critical | Total |
| --- | ---: | ---: | ---: | ---: |
| Server full | 5 | 8 | 3 | 16 |
| Server production (`--omit=dev`) | 4 | 4 | 1 | 9 |
| Client full | 4 | 7 | 2 | 13 |
| Client production (`--omit=dev`) | 0 | 2 | 0 | 2 |

Server production entries are `@grpc/grpc-js`, `body-parser`, `dockerode`,
`engine.io`, `ip-address`, `proxy-addr`, `qs`, `uuid` and `zod`. Client production
entries are `axios` and `follow-redirects`. Request-facing body/Socket.IO chains
and browser Axios need targeted update/retest before public hosting. The critical
`proxy-addr` advisory concerns trusted-proxy handling; this app does not enable
Express trust proxy, but that is not a general exemption. No `npm audit fix`,
forced upgrade or lockfile change was made.

## Google external action required

Create a Google OAuth **Web application** client, configure frontend origin
`http://localhost:5173` and exact redirect URI
`http://localhost:5000/api/auth/google/callback`, then add all three existing
variables to the ignored root `.env` and restart the backend. Detailed steps and
live acceptance cases are in [GOOGLE_OAUTH_LOCAL_SETUP.md](GOOGLE_OAUTH_LOCAL_SETUP.md).
A real provider sign-in/link remains the required external acceptance action.

## Remaining limitations

- Real Google sign-in/linking: BLOCKED by absent external credentials.
- Admin account mutations: BLOCKED by transaction/serialization prerequisite.
- Real Kali/QEMU: BLOCKED by local VM prerequisites.
- Natural 45-minute lab expiry: NOT TESTED live.
- Full screen-reader/contrast/touch/WCAG acceptance: NOT TESTED.
- Dependency security gate: FAILED pending targeted remediation.
- Password email verification/reset and global JWT revocation: not implemented.
- Full live runtimes for non-Nmap experiments: NOT TESTED.

Use [FINAL_MANUAL_ACCEPTANCE.md](FINAL_MANUAL_ACCEPTANCE.md) for the complete
manual role/lab checklist and
[AUTHENTICATION_AND_REGISTRATION_SETUP.md](AUTHENTICATION_AND_REGISTRATION_SETUP.md)
for startup and account instructions.
