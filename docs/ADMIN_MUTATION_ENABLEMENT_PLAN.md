# Approval-dependent admin account mutation plan

Stage 9, 24 October 2026. Proposal only; no topology, schema or writer changes.
See [reviewed policy](STAGE4B_API_IMPLEMENTATION_PLAN.md) POL-ADMIN-1 and
[current gate](STAGE6_ADMIN_MANAGEMENT.md). A replica set alone does **not**
enable the current implementation: `accountManagement.writesAvailable` is
deliberately false and there is no transactional management writer/guard/version.

## Approval scope and infrastructure

Obtain explicit approval for the isolated replica-set experiment, backup storage
and access, new guard/version schema, enrollment-writer coordination, approved
teacher/student role-transition policy and later rollout. Never enable writes
by removing the 503, using a process mutex, or replacing an atomic update with
count-then-update. Keep the original standalone data and volume untouched.

Proposed development topology: a **new** MongoDB replica-set container/volume,
unique Compose project/container/network names, loopback-only **different port**
(for example 27018, after checking availability), supported pinned image and
authenticated database access. One member suffices to test transactions locally
but does not establish production availability. Member advertised hostname must
be reachable by the Windows Node driver; verify discovery, authentication,
primary election and transactions before switching a separate test process.
Do not reuse the running Mongo container or its mounted data directory.
No public bind, unauthenticated replica-set exposure or machine-wide change.

## Preserve and restore first

1. Inventory database/collection counts, indexes, users, role/enrollment fields,
   academic references and PDF hashes. Exclude credentials from the report.
2. Schedule a quiescent local backup window (no labs/writes); obtain an
   authenticated logical backup to private, ignored, access-controlled storage.
   Never put credential-bearing URIs on a command line or in documentation.
   Standalone backups are not assumed to be consistent during concurrent writes.
3. Copy report files separately with a manifest; backups must include the DB
   metadata **and** files required by report download paths. Keep originals.
4. Restore into the **new isolated** replica-set database; verify counts/indexes,
   record/reference integrity, identity fields and file hashes, then perform an
   actual restore test. Do not restore over the current standalone database.
5. Preserve the current uncommitted environment securely; use an approved test
   environment/URI pointing at the new port/database, not an in-place migration.
   Start only one API process against each intended DB/lab runtime ownership set.
6. Roll back by stopping the experimental API, reverting only its configuration
   and returning to the untouched standalone baseline with writes still gated.
   Preserve experimental data for review. Once accepting real new writes on a
   different topology, rollback needs an explicit reconciliation/backup plan;
   never silently discard them by pointing back to an older database.

## Transaction and concurrency design to review

Persist a management version on accounts (explicit reviewed legacy migration;
never silently treat null as an accepted optimistic token). Introduce a shared,
durable policy guard written inside **every privileged mutation transaction**.
All API processes must participate. Guard write conflicts serialize decisions
that otherwise could exhibit last-admin write skew.

Each operation uses a Mongo session, supported transaction semantics, appropriate
snapshot read concern/majority commit write concern, and bounded retries for
transient conflicts/unknown commit outcomes according to driver labels. On each
retry reload the actor/target, current role/status, guard and policy predicates.
Never reuse a stale authorization decision from outside the transaction.

Within the same transaction:

- Validate active admin actor, self-demotion/self-deactivation prohibition,
  strict allowlisted fields and expected management version.
- Acquire/write the shared policy guard; check the active-admin invariant;
  reject disabling or demoting the last active admin. Guard all paths that can
  remove active-admin eligibility, not merely one controller.
- Apply POL-ADMIN-1 explicitly: reject faculty demotion while assigned students
  exist; student promotion clears teacherId/enrolledAt atomically without deleting
  academic history; student/faculty deactivation retains assignments. Confirm
  these pending policy choices before implementation; no implicit transfer.
- Serialize role/status changes affecting enrollment with assignment writers.
  All teacher/admin enrollment routes must write the same agreed guard (or an
  approved account-scoped coordination scheme) and validate current teacher and
  student eligibility inside the transaction. Otherwise keep those transitions
  blocked; a last-admin guard alone does not solve enrollment races.
- Mutate the account/version and insert a safe actor/account audit event before
  commit. If audit persistence fails, the account change rolls back. No partial
  create-then-audit sequence. Hash creation passwords without logging them;
  normalize email and rely on the real unique email index for contention.
- Preserve password hash/Google subject/academic records on unrelated updates.
  Response projections never include credentials or raw audit metadata.

Define successful no-op semantics, stale-version conflict, duplicate-email
conflict and retry exhaustion explicitly. Decide an approved request-id policy
for safe creation retries after unknown commit outcomes. Do not add speculative
endpoints; retain current POST/PATCH contracts or coordinate a reviewed change.
Return 401/403 for auth, 400 invalid input, 404 absent target, 409 policy/version/
duplicate conflict and an honest unavailable/retryable failure when appropriate.
Do not promise that copied stateless JWTs are revoked by a role change: current
database role/status must continue to govern each protected request.

## Required validation before opening the gate

- Real authenticated replica-set create/update, strict bodies, malformed/missing
  IDs, student/faculty denials and identity/credential redaction.
- Successful create plus exactly one atomic audit; duplicate normalization and
  competing same-email creates; unknown-commit/retry idempotency behavior.
- Stale-version contention: one version wins, other conflicts without side effects.
- Actor concurrently deactivated/demoted cannot keep making privileged writes.
- Self-demotion/deactivation rejected; single last-admin rejected; two active
  admins concurrently demoting/disabling each other cannot remove both admins.
  Repeat independent processes/sessions against real Mongo, not mocks only.
- Teacher demotion versus enrollment, student role update versus enrollment,
  inactive teacher, ownership transfer attempt, unchanged account/academic/PDF
  records after rejection/removal. Test every existing assignment entry point.
- Inject audit-write failure, transaction abort, primary interruption and retry
  exhaustion; prove rollback and no unaudited account state.
- Regression on public registration, password/Google identity, current-role
  authorization, student/teacher report access and Socket.IO ownership.
- Browser confirmation, disabled/pending states, error/retry, directory/metrics/
  audit cache refresh and session isolation at all four viewport sizes.
- Full tests/build/lint and isolated backup/restore/rollback rehearsal. Obtain
  explicit acceptance before any baseline URI switch or final gate enablement.

Risks: backup privacy, incomplete file restoration, driver hostname discovery,
write-conflict throughput, incomplete participation by another writer, stale
actor checks, cross-process races, audit duplication and unsafe rollback after
new writes. None is resolved merely by observing `hello.setName`.
