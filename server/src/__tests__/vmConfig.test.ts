import { afterEach, describe, expect, it, vi } from 'vitest';
import net from 'node:net';
import path from 'node:path';
import { qemuArgs, vmConfig, type VmRecord } from '../services/vm/config.js';
import { reservePorts } from '../services/vm/ports.js';
import { vmDirectory } from '../services/vm/manager.js';

const vm: VmRecord = { id: '550e8400-e29b-41d4-a716-446655440000', name: 'somaiya-64b000000000000000000001',
  attemptId: '64b000000000000000000001', studentId: '64b000000000000000000002', profile: 'disk-forensics-v1',
  directory: 'C:/vm/attempt', overlay: 'C:/vm/attempt/os.qcow2', secondaryDisk: 'C:/vm/attempt/evidence.qcow2',
  qmpPort: 31001, sshPort: 31002, vncPort: 31003, createdAt: new Date().toISOString(), expiresAt: new Date().toISOString(),
  state: 'running', networkMode: 'nat', hostKeyHash: 'a'.repeat(64) };
afterEach(() => vi.unstubAllEnvs());
describe('QEMU generated configuration', () => {
  it('uses WHPX, private management endpoints and only virtual disks', () => {
    const args = qemuArgs(vm, vmConfig());
    expect(args).toContain('whpx');
    expect(args).toContain(`tcp:127.0.0.1:${vm.qmpPort},server=on,wait=off`);
    expect(args).toContain(`127.0.0.1:${vm.vncPort - 5900}`);
    expect(args.join(' ')).toContain(`hostfwd=tcp:127.0.0.1:${vm.sshPort}-:22`);
    expect(args.join(' ')).not.toMatch(/0\.0\.0\.0|virtfs|fsdev|docker\.sock|docker_engine|PhysicalDrive|nvme|usb-host/);
    expect(args.filter((_, i) => args[i - 1] === '-drive')).toEqual([
      'file=C:/vm/attempt/os.qcow2,format=qcow2,if=virtio', 'file=C:/vm/attempt/evidence.qcow2,format=qcow2,if=virtio']);
  });
  it('refuses unconfigured bridging and disallows QEMU suboption injection', () => {
    vi.stubEnv('VM_NETWORK_MODE', 'bridged');
    expect(() => qemuArgs(vm, vmConfig())).toThrow(/TAP/);
    vi.stubEnv('VM_TAP_ADAPTER', 'tap,script=evil');
    expect(() => vmConfig()).toThrow();
  });
  it('enforces bounded CPU, RAM and concurrency values', () => {
    for (const [key, value] of [['VM_CPUS', '200'], ['VM_MEMORY_MB', '500000'], ['VM_MAX_CONCURRENT', '0']]) {
      vi.stubEnv(key, value); expect(() => vmConfig()).toThrow(); vi.unstubAllEnvs();
    }
    expect(vmConfig().VM_MAX_CONCURRENT).toBe(1);
  });
  it('rejects path traversal attempt identities', () => {
    expect(() => vmDirectory('../base')).toThrow();
    expect(path.basename(vmDirectory(vm.attemptId))).toBe(vm.attemptId);
  });
  it('reserves distinct loopback ports until released', async () => {
    const lease = await reservePorts();
    try {
      expect(new Set(lease.ports).size).toBe(3);
      for (const port of lease.ports) {
        const other = net.createServer();
        const code = await new Promise<string>(resolve => {
          other.on('error', (error: NodeJS.ErrnoException) => resolve(error.code!));
          other.listen({ port, host: '127.0.0.1', exclusive: true }, () => { other.close(); resolve('bound'); });
        });
        expect(code).toBe('EADDRINUSE');
      }
    } finally { await lease.release(); }
  });
});
