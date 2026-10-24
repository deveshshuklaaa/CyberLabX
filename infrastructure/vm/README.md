# CyberLabX real Kali Nmap integration — review report

Reviewed on 24 October 2026 (Asia/Calcutta). Integration branch:
`codex/real-kali-nmap-integration`, based on `d58fc2b`.

**Code and protocol tests pass. Real Kali execution is still unvalidated.**
The live smoke command was attempted, but the existing resource guard refused
startup: 3,351 MiB free versus 4,096 MiB guest RAM plus 2,048 MiB host reserve.
No Kali VM, Kali command, target connection, or VM cleanup was live-validated.

## 1. Repository state and what already existed

The initial checkout was clean on `feature/cybersecurity-experiment-suite` at
`d58fc2bec198249dcf2be371fa20c98c28a8ad3d`. After fetching origin, remote refs
still matched the local branches:

| Branch | Commit | Relationship |
| --- | --- | --- |
| `main` | `b794dd1d06f3972978c1a6b713afcfe065d1263f` | Stable Docker Nmap/DoS foundation |
| `feature/student-portal-multipage` | `a1bfee887e9d65a98a8da6065436a1652aad9390` | Existing portal work |
| `feature/cybersecurity-experiment-suite` | `d58fc2bec198249dcf2be371fa20c98c28a8ad3d` | Existing expanded experiments; current integration base |
| `feature/real-kali-vm` | `cf4f464db28e2e466ff179ada2dc5ff09060926d` | Five VM commits directly after `d58fc2b` |

The Kali branch also has a separate local worktree. That worktree has
uncommitted changes to guest preparation, SSH error handling, resource settings,
routes, seeding and UI/start scripts. They were inspected and left intact.
The committed implementation was used as the reusable source; the local SSH
transport-error fix was independently applied here. Lower memory limits from
the dirty worktree were not copied.

| Area | Existing implementation on the Kali branch | Current integration |
| --- | --- | --- |
| Lifecycle | Per-attempt UUID, owner, overlay, credentials, ports, metadata and capacity queue | Reused; entry and completion expiry checked |
| Startup | `qemu-img` overlay, QEMU spawn, authenticated SSH, `ID=kali` and ready marker | Reused; Nmap target port 80 must also respond before ready |
| Shutdown | QMP UUID check, ACPI shutdown, QMP quit, identity-checked process termination, bounded waits | Reused; no process kill by stale PID alone |
| QEMU/WHPX | Windows-only `q35`/WHPX, CPU/RAM limits, loopback QMP/SSH/VNC | Reused; actual WHPX boot remains untested |
| Commands | `ssh2` exec and bash PTY; generated SSH identity and pinned guest host key | Reused; transport errors cannot become unhandled API errors |
| Browser terminal | Socket.IO to SSH PTY, resize, reconnect output, command logging | Reused; existing Docker terminal retained and protocol-tested |
| Desktop | Authenticated noVNC/WebSocket-to-VNC proxy and lazy UI | Inspected, excluded from this terminal-only integration |
| Sessions | VM attempt reference, status, TTL, owner/attempt checks | Persist VM reference before provisioning; use the database session's expiry |
| Targets | Existing target Dockerfiles built into the Kali image; internal guest network | Nmap only: `nmap-target`, `172.28.0.10:80`; no host Docker dependency for VM execution |
| Recovery | Private runtime ACL/lock, startup orphan sweep, stopped-VM reaper | Reused; retain retryable state after failed shutdown, including quiz/TTL cleanup |
| Authorization | Existing cookie/JWT authentication, student role, session ownership, VM owner and active attempt checks | Retained; terminal also checks origin and expiry; no authentication feature added |
| Assessment | Existing task verification, quizzes, report generation | Retained; recognize sudo and require completed server-captured VM Nmap output plus live target check |

The original Kali branch defaulted **every experiment** to QEMU and projected
different curricula over existing experiments. Those global migrations and
frontend desktop changes were not imported. Main's Docker container creation,
capabilities, image allowlist, internal networks and Dockerfiles remain intact.

## 2. What changed

- `LAB_BACKEND=docker` remains the default. `LAB_BACKEND=qemu` opts in only the
  existing approved Nmap lab. Other experiments continue using Docker.
- Added a small dispatch boundary in the existing LabEngine. No new service,
  provider class hierarchy, queue service or deployment infrastructure is needed.
- Readiness checks the selected provider. `assertDockerReady` retains its original
  meaning and is never repurposed into a QEMU check.
- Persisted provider/VM identity before spawn and aligned guest/session expiry.
  Inspection and cleanup dispatch by persisted VM reference even if the default
  is subsequently switched back to Docker.
