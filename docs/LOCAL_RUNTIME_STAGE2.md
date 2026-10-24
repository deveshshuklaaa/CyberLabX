# Stage 2: local runtime setup and evidence

Branch: `integration/local-takeover`. Starting commit:
`7d48023abd27208c3f5c89676bef77b57ffb71f3`.
Date: 2026-10-24 (Asia/Calcutta).

Application source and security settings were not changed. Only this document
is committed. No push, PR change, remote modification, deployment, enrollment UI
development or practical lab execution occurred.

## Running services

| Component | Actual result |
| --- | --- |
| Node / npm | v24.19.0 / 11.17.0 |
| Docker client / daemon | 29.7.2 / 29.7.2 |
| Compose | v5.5.1 |
| MongoDB | mongo:7.0.14; container running and healthy |
| Mongo binding | 127.0.0.1:27017 |
| Database | cyberlabx_local_takeover |
| Express | http://localhost:5000; health returns 200 |
| Vite | http://localhost:5173; HTML shell, entry module and logo return 200 |

Docker Desktop was installed but its Linux engine was initially stopped:
the `dockerDesktopLinuxEngine` named pipe was absent. Starting Docker Desktop
through its CLI resolved this. Both lockfile installs (`npm --prefix server ci`
and `npm --prefix client ci`) passed. No package upgrades or lockfile changes.

## Isolation, configuration and seed behavior

The pre-existing stopped `cyberlabx-mongodb` container and
`cyberlabx_mongodb_data` volume were preserved. This runtime uses:

- Compose project: `cyberlabx-local-takeover`.
- Container: `cyberlabx-local-takeover-mongodb`.
- Named volume: `cyberlabx_local_takeover_mongodb_data`.
- Network: `cyberlabx_local_takeover_network`.
- Ignored files: root `.env` and `.env.local-runtime.compose.yaml`.

The root environment file was absent and was created from `.env.example`.
MongoDB, JWT and three seed-account secrets were generated directly into that
ignored file without printing them. Both local configuration files were verified
with `git check-ignore`; neither is staged or committed.

Configured variable names:

- `NODE_ENV`, `SERVER_PORT`, `CLIENT_URL`.
- `MONGO_URI`, `MONGO_ROOT_USERNAME`, `MONGO_ROOT_PASSWORD`, `MONGO_DATABASE`, `MONGO_PORT`.
- `JWT_SECRET`, `JWT_EXPIRES_IN`, `BCRYPT_ROUNDS`.
- `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_FACULTY_EMAIL`,
  `SEED_FACULTY_PASSWORD`, `SEED_STUDENT_EMAIL`, `SEED_STUDENT_PASSWORD`.
- `LAB_BACKEND=docker`; existing limits/image configuration preserved.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` left empty.

No frontend VITE overrides exist; existing API/socket defaults target localhost:5000.
Use localhost consistently with the configured frontend Origin.

The local Compose override contains no credentials and selects the existing
documented `mongodb` service with isolated names and a loopback port:

```yaml
services:
  mongodb:
    container_name: cyberlabx-local-takeover-mongodb
    ports: !override
      - "127.0.0.1:${MONGO_PORT:-27017}:27017"
volumes:
  mongodb_data:
    name: cyberlabx_local_takeover_mongodb_data
networks:
  cyberlabx_network:
    name: cyberlabx_local_takeover_network
