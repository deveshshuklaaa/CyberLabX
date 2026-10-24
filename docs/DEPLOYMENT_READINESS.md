# Deployment readiness: preparation only

Stage 9, 24 October 2026. **Not approved for public deployment.** No hosting,
domains, cloud resources, infrastructure changes or deployment were performed.
Local demonstration readiness is separate from production security acceptance.

## Proposed deployment boundaries

| Layer | Required preparation and validation |
| --- | --- |
| Frontend | Build `client/dist`; static hosting with SPA history fallback for protected/deep routes. Set build-time VITE_API_URL (ending `/api`) and VITE_SOCKET_URL to approved HTTPS endpoints. Never inject backend secrets. Test all roles, refresh, PDFs and socket reconnection on final origins. |
| API | Supported pinned Node runtime, production build in server/dist, controlled process/service restart and graceful lab cleanup. Persistent writable report directory with least privilege, reliable Mongo connectivity and approved capacity limits. Do not expose Vite/tsx/Vitest to public traffic. |
| Domain / TLS | Prefer a same-origin reverse proxy for frontend/API/Socket.IO. Obtain approved domain/certificates, HTTPS/WSS, certificate renewal and forwarded-header policy. Do not run public HTTP authentication. |
| Cookies / CORS | NODE_ENV=production makes existing host-only HttpOnly SameSite=Lax cookie Secure. CLIENT_URL must match the exact frontend origin; allow credentials only for it. Socket origin must match too. Cross-site unrelated frontend/API domains are not supported merely by setting CORS: SameSite=Lax will constrain cookies. Review any cookie-model change separately. |
| Proxy / throttling | Current Express trust-proxy policy is not configured for deployment. Decide exact trusted hops/subnets and validate client-IP/rate-limit attribution; never set blanket trust to evade throttles. Shared/multi-instance auth and start limits need a reviewed store/edge policy; the current memory store is process-local. |
| MongoDB | Private authenticated network, least-privilege application account, encryption, tested backup/restore and monitored capacity. Never publish Mongo ports publicly. Replica-set/transactions and shared serialization implementation require approval before admin writes can be enabled. |
| Reports / backups | Preserve DB references and actual PDF files consistently. Private encrypted backups with retention/access controls; test restoration, symlink/path protections and teacher/student ownership after restore. Do not store report PDFs on public static hosting. |
| Docker labs | Dedicated controlled host with adequate CPU/RAM/disk/concurrency. Docker socket is effectively privileged host access: API only, never browser/public proxy; avoid arbitrary user Docker configuration. Keep internal per-attempt networks, no published lab ports, resource limits, dropped capabilities/no-new-privileges and image allowlist. Pin/review image supply chain and patch deliberately. |
| Real Kali VM | Existing implementation requires Windows/QEMU/WHPX, approved prepared qcow2/manifest, disk space, 4,096 MiB guest + 2,048 MiB host reserve. A generic Linux PaaS is not a validated host for this provider. No VM live boot/SSH/cleanup is accepted yet. |
| OAuth | Google Web application client, consent/test-user policy, backend-only secrets, exact deployed HTTPS callback `/api/auth/google/callback`, matching HTTPS CLIENT_URL; test live login/linking/conflicts. No credentials configured locally. |

## Configuration inventory

Review `.env.example` with the chosen topology; do not copy insecure placeholders.
Privately configure Mongo URI/auth, JWT signing secret/expiry, bcrypt rounds,
CLIENT_URL and SERVER_PORT; frontend API/socket URLs; LAB_BACKEND, TTL, limits,
approved image references and network prefix; REPORT_DIR/persistence; optional
Google credentials/callback and VM paths/resources. Production must not inherit
development account credentials, broad debugging or sample secrets. Do not
publish `.env`, private keys, raw HAR files, Mongo backups or VM credentials.

Keep local data/original branches untouched. Configuration changes require a
reviewed rollback: retain prior build/configuration, ensure schema compatibility,
back up before migration, and reconcile writes before reverting data stores.

## Observability and operational acceptance

- `/health` currently reports process liveness only. Define separately monitored
  Mongo/report-store/Docker/VM readiness; a 200 does not prove labs can start.
- Monitor API status/latency, auth throttles, failed provisioning, lab capacity,
  expiration lag, cleanup failures/orphan labels, storage growth, report failures,
  Socket.IO reconnect errors and database health. Bound logs and disk retention.
- Redact credentials, Cookie/Authorization/Set-Cookie headers, OAuth transaction
  data, password request bodies and personal academic details from logs/traces.
  Restrict audit/report access; export only sanitized evidence.
- Test restart recovery with only owned disposable fixtures; preserve unrelated
  containers/volumes and never treat prune as a normal cleanup mechanism.
- Exercise backup/restore, disk-full, daemon unavailable, expired session, failed
  report generation and bounded capacity recovery before a public demo.

## Release gates

1. Resolve/review production npm audit findings with targeted compatible lockfile
   changes and tests; never auto-force major upgrades. Full audit counts are in
   [final readiness](FINAL_PROJECT_READINESS.md). Dev-only advisories still
   prohibit exposing development servers; browser bundle reachability needs
   separate analysis from npm's dependency classification.
2. Decide whether admin mutations are essential. If so, approve and execute the
   [isolated atomicity plan](ADMIN_MUTATION_ENABLEMENT_PLAN.md). Until then they
   remain honestly unavailable on both server and UI.
3. Obtain a live natural-expiry acceptance result and final manual acceptance;
   record limitations for other experiment images, accessibility and VM/OAuth.
4. Review CSRF/origin strategy, rate limiting behind real proxies, stateless JWT
   logout limitations and live socket revocation policy. Current CORS is a
   browser response-access policy, not general CSRF protection or API auth.
   Socket handshake checks current DB role/status; existing Docker connections
   are not asserted to continuously revalidate account deactivation. Do not
   claim immediate global JWT/socket revocation from client logout.
5. Obtain explicit approval for hosting, topology, secrets, migration and final
   push/deployment. No part of this document authorizes those actions.
