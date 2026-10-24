# CyberLabX final local readiness review

Stage 9, 24 October 2026 (Asia/Calcutta).
Branch: `integration/local-takeover`. Starting HEAD:
`574d72cdea27bf20bf702ae91699e4351b0220d3`.
Frontend correction: `c306c1e41b7dcb8b0347fa72639ee1633ac92c41`.
This document and the manual/enablement/deployment plans are delivered by the
subsequent local documentation commit; use `git log -2` for its final SHA.

**Ready for informed local manual acceptance of the supported scope. Not ready
for unrestricted production release or a claim that every planned feature works.**
No remote Git operation, PR update, deployment, cloud purchase, topology change,
dependency upgrade, record deletion or security-control weakening occurred.

## Implemented journeys and status

| Capability | Classification | Evidence / limits |
| --- | --- | --- |
| Student login/dashboard/catalogue/details | PASSED | Actual Chrome login, refresh persistence, real catalogue search/details; four-width layouts |
| Student progress/history/profile | PASSED | Real academic data; loading, failed request/retry, authenticated profile and honest scores/report availability |
| Real Nmap tasks/quiz/results/PDF | PASSED | Stage 8 real Docker terminal scans, four verified tasks, 75/75 completion, generated PDF; not repeated in Stage 9 |
| Terminal resize/reconnect/stop/cleanup | PASSED | Stage 8 browser/socket/container evidence and fixes; no fake terminal |
| Teacher enrollment/list/detail/removal | PASSED | Stage 9 UI 201 enrollment and 204 removal using existing student; final unassigned state |
| Nonzero faculty score/report isolation | PASSED | A: 1 student, 2 completions, average 75 points, 2 reports; actual PDF download. B: empty cohort and foreign attempts/reports 404. A loses report-list access after removal |
| Teacher cohort/experiment analytics | PASSED | Actual scoped analytics: 8 attempts, 2 completed, 1 attempted/completed student; no task totals invented |
| Admin directory/detail/search | PASSED | Real directory, teacher selection/detail, filters, empty states and disabled mutation disclosure |
| Admin teacher-cohort management | PASSED | Existing teacher-scoped routes implemented and live-validated Stage 6; Stage 9 renders selected teacher cohort. Stage 9 does not claim another admin enrollment mutation round |
| Admin full audit search/pagination | PASSED | Server-paginated stored collection, separate latest-20 sample; real no-match filter. Only 2 stored events locally; broader pagination API evidence from Stage 6/tests |
| Admin account creation / role/status mutation | BLOCKED | Standalone DB plus absent approved shared guard/versioned transactional writer. Server 503 gate stays closed; self-change 409 protections retained |
| Google OAuth login/linking | BLOCKED | Three credentials/callback settings absent; Stage 8 303 not-configured fallback works; no live provider success claimed |
| Real Kali/QEMU | BLOCKED | Stage 8 check exits 1: default prepared image missing; QEMU tools not found on current PATH. Memory guard preserved; smoke not run |
| Natural 45-minute expiry / expired terminal | NOT TESTED | Automated expiry checks exist, but fresh live TTL was not waited out. Manual procedure supplied; no simulated timestamp success |
| Focused keyboard/semantic audit | PASSED | Named controls, labels, main/h1/lang/alt checks; mobile Escape focus, native modal background exclusion and restored cancellation focus |
| Full accessibility acceptance | NOT TESTED | No NVDA/JAWS/VoiceOver session, full contrast/WCAG audit, zoom/hardware acceptance |
| Historical task totals | BLOCKED | No reliable assessment snapshot for old attempts; verified task count can be shown, unknown maximum stays unknown. Do not fabricate a percentage |
| Admin experiment authoring | OPTIONAL | Unapproved/unimplemented; honest pending state and read-only catalogue |
| Other experiments' full live runtimes | NOT TESTED | Required images/workflows not all validated; missing DoS image failure tested in Stage 8, not a successful DoS practical |
| Full backend lint | FAILED | Exactly the same three pre-existing findings; no new failure hidden |
| Dependency security gate | FAILED | Production and development audit advisories remain; see below |

## Fresh Stage 9 browser review

Installed Chrome 155.0.8059.85, actual React pages and running localhost APIs,
using existing temporary Playwright tooling; no dependency installation.

Main run: **89 passing assertions**, 40 layouts across 10 page states and
43 masked screenshots. States: student dashboard/catalogue/progress/history/
profile/details; teacher empty and enrolled detail; admin directory/audit and
selected teacher detail. All fit document width at **320/375/768/1280**, height
900. Semantic probes covered lang, one h1/main, field labels, button names and
image alt attributes. These are focused DOM checks, not an axe/WCAG certification.

