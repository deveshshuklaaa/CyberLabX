import Docker from 'dockerode';
import { env } from '../config/env.js';
import { LabSession } from '../models/LabSession.js';
import { Attempt } from '../models/Attempt.js';

const docker = process.platform === 'win32'
  ? new Docker({ socketPath: '//./pipe/docker_engine' })
  : new Docker({ socketPath: process.env.DOCKER_HOST || '/var/run/docker.sock' });

const safeName = (value: string) => value.replace(/[^a-zA-Z0-9_.-]/g, '').slice(-24);

/* Shared resource limits applied to every lab container */
const baseResources = {
  Memory: env.LAB_MEMORY_MB * 1024 * 1024,
  NanoCpus: env.LAB_CPU_NANOS,
  PidsLimit: 128,
  SecurityOpt: ['no-new-privileges:true'],
};

/**
 * Student (Kali) container:
 *   – NET_RAW is needed for raw-socket tools (nmap SYN scan, ping, etc.)
 */
const studentResources = {
  ...baseResources,
  CapDrop: ['ALL'],
  CapAdd: ['NET_RAW'],
};

/**
 * Target container:
 *   – NET_BIND_SERVICE is needed so lighttpd can bind to port 80
 *   – SETUID / SETGID are needed because lighttpd drops privileges
 *     after binding (standard daemon behaviour). These are
 *     privilege-*dropping* calls, not escalation, so they are safe
 *     even with no-new-privileges.
 *   – NET_RAW is NOT required (target doesn't run scans)
 */
const targetResources = {
  ...baseResources,
  CapDrop: ['ALL'],
  CapAdd: ['NET_BIND_SERVICE', 'SETUID', 'SETGID'],
};

/* ------------------------------------------------------------------ */
/*  Idempotent helper — never throws                                  */
/* ------------------------------------------------------------------ */
async function removeQuietly(fn: () => Promise<unknown>) {
  try { await fn(); } catch { /* idempotent cleanup */ }
}

