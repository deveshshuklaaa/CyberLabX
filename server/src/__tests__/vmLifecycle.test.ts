import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const mocks = vi.hoisted(() => ({ execute: vi.fn(), spawn: vi.fn(), qmp: vi.fn(), guest: vi.fn() }));
vi.mock('node:child_process', async () => {
  const { promisify } = await import('node:util');
  const execFile = Object.assign(vi.fn(), { [promisify.custom]: mocks.execute });
  return { execFile, spawn: mocks.spawn };
});
vi.mock('../services/vm/qmp.js', () => ({ qmp: mocks.qmp }));
vi.mock('../services/vm/ssh.js', () => ({ guestExec: mocks.guest }));
import { createVm, destroyVm, getVm, recoverOrphanedVms } from '../services/vm/manager.js';
import { EventEmitter } from 'node:events';

let directory: string;
const platform = process.platform;
const first = '64b000000000000000000001';
const second = '64b000000000000000000002';
const input = (attemptId = first) => ({ attemptId, studentId: '64b000000000000000000003', profile: 'disk-forensics-v1', expiresAt: new Date(Date.now() + 60000) });
beforeEach(async () => {
  vi.resetAllMocks();
  Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
  vi.spyOn(os, 'freemem').mockReturnValue(12 * 1024 ** 3);
  directory = await mkdtemp(path.join(os.tmpdir(), 'somaiya-vm-test-'));
  const base = path.join(directory, 'base.qcow2');
  await writeFile(base, 'unit-test-base');
  await writeFile(base + '.json', '{"schema":1,"prepared":true}');
  vi.stubEnv('VM_BASE_IMAGE', base);
  vi.stubEnv('VM_RUNTIME_DIR', path.join(directory, 'runtime'));
  vi.stubEnv('VM_MAX_CONCURRENT', '1');
  mocks.execute.mockImplementation(async (binary: string, args: string[]) => ({ stdout: args.includes('help') ? 'whpx tcg' : binary === 'powershell.exe' ? '' : '' }));
  mocks.spawn.mockImplementation(() => Object.assign(new EventEmitter(), { pid: 12345, exitCode: null, stderr: new EventEmitter() }));
  mocks.guest.mockResolvedValue('ID=kali\n');
  mocks.qmp.mockRejectedValue(new Error('offline'));
});
afterEach(async () => {
  // The only recursively removed tree is the exact mkdtemp result, never a derived parent.
  await rm(directory, { recursive: true, force: true });
  Object.defineProperty(process, 'platform', { value: platform, configurable: true });
  vi.restoreAllMocks(); vi.unstubAllEnvs();
});
describe('VM lifecycle with mocked hypervisor', () => {
  it('creates a backing overlay and synthetic secondary disk, then removes only the attempt', async () => {
    const vm = await createVm(input());
    expect(vm.state).toBe('running');
    expect(mocks.execute).toHaveBeenCalledWith('qemu-img', ['create', '-f', 'qcow2', '-F', 'qcow2', '-b', path.join(directory, 'base.qcow2'), vm.overlay], expect.anything());
    expect(mocks.execute).toHaveBeenCalledWith('qemu-img', ['create', '-f', 'qcow2', vm.secondaryDisk, '2G'], expect.anything());
    expect((await getVm(first)).pid).toBe(12345);
    await destroyVm(first);
    expect(await readdir(path.join(directory, 'runtime'))).toEqual([]);
    expect(await readFile(path.join(directory, 'base.qcow2'), 'utf8')).toBe('unit-test-base');
  });
  it('serializes simultaneous requests and enforces capacity before spawning', async () => {
    const result = await Promise.allSettled([createVm(input()), createVm(input(second))]);
    expect(result.map(r => r.status)).toEqual(['fulfilled', 'rejected']);
    expect(mocks.spawn).toHaveBeenCalledTimes(1);
  });
  it('generates distinct VM identities, credentials and host keys', async () => {
    vi.stubEnv('VM_MAX_CONCURRENT', '2');
    const a = await createVm(input()); const b = await createVm(input(second));
    expect(a.id).not.toBe(b.id); expect(a.hostKeyHash).not.toBe(b.hostKeyHash);
    expect(await readFile(path.join(a.directory, 'identity'), 'utf8')).not.toBe(await readFile(path.join(b.directory, 'identity'), 'utf8'));
  });
  it('removes partial resources after image creation fails', async () => {
    mocks.execute.mockImplementation(async (_binary: string, args: string[]) => {
      if (args[0] === 'create') throw new Error('disk full');
      return { stdout: args.includes('help') ? 'whpx' : '' };
    });
    await expect(createVm(input())).rejects.toThrow('disk full');
    expect(await readdir(path.join(directory, 'runtime'))).toEqual([]);
    expect(mocks.spawn).not.toHaveBeenCalled();
  });
  it('reclaims prior metadata on restart and leaves unrelated QEMU untouched', async () => {
    await createVm(input());
    mocks.execute.mockImplementation(async (binary: string) => ({ stdout: binary === 'powershell.exe' ? JSON.stringify({ ProcessId: 999, CommandLine: 'qemu-system-x86_64.exe -name unrelated' }) : '' }));
    const kill = vi.spyOn(process, 'kill');
    expect(await recoverOrphanedVms()).toBe(1);
    expect(kill).not.toHaveBeenCalled();
  });
  it('rejects metadata that redirects deletion outside its attempt directory', async () => {
    const vm = await createVm(input());
    await writeFile(path.join(vm.directory, 'metadata.json'), JSON.stringify({ ...vm, directory }));
    await expect(destroyVm(first)).rejects.toThrow('Invalid VM recovery metadata');
    expect(await readFile(path.join(directory, 'base.qcow2'), 'utf8')).toBe('unit-test-base');
  });
  it('refuses low memory before any disk or process mutation', async () => {
    vi.mocked(os.freemem).mockReturnValue(1024 ** 3);
    await expect(createVm(input())).rejects.toThrow('Insufficient free RAM');
    expect(mocks.spawn).not.toHaveBeenCalled();
  });
  it('removes a pre-spawn orphan directory with incomplete metadata', async () => {
    const orphan = path.join(directory, 'runtime', first);
    await mkdir(orphan, { recursive: true });
    await writeFile(path.join(orphan, 'metadata.json.tmp'), '{}');
    await destroyVm(first);
    expect(await readdir(path.join(directory, 'runtime'))).toEqual([]);
  });
});
