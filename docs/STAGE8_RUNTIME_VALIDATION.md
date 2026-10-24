# Stage 8: real lab, terminal and authentication validation

Validated locally on 24 October 2026 (Asia/Calcutta).
Branch: `integration/local-takeover`. Starting commit:
`4c9722b32ac5f3919d82a129fc4449dd153f0a08` (clean worktree).
Runtime corrections: `bcd8cef507bb0b7c927b1d04b933696a4e384f8b`.
This report is delivered by the subsequent local documentation commit.
No fetch, push, PR action, deployment, branch replacement, Docker prune, volume
removal, security-limit change or external scan was performed.

## Acceptance summary

| Area | Result | Actual evidence / boundary |
| --- | --- | --- |
| Docker Nmap provisioning | PASS | Real API 201; two running containers on a dedicated internal network |
| Nmap execution and assessment | PASS | Four actual browser-terminal scans against `nmap-target`, four verification 200s, quiz 200, 75/75 points |
| PDF generation/download | PASS | Newly generated report; authenticated download 200, application/pdf and `%PDF` signature |
| Browser terminal | PASS | Actual xterm/Socket.IO input/output, refresh restoration, offline/online reconnection, PTY resizing and stop rejection |
| Stop / completion cleanup | PASS | Completion and explicit browser stop removed their containers/networks; repeated stop 204 |
| Provisioning failure/recovery | PASS | Missing allowlisted DoS image caused real 500 and persisted failed session; no orphan resources; subsequent Nmap start 201 |
| Natural TTL expiry | NOT TESTED | Existing 45-minute TTL was not waited out; no timestamps/configuration were altered to simulate expiry |
| Terminal behavior after expiry | NOT TESTED | Automated expired-session checks passed; no fresh live expired terminal is claimed |
| Real Kali VM | BLOCKED | `vm:check` exits 1: configured default prepared qcow2 image is absent |
| Google browser login/linking | BLOCKED | All three local Google OAuth settings absent; no provider login or linking attempted |
| Unconfigured Google fallback | PASS | Real 303 to login error, no-store, no transaction cookie; useful rendered password-login guidance |
| Ownership / role / origin checks | PASS | Actual authenticated student/faculty sessions and Socket.IO denials described below |
| Full server lint | FAIL (existing baseline) | Exactly three unchanged pre-existing unused-variable findings |

Stage 8 is **partially accepted**: Docker/Nmap and terminal checks passed after
corrections; live expiry, VM and configured Google OAuth remain outstanding.
Mocked tests are not counted as real VM, Google or expiry validation.

## Runtime and image verification

Read README.md, docs/TEAM_HANDOFF.md, infrastructure/vm/README.md,
docs/google-auth.md, Dockerfiles, lab engine and terminal socket source,
Nmap task/quiz definitions, and task/quiz/lab controllers.

Docker Engine reports `29.7.2`. Existing images were verified and exercised;
no rebuild or download was necessary for Nmap:

| Image | Verified image ID |
| --- | --- |
| cyberlabx-kali:latest | `af101b9edf8b90c3bf1389d3eba966fd2883ca828317d008112d972c761c74d9` |
| cyberlabx-target:latest | `88918aa56e59fab941400a4b72286b32c979fab776a8e2fc10a1173d0a1774e1` |

The real student shell identified Kali Rolling 2026.3 and Nmap 7.99. This is
Kali **inside Docker**, not a successful QEMU/Kali VM boot.
Network inspection confirmed `Internal: true`; neither container published
ports or ran privileged. Captured inspection records include memory limits,
capabilities and `no-new-privileges`. Only the assigned internal hostname was
scanned. No external reachability probe was used to test isolation.

Successful complete attempt: `6adcec81b977087c523931bb`.
Session: `6adcec81b977087c523931bd`.
Student container:
`1caae3cb548d771ee5ddb33ff398b86b63f32c0db89170f4174256ee6a3ca610`.
Target container:
`ec1b9604ee3559d1c36b390bc0110b21228697a11563f29f16f868d9b6eb6ebc`.
Network: `cyberlabx-lab-6adcec81b977087c523931bb`.
All three runtime resources were removed by application cleanup.

| Browser-entered command | Verification | Marks |
| --- | --- | --- |
| `nmap -sn nmap-target` | 200, passed; live host output | 10 |
| `nmap -sS -p 80 nmap-target` | 200, passed; port 80 open/http | 15 |
| `nmap -O -p 80,81 nmap-target` | 200, passed; completed OS-detection run | 15 |
| `nmap -sV -p 80 nmap-target` | 200, passed; completed service scan | 20 |

