import { describe, expect, it, vi } from 'vitest';
vi.mock('../services/vm/access.js', () => ({ authorizeVm: vi.fn() }));
vi.mock('../services/vm/ssh.js', () => ({ guestExec: vi.fn() }));
import { hasNmapEvidence, inspectVmTask } from '../services/vm/verification.js';
import { authorizeVm } from '../services/vm/access.js';
import { guestExec } from '../services/vm/ssh.js';
import { validateTask } from '../services/gradingEngine.js';

const done = 'Nmap done: 1 IP address (1 host up) scanned in 1.0 seconds\r\n';
describe('real Kali Nmap evidence', () => {
  it.each([
    ['live-host', 'sudo nmap -sn nmap-target', 'Host is up.\n' + done],
    ['syn-scan', 'sudo nmap -sS -p 80 nmap-target', '80/tcp open http\n' + done],
    ['os-detection', 'sudo nmap -O -p 80,81 nmap-target', 'No exact OS matches for host\n' + done],
    ['service-detection', 'nmap -sV -p 80 nmap-target', '80/tcp open http lighttpd\n' + done],
  ])('accepts completed controlled-target evidence for %s', (id, command, output) => {
    expect(hasNmapEvidence(id, command, output)).toBe(true);
  });
  it.each([
    ['sudo nmap -sS nmap-target', 'You requested a scan type which requires root privileges.'],
    ['nmap -sS --help nmap-target', done],
    ['nmap -sS example.com', done],
    ['nmap -sS nmap-target example.com', done],
    ['nmap -sS nmap-target; echo spoof', done],
    ['nmap -sS nmap-target', '80/tcp closed http\n' + done],
    ['nmap -sS nmap-target', '80/tcp open http\n'],
  ])('rejects failed, incomplete or unrelated evidence: %s', (command, output) => {
    expect(hasNmapEvidence('syn-scan', command, output)).toBe(false);
  });
  it('supports sudo in existing grading while rejecting executable prefix lookalikes', () => {
    const task = { marks: 15, verification: [{ type: 'command', tool: 'nmap', requiredArgs: ['-sS'] }] } as any;
    expect(validateTask(task, 'sudo nmap -sS nmap-target', '').passed).toBe(true);
    expect(validateTask(task, 'nmap-fake -sS nmap-target', '').passed).toBe(false);
  });
  it('checks ownership before inspecting only the fixed guest target', async () => {
    const vm = { profile: 'shell-target-v1' };
    vi.mocked(authorizeVm).mockResolvedValue({ vm } as any);
    vi.mocked(guestExec).mockResolvedValue('80/open');
    expect(await inspectVmTask('session', 'owner')).toBe(true);
    expect(authorizeVm).toHaveBeenCalledWith('session', 'owner');
    expect(guestExec).toHaveBeenCalledWith(vm, expect.stringContaining('nmap-target'));
    vi.mocked(guestExec).mockRejectedValue(new Error('unreachable'));
    expect(await inspectVmTask('session', 'owner')).toBe(false);
  });
});
