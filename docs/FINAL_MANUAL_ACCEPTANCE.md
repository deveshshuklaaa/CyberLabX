# CyberLabX manual acceptance and demonstration

Stage 9 local package, 24 October 2026. Run from VS Code on Windows with Chrome.
No push/deployment is required. Record PASS / FAIL / BLOCKED / NOT TESTED and
screenshots for your own run; earlier automated evidence is not your sign-off.
See [readiness and blockers](FINAL_PROJECT_READINESS.md).

## 1. Start the existing local environment

Open `C:\Users\Arvind Shekhawat\Desktop\CyberLab\CyberLabX` in VS Code.
Use separate PowerShell terminals, all starting at that repository root:

```powershell
git branch --show-current
git status --short
docker version
docker ps -a --format '{{.Names}} {{.Status}}'
```

Expected branch `integration/local-takeover`. Preserve unexpected changes;
never reset/clean/reseed to fix them. Docker Desktop must be running. The
existing isolated database container is `cyberlabx-local-takeover-mongodb`.
If it already runs, leave it running. If it exists but is stopped:

```powershell
docker start cyberlabx-local-takeover-mongodb
```

If that container is absent, stop and check your environment before creating a
database. The existing ignored `.env.local-runtime.compose.yaml` overrides the
base Compose container, volume and network names and binds Mongo to loopback.
Only after confirming these files and the intended existing volume:

```powershell
docker compose -p cyberlabx-local-takeover -f docker-compose.yml -f .env.local-runtime.compose.yaml up -d mongodb
docker inspect cyberlabx-local-takeover-mongodb --format '{{.State.Health.Status}}'
```

Do not print `docker compose config` or full inspect/env output containing
credentials. Do not run `down -v`, prune, database deletion or a seed/reset.
Confirm local `.env` targets **cyberlabx_local_takeover**, not a shared database;
inspect it privately in VS Code, never paste it into screenshots or chat.
The isolated override is machine-local/ignored; a fresh checkout needs its
equivalent reviewed setup rather than blindly using the base Compose defaults.

Dependencies are already installed. Start only if ports are not already served:

```powershell
# Terminal 1
npm --prefix server run dev
# Terminal 2
npm --prefix client run dev
# Terminal 3
Invoke-RestMethod http://localhost:5000/health
```

Expected health `{status:ok}`; this is process liveness, not proof of Mongo or
Docker readiness. Open **http://localhost:5173** in Chrome. Use localhost
consistently; mixing 127.0.0.1 changes the allowed browser/socket origin.
If Vite offers 5174 because 5173 is occupied, use the intended existing 5173
instance or resolve the conflict; do not silently change the configured origin.

## 2. Accounts and test hygiene

Public Student registration is now available at **http://localhost:5173/register**.
From `/login`, choose **Create Account**, enter first/last name, an email address,
and a 12–128 character password twice. The successful MongoDB write creates an
active `student`, starts the existing HttpOnly-cookie session, and opens
`/student` with a success notice. Refresh once, sign out, and sign in again with
the same email/password. Password registration does not verify control of the
email address because the project has no email-delivery/verification service.
It never offers Faculty/Admin role selection.

The **Continue with Google** button starts the real backend OAuth flow. When the
three Google settings are absent it returns to `/login?oauth_error=not_configured`
with a useful message. Complete [the local Google setup guide](GOOGLE_OAUTH_LOCAL_SETUP.md)
before expecting a Google account-selection page. Do not treat the current
unconfigured response or mocked tests as provider acceptance.

Retrieve these existing development accounts from local `.env` privately:

| Account | Environment key prefix | Purpose |
| --- | --- | --- |
| Dedicated student | CHECKPOINT3_STUDENT | Existing nonzero attempts/reports |
| Other student | SEED_STUDENT | Ownership denial checks |
| Faculty A | SEED_FACULTY | Enrollment and academic monitoring |
| Faculty B | CHECKPOINT3_FACULTY_B | Foreign cohort denial |
| Admin | SEED_ADMIN | Directory/audit/cohort administration |

Each prefix has `_EMAIL` and `_PASSWORD`. No passwords are published here.
Use separate Chrome profiles/incognito contexts for simultaneous roles, or log
out between roles. Tabs in one browser profile share cookies. Avoid rapid
repeated login: the shared auth limiter allows **10 requests / 15 minutes**;
successful logins and OAuth initiation also count. On 429 wait the advertised
Retry-After/window; never restart to evade it. DevTools may expose request
bodies/cookies: redact screenshots and never export an unredacted HAR.

Keep a note of student/teacher/session IDs you intentionally use. Preserve all
accounts, attempts, reports and identity fields. Enrollment cleanup removes
only the relationship, not the student or academic records.

## 3. Student journey

1. Open `/login`; Tab through labeled email/password fields. Sign in as the
   dedicated student. Expect `/student`, a personalized welcome and real totals.
   For a fresh account, first choose **Create Account**, confirm inline validation
   and the password visibility control, then expect immediate Student access.
2. Refresh. Expect the session to persist via `/api/auth/me`, without entering
   another password. Student access to `/admin` or `/teacher` must redirect to
   the authorized landing page; direct privileged API access must return 403.
