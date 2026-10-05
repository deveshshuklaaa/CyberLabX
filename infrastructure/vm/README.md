# Real Kali VM backend — implementation and validation report

Status: **implementation awaiting base-image and live validation**. The user explicitly
deferred live tests on 5 October 2026. No browser session has executed inside Kali in
this phase. Do not treat passing builds or protocol tests as a live VM acceptance result.

Worktree: `C:\Users\DEVESH SHUKLA\.codex\worktrees\2508\CyberLabX`.
Branch: `feature/real-kali-vm`, based on `d58fc2b`. The original `C:\dev\CyberLabX`
checkout was left on its existing branch. No pushes or history rewrites were performed.

## 1. Host prerequisites and observed audit

| Item | Observed result |
| --- | --- |
| OS | Windows 11 Home Single Language x86-64 |
| CPU | AMD Ryzen 7 5800H, 8 cores / 16 logical processors |
| Firmware virtualization | Enabled |
| Hypervisor | Windows reports present |
| WHPX API | `WHvGetCapability(HypervisorPresent)` returned HRESULT 0 and value 1 |
| Windows optional feature inspection | Requires elevation; feature servicing state not independently verified |
| QEMU / qemu-img | Not installed / not on PATH |
| TAP driver | No TAP adapter detected; existing VirtualBox adapter is not used |
| RAM | About 15.85 GiB installed; about 1.44 GiB free at initial audit |
| Disk | C: about 107 GiB free; D: about 160 GiB free at initial audit |
| Docker | Docker Desktop engine 29.7.2 responding |
| WSL | Default version 2; Ubuntu stopped, docker-desktop running |

No features, bridges, drivers, host devices, or Windows firewall settings were changed.
A QEMU installer download was started, then stopped after live testing was deferred.
The partial download was neither verified nor executed, and was discarded.
`audit-host.ps1` repeats the read-only audit. Preparation additionally needs Ubuntu WSL
packages listed in section 18; those packages were not installed in this phase.

## 2. Hypervisor technology