OS fingerprint accuracy on a container is not asserted. Quiz: 15/15; total
75/75. Report: `6adcecadd794932ab5c5c842`, generated through the real completion
controller and fetched through its authenticated download route. No task
results, command evidence, scores or report records were inserted directly.

## Terminal findings and corrections

1. The original percentage/minimum-height terminal plus ResizeObserver fitting
   repeatedly increased the live workspace height. Playwright could not click
   the moving second verification button. Replaced that sizing with bounded
   360px/mobile and 430px/tablet-desktop heights. All four tasks then worked.
2. Docker exec did not expose resize, while the socket resize handler was
   VM-only. Forward Docker exec resize and await it, checking current student
   ownership, running status, expiry and socket membership; VM authorization
   remains required for VM sessions. Dimensions retain existing clamps.
3. Explicit stop reproduced an xterm 5.5 queued viewport callback accessing
   disposed renderer dimensions. Disconnect input/socket/observers immediately,
   drain queued terminal writes and the animation frame, then dispose xterm.
   Repeat live stop produced zero page errors. No dependencies were changed.

Actual 900px-high rendered viewports and shell `stty size` (rows, columns):

| Width | Terminal height | Real PTY size |
| --- | --- | --- |
| 320 | 360px, stable | 20, 30 |
| 375 | 360px, stable | 20, 36 |
| 768 | 430px, stable | 23, 81 |
| 1280 | 430px, stable | 23, 101 |

Document width fit each viewport. Browser refresh rejoined the existing
session and restored buffered terminal output. Temporary Playwright context
offline/online recovered the real Socket.IO connection and accepted another
shell command. Explicit browser End Lab Session confirmation yielded stopped
state and removed xterm input. Rejoining that stopped session was denied.

## Failure recovery and security

The allowlisted but locally absent `cyberlabx-dos-attacker:latest` image caused
a real provisioning failure: HTTP 500 with the generic public error. Session
`6adcecd8b977087c523932aa` and attempt `6adcecd8b977087c523932a8`
persisted failed; local session diagnostics recorded the Docker missing-image
404. Its provisional network was removed. Next Nmap start returned 201.
This validates recovery from an early provisioning failure, not a mid-scan
Docker daemon crash or every possible partial provisioning failure.

On active session `6adcecd9b977087c523932b5`:

- Owner's socket joined successfully.
- Anonymous and faculty socket handshakes: Unauthorized.
- Origin `http://127.0.0.1:5173` with valid owner cookie: Unauthorized origin
  (configured frontend origin is `http://localhost:5173`).
- Another authenticated student's join: terminal unavailable.
- Other student's GET lab, POST stop, GET attempt: all 404.
- Faculty GET lab: 403.
- Owner stop from the rendered UI worked; stopped join was unavailable;
  repeated authorized stop returned 204.

Session cookie evidence stores flags only: HttpOnly, SameSite=Lax, path `/`,
non-Secure for this HTTP development environment. Source retains Secure in
production and current database role/active checks. No cookies, passwords,
JWTs or provider secrets appear in evidence/reports. Normal password login
and `/auth/me` returned 200; logout 204 followed by `/auth/me` 401.
The existing 10-request/15-minute authentication limit was not changed or
deliberately exhausted. Source-watch restart while applying the backend fix
reset process-local counters; it was not used as a throttling bypass.

Isolation is enforced by Docker topology and server-controlled image/config
allowlists. The educational Docker command grader checks the existing task
rules; this stage does not claim adversarially tamper-proof assessment or
comprehensive shell egress/security auditing.

## Kali VM blocker

`npm --prefix server run vm:check` was executed twice, both exit 1. Final
preflight: 12,750 MiB available versus required 6,144 MiB. It stopped at:

`ENOENT ... infrastructure\vm\kali\base\kali.qcow2`.

No `VM_BASE_IMAGE` override is configured. `Get-Command qemu-system-x86_64,
qemu-img` found neither on the current PATH; standard `C:\Program Files\qemu`
also supplied no matching executable. Earlier documentation's other-worktree
image/QEMU observations are historical; current Git worktree inventory shows
only this checkout. No broad disk search/download or machine configuration
change was performed.

`vm:smoke` was **not run**, because preflight failed. VM boot, SSH, guest
controlled Nmap, stop and cleanup are NOT TESTED. No VM was created, so
preflight's `cleanupPassed:false` does not mean a leaked VM. Supply an approved
prepared qcow2 plus matching manifest, configure documented image/binary paths,
confirm Windows QEMU/WHPX prerequisites and sufficient disk/RAM, rerun check,
then smoke. Preserve the 6,144 MiB readiness requirement and isolation policy.

## Google OAuth blocker