3. Choose Browse experiments (`/experiments`). Search Nmap and select the actual
   Network Security category. Expect the intersection of real results; a nonsense
   search gives an honest empty state; Clear filters restores the catalogue.
4. Open Network Mapping using Nmap (`/experiments/:id`). Inspect aim, objectives,
   theory, procedure, tasks, duration and safety. Start is a real provisioning
   action; follow the practical checklist below before clicking it.
5. Visit `/progress`. Curriculum completion is completed distinct published
   experiments / published catalogue, not number of attempts. Summary scores are
   **points**, not invented percentages or assumed /100 totals.
6. Visit `/history`. Inspect actual dates/statuses, filters and completed score
   denominators. Reports are offered only when available. Download a genuine PDF
   and open it; verify your identity/experiment/result, not another student's.
7. Visit `/profile`. Expect authenticated account information and own teacher
   enrollment state. No account editing/password-reset API is promised.
8. Open DevTools Network; temporarily block `/api/student/history`, reload that
   page and expect error/retry rather than invented rows. Unblock and retry.
   For loading, use temporary network throttling; restore normal settings after.
9. Sign out. Expect `/login`; refresh and use Back: protected data must not return
   as an authenticated session. `/api/auth/me` should be 401. Logging in as a
   different role must not show the previous user's React Query data.

## 4. Real Docker/Nmap practical

Check existing images (no image downloads/builds required for the verified setup):

```powershell
docker image inspect cyberlabx-kali:latest --format '{{.Id}}'
docker image inspect cyberlabx-target:latest --format '{{.Id}}'
```

If missing, use the README's two Nmap image build commands deliberately; do not
substitute an arbitrary image or change lab allowlists. Other experiment images
are not all installed; do not claim their Start buttons establish demo readiness.

1. As student, open Nmap and Start Lab. Expect POST `/api/labs/start` 201,
   active Docker state and terminal Connected. A 409 may identify an existing
   active session; restore/stop your own session instead of deleting DB records.
2. Type `cat /etc/os-release`, `nmap --version` and `ip addr` in the actual browser
   terminal. Expect real Kali/Nmap output. Docker Kali is **not** a QEMU VM boot.
3. Run the following **only against the assigned CyberLabX target**. Wait for
   `Nmap done` before entering the exact command in Command Submission and
   clicking Verify Task, in this order:

   ```text
   nmap -sn nmap-target
   nmap -sS -p 80 nmap-target
   nmap -O -p 80,81 nmap-target
   nmap -sV -p 80 nmap-target
   ```

   Expect four actual verification responses, saved progression and 60 task
   points total. OS fingerprint certainty is not guaranteed inside Docker.
   Never scan an external IP/domain, the host network or other containers.
4. Refresh mid-session. Expect restoration of the same session/progress and
   terminal output, not a new lab. Briefly use DevTools Network Offline, then
   restore Online; expect reconnection and another command to work. Restore
   normal networking before grading.
5. At 320/375/768/1280 widths run `stty size`. Expect terminal dimensions to
   change without endlessly growing the page or blocking verification controls.
6. Answer the three quiz questions and Submit Practical & Generate Report.
   Expect actual results, grading feedback and a genuine PDF link. Download/open
   it. Completion closes the terminal and removes runtime containers/network.
7. For explicit stop testing, start another lab deliberately. End Lab Session,
   confirm, expect stopped state, no terminal input, and repeated stop safe.
   Exiting to catalogue alone does **not** stop a lab. Current manual stop may
   leave attempt status running while its lab is stopped; record this limitation.
8. To finish the **pending natural-expiry check**, use another allowed start,
   note returned expiresAt and leave it running for the real 45 minutes. Do not
   change clocks/DB timestamps or shorten the security configuration. After
   expiry plus the 15-second reaper interval, expect expired state, denied
   terminal input and removed resources. Refresh to confirm persisted status.
   Respect the separate five-starts/15-minute provisioning limit.

Inspect cleanup without touching unrelated Docker resources:

```powershell
docker ps -a --filter label=com.cyberlabx.managed=true --format '{{.ID}} {{.Names}} {{.Status}}'
docker network ls --filter label=com.cyberlabx.managed=true --format '{{.ID}} {{.Name}}'
```

Expected no resources for your stopped/completed/expired attempt. Other users'
legitimate active labs are not orphans. Use authorized End Lab/API cleanup;
never broad prune or volume removal. Preserve educational records/PDFs.

## 5. Teacher journey and nonzero isolation

1. Sign in as Faculty A; `/teacher` and `/faculty` both work. Expect metrics and
   descriptions scoped to the enrolled cohort, not all platform students.
2. With no assignments expect genuine empty student/cohort states. Enroll the
   dedicated existing student using **exactly one** email or student ID.
   Expect 201, refreshed student list/dashboard/cohort analytics. There is no
   fuzzy directory/invitation feature. Existing assignment conflicts return 409.
3. Open student detail. Inspect real attempt states, completion/average/best
   points, filters/pagination and experiment performance. Average/best scores
   use completed scored attempts; running/failed/expired attempts do not become
   zero-scored completions. No historical task-total denominator is invented.