Node launches `qemu-system-x86_64` directly with `-machine q35 -accel whpx` and argument
arrays, never a student-controlled shell command. There is no TCG fallback for runtime,
no Hyper-V management API, and no VirtualBox runtime. The QEMU installer script uses
the Windows distribution linked from [QEMU's download page](https://www.qemu.org/download/#windows),
checks its published SHA-512 digest, and does not restart Windows. See the
[WHPX documentation](https://www.qemu.org/docs/master/system/whpx.html).

## 3. Kali base image

`prepare-base.sh` selects the official Kali 2026.2 QEMU amd64 archive, verifies the
signed SHA256SUMS with Kali's pinned 2025 archive key, verifies the archive checksum,
extracts and converts it, and configures a copy using `virt-customize` in WSL.
Sources: [Kali images](https://cdimage.kali.org/current/),
[Kali signing key](https://www.kali.org/blog/new-kali-archive-signing-key/).

Output: `infrastructure/vm/kali/base/kali.qcow2` plus a manifest with the final hash.
The original download, intermediate images, base, and runtime secrets are ignored by Git.
The base is never a student's writable disk. Finalization fails if required packages or
target image builds fail. Package installation follows Kali rolling repositories;
the recipe is repeatable, not a guarantee of byte-identical future builds. The upstream
skeylogger source is pinned to commit `a687c72a59aae7462e448fb41bd0f1e1fc35d793` from
[its project](https://github.com/gsingh93/simple-key-logger).

**Not executed yet:** image download, signature/checksum verification, package installation,
guest image build, and successful boot. No prepared base image currently exists.

## 4. VM architecture

The existing Node modular monolith owns the VM manager, authenticated HTTP routes,
Socket.IO terminal bridge, and raw WebSocket desktop bridge. No second application or
VM microservice is introduced. `LAB_BACKEND=qemu` is the default; the retained Docker
path is only selected explicitly for legacy development/tests.

Every attempt has a UUID, name, owner, attempt id, process id, lifecycle state,
QMP/SSH/VNC loopback ports, disk paths, timestamps, network mode, and a pinned SSH host
key hash. Recovery metadata is persisted before launch and atomically replaced.

## 5. Lifecycle

Admission checks the base manifest, QEMU WHPX support, RAM, disk headroom, and concurrency.
Provisioning creates an overlay and credentials, starts QEMU, waits for authenticated SSH,
checks `ID=kali` and guest readiness, then marks the session running. A normal guest bash
PTY accepts ordinary commands without an allowlist or command replacement.
The `student` account is unique to each disposable attempt, with a unique SSH key and
passwordless sudo inside that guest. Desktop login is automatic inside the VM console.

Shutdown requests QMP ACPI powerdown, then QMP quit after a bounded grace period.
Process termination is a last resort after matching the QEMU UUID, name and overlay in
its process command line. Disks are retained if process removal cannot be confirmed.

## 6. Browser terminal

`xterm.js → Socket.IO → Node ssh2 → Kali SSH → xterm-256color PTY`.
The existing terminal remains, with resize forwarding and rolling output replay on reconnect.
SSH private keys stay in the host's private runtime directory. Each host key is generated
before boot, installed through QEMU firmware configuration and strictly pinned by the SSH client.
No password trust-on-first-use or Windows command execution is involved.

## 7. Browser desktop

`noVNC → /desktop/:sessionId WebSocket → Node TCP proxy → loopback QEMU VNC`.
The authenticated owner gets an Open Kali Desktop action. The browser never receives a
VNC port or chooses a backend address. Both proxies check active session ownership,
active attempt ownership, matching VM identity and TTL. Desktop upgrades also check the
configured browser origin. Connection cleanup is tied to VM lifecycle and expiry.
noVNC is loaded separately when needed. Production uses HTTPS/WSS at the existing app proxy.

## 8. Networking

Default: user-mode NAT with loopback SSH forwarding. `VM_ALLOW_INTERNET=false` uses QEMU
restricted user networking, while the internal experiment targets remain available inside Kali.
Faculty may set `VM_ALLOW_INTERNET=true` for normal NAT egress, package installation and
approved external OSINT. This permits broad egress; it is not a destination allowlist.
Do not enable it on untrusted university networks without appropriate network policy.

`VM_NETWORK_MODE=bridged` adds a second TAP NIC while retaining private NAT management.
It requires an existing named TAP adapter, checked before startup. Bridge/driver installation,
LAN addressing, routing, and faculty firewall policy remain administrator setup tasks.
The backend never configures the Windows bridge from student input. Neither NAT nor TAP
has been live-tested here. No TAP driver was blindly installed.

Nmap/recon/DoS targets run as real Docker containers **inside Kali**, using the existing
target/victim/client Dockerfiles. Their network is internal, `172.28.0.0/24`, with the
assigned target at `172.28.0.10`. No Windows Docker socket is shared. Guest sudo can
alter guest networking; QEMU restriction or an external faculty network policy is the
egress boundary, not guest iptables rules.

## 9. Storage

One qcow2 overlay per attempt references the common base. Experiment 07 also gets a
new 2 GiB qcow2 disk, attached as `/dev/vdb`; Kali's OS is `/dev/vda`. Guest initialization
checks the secondary disk size, creates an ext4 filesystem labelled SOMAIYA_EVIDENCE,
copies synthetic evidence, and unmounts it. Both disks are removed at cleanup.
No physical disks, host mounts, host input devices or GPU passthrough are generated.
Read-only original email/file evidence is copied separately from writable student work.
Guest root can change its overlay's evidence, but cannot change the common base through
that overlay. Curriculum instructions require preserving the original evidence.

## 10. Experiment migration

| Experiment | VM path implemented | Live status |
| --- | --- | --- |
| 01 | Real ping, DNS queries, traceroute, nmap, ss and dig against controlled recon target; no fake recon-osint | Pending |
| 02 | Existing Nmap tasks retained; sudo supported, genuine guest-internal HTTP target | Pending |
| 03 | Existing victim/client images moved into guest; bounded hping3 exercise, real tshark pcap analysis | Pending |
| 04 | Compile pinned upstream skeylogger; observe virtual keyboard input typed through noVNC; no FIFO | Pending |
| 05 | Synthetic email, genuine ripmime/file/exiftool; bulk_extractor and whois package checks | Pending |
| 06 | Existing real disguised JPEG, xxd signature, copy and hash workflow | Pending |
| 07 | Real secondary disk, dd acquisition, clone/hash checks, TestDisk/PhotoRec available | Pending |

VM curriculum is projected server-side over existing definitions; it does not overwrite
stored legacy curriculum. Task marks, quiz, reports and CommandLog are retained. Fixed
server-owned SSH inspections verify selected artifacts and target availability. Browser
output is never accepted as grading evidence and submitted commands are never replayed
as host commands. Terminal command reconstruction remains best-effort (interactive
editors, shell history and GUI commands are not authoritative command transcripts).
Students with guest root can manipulate guest artifacts: this is educational evidence,
not tamper-proof high-stakes examination attestation. Legacy simulation files are retained
until complete live acceptance; none are installed as VM command replacements.

## 11. Security boundary

The trusted Windows host/backend controls QEMU configuration; the guest is the student
administrative boundary. Host management endpoints bind only to 127.0.0.1. Windows
runtime ACLs restrict keys and metadata to the backend identity and SYSTEM. Host users
and administrator processes are trusted; loopback is not isolation from another local
Windows administrator. Invalid recovery metadata blocks destructive cleanup.

## 12. Resource management

Defaults: 2 vCPU, 4096 MiB RAM, one concurrent VM, 2048 MiB additional free host RAM,
16 GiB free runtime disk required. Provisioning is serialized and a runtime lock prevents
two backends from managing the same directory. CPU: 2–4, RAM: 4096–8192 MiB, concurrency:
1–8 configurable. These are limits, not measured safe concurrency for this machine.
The host's observed free RAM was insufficient, so no large VM was launched.

## 13. Cleanup and recovery

Stop, quiz completion, TTL, guest crash, provisioning failure, and orderly backend shutdown
invoke cleanup. A periodic reaper retries failed/stopping resources and removes crashed VMs.
Startup enumerates managed metadata and Windows QEMU processes, expires previous DB
sessions/attempts and disposes their VMs before serving requests. QEMU instances without
matching metadata are never killed by name alone. Unresolved identity mismatches block
startup. Incomplete metadata directories without running processes are reclaimed.

## 14. Automated tests

The final verification results are recorded in `validation.txt`: 132 server tests and
20 client tests passed; both builds passed. Coverage includes real loopback TCP port reservation and QMP negotiation,
SSH protocol host-key pinning/PTY/resize/reconnect using a test SSH server, WebSocket/VNC
proxy routing and unauthorized upgrade rejection using a test TCP server, and mocked
QEMU lifecycle, overlay arguments, capacity races, provisioning failure, orphan recovery,
metadata path validation, and insufficient-memory refusal. Existing container/assessment
tests remain regression checks; they do not validate real QEMU execution.

## 15. Live tests

**Pending at the user's request.** QEMU is not installed and no Kali base is prepared.
Required acceptance: Student A login → Experiment 01 → actual VM process → browser PTY
`cat /etc/os-release`, `whoami`, `uname -a`, `which nmap whois traceroute` → noVNC → GUI
terminal/application → stop → process/overlay gone. Repeat Experiment 07 with `lsblk`,
acquisition, hash and TestDisk/PhotoRec workflow and both disks removed. Retest 02 and 03;
use Student B to verify both terminal and desktop denial for Student A's session.

## 16. Performance measurements

Not measured: boot-to-ready latency, QEMU working set/CPU, overlay growth, GUI responsiveness,
concurrent VMs. After single-VM acceptance, measure with `Get-Process qemu-system-x86_64`
and `Get-ChildItem infrastructure/vm/runtime -Recurse`. Only increase concurrency after
free RAM can accommodate the additional guest and configured host reserve.

## 17. Remaining work

Install QEMU; prepare and checksum-verify the real base; validate the complete image build
recipe (including Docker builds in the libguestfs appliance and upstream tool compatibility);
run all seven practicals and live terminal/desktop/cleanup/ownership acceptance; measure
performance; validate optional TAP on a faculty-controlled network. Hot disk attach/detach
is not exposed: the forensic disk is attached at VM creation. No live completion claim is made.
Dependency installation reported npm audit findings (server 10, client 11); remediation
of that dependency graph was not part of this architecture implementation.

## 18. Commands to prepare and run

Use the new worktree, not the unchanged original checkout. Start with an elevated
PowerShell for QEMU installation:

```powershell
Set-Location 'C:\Users\DEVESH SHUKLA\.codex\worktrees\2508\CyberLabX'
.\infrastructure\vm\audit-host.ps1
.\infrastructure\vm\install-qemu.ps1
```

If a subsequent QEMU WHPX probe reports the optional feature missing, enable it from
an elevated PowerShell, then arrange any required reboot yourself:

```powershell
Enable-WindowsOptionalFeature -Online -FeatureName HypervisorPlatform -All -NoRestart
```

Inside Ubuntu WSL, install the image preparation tools and run the recipe:

```bash
sudo apt-get update
sudo apt-get install -y libguestfs-tools qemu-utils p7zip-full curl gnupg
cd '/mnt/c/Users/DEVESH SHUKLA/.codex/worktrees/2508/CyberLabX'
bash infrastructure/vm/prepare-base.sh
```

In a normal PowerShell in the worktree, mark the finalized base read-only, configure
the application and start MongoDB:

```powershell
attrib +R infrastructure\vm\kali\base\kali.qcow2
Copy-Item .env.example .env
# Edit .env: choose unique JWT/database/seed passwords; leave LAB_BACKEND=qemu.
# QEMU_BINARY and QEMU_IMG_BINARY already point to C:/Program Files/qemu in the example.
npm --prefix server ci
npm --prefix client ci
docker compose up -d mongodb
npm --prefix server run seed
npm --prefix server run dev
```

In a second PowerShell in the same worktree:

```powershell
npm --prefix client run dev
```

Open `http://localhost:5173`, log in using the configured seed student, and start a lab.
Keep the backend running directly on Windows so WHPX is available. Docker Desktop is
only needed for the existing MongoDB service, not the student execution environment.
Do not copy `.env.example` over an already configured `.env` on subsequent runs.

To repeat the automated acceptance commands:

```powershell
npm --prefix client test -- --run
npm --prefix server test -- --run
npm --prefix client run build
npm --prefix server run build
```