Focused follow-up: **16 passing checks** for actual pending history UI, profile
and header logout, protected-route redirect after logout, Student-to-Admin switch
in the same context, modal background-control exclusion, Escape and return focus;
one further loading screenshot. Native dialogs may allow focus to browser chrome
(document.body as activeElement) rather than a background page control. The first
probe incorrectly required every Tab to stay on an element inside the dialog;
retained evidence distinguishes that probe assumption from the real return-focus
defect. Final return-focus check passes after the correction.

Separate anonymous login-page review: four additional layouts/screenshots, all
widths fit and focused email control visibly outlined. Total **44 layout samples,
48 screenshots**. Four login profiles/role sessions were tested; a later same-
context role switch verified UI logout/cache isolation without sharing cookies
across the independent cohort-isolation contexts.

Zero uncaught page exceptions in completed runs. Main console entries: four
expected anonymous bootstrap 401s, one actual login-throttle 429, one deliberately
aborted history request. Network statuses and actions are retained. The auth
retry waited the actual **320-second Retry-After** before retrying; the backend
was not restarted or limits changed. Main and follow-up logouts returned 204;
subsequent me checks returned 401. Google and lab starts were not unnecessarily
repeated here.

Confirmed frontend defect: conditional account review unmounted the opener, so
closing the native dialog left keyboard focus outside the review control. Added
explicit focus restoration only when leaving review, with regression assertions
for both Cancel and the native cancel/Escape event. Account writes remain blocked.
Screenshots/evidence: `.env.stage9-evidence/admin-blocked-dialog.png`,
`pre-focus-fix.json`, final `focus.json`. No other new frontend defect was found
within the executed checks; this is not a guarantee about untested combinations.

## Fresh regression results

| Command | Result |
| --- | --- |
| `npm --prefix server test` | PASS: 36 files, **345 tests**, exit 0 |
| `npm --prefix client test` | PASS: 20 files, **238 tests**, exit 0; rerun after focus fix |
| `npm --prefix server run build` | PASS, exit 0 |
| `npm --prefix client run build` | PASS, exit 0; rerun after focus fix |
| `npm --prefix server run lint` | FAIL, exit 1, three existing errors |
| `npm --prefix client run lint` | PASS, exit 0; rerun after focus fix |

Backend lint: `server/src/__tests__/allExperiments.test.ts:9` unused
NMAP_LAB_DEFINITION; line 10 unused DOS_LAB_DEFINITION;
`server/src/middleware/error.ts:3` unused `_next`. Tests/security were not weakened
to hide these findings. The focus regression extends an existing test, so the
client count remains 238. No backend code changed in Stage 9.

Frontend production JS: **826.87kB / 230.71kB gzip**, existing >500kB Vite warning.
It is not a build failure. Future route-level splitting/lazy terminal loading
should be profiled and regression-tested; no broad late-stage bundling rewrite.

## Dependency audit and production exposure

Fresh `npm --prefix {server,client} audit --json` and corresponding
`audit --omit=dev --json` reports were captured. Counts describe vulnerable npm
package entries, not distinct exploitable flaws or a proof of compromise:

| Scope | Moderate | High | Critical | Total |
| --- | ---: | ---: | ---: | ---: |
| Server full | 5 | 8 | 3 | 16 |
| Server omit-dev | 4 | 4 | 1 | 9 |
| Client full | 4 | 7 | 2 | 13 |
| Client omit-dev | 0 | 2 | 0 | 2 |

Server production entries: @grpc/grpc-js, body-parser, dockerode, engine.io,
ip-address, proxy-addr, qs, uuid and zod. `npm ls --omit=dev` confirms paths:
Express 5.2.1 -> body-parser 2.3.0/proxy-addr 2.0.7; Socket.IO 4.8.3 -> engine.io
6.6.9; dockerode 4.0.12 -> @grpc/grpc-js 1.14.4; zod 3.25.76 direct.
Critical proxy-addr advisory concerns trusted proxy-subnet behavior; current app
does not configure trust proxy, so that specific exposure is not demonstrated.
Body parsing and Socket.IO are real request-facing runtime paths and require
priority review/patch validation before public hosting. JSON size limits and
current socket auth do not establish immunity to dependency-level defects.

Client production entries: axios 1.19.0 and transitive follow-redirects 1.16.0.
Several advisories concern Node adapters/proxy/redirect code, which are not
automatically browser-bundle vulnerabilities; Axios browser/prototype-pollution
advisories still require review. `omit=dev` is a package classification, not a
bundle reachability proof. Full audits also flag Vite/Vitest/Tinypool and build
dependencies. Never expose dev/test servers publicly.