- Reused the branch's SSH terminal and VM manager, with the focused startup,
  transport-error and cleanup fixes described above.
- The browser terminal receives the actual session provider after attachment,
  displays a Kali VM banner and sudo guidance, and forwards terminal size.
- Privileged Nmap commands use the existing guest's passwordless sudo. Task
  verification rejects failed/incomplete output and unrelated targets. It does
  not substitute a server-run scan for the student's captured evidence.
- Added infrastructure-only preflight/live smoke commands and focused tests.

There is no silent conversion of a failed VM launch into a Docker launch.
To use the fallback, stop the backend, set `LAB_BACKEND=docker`, restart it,
and start a new lab. Persisted VM references still receive VM cleanup.

## 3. Architecture after the change

```text
Existing authenticated student + Nmap Start Lab
  -> existing lab controller / Attempt / LabSession
  -> LabEngine
       -> Docker path (default; all other experiments)
       -> Kali VM path (Nmap only, when LAB_BACKEND=qemu)
            -> Windows QEMU/WHPX + disposable qcow2 overlay
            -> Kali Linux student account + sudo + real Nmap
            -> controlled HTTP target container INSIDE Kali
               internal 172.28.0.0/24 network, target 172.28.0.10

Browser xterm -> authenticated Socket.IO -> Node ssh2 -> Kali bash PTY
Server-captured evidence -> existing grading / quiz / report flow
Stop / completion / TTL / crash / restart -> provider-specific cleanup
```

QEMU management ports bind to loopback. Default `restrict=on` user networking
blocks external networking; no TAP setup is needed for this experiment. The
inherited optional bridged/Internet configuration exists but is outside this
acceptance path. No host Docker socket, host directory or physical device is
passed into the guest. The guest's administrative user can modify its own
disposable environment; terminal evidence is educational verification, not a
tamper-proof assessment system for a hostile guest administrator.

## 4. Files changed

Modified existing integration files:

```text
.env.example
.gitignore
client/src/components/terminal/Terminal.tsx
client/src/types/api.ts
client/src/__tests__/Terminal.test.tsx
server/package.json
server/package-lock.json
server/src/config/env.ts
server/src/models/LabSession.ts
server/src/controllers/labController.ts
server/src/controllers/taskController.ts
server/src/controllers/quizController.ts
server/src/services/labEngine.ts
server/src/services/gradingEngine.ts
server/src/sockets/terminalSocket.ts
server/src/server.ts
server/src/__tests__/labControllerMetadata.test.ts
server/src/__tests__/taskVerification.test.ts
server/src/__tests__/labCompletion.test.ts
```

Added files (mostly reused from `feature/real-kali-vm`):

```text
.gitattributes
infrastructure/vm/README.md
infrastructure/vm/audit-host.ps1
infrastructure/vm/install-qemu.ps1
infrastructure/vm/prepare-base.sh
infrastructure/vm/guest/prepare.sh
infrastructure/vm/guest/first-boot.sh
infrastructure/vm/guest/identity.py
server/vitest.config.ts
server/src/services/vm/config.ts
server/src/services/vm/manager.ts
server/src/services/vm/ports.ts
server/src/services/vm/qmp.ts
server/src/services/vm/ssh.ts
server/src/services/vm/access.ts
server/src/services/vm/lock.ts
server/src/services/vm/reaper.ts
server/src/services/vm/verification.ts
server/src/scripts/validateKaliVm.ts
server/src/__tests__/labProviders.test.ts
server/src/__tests__/vmConfig.test.ts
server/src/__tests__/vmLifecycle.test.ts
server/src/__tests__/vmQmp.test.ts
server/src/__tests__/vmSsh.test.ts
server/src/__tests__/vmAccess.test.ts
server/src/__tests__/vmTerminal.test.ts
server/src/__tests__/vmTerminalAccess.test.ts
server/src/__tests__/vmVerification.test.ts
server/src/__tests__/vmReaper.test.ts
```

Downloaded images, runtime secrets and generated `validation-*.json` are ignored.
Unrelated DNS artifacts appearing concurrently in the workspace were left alone.
No dashboards, login flows, seed curricula, Dockerfiles or compose files changed.

## 5. Validation commands and results

Baseline, before implementation:

```powershell
npm --prefix server test
npm --prefix client test
```

