# CyberLabX V1

For the current integration baseline, complete setup, enrollment API and
validation status, start with [the team handoff](docs/TEAM_HANDOFF.md).
The sections below describe the original Docker Nmap/DoS foundation.

CyberLabX is an isolated, browser-based cybersecurity lab. V1 teaches Network Mapping with real Nmap commands running inside a disposable Kali container against a controlled private target.

## Prerequisites

- Windows 11, Docker Desktop with the WSL2 backend, Node.js 22+ and npm
- Docker Desktop must be running before starting a lab. Lab containers are deliberately internal-only and have no published ports.

## Setup

1. Copy `.env.example` to `.env` and replace every `change_me` secret with a strong local-only value. Keep `.env` uncommitted.
2. Install application dependencies:

   ```powershell
   npm --prefix server install
   npm --prefix client install
   ```

3. Start the pinned MongoDB service and confirm it is healthy:

   ```powershell
   docker compose config
   docker compose up -d mongodb
   docker compose ps
   ```

4. Build the lab images:

   ```powershell
   docker build -t cyberlabx-kali:latest -f docker/kali/Dockerfile docker/kali
   docker build -t cyberlabx-target:latest -f docker/target/Dockerfile docker/target
   docker build -t cyberlabx-dos-attacker:latest -f docker/dos-attacker/Dockerfile docker/dos-attacker
   docker build -t cyberlabx-dos-victim:latest -f docker/dos-victim/Dockerfile docker/dos-victim
   docker build -t cyberlabx-dos-client:latest -f docker/dos-client/Dockerfile docker/dos-client
   ```

5. Seed optional local development accounts (only inserts missing documents):

   ```powershell
   npm --prefix server run seed
   ```

6. Run the API and client in separate terminals:

   ```powershell
   npm --prefix server run dev
   npm --prefix client run dev
   ```

Open `http://localhost:5173`. Use the student seed credentials configured in `.env`.

## Verification

```powershell
npm --prefix server run build
npm --prefix server test
npm --prefix client run build
```

For an end-to-end smoke test, start a lab, run `ip addr`, then use Nmap only against `nmap-target`. When the lab is stopped or expires, the backend removes the Kali container, target container, and attempt-specific internal network while retaining educational records.

## Security notes

- The browser never receives Docker credentials or direct Docker API access.
- Lab networks are created with Docker `Internal: true`; no public ports are published.
- Only server-side allowlisted images/configuration are used, with CPU, memory, PID, capability, and no-new-privileges restrictions. The DoS lab's student shell is an unprivileged user; only a localhost controller can send its fixed 60 SYN probes at 10pps to `victim`.
- Authentication uses an HttpOnly cookie; protected APIs validate ownership on every student resource.