Detailed advisory URLs/ranges/fix metadata are retained in ignored local JSON
reports. Examples: [Express proxy dependency](https://github.com/advisories/GHSA-jqcg-44mw-7w3h),
[body parser](https://github.com/advisories/GHSA-27r3-jxmh-p828),
[Engine.IO](https://github.com/advisories/GHSA-2gc4-cqfq-p2gv).
No exploit traffic was sent. No audit fix, force operation or upgrade was run.
Next approved remediation should review compatible patch/minor updates one
dependency chain at a time, diff lockfiles and rerun affected/full tests and real
terminal/auth checks. Major Dockerode/Zod/Vitest suggestions need separate
compatibility review; this report does not approve blindly applying them.

## Security review and boundaries

Reviewed current DB role/active authorization, strict ownership routes, student
report routes and private PDF containment, teacher cohort checks, fail-closed
admin writes, terminal origin/student/session/expiry checks, internal Docker
topology and allowlisted configuration, session bootstrap, query-cache clearing,
cookie flags and CORS. Fresh Student-to-admin/teacher API access returned 403;
Admin-to-faculty enrollment API returned 403. Nonzero teacher isolation is live
evidence above. Student foreign-report and active Socket.IO foreign-owner denial
remain supported by Stage 5/7/8 evidence and fresh regression suites; not every
negative runtime test was repeated in Stage 9.

Real `/health` 200 with Helmet headers and expected credentialed CORS origin was
observed. A foreign-Origin health request still advertises only the configured
localhost origin, so browsers cannot read it credentialed; CORS is not general
server authentication or blanket CSRF protection. Local HttpOnly SameSite=Lax
cookies become Secure in production. JWT logout is client cookie removal, not
global copied-token revocation. Current API requests reload DB role/status;
long-lived Docker sockets are not claimed to revalidate account deactivation
continuously. These/proxy/CSRF operational policies need production review.

Scanned **269 tracked files** against securely loaded configured local secret/
password values: no matches (values never printed). Frontend source review found
no browser token persistence or credential logging; no new secret-bearing files
are staged. This is a bounded scan, not proof that every historical repository
artifact lacks personal information. Existing tracked test-output/smoke logs and
two legacy generated report PDFs predate this stage; they were not deleted or
newly committed. Review their privacy/retention separately before publication.
No `.env`, backups, VM images, private keys or runtime evidence is added here.

## Data preservation and evidence locations

Read-only snapshots plus authorized enrollment/removal only, using isolated
`cyberlabx_local_takeover`. Final totals unchanged: **5 users, 8 experiments,
8 attempts, 8 lab sessions, 25 command logs, 2 reports, 2 audit events**. Both
existing report file digests match. Only the dedicated student's document changed
through enrollment/removal (including normal timestamps); final assignment is
absent. Other original documents matched their snapshots. No records/files were
deleted. No active/provisioning/stopping lab remains; no lab starts were made.
The DB remains standalone. Existing Stage 8 runtime history is intentionally kept.

Ignored local `.env.stage9-evidence/`: `results.json` (89 checks, API/statuses,
layouts/audit/data snapshots), `focus.json` (16 final checks), `login.json`,
`preservation.json`, `secret-scan.json`, masked screenshots and authorized
`teacher-report.pdf`. Retained first probes document failures/assumptions honestly.
Harnesses: `server/.env.stage9-{browser,focus}.mjs`. Fresh test output:
`.env.stage9-{server,client}-tests.txt`; audit JSON:
`.env.stage9-{server,client,server-prod,client-prod}-audit.json`.
No unredacted HAR, cookies, passwords or OAuth credentials were exported.

## Manual sign-off and next decisions

Use [FINAL_MANUAL_ACCEPTANCE.md](FINAL_MANUAL_ACCEPTANCE.md) for exact startup,
accounts, role journeys, Nmap commands, terminal/PDF checks, cleanup, responsiveness
and troubleshooting. Complete the real expiry test and assistive-technology
checks rather than assuming the automated review signs them off.

Review [ADMIN_MUTATION_ENABLEMENT_PLAN.md](ADMIN_MUTATION_ENABLEMENT_PLAN.md)
before approving a new isolated replica-set/guard implementation; it includes
backup/restore/rollback, transaction/audit/last-admin and enrollment-race tests.
See [DEPLOYMENT_READINESS.md](DEPLOYMENT_READINESS.md) for hosting, HTTPS, Mongo
backup, Google callback, cookie/CORS, labs/VM, monitoring and release gates.
The current baseline deliberately leaves unavailable capabilities disabled.
User manual acceptance and explicit approval determine any later development,
final push or deployment. Stage 9 ends here.
