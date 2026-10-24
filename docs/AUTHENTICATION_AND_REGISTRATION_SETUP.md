# Authentication and Student registration setup

Checkpoint 10 local guide, 24 October 2026. CyberLabX uses the existing MongoDB
User model, bcrypt password hashes and a backend-issued JWT in the
`cyberlabx_session` HttpOnly cookie. The browser stores no access token in
localStorage. Public registration creates Students only.

## Start the local application safely

Open PowerShell in:

```text
C:\Users\Arvind Shekhawat\Desktop\CyberLab\CyberLabX
```

Confirm branch `integration/local-takeover` and preserve unexpected changes:

```powershell
git branch --show-current
git status --short
docker ps --filter name=cyberlabx-local-takeover-mongodb
```

The existing isolated database container must be healthy and `.env` must point
to database `cyberlabx_local_takeover`. Inspect `.env` privately. Never print or
capture it. If the existing container is stopped, start only that container:

```powershell
docker start cyberlabx-local-takeover-mongodb
```

Run the services in separate terminals:

```powershell
npm --prefix server run dev
npm --prefix client run dev
Invoke-RestMethod http://localhost:5000/health
```

Expected URLs are API `http://localhost:5000` and frontend
`http://localhost:5173`. Keep `localhost` consistent with configured CORS and
Socket.IO origins.

## Register and sign in

1. Open `http://localhost:5173/login` and choose **Create Account**, or open
   `http://localhost:5173/register` directly.
2. Enter First Name, Last Name, Email Address, Password and Confirm Password.
   Names are trimmed and limited to 60 characters, email to 254 characters,
   and password to 12–128 characters.
3. Use **Show passwords** only in a private environment. Submit **Create Student
   Account**.
4. A confirmed MongoDB write returns HTTP 201, issues the normal session cookie,
   and opens `/student`. The success notice confirms the account creation.
5. Refresh to verify `/api/auth/me` restores the session. Sign out, then use the
   same email and password on `/login`.

The endpoint rejects unknown fields. Supplying `role`, `teacherId` or
`enrolledAt` returns 400, so a public client cannot choose Faculty/Admin or an
enrollment. Existing and racing duplicate emails return 409. Email is normalized
to lowercase and protected by the MongoDB unique index. Passwords are bcrypt
hashes and are never returned by the API.

Password registration proves possession of the chosen password, but the current
project has no email verification, password reset or email delivery service. It
does not establish ownership of the email address and does not mark it verified.
Do not silently link a matching Google identity; use authenticated linking.

## Google sign-in and account linking

The **Continue with Google** link calls `GET /api/auth/google`; it is a real
authorization-code flow, not a client mock. See
[GOOGLE_OAUTH_LOCAL_SETUP.md](GOOGLE_OAUTH_LOCAL_SETUP.md) for the required
Google Cloud configuration.

New verified Google identities create Students only. Returning identities use
their stable Google subject and the current database role/status. A matching
email on an unlinked password account produces an `account_exists` error. Sign
in with the password, return to `/login` while still authenticated, and choose
**Link Google to this account**. The Google verified email must match and the
callback must retain the same authenticated account. This is also the supported
way to link an authorized Faculty/Admin account; Google never grants a role.

## Existing local Faculty and Admin access

The verified development accounts remain:

| Role | Email | Credential source |
| --- | --- | --- |
| Faculty | `faculty@cyberlabx.local` | `SEED_FACULTY_EMAIL` / `SEED_FACULTY_PASSWORD` in ignored `.env` |
| Admin | `admin@cyberlabx.local` | `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in ignored `.env` |

Their credentials were usable in prior live acceptance. No new fixture script or
credentials file was needed. Do not rerun `dbSeeder` merely to provision these
accounts: account insertion is conditional, but the same script upserts the full
experiment catalogue and may rewrite catalogue definitions. Never use public
registration for privileged roles.

## Errors and recovery

| Symptom | Action |
| --- | --- |
| 400 Invalid request data | Correct field format/length and remove unsupported fields |
| 401 Invalid email or password | Re-enter credentials; disabled and Google-only accounts also reject password login |
| 409 account already exists | Sign in or use authenticated Google linking; do not create a duplicate identity |
| 429 Too many login attempts | Stop automated attempts and wait the `Retry-After` duration; never restart or weaken the limiter |
| Google not configured | Complete the Google Cloud guide and restart the backend |
| API/network failure | Verify `/health`, MongoDB health, ports 5000/5173 and configured localhost origin |

Logout removes the app cookie and pending OAuth transaction cookie. A copied JWT
has no server-side revocation list, so production session revocation remains an
operational gap. Authorization middleware still reloads the current database
role and active state for API requests.

## Safe shutdown

Sign out and stop only the development processes you started. End active labs
through the application before stopping the API. Leave MongoDB data intact. Do
not use `docker compose down -v`, prune, reseed, delete reports or remove the
isolated volume.