/* ------------------------------------------------------------------ */
/*  Wait for a container to become healthy                            */
/* ------------------------------------------------------------------ */
async function waitForHealthy(containerId: string, timeoutMs = 60_000) {
  const finish = Date.now() + timeoutMs;
  while (Date.now() < finish) {
    const info = await docker.getContainer(containerId).inspect();
    const state = info.State;
    const healthStatus = state.Health?.Status;

    /* Container exited — fail fast with diagnostics */
    if (!state.Running) {
      const exitCode = state.ExitCode;
      const lastLog = state.Health?.Log?.slice(-1)[0]?.Output?.trim() ?? '(no health log)';
      throw new Error(
        `Target container exited before becoming healthy. ` +
        `ExitCode=${exitCode}, lastHealthLog="${lastLog}", ` +
        `containerName="${info.Name}"`
      );
    }

    /* Success */
    if (healthStatus === 'healthy' || !state.Health) return;

    /* Definitive failure from Docker's own retry logic */
    if (healthStatus === 'unhealthy') {
      const lastLog = state.Health?.Log?.slice(-1)[0]?.Output?.trim() ?? '(no health log)';
      throw new Error(
        `Target container health check failed. ` +
        `status="unhealthy", lastHealthLog="${lastLog}", ` +
        `containerName="${info.Name}"`
      );
    }

    /* healthStatus === 'starting' — keep waiting */
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error(
    `Target container timed out after ${timeoutMs}ms while waiting for healthy status.`
  );
}

/* ------------------------------------------------------------------ */
/*  Docker readiness check                                            */
/* ------------------------------------------------------------------ */
export async function assertDockerReady() {
  await docker.ping();
}

/* ------------------------------------------------------------------ */
/*  Provision a new lab environment                                   */
/* ------------------------------------------------------------------ */
export async function provisionLab(input: { attemptId: string; studentId: string }) {
  const tag = safeName(input.attemptId);
  const networkName = `${env.LAB_NETWORK_PREFIX}-${tag}`;
  const studentName = `cyberlabx-student-${tag}`;
  const targetName = `cyberlabx-target-${tag}`;

  let network: Docker.Network | undefined;
  let student: Docker.Container | undefined;
  let target: Docker.Container | undefined;

  try {
    network = await docker.createNetwork({
      Name: networkName,
      Driver: 'bridge',
      Internal: true,
      Labels: { 'com.cyberlabx.managed': 'true', 'com.cyberlabx.attempt': input.attemptId },
    });

    const labels = { 'com.cyberlabx.managed': 'true', 'com.cyberlabx.attempt': input.attemptId };

    target = await docker.createContainer({
      Image: env.TARGET_IMAGE,
      name: targetName,
      Hostname: 'nmap-target',
      HostConfig: { ...targetResources, NetworkMode: networkName },
      Labels: labels,
    });
    await target.start();
    await waitForHealthy(target.id);

    student = await docker.createContainer({
      Image: env.LAB_IMAGE,
      name: studentName,
      Hostname: 'kali-student',
      Cmd: ['/bin/bash'],
      Tty: true,
      OpenStdin: true,
      StdinOnce: false,
      HostConfig: { ...studentResources, NetworkMode: networkName },
      Labels: labels,
    });
    await student.start();

    const targetInspect = await target.inspect();
    const targetIp = targetInspect.NetworkSettings.Networks[networkName]?.IPAddress;
    if (!targetIp) throw new Error('Target IP was not allocated.');

    return { networkName, studentContainerId: student.id, targetContainerId: target.id, studentContainerName: studentName, targetContainerName: targetName, targetIp };
  } catch (error) {
    if (student) await removeQuietly(() => student!.remove({ force: true }));
    if (target) await removeQuietly(() => target!.remove({ force: true }));
    if (network) await removeQuietly(() => network!.remove());
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/*  Cleanup lab Docker resources — idempotent                         */
/* ------------------------------------------------------------------ */
export async function cleanupLab(session: {
  studentContainerId?: string;
  targetContainerId?: string;
  networkName?: string;
}) {
  if (session.studentContainerId) {
    await removeQuietly(() => docker.getContainer(session.studentContainerId!).remove({ force: true }));
  }
  if (session.targetContainerId) {
    await removeQuietly(() => docker.getContainer(session.targetContainerId!).remove({ force: true }));
  }
  if (session.networkName) {
    await removeQuietly(() => docker.getNetwork(session.networkName!).remove());
  }
}

/* ------------------------------------------------------------------ */
/*  Inspect whether a lab is still running                            */
/* ------------------------------------------------------------------ */
export async function inspectLab(session: { studentContainerId?: string }) {
  if (!session.studentContainerId) return false;
  try {
    return (await docker.getContainer(session.studentContainerId).inspect()).State.Running;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Get an interactive shell stream into a container                  */
/* ------------------------------------------------------------------ */
export async function getShellStream(containerId: string) {
  const exec = await docker.getContainer(containerId).exec({
    Cmd: ['/bin/bash', '-l'],
    AttachStdin: true, AttachStdout: true, AttachStderr: true, Tty: true,
  });
  return exec.start({ hijack: true, stdin: true });
}

/* ------------------------------------------------------------------ */
/*  Expire labs past their TTL                                        */
/* ------------------------------------------------------------------ */
export async function expireLabs() {
  const sessions = await LabSession.find({
    status: 'running',
    expiresAt: { $lte: new Date() },
  });
  for (const session of sessions) {
    await cleanupLab(session);
    session.status = 'expired';
    session.endedAt = new Date();
    await session.save();

    // Mark corresponding attempts
    await Attempt.updateMany(
      { _id: session.attemptId, status: 'running' },
      { $set: { status: 'expired', completedAt: new Date() } },
    );
  }
  return sessions.length;
}

/* ------------------------------------------------------------------ */
/*  Backend startup recovery — clean orphaned labs                    */
/* ------------------------------------------------------------------ */
export async function recoverOrphanedLabs() {
  let recovered = 0;

  /* ── 1. Recover stale DB sessions ─────────────────────────────── */
  const staleSessions = await LabSession.find({
    status: { $in: ['provisioning', 'running'] },
  });

  for (const session of staleSessions) {
    await cleanupLab(session);

    const newStatus = session.status === 'provisioning' ? 'failed' : 'expired';
    session.status = newStatus as typeof session.status;
    session.endedAt = new Date();
    session.failureReason = 'Recovered after server restart.';
    await session.save();

    await Attempt.updateMany(
      { _id: session.attemptId, status: 'running' },
      { $set: { status: newStatus === 'failed' ? 'failed' : 'expired', completedAt: new Date() } },
    );
    recovered++;
  }

  /* ── 2. Remove orphaned Docker containers by label ────────────── */
  try {
    const containers = await docker.listContainers({
      all: true,
      filters: { label: ['com.cyberlabx.managed=true'] },
    });

    // Get set of current active attempt IDs
    const activeSessions = await LabSession.find({ status: { $in: ['provisioning', 'running'] } });
    const activeAttemptIds = new Set(activeSessions.map(s => String(s.attemptId)));

    for (const c of containers) {
      const attemptId = c.Labels?.['com.cyberlabx.attempt'];
      if (!attemptId || !activeAttemptIds.has(attemptId)) {
        await removeQuietly(() => docker.getContainer(c.Id).remove({ force: true }));
      }
    }

    /* ── 3. Remove orphaned Docker networks by label ──────────── */
    const networks = await docker.listNetworks({
      filters: { label: ['com.cyberlabx.managed=true'] },
    });
    for (const n of networks) {
      const attemptId = n.Labels?.['com.cyberlabx.attempt'];
      if (!attemptId || !activeAttemptIds.has(attemptId)) {
        await removeQuietly(() => docker.getNetwork(n.Id).remove());
      }
    }
  } catch (err) {
    // Docker may not be available at startup — log and continue
    console.warn('Docker orphan cleanup skipped (Docker may be unavailable):', err instanceof Error ? err.message : err);
  }

  if (recovered > 0) {
    console.log(`Recovered ${recovered} orphaned lab session(s).`);
  }

  return recovered;
}
