import Docker from 'dockerode';
import { Transform } from 'node:stream';
import { env } from '../config/env.js';
import { LabSession } from '../models/LabSession.js';
import { Attempt } from '../models/Attempt.js';
import type { LabDefinition } from '../models/Experiment.js';

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
const clientResources = { ...baseResources, CapDrop: ['ALL'] };

/*
 * Experiments select stable image keys; only this server-side registry maps
 * those keys to Docker images.  Database content can never supply an image
 * reference, registry, tag, volume, or other Docker option directly.
 */
const approvedImages = {
  'kali-nmap': env.LAB_IMAGE,
  'nmap-http-target': env.TARGET_IMAGE,
  'kali-dos-attacker': env.DOS_ATTACKER_IMAGE,
  'dos-http-victim': env.DOS_VICTIM_IMAGE,
  'dos-legitimate-client': env.DOS_CLIENT_IMAGE,
  'kali-recon': env.RECON_STUDENT_IMAGE,
  'recon-target': env.RECON_TARGET_IMAGE,
  'kali-keylogger-lab': env.KEYLOGGER_IMAGE,
  'kali-email-forensics': env.EMAIL_FORENSICS_IMAGE,
  'kali-file-forensics': env.FILE_FORENSICS_IMAGE,
  'kali-disk-forensics': env.DISK_FORENSICS_IMAGE,
} as const;