```

Authenticated Mongo ping returned 1. Unauthenticated collection listing was
rejected with Mongo error code 13. The new database had zero collections before
seeding. The target hostname/database were checked before running the seed script.
No existing CyberLabX-managed lab resources were found before API startup.

The seed script inserts missing accounts without overwriting existing users or
passwords, but DOES upsert built-in experiment definitions by slug. It is not
globally insert-only and was run only against the new isolated database.

Seeding passed. Subsequent real database inspection found 3 accounts, 8 experiment
records (7 published, 1 draft), the cohort index on teacherId/role/_id, and zero lab
sessions. No student was enrolled; empty cohorts are genuine initial data.
Seed credential values remain only in the ignored local environment file.

## Restart and normal shutdown

From the repository root:

```powershell
docker desktop start --timeout 60
docker compose -p cyberlabx-local-takeover -f docker-compose.yml -f .env.local-runtime.compose.yaml config --quiet
docker compose -p cyberlabx-local-takeover -f docker-compose.yml -f .env.local-runtime.compose.yaml up -d mongodb
docker compose -p cyberlabx-local-takeover -f docker-compose.yml -f .env.local-runtime.compose.yaml ps
npm --prefix server run dev
# Separate terminal:
npm --prefix client run dev
```

Use `config --quiet`: printing resolved Compose configuration exposes interpolated
secrets. Services are left running at completion. For a normal later shutdown,
stop the API/Vite processes and use the same Compose project/files with
`stop mongodb`. Preserve all databases and volumes.

## Real HTTP smoke results

Requests used real seeded accounts and in-memory cookie jars. No credentials,
tokens, session cookies or full Mongo connection strings were printed. Every
role/path combination below returned the stated status.

| Session | Method/path | Actual result |
| --- | --- | --- |
| Anonymous | GET `/health` | 200; status ok |
| Anonymous | GET Vite `/`, `/src/main.tsx`, `/assets/somaiya-emblem.png` | 200 each |
| Student, faculty, admin | POST `/api/auth/login` | 200 each; expected active role |
| Student, faculty, admin | GET `/api/auth/me` with cookie | 200 each; expected role restored |
| Student | GET `/api/student/dashboard` | 200; total experiments 7, attempted/completed/average/best all 0 |
| Student | GET `/api/student/history` | 200; empty attempts |
| Student | GET `/api/experiments` | 200; 7 published records with integer task counts |
| Student | GET `/api/experiments/:id` | 200; first returned experiment has 4 tasks, 3 quiz questions, no exposed correctOption fields |
| Student | GET `/api/student/enrollment` | 200; enrollment null |
| Faculty | GET `/api/faculty/dashboard`, `/api/teacher/dashboard` | 200 each; all four metrics 0 |
| Faculty | GET `/api/teacher/students`, `/api/faculty/students` | 200 each; empty students, pagination page 1/limit 25/total 0 |
| Admin | GET `/api/admin/dashboard` | 200; users 3, active students 1, attempts 0, audit events 0 |
| Admin | GET `/api/admin/teachers/:teacherId/students` with seeded faculty ID | 200; empty students, page 1/limit 25/total 0 |
| Anonymous | GET `/api/auth/me`, `/api/student/dashboard`, `/api/teacher/students`, `/api/admin/dashboard` | 401 each |
| Student | GET `/api/admin/dashboard`, `/api/faculty/dashboard`, `/api/teacher/students` | 403 each |
| Faculty | GET `/api/admin/dashboard`, `/api/student/dashboard` | 403 each |
| Admin | GET `/api/teacher/students`, `/api/student/enrollment` | 403 each |
| Faculty, admin | GET `/api/reports/:id/download` with nonexistent test ID | 403 each; rejected before resource lookup |
| Incorrect student password | POST `/api/auth/login` | 401 |
| Student, faculty, admin | POST `/api/auth/logout` | 204 each; session cookie cleared |
| Student, faculty, admin | GET `/api/auth/me` after discarding cleared cookie | 401 each |

401 without a session: `Authentication required.`
401 incorrect password: `Invalid email or password.`
403: `You do not have permission to perform this action.`

Session cookies had HttpOnly and SameSite=Lax. Credentialed CORS responses allowed
exactly `http://localhost:5173`. Logout checks establish cookie clearing, not
server-side revocation of copied JWTs. Main smoke checks reported zero unexpected
HTTP statuses; existing session semantics were retained.

## Automated verification and remaining limitations

- Server: 262 tests passed in 33 files; build passed.
- Client: 147 tests passed in 14 files; build and lint passed.
- Server lint: the same 3 existing unused-symbol findings (`NMAP_LAB_DEFINITION`,
  `DOS_LAB_DEFINITION`, and error-handler `_next`); no new failures.
- Client bundle advisory remains: 768.84 kB JavaScript / 218.14 kB gzip.
- Install audits reported 16 server and 13 client vulnerabilities. No automatic
  dependency upgrades or audit fixes were applied.

Browser inventory was empty and an attempted in-app browser open returned
`Browser is not available: iab`. HTML/module availability is verified, but rendered
pages, browser console/network checks, browser role redirects and browser cookie
persistence are NOT verified. Existing route/login unit tests passed; these are
not substitutes for real browser acceptance.

Google OAuth remains disabled. No Docker/Kali practical, scan, lab cleanup,
live grading or PDF generation was attempted. No enrollment mutations/UI work
were started. No setup blocker remains for the running Mongo/API/Vite stack;
browser acceptance and practical-runtime validation remain separate work.