All three backend settings are absent: `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`. Live Google sign-in and explicit
account linking were not attempted. Anonymous initiation actually returned
303 to `http://localhost:5173/login?oauth_error=not_configured`,
`Cache-Control: no-store`, and no transaction cookie. Chrome rendered
“Google sign-in is not configured yet. Use your account password.”

Required setup: Google Cloud OAuth Web application client and consent screen,
approved test accounts if consent is in testing mode; securely set the three
backend-only variables in uncommitted local configuration. Register exactly
`http://localhost:5000/api/auth/google/callback` as authorized redirect URI;
retain `CLIENT_URL=http://localhost:5173`. Never expose a client secret through
Vite. Then test provider login, refreshed `/auth/me`, explicit matching-email
linking while authenticated, conflicting identity rejection and logout.
Existing state/nonce/PKCE, issuer/audience checks, unique Google subject and
explicit linking rules were inspected and retained. Their automated tests
passing is not a live provider test.

## Commands and regression results

Executed read-only Git status/HEAD/worktree/diff commands; `docker version`,
`docker ps -a`, `docker images`, `docker image inspect`, `docker network ls`;
Dockerode inspect/list operations; Playwright Chrome harnesses using existing
temporary playwright-core (no installation); authenticated app requests;
read-only Mongoose snapshots in `cyberlabx_local_takeover` only.

| Command | Actual fresh result |
| --- | --- |
| `npm --prefix server test` | PASS, 36 files / 345 tests |
| `npm --prefix client test` | PASS, 20 files / 238 tests (rerun after disposal fix) |
| `npm --prefix server run build` | PASS |
| `npm --prefix client run build` | PASS, rerun after final fix; existing ~827kB chunk warning |
| `npm --prefix server run lint` | FAIL, same three baseline findings below |
| `npm --prefix client run lint` | PASS, rerun after final fix |
| Targeted ESLint on three changed backend files | PASS |
| `npm --prefix server run vm:check` | BLOCKED, exit 1, missing image |

Existing backend lint: `allExperiments.test.ts:9` unused NMAP_LAB_DEFINITION;
line 10 unused DOS_LAB_DEFINITION; `middleware/error.ts:3` unused `_next`.
No newly introduced lint failures. Tests extend Docker socket resize coverage
for dimension clamping and loss of ownership, and cover bounded terminal layout
and draining/disposal order. VM/provider/auth/ownership suites remain green.

## Evidence, data preservation and remaining acceptance work

Local ignored evidence directory: `.env.stage8-evidence/`:

- `results.json`: successful full Nmap run, terminal output, safe inspection,
  rate/cookie flags, requests/statuses and preservation checks.
- `pre-fix-results.json`: retained failed unstable-button browser run.
- `security.json`: real authorization, failure/recovery and stop checks. Its
  final harness error is a JSON parse of the followed Google redirect HTML,
  not a failed security check. Follow-up recorded the actual 303 correctly.
- `pre-disposal-fix.json`: real xterm renderer error and stack.
- `followup.json`: corrected Google evidence, stop/logoff, zero page errors.
  Its one console 401 is expected unauthenticated session bootstrap.
- `terminal-{320,375,768,1280}.png`, four `verified-*.png`, `completed.png`,
  `manual-stop.png`, `google-unconfigured.png` (11 screenshots).
- `final-state.json`: non-sensitive session/container IDs and database counts.
- `infrastructure/vm/validation-preflight.json`: ignored actual VM preflight.

Harnesses are local ignored `server/.env.stage8-{browser,security,followup}.mjs`.
An initial harness terminated on a response timeout before its finally block;
that known test session was subsequently stopped through the authorized API
(204). No broad cleanup was used. All subsequent runs include scoped cleanup.

Existing document snapshots were unchanged across completed runs. Original
student remains active/unassigned; original completed attempt/report remain
75 points, and original PDF SHA-256 is unchanged:
`c19669e84c35e33a4b73c443e21ed36c027d4e0b9cb677388622ba8f278e8fa9`.
All five original accounts and original catalogue/audits remain. Final counts:
5 users, 8 experiments, 2 audits, 8 attempts, 8 lab sessions, 25 command logs,
2 reports. Seven new attempts/sessions, 21 command logs and one new real report
are intentional validation history; no academic records were deleted.
Final active/provisioning/stopping sessions: **0**. Final managed Docker
containers/networks: **0**. Pre-existing MongoDB, stopped containers and networks
were preserved. Manual stop currently retains a running-status attempt even
though its lab is stopped; this existing lifecycle behavior was not rewritten.

Outstanding: wait out a real 45-minute expiry, confirm live reaper cleanup and
terminal denial; configure/validate Kali prerequisites; configure/validate real
Google login/linking. DoS/other experiment runtime images and complete runtime
flows are not validated here. No Stage 9, teacher/admin feature development,
remote modification or deployment was started.
