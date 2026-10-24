import { spawn, execFile, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash, randomUUID } from 'node:crypto';
import ssh2 from 'ssh2';
import { mkdir, readFile, writeFile, rename, readdir, rm, access, lstat, statfs } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { assertId, qemuArgs, vmConfig, type VmRecord } from './config.js';
import { reservePorts } from './ports.js';
import { qmp } from './qmp.js';
import { guestExec, openGuestShell } from './ssh.js';

const execute = promisify(execFile);
const { utils } = ssh2;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const children = new Map<string, ChildProcess>();
const connections = new Map<string, Set<() => void>>();
let queue: Promise<unknown> = Promise.resolve();
// All provisioning/cleanup is serialized; a second request cannot pass the capacity check.
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn); queue = next.catch(() => undefined); return next;
}

export function vmDirectory(attemptId: string) {
  assertId(attemptId);
  return path.resolve(vmConfig().VM_RUNTIME_DIR, attemptId);
}
async function persist(vm: VmRecord) {
  const dest = path.join(vm.directory, 'metadata.json');
  await writeFile(dest + '.tmp', JSON.stringify(vm, null, 2), { mode: 0o600 });
  await rename(dest + '.tmp', dest);
}
export async function getVm(attemptId: string): Promise<VmRecord> {
  const directory = vmDirectory(attemptId);
  if ((await lstat(directory)).isSymbolicLink()) throw new Error('VM directory must not be a link.');
  const vm = JSON.parse(await readFile(path.join(directory, 'metadata.json'), 'utf8')) as VmRecord;
  if (vm.attemptId !== attemptId || vm.directory !== directory || vm.name !== `somaiya-${attemptId}` ||
    !/^[a-f\d-]{36}$/i.test(vm.id) || vm.overlay !== path.join(directory, 'os.qcow2') ||
    (vm.secondaryDisk && vm.secondaryDisk !== path.join(directory, 'evidence.qcow2')) ||
    ![vm.sshPort, vm.vncPort, vm.qmpPort].every(p => Number.isInteger(p) && p >= 5900 && p <= 65535)) {
    throw new Error('Invalid VM recovery metadata.');
  }
  return vm;
}