export function resolveLabDefinition(lab: unknown) {
  if (!lab || typeof lab !== 'object') {
    throw new Error('Experiment is missing a valid lab definition. Run the experiment data migration before starting this lab.');
  }

  const definition = lab as Partial<LabDefinition>;
  if (definition.profile === 'dos-analysis-v1') {
    const resources = (definition as Extract<LabDefinition, { profile: 'dos-analysis-v1' }>).resources;
    if (!Array.isArray(resources) || resources.length !== 3) throw new Error('DoS lab definition requires three approved resources.');
    const expected = ['student:kali-dos-attacker:attacker', 'victim:dos-http-victim:victim', 'legitimate-client:dos-legitimate-client:legitimate-client'];
    if (!resources.every((resource, index) => `${resource.role}:${resource.imageKey}:${resource.hostname}` === expected[index])) throw new Error('Lab definition references an unsupported resource configuration.');
    const resolved = resources.map(resource => ({
      role: resource.role,
      imageKey: resource.imageKey,
      hostname: resource.hostname,
      displayName: resource.displayName,
      image: approvedImages[resource.imageKey as keyof typeof approvedImages],
    }));
    if (resolved.some(resource => !resource.image)) throw new Error('Lab definition references an unsupported image key.');
    return { profile: 'dos-analysis-v1' as const, resources: resolved };
  }

  if (definition.profile === 'shell-target-v1' || definition.profile === 'recon-v1') {
    if (!definition.target || !definition.terminal) {
      throw new Error('Experiment lab definition is incomplete. Run the experiment data migration before starting this lab.');
    }

    const studentImage = approvedImages[definition.studentImageKey as keyof typeof approvedImages];
    const targetImage = approvedImages[definition.target.imageKey as keyof typeof approvedImages];
    if (!studentImage || !targetImage) {
      throw new Error('Lab definition references an unsupported image key.');
    }

    return {
      profile: definition.profile,
      studentImage,
      targetImage,
      targetHostname: definition.target.hostname,
      targetDisplayName: definition.target.displayName,
    };
  }

  if (['keylogger-lab-v1', 'email-forensics-v1', 'file-forensics-v1', 'disk-forensics-v1'].includes(definition.profile as string)) {
    const studentImageKey = (definition as { studentImageKey?: string }).studentImageKey;
    const studentImage = approvedImages[studentImageKey as keyof typeof approvedImages];
    if (!studentImage) {
      throw new Error('Lab definition references an unsupported image key.');
    }

    return {
      profile: definition.profile as 'keylogger-lab-v1' | 'email-forensics-v1' | 'file-forensics-v1' | 'disk-forensics-v1',
      studentImage,
    };
  }

  throw new Error(`Unsupported lab profile: ${String(definition.profile)}`);
}

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
export async function provisionLab(input: { attemptId: string; studentId: string; lab: LabDefinition }) {
  const resolved = resolveLabDefinition(input.lab);
  const tag = safeName(input.attemptId);
  const networkName = `${env.LAB_NETWORK_PREFIX}-${tag}`;
  const studentName = `cyberlabx-student-${tag}`;
  const targetName = `cyberlabx-target-${tag}`;

  let network: Docker.Network | undefined;
  let student: Docker.Container | undefined;
  let target: Docker.Container | undefined;
  const created: Docker.Container[] = [];

  try {
    network = await docker.createNetwork({
      Name: networkName,
      Driver: 'bridge',
      Internal: true,
      Labels: { 'com.cyberlabx.managed': 'true', 'com.cyberlabx.attempt': input.attemptId },
    });

    const labels = { 'com.cyberlabx.managed': 'true', 'com.cyberlabx.attempt': input.attemptId };

    if (resolved.profile === 'dos-analysis-v1') {
      const containers: Record<string, Docker.Container> = {};
      const names: Record<string, string> = {};
      for (const resource of resolved.resources) {
        const name = `cyberlabx-${resource.role}-${tag}`;
        names[resource.role] = name;
        const resourceLabels = { ...labels, 'com.cyberlabx.role': resource.role };
        const isStudent = resource.role === 'student';
        const container = await docker.createContainer({
          Image: resource.image, name, Hostname: resource.hostname,
          ...(isStudent ? { Tty: true, OpenStdin: true, StdinOnce: false } : {}),
          HostConfig: { ...(isStudent ? studentResources : resource.role === 'victim' ? targetResources : clientResources), NetworkMode: networkName },
          Labels: resourceLabels,
        });
        containers[resource.role] = container;
        created.push(container);
        await container.start();
        if (resource.role === 'victim') await waitForHealthy(container.id);
      }
      const victim = containers.victim;
      const attacker = containers.student;
      const victimIp = (await victim.inspect()).NetworkSettings.Networks[networkName]?.IPAddress;
      if (!victimIp) throw new Error('Victim IP was not allocated.');
      return {
        networkName, studentContainerId: attacker.id, targetContainerId: victim.id,
        studentContainerName: names.student, targetContainerName: names.victim, targetIp: victimIp,
        resources: resolved.resources.map(resource => ({ role: resource.role, containerId: containers[resource.role].id, name: names[resource.role], hostname: resource.hostname, displayName: resource.displayName })),
      };
    }

    if (['keylogger-lab-v1', 'email-forensics-v1', 'file-forensics-v1', 'disk-forensics-v1'].includes(resolved.profile)) {
      student = await docker.createContainer({
        Image: (resolved as { studentImage: string }).studentImage,
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
      return { networkName, studentContainerId: student.id, studentContainerName: studentName };
    }

    const { studentImage, targetImage, targetHostname } = resolved as { studentImage: string; targetImage: string; targetHostname: string };

    target = await docker.createContainer({
      Image: targetImage,
      name: targetName,
      Hostname: targetHostname,
      HostConfig: { ...targetResources, NetworkMode: networkName },
      Labels: labels,
    });
    await target.start();
    await waitForHealthy(target.id);

    student = await docker.createContainer({
      Image: studentImage,
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
    for (const container of created) await removeQuietly(() => container.remove({ force: true }));
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
  resources?: { containerId: string }[];
}) {
  for (const resource of session.resources ?? []) {
    await removeQuietly(() => docker.getContainer(resource.containerId).remove({ force: true }));
  }
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
/*  Docker exec output demultiplexing                                  */
/* ------------------------------------------------------------------ */
/*
 * Docker Desktop can send exec output in Docker's eight-byte framed
 * format even when the exec request asks for a TTY.  Pass ordinary PTY
 * output through untouched, but remove only confirmed Docker framing.
 */
class DockerExecOutputDemuxer extends Transform {
  private pending = Buffer.alloc(0);
  private multiplexed: boolean | undefined;

  private isFrameHeader(buffer: Buffer) {
    return buffer.length >= 8 &&
      (buffer[0] === 0 || buffer[0] === 1 || buffer[0] === 2) &&
      buffer[1] === 0 && buffer[2] === 0 && buffer[3] === 0;
  }

  override _transform(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void) {
    this.pending = Buffer.concat([this.pending, chunk]);

    if (this.multiplexed === undefined) {
      if (this.pending.length < 8) return callback();
      this.multiplexed = this.isFrameHeader(this.pending);
      if (!this.multiplexed) {
        this.push(this.pending);
        this.pending = Buffer.alloc(0);
        return callback();
      }
    }

    if (!this.multiplexed) {
      this.push(this.pending);
      this.pending = Buffer.alloc(0);
      return callback();
    }

    while (this.pending.length >= 8) {
      const payloadLength = this.pending.readUInt32BE(4);
      if (this.pending.length < 8 + payloadLength) break;
      this.push(this.pending.subarray(8, 8 + payloadLength));
      this.pending = this.pending.subarray(8 + payloadLength);
    }
    callback();
  }

  override _flush(callback: (error?: Error | null) => void) {
    if (this.multiplexed === false && this.pending.length) this.push(this.pending);
    this.pending = Buffer.alloc(0);
    callback();
  }
}

export function createDockerExecOutputDemuxer() {
  return new DockerExecOutputDemuxer();
}

/* ------------------------------------------------------------------ */
/*  Get an interactive shell stream into a container                  */
/* ------------------------------------------------------------------ */
export async function getShellStream(containerId: string, user?: string) {
  const exec = await docker.getContainer(containerId).exec({
    Cmd: ['/bin/bash', '-l'],
    ...(user ? { User: user } : {}),
    AttachStdin: true, AttachStdout: true, AttachStderr: true, Tty: true,
  });
  const input = await exec.start({ hijack: true, stdin: true });
  const output = createDockerExecOutputDemuxer();
  input.on('data', chunk => output.write(chunk));
  input.on('end', () => output.end());
  input.on('close', () => output.end());
  input.on('error', error => output.destroy(error));
  return { input, output };
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