4. Open Student reports. Download a real PDF through the teacher-authorized
   route. Expect own enrolled student's metadata/PDF only.
5. In a separate Faculty B session, the student must not appear. A copied
   Faculty A student/detail/attempt/report URL must not expose records; expect
   404 from foreign-scoped endpoints. Faculty B analytics remain their own cohort.
6. Return to A, Remove enrollment, read confirmation and confirm. Expect 204,
   refreshed empty list and A's loss of academic/PDF access. Student account,
   attempts, PDF files and identity remain. Check student Profile now unassigned.
7. Optional authorized transfer test: B may enroll only after removal; remove
   that test relationship through B afterward. Never overwrite ownership.
8. Test temporary request blocking for student list/history, retry and real
   no-match filters. Restore network rules. Keep account writes out of this flow.

## 6. Admin journey

1. Sign in as Admin to `/admin`. Compare real overview counts with stored data;
   Stage 8 added intentional history, so old screenshots' attempt totals differ.
2. In User management search a real name, exact email, role and active status.
   Use a nonexistent literal query for empty results. Reset; inspect a selected
   existing user, role/status/assignment/timestamps. Do not invent user rows.
3. List teachers; select a real faculty account. Expect explicit teacher cohort
   controls, not a faculty-only API called with an admin session.
4. If testing enrollment here, use the unassigned dedicated student; enroll with
   the selected teacher, inspect detail, cancel removal once, then confirm
   Release teacher assignment. Expect records retained and final unassigned state.
5. Search full Audit events by actual exact action, actor/resource/date filters.
   Use a nonexistent action for empty results. Reset; exercise pagination when
   enough events exist. The latest-20 sample is **not** the complete audit log.
   Enrollment routes currently do not invent new audit events.
6. Account creation and role/status updates are **BLOCKED** intentionally.
   Confirm the unavailable explanation and disabled submission. A proposed
   change may be reviewed/canceled, but Apply remains unavailable. Do not enable
   it or change Mongo topology. Self-demotion/deactivation must remain protected.
7. Experiment catalogue overview is read-only. Authoring is optional/unapproved;
   no fake publish/edit/delete success should appear. Admin must not access
   teacher-only academic/report APIs by impersonating the teacher role.
8. Sign out and confirm protected routes no longer restore admin data.

## 7. Responsiveness, accessibility and console

In Chrome DevTools device toolbar set widths **320, 375, 768, 1280** (900px
height is the automated reference). Repeat key pages and expanded detail/forms:

- No document-wide horizontal scroll; tables may have labeled local scrolling.
- Mobile navigation opens/closes; Escape returns focus to its toggle.
- Tab/Shift+Tab reach visible links, fields, filters and controls; Enter/Space
  activate them. Focus is visible and is not hidden behind menus.
- Labels identify every field; validation is readable; errors have retry.
- Dialog opens with contained focus; Escape cancels; disabled actions explain why.
- Long IDs/emails, scores, report controls and cards fit. Browser zoom 200% and
  text enlargement remain a **manual check**, not an automated WCAG guarantee.
- Loading/empty/error states do not expose stale unauthorized data.
- Clear Console before each journey; capture unexpected exceptions with URL,
  role/action and time. Expected bootstrap 401/intentional blocked-request errors
  differ from application exceptions. Never capture cookies or password bodies.

Actual NVDA/JAWS/VoiceOver testing, full contrast audit, touch hardware and
complete WCAG conformance remain unverified. Perform assistive-technology checks
before claiming accessibility acceptance.

## 8. Common local errors and blocked features

| Symptom | Expected response / next action |
| --- | --- |
| Login 429 | Wait Retry-After; stop repeated automation; do not weaken limits |
| API unavailable / EADDRINUSE | Confirm the existing API, URI and port privately; avoid duplicate processes |
| Blank/error protected page | Check health/network, then retry; do not fabricate successful data |
| Terminal origin error | Use configured localhost:5173 consistently; check socket URL |
| Docker image/provisioning error | Verify Docker Desktop and approved image; preserve failed history; retry after fixing prerequisite |
| Lost/stopped terminal | Refresh session state; stopped/expired terminals intentionally reject input |
| Missing/unavailable PDF | Verify actual completion/report availability; do not invent a URL or overwrite report records |
| Admin writes unavailable | Expected atomicity gate; see approved-plan requirement below |
| Google not configured | Password login works; provider login/linking requires secure credentials/exact callback |
| VM preflight ENOENT | Prepared image missing; no smoke until check passes; no large download without approval |

Use [admin enablement plan](ADMIN_MUTATION_ENABLEMENT_PLAN.md) for the blocked
writer. Google setup is in [google-auth.md](google-auth.md); VM prerequisites in
[VM README](../infrastructure/vm/README.md). Preserve 6,144 MiB readiness and
Windows QEMU/WHPX restrictions. Do not treat either as live-validated.

Finish by stopping only your active labs, removing only test enrollments,
logging out, restoring DevTools networking and recording remaining failures.
Do not delete history, stop Mongo unnecessarily, push, deploy or begin another
development stage as part of this acceptance run.