| Check | Result |
| --- | --- |
| Baseline backend | PASS: 16 files, 102 tests |
| Baseline frontend | PASS: 4 files, 19 tests |
| Final backend | PASS: 26 files, 152 tests |
| Final frontend | PASS: 4 files, 20 tests |
| Backend build | PASS |
| Frontend build | PASS; 760.03 kB application chunk advisory remains |
| Changed backend files ESLint | PASS |
| Frontend ESLint | PASS |
| Full backend ESLint | Fails on three existing unused imports/argument findings outside this change |
| Guest Bash and host PowerShell syntax | PASS |
| Real loopback SSH / QMP / Socket.IO protocols | PASS against test servers; not Kali |
| QEMU process lifecycle | Mocked tests PASS; actual lifecycle not executed |

Final test/build commands:

```powershell
npm --prefix server test -- --maxWorkers=2
npm --prefix client test -- --maxWorkers=2
npm --prefix server run build
npm --prefix client run build
npm --prefix server run lint
npm --prefix client run lint
```

Focused backend lint, from the repository's `server` directory:

```powershell
npx --no-install eslint src/config/env.ts src/controllers/labController.ts src/controllers/quizController.ts src/controllers/taskController.ts src/models/LabSession.ts src/server.ts src/services/labEngine.ts src/services/gradingEngine.ts src/services/vm src/scripts/validateKaliVm.ts src/sockets/terminalSocket.ts 'src/__tests__/vm*.test.ts' src/__tests__/labProviders.test.ts src/__tests__/labControllerMetadata.test.ts src/__tests__/labCompletion.test.ts src/__tests__/taskVerification.test.ts --max-warnings=0
```

Full backend lint findings: unused `NMAP_LAB_DEFINITION` and
`DOS_LAB_DEFINITION` imports in unchanged `allExperiments.test.ts`, and unused
`_next` in unchanged `middleware/error.ts`. An unused argument in the imported
VM terminal test was fixed. Initial local protocol runs failed with sandbox
`EACCES` on loopback; the permitted unsandboxed rerun passed. Early test fixture
and TypeScript issues were corrected before the final runs. No failures were
skipped or reported as passes.

Script syntax validation:

```powershell
# Run with Git Bash available on PATH; these are syntax checks only.
bash -n infrastructure/vm/prepare-base.sh
bash -n infrastructure/vm/guest/prepare.sh
bash -n infrastructure/vm/guest/first-boot.sh
$files = @('infrastructure/vm/audit-host.ps1','infrastructure/vm/install-qemu.ps1')
foreach ($file in $files) {
  $parseTokens = $null; $parseErrors = $null
  [System.Management.Automation.Language.Parser]::ParseFile((Join-Path (Get-Location) $file), [ref]$parseTokens, [ref]$parseErrors) | Out-Null
  if ($parseErrors.Count) { throw ($parseErrors | Out-String) }
}
```

## 6. Actual host and image checks

```powershell
git fetch origin
git status --short --branch
git branch -avv
git worktree list
git ls-remote --heads origin
git merge-base main feature/real-kali-vm
git merge-base feature/cybersecurity-experiment-suite feature/real-kali-vm
qemu-system-x86_64 --version
qemu-system-x86_64 -accel help
docker info --format '{{.ServerVersion}}'
Get-CimInstance Win32_OperatingSystem | Select-Object Caption,FreePhysicalMemory
Get-CimInstance Win32_ComputerSystem | Select-Object TotalPhysicalMemory,HypervisorPresent
Get-CimInstance Win32_Process -Filter "Name='qemu-system-x86_64.exe'" | Select-Object ProcessId,CommandLine
Get-WindowsOptionalFeature -Online -FeatureName HypervisorPlatform
wsl --list --verbose
```

Observed Windows 11 Home, about 15.85 GiB installed RAM, Windows hypervisor
present, QEMU 11.1.0 installed with `tcg` and `whpx` listed, and about 122 GiB
free on C:. Windows optional-feature servicing-state inspection required OS
administrator elevation, so that state was not independently established.
Listing a WHPX accelerator does not prove a working WHPX guest boot.
Docker Desktop's daemon was stopped (`docker_engine` pipe missing); both WSL
distributions were stopped. No existing QEMU process was observed.

The older worktree contains a read-only prepared qcow2 image. These checks were
actually executed without altering it:

```powershell
# Set VM_BASE_IMAGE locally to the approved prepared image; no image is committed.
$image = $env:VM_BASE_IMAGE
qemu-img info --output=json $image
$manifest = Get-Content -LiteralPath ($image + '.json') -Raw | ConvertFrom-Json
$actual = (Get-FileHash -LiteralPath $image -Algorithm SHA256).Hash.ToLowerInvariant()
$actual -eq $manifest.sha256
qemu-img check -f qcow2 $image
```

