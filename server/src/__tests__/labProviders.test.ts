import { beforeEach, describe, expect, it, vi } from 'vitest';
const docker = vi.hoisted(() => ({ ping: vi.fn() }));
vi.mock('dockerode', () => ({ default: vi.fn(() => docker) }));
vi.mock('../services/vm/manager.js', () => ({
  assertVmReady: vi.fn(), createVm: vi.fn(), destroyVm: vi.fn(), getVmStatus: vi.fn(),
}));
import { env } from '../config/env.js';
import { NMAP_LAB_DEFINITION, RECON_LAB_DEFINITION, DOS_LAB_DEFINITION, FILE_FORENSICS_LAB_DEFINITION } from '../models/Experiment.js';
import { labBackend, assertDockerReady, assertLabReady, provisionLab, cleanupLab, inspectLab } from '../services/labEngine.js';
import { assertVmReady, createVm, destroyVm, getVmStatus } from '../services/vm/manager.js';

describe('LabEngine provider boundary', () => {
  beforeEach(() => { vi.resetAllMocks(); env.LAB_BACKEND = 'docker'; });
  it('keeps Docker as the configured default', () => {
    expect(labBackend(NMAP_LAB_DEFINITION)).toBe('docker');
  });
  it('opts in only Nmap, retaining every other experiment on Docker', () => {
    env.LAB_BACKEND = 'qemu';
    expect(labBackend(NMAP_LAB_DEFINITION)).toBe('qemu');
    for (const lab of [RECON_LAB_DEFINITION, DOS_LAB_DEFINITION, FILE_FORENSICS_LAB_DEFINITION]) expect(labBackend(lab)).toBe('docker');
  });
  it('uses the selected readiness check without requiring host Docker for Kali', async () => {
    env.LAB_BACKEND = 'qemu';
    await assertLabReady(NMAP_LAB_DEFINITION);
    expect(assertVmReady).toHaveBeenCalledOnce();
    expect(docker.ping).not.toHaveBeenCalled();
    await assertLabReady(RECON_LAB_DEFINITION);
    await assertDockerReady();
    expect(docker.ping).toHaveBeenCalledTimes(2);
  });
  it('uses the persisted session expiry and returns the controlled guest target', async () => {
    env.LAB_BACKEND = 'qemu';
    const attemptId = '64b000000000000000000001';
    const studentId = '64b000000000000000000002';
    const expiresAt = new Date(Date.now() + 60000);
    vi.mocked(createVm).mockResolvedValue({ attemptId } as any);
    expect(await provisionLab({ attemptId, studentId, lab: NMAP_LAB_DEFINITION, expiresAt })).toEqual({ backend: 'qemu', vmAttemptId: attemptId, targetIp: '172.28.0.10' });
    expect(createVm).toHaveBeenCalledWith({ attemptId, studentId, profile: 'shell-target-v1', expiresAt });
  });
  it('fails a VM start visibly without silently substituting Docker', async () => {
    env.LAB_BACKEND = 'qemu';
    vi.mocked(createVm).mockRejectedValue(new Error('WHPX unavailable'));
    await expect(provisionLab({ attemptId: 'a', studentId: 'b', lab: NMAP_LAB_DEFINITION })).rejects.toThrow('WHPX unavailable');
    expect(docker.ping).not.toHaveBeenCalled();
  });
  it('cleans and inspects persisted VM sessions even after reverting the default to Docker', async () => {
    const session = { vmAttemptId: '64b000000000000000000001' };
    vi.mocked(getVmStatus).mockResolvedValue(true);
    expect(await inspectLab(session)).toBe(true);
    await cleanupLab(session);
    expect(destroyVm).toHaveBeenCalledWith(session.vmAttemptId);
    vi.mocked(destroyVm).mockRejectedValue(new Error('process still running'));
    await expect(cleanupLab(session)).rejects.toThrow('process still running');
  });
});
