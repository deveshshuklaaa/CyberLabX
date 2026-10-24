import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../models/LabSession.js', () => ({ LabSession: { find: vi.fn() } }));
vi.mock('../models/Attempt.js', () => ({ Attempt: { updateMany: vi.fn() } }));
vi.mock('../services/vm/manager.js', () => ({ destroyVm: vi.fn(), getVmStatus: vi.fn() }));
import { LabSession } from '../models/LabSession.js';
import { Attempt } from '../models/Attempt.js';
import { destroyVm, getVmStatus } from '../services/vm/manager.js';
import { reapStoppedVms } from '../services/vm/reaper.js';
import { expireLabs } from '../services/labEngine.js';
const session = (status = 'running') => ({
  _id: 'session', attemptId: 'attempt', vmAttemptId: 'vm', status,
  expiresAt: new Date(Date.now() + 60000), save: vi.fn(),
});
beforeEach(() => vi.resetAllMocks());
describe('VM cleanup retries', () => {
  it('retains running VMs and destroys crashed VMs before clearing their resource reference', async () => {
    const running = session();
    vi.mocked(LabSession.find).mockResolvedValue([running] as any);
    vi.mocked(getVmStatus).mockResolvedValue(true);
    await reapStoppedVms();
    expect(destroyVm).not.toHaveBeenCalled();
    vi.mocked(getVmStatus).mockResolvedValue(false);
    await reapStoppedVms();
    expect(destroyVm).toHaveBeenCalledWith('vm');
    expect(running.status).toBe('failed');
    expect(running.vmAttemptId).toBeUndefined();
  });
  it('does not claim success or discard metadata if VM destruction fails', async () => {
    const stopping = session('stopping');
    vi.mocked(LabSession.find).mockResolvedValue([stopping] as any);
    vi.mocked(destroyVm).mockRejectedValue(new Error('still running'));
    await expect(reapStoppedVms()).rejects.toThrow('still running');
    expect(stopping.vmAttemptId).toBe('vm');
    expect(stopping.status).toBe('stopping');
    expect(stopping.save).not.toHaveBeenCalled();
  });
  it('preserves stop and expiry outcomes when retrying cleanup', async () => {
    const stopped = session('stopping'); const expired = session('stopping');
    expired.expiresAt = new Date(0);
    vi.mocked(LabSession.find).mockResolvedValue([stopped, expired] as any);
    await reapStoppedVms();
    expect(stopped.status).toBe('stopped'); expect(expired.status).toBe('expired');
    expect(Attempt.updateMany).toHaveBeenCalledWith(expect.anything(), { $set: { status: 'expired', completedAt: expect.any(Date) } });
  });
  it('leaves a failed TTL shutdown retryable and still expires another lab', async () => {
    const failed = session(); const expired = session();
    expired.vmAttemptId = 'vm-2';
    vi.mocked(LabSession.find).mockResolvedValue([failed, expired] as any);
    vi.mocked(destroyVm).mockRejectedValueOnce(new Error('monitor offline')).mockResolvedValue(undefined);
    await expireLabs();
    expect(failed.status).toBe('stopping'); expect(failed.vmAttemptId).toBe('vm');
    expect(expired.status).toBe('expired');
  });
});
