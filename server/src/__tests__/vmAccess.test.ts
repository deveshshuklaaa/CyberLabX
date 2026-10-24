import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../models/LabSession.js', () => ({ LabSession: { findOne: vi.fn() } }));
vi.mock('../models/Attempt.js', () => ({ Attempt: { findOne: vi.fn() } }));
vi.mock('../services/vm/manager.js', () => ({ getVm: vi.fn() }));
import { LabSession } from '../models/LabSession.js';
import { Attempt } from '../models/Attempt.js';
import { getVm } from '../services/vm/manager.js';
import { authorizeVm } from '../services/vm/access.js';
const id = '64b000000000000000000001';
const student = '64b000000000000000000002';
beforeEach(() => vi.resetAllMocks());
describe('shared terminal and desktop VM authorization', () => {
  it('rejects another student without looking up any endpoint', async () => {
    vi.mocked(LabSession.findOne).mockResolvedValue(null);
    await expect(authorizeVm(id, student)).rejects.toThrow();
    expect(LabSession.findOne).toHaveBeenCalledWith(expect.objectContaining({ studentId: student, status: 'running', expiresAt: { $gt: expect.any(Date) } }));
    expect(getVm).not.toHaveBeenCalled();
  });
  it('requires the active attempt and matching VM owner', async () => {
    vi.mocked(LabSession.findOne).mockResolvedValue({ attemptId: id, vmAttemptId: id } as any);
    vi.mocked(Attempt.findOne).mockResolvedValue({ _id: id } as any);
    vi.mocked(getVm).mockResolvedValue({ attemptId: id, studentId: 'other', state: 'running', expiresAt: new Date(Date.now() + 10000).toISOString() } as any);
    await expect(authorizeVm(id, student)).rejects.toThrow(/ownership/);
  });
  it('allows the owner only before expiry', async () => {
    vi.mocked(LabSession.findOne).mockResolvedValue({ attemptId: id, vmAttemptId: id } as any);
    vi.mocked(Attempt.findOne).mockResolvedValue({ _id: id } as any);
    const vm = { attemptId: id, studentId: student, state: 'running', expiresAt: new Date(Date.now() + 10000).toISOString() } as any;
    vi.mocked(getVm).mockResolvedValue(vm);
    await expect(authorizeVm(id, student)).resolves.toHaveProperty('vm', vm);
    vm.expiresAt = new Date(0).toISOString();
    await expect(authorizeVm(id, student)).rejects.toThrow();
  });
});