Result: qcow2, 19,374,538,752 bytes on disk, clean flag, consistency check
reported **No errors were found on the image**. Stored and measured SHA-256:
`597a12542713e77dc3da36a5e08f0fdfd479d740789668a57dd5676b57c511ce`.
This verifies consistency with the existing local manifest. The official
archive signature and image preparation were not repeated in this task, and
the guest's installed software was not confirmed by booting it.

## 7–10. Real VM, commands, connectivity and blockers

The following commands were actually attempted with the existing image:

```powershell
# Set VM_BASE_IMAGE locally to the approved prepared image before running these.
npm --prefix server run vm:check
npm --prefix server run vm:smoke
```

Both exited with status 1 at the resource guard. Exact live-smoke error:

```text
Insufficient free RAM: 3351 MB available; Kali requires 4096 MB plus 2048 MB host headroom.
```

Generated evidence: `validation-preflight.json` and `validation-boot.json` in
this directory. The `cleanupPassed=false` field means cleanup was not exercised;
no VM or overlay was created by these checks. The guard was not lowered.

| Validation level | Actual result in this task |
| --- | --- |
| Code/types/builds | Passed |
| Unit and controller tests | Passed |
| Real SSH/QMP/WebSocket protocols to local test servers | Passed |
| QEMU available / image readable and consistent | Confirmed |
| Actual WHPX Kali startup | **NOT PERFORMED — insufficient free RAM** |
| Actual command inside Kali | **NO** |
| Actual Kali-to-target connectivity | **NOT TESTED** |
| Actual VM stop/expiry/crash cleanup | **NOT TESTED** |
| Authenticated browser Nmap-to-report completion | **NOT TESTED** |

Further runtime errors may surface once the memory guard passes. In particular,
the existing prepared guest must still prove SSH first boot, internal target
startup and sudo access. The inherited full image-preparation recipe is syntax
checked, not rebuilt or live accepted; its separate worktree contains cgroup
setup fixes that may matter if a new image is built.

## 11. Git diff summary

The combined VM/authentication handoff baseline uses
`codex/real-kali-nmap-integration`; see [TEAM_HANDOFF.md](../../docs/TEAM_HANDOFF.md).
Main, the experiment-suite branch and the separate VM worktree are preserved.
The test counts above record the VM integration review; the handoff document
records the current combined baseline. Inspect the baseline commit and local
changes with:

```powershell
git show --stat codex/real-kali-nmap-integration
git diff --check
git diff -- docker docker-compose.yml
```

The last command must be empty. See the file inventory above for all imported
VM files and the limited changes to the existing monolith.

## 12. Recommended next step: live Nmap acceptance

Review this infrastructure change, then free at least 6,144 MiB RAM or use a
Windows WHPX host with that headroom. Keep the existing read-only base and use
this checkout's private runtime directory, not the older worktree's runtime.
Run `vm:check` and `vm:smoke` again before an investor demonstration.

`vm:smoke` requires no database. When preflight passes, it will start one VM,
check QMP identity, execute Kali identification commands, open and resize an
SSH PTY, fetch the controlled target, run all four real scans, record their
actual output, and destroy its own VM in `finally`. It does not exercise the
browser, HTTP authentication, database grading or PDF generation.

For the full demonstration, start Docker Desktop and the existing MongoDB
service, configure the backend with `LAB_BACKEND=qemu` and `VM_BASE_IMAGE`,
and run the backend directly on Windows. Use the existing authenticated
student account and Nmap experiment. Do not overwrite an existing `.env` with
the example. Normal existing service commands are:

```powershell
docker compose up -d mongodb
$env:LAB_BACKEND = 'qemu'
# Set VM_BASE_IMAGE as above in this same PowerShell session.
npm --prefix server run dev
# In a second PowerShell session:
npm --prefix client run dev
```

In the browser terminal, confirm `cat /etc/os-release`, `id`, `uname -a`, and
then execute and verify each task separately after Nmap finishes:

```bash
sudo nmap -sn nmap-target
sudo nmap -sS -p 80 nmap-target
sudo nmap -O -p 80,81 nmap-target
nmap -sV -p 80 nmap-target
```

An uncertain OS fingerprint is a legitimate Nmap result; do not claim an exact
OS match if Nmap does not provide one. Finish the existing quiz/report flow,
confirm the attempt's QEMU process and overlay are gone, and test stop, TTL,
server restart and a second student's denial of access. These remain live
acceptance requirements. Google authentication, dashboard changes and further
VM experiments are deferred until this infrastructure work is reviewed.