export async function assertVmReady() {
  const config = vmConfig();
  if (process.platform !== 'win32') throw new Error('The Kali VM backend requires Windows with WHPX.');
  await access(config.VM_BASE_IMAGE);
  const manifest = JSON.parse(await readFile(config.VM_BASE_IMAGE + '.json', 'utf8'));
  if (manifest.prepared !== true || manifest.schema !== 1) throw new Error('Kali base image has not been finalized.');
  const { stdout } = await execute(config.QEMU_BINARY, ['-accel', 'help'], { windowsHide: true, timeout: 10000 });
  if (!stdout.includes('whpx')) throw new Error('This QEMU build does not support WHPX.');
  await execute(config.QEMU_IMG_BINARY, ['--version'], { windowsHide: true, timeout: 10000 });
  if (config.VM_NETWORK_MODE === 'bridged') {
    const { stdout: adapters } = await execute('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      'Get-NetAdapter -IncludeHidden | Select-Object Name,InterfaceDescription | ConvertTo-Json -Compress'], { windowsHide: true, timeout: 10000 });
    const value = JSON.parse(adapters || '[]');
    if (!(Array.isArray(value) ? value : [value]).some(a => a.Name === config.VM_TAP_ADAPTER && /tap/i.test(a.InterfaceDescription))) {
      throw new Error('Configured TAP adapter was not detected. Configure the Windows bridge before enabling bridged mode.');
    }
  }
  if (os.freemem() / 1048576 < config.VM_MEMORY_MB + config.VM_HOST_RESERVE_MB) {
    throw new Error(`Insufficient free RAM: ${Math.floor(os.freemem() / 1048576)} MB available; Kali requires ${config.VM_MEMORY_MB} MB plus ${config.VM_HOST_RESERVE_MB} MB host headroom.`);
  }
}

async function managedProcesses(): Promise<{ pid: number; command: string }[]> {
  if (process.platform !== 'win32') return [];
  const { stdout } = await execute('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    "Get-CimInstance Win32_Process -Filter \"Name='qemu-system-x86_64.exe'\" | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress"], { windowsHide: true, timeout: 15000 });
  if (!stdout.trim()) return [];
  const value = JSON.parse(stdout);
  return (Array.isArray(value) ? value : [value]).map(v => ({ pid: v.ProcessId, command: v.CommandLine ?? '' }));
}
function matchesProcess(vm: VmRecord, p: { pid: number; command: string }) {
  return p.command.includes(vm.name) && p.command.includes(vm.id) && p.command.includes(vm.overlay);
}

async function destroy(vm: VmRecord) {
  vm.state = 'stopping'; await persist(vm);
  for (const close of connections.get(vm.attemptId) ?? []) close();
  connections.delete(vm.attemptId);
  // Authenticate the monitor by QEMU UUID before issuing a lifecycle command.
  try {
    const identity = await qmp(vm.qmpPort, 'query-uuid') as { UUID: string };
    if (identity.UUID !== vm.id) throw new Error('QMP VM identity mismatch.');
    await qmp(vm.qmpPort, 'system_powerdown');
    for (let i = 0; i < 10; i++) {
      await delay(500);
      if (!(await managedProcesses()).some(p => matchesProcess(vm, p))) break;
    }
    // Disposable VM: bounded graceful shutdown, then QMP quit.
    const remaining = (await managedProcesses()).some(p => matchesProcess(vm, p));
    if (remaining) await qmp(vm.qmpPort, 'quit');
  } catch (error) {
    if ((await managedProcesses()).some(p => matchesProcess(vm, p))) console.warn('QMP shutdown failed for managed VM:', vm.name, error);
  }
  await delay(200);
  for (const p of await managedProcesses()) {
    if (matchesProcess(vm, p)) {
      // Last resort only, after checking full identity; never kill by a stale PID alone.
      process.kill(p.pid);
    }
  }
  for (let i = 0; i < 20; i++) {
    if (!(await managedProcesses()).some(p => matchesProcess(vm, p))) break;
    await delay(250);
  }
  if ((await managedProcesses()).some(p => matchesProcess(vm, p))) throw new Error('VM is still running; disks retained for recovery.');
  children.delete(vm.attemptId);
  const expected = vmDirectory(vm.attemptId);
  if (vm.directory !== expected || (await lstat(expected)).isSymbolicLink()) throw new Error('Unsafe VM cleanup path.');
  await rm(expected, { recursive: true, force: true });
}

export function createVm(input: { attemptId: string; studentId: string; profile: string; expiresAt: Date }) {
  return exclusive(async () => {
    assertId(input.attemptId); assertId(input.studentId);
    if (input.expiresAt.getTime() <= Date.now()) throw new Error('Lab session has expired.');
    await assertVmReady();
    const config = vmConfig();
    await mkdir(config.VM_RUNTIME_DIR, { recursive: true, mode: 0o700 });
    const diskSpace = await statfs(config.VM_RUNTIME_DIR);
    if (diskSpace.bavail * diskSpace.bsize < config.VM_MIN_FREE_DISK_GB * 1024 ** 3) throw new Error('Insufficient free disk space for a Kali attempt.');
    const records = (await readdir(config.VM_RUNTIME_DIR)).filter(name => /^[a-f\d]{24}$/i.test(name));
    if (records.length >= config.VM_MAX_CONCURRENT) throw new Error('Kali VM capacity reached. Stop an existing lab first.');
    const reservation = await reservePorts();
    const directory = vmDirectory(input.attemptId);
    try { await mkdir(directory, { mode: 0o700 }); }
    catch (error) { await reservation.release(); throw error; }
    const identity = utils.generateKeyPairSync('ed25519');
    const host = utils.generateKeyPairSync('ed25519');
    const vm: VmRecord = {
      id: randomUUID(), name: `somaiya-${input.attemptId}`, ...input,
      directory, overlay: path.join(directory, 'os.qcow2'),
      ...(input.profile === 'disk-forensics-v1' ? { secondaryDisk: path.join(directory, 'evidence.qcow2') } : {}),
      qmpPort: reservation.ports[0], sshPort: reservation.ports[1], vncPort: reservation.ports[2],
      createdAt: new Date().toISOString(), expiresAt: input.expiresAt.toISOString(), state: 'creating',
      networkMode: config.VM_NETWORK_MODE,
      hostKeyHash: createHash('sha256').update(Buffer.from(host.public.split(' ')[1], 'base64')).digest('hex'),
    };
    try {
      await persist(vm); // Durable intent before creating disks or spawning QEMU.
      await writeFile(path.join(directory, 'identity'), identity.private, { mode: 0o600 });
      await writeFile(path.join(directory, 'guest.json'), JSON.stringify({
        attemptId: vm.attemptId, profile: vm.profile, publicKey: identity.public,
        hostPrivateKey: host.private, hostPublicKey: host.public,
      }), { mode: 0o600 });
      await execute(config.QEMU_IMG_BINARY, ['create', '-f', 'qcow2', '-F', 'qcow2', '-b', path.resolve(config.VM_BASE_IMAGE), vm.overlay], { windowsHide: true, timeout: 30000 });
      if (vm.secondaryDisk) await execute(config.QEMU_IMG_BINARY, ['create', '-f', 'qcow2', vm.secondaryDisk, '2G'], { windowsHide: true, timeout: 30000 });
      vm.state = 'starting'; await persist(vm);
      await reservation.release();
      const child = spawn(config.QEMU_BINARY, qemuArgs(vm, config), { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
      children.set(vm.attemptId, child);
      let failure = '';
      child.stderr?.on('data', data => { failure = (failure + data.toString()).slice(-8000); });
      child.on('error', error => { failure = error.message; });
      child.once('exit', () => {
        for (const close of connections.get(vm.attemptId) ?? []) close();
        connections.delete(vm.attemptId);
      });
      vm.pid = child.pid; await persist(vm);
      const deadline = Date.now() + config.VM_BOOT_TIMEOUT_MS;
      while (Date.now() < deadline) {
        if (!child.pid || child.exitCode !== null) throw new Error(`QEMU exited: ${failure}`);
        try {
          const output = await guestExec(vm, 'cat /etc/os-release; test -f /run/somaiya-ready');
          if (!/^ID=kali$/m.test(output)) throw new Error('Guest is not Kali Linux.');
          if (vm.profile === 'shell-target-v1') {
            // Ready means Kali and its controlled HTTP target are actually usable.
            await guestExec(vm, 'sudo -n nmap -sT -Pn -p 80 nmap-target -oG - | grep "80/open"');
          }
          if (Date.parse(vm.expiresAt) <= Date.now()) throw new Error('Lab expired during VM startup.');
          vm.state = 'running'; await persist(vm); return vm;
        } catch { await delay(2000); }
      }
      throw new Error(`Kali boot timed out. ${failure}`);
    } catch (error) {
      await reservation.release().catch(() => undefined);
      await destroy(vm); throw error;
    }
  });
}

export const destroyVm = (attemptId: string) => exclusive(async () => {
  try { await destroy(await getVm(attemptId)); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    const directory = vmDirectory(attemptId);
    const info = await lstat(directory).catch(e => { if (e.code === 'ENOENT') return null; throw e; });
    if (!info) return;
    if (info.isSymbolicLink()) throw new Error('Unsafe orphan directory.');
    // Crash before the first metadata rename: remove files only when no process references them.
    if ((await managedProcesses()).some(p => p.command.includes(directory))) throw new Error('Orphan VM is missing metadata; operator recovery required.');
    await rm(directory, { recursive: true, force: true });
  }
});
export async function getVmStatus(attemptId: string) {
  try {
    const vm = await getVm(attemptId);
    const identity = await qmp(vm.qmpPort, 'query-uuid') as { UUID: string };
    const status = await qmp(vm.qmpPort, 'query-status') as { running: boolean };
    return vm.state === 'running' && vm.id === identity.UUID && status.running;
  } catch { return false; }
}

export function trackConnection(attemptId: string, close: () => void) {
  const set = connections.get(attemptId) ?? new Set(); set.add(close); connections.set(attemptId, set);
  return () => { set.delete(close); if (!set.size) connections.delete(attemptId); };
}
export async function openTerminal(attemptId: string) {
  const vm = await getVm(attemptId);
  if (vm.state !== 'running' || Date.parse(vm.expiresAt) <= Date.now()) throw new Error('VM is inactive.');
  const shell = await openGuestShell(vm);
  const expiry = setTimeout(shell.close, Math.max(1, Date.parse(vm.expiresAt) - Date.now()));
  shell.output.once('close', () => clearTimeout(expiry));
  const untrack = trackConnection(attemptId, shell.close); shell.output.once('close', untrack);
  return shell;
}

/** Startup deliberately expires all prior sessions, including active DB attempts. */
export async function recoverOrphanedVms() {
  const config = vmConfig();
  await mkdir(config.VM_RUNTIME_DIR, { recursive: true, mode: 0o700 });
  const names = (await readdir(config.VM_RUNTIME_DIR)).filter(n => /^[a-f\d]{24}$/i.test(n));
  for (const name of names) await destroyVm(name);
  const root = path.resolve(config.VM_RUNTIME_DIR);
  const untracked = (await managedProcesses()).filter(p => p.command.includes(root) && /somaiya-[a-f\d]{24}/i.test(p.command));
  // Missing/corrupt metadata is an operator-recoverable failure, never a broad process kill.
  if (untracked.length) throw new Error('Managed QEMU processes remain without valid metadata; startup blocked for safe recovery.');
  console.log(`VM recovery: removed ${names.length} prior attempt(s).`);
  return names.length;
}
