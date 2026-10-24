import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('bcrypt', () => ({ default: { compare: vi.fn() } }));
vi.mock('../models/User.js', () => ({ User: { findOne: vi.fn() } }));
import bcrypt from 'bcrypt';
import { User } from '../models/User.js';
import { authenticate } from '../services/authService.js';
beforeEach(() => vi.resetAllMocks());
describe('password authentication compatibility', () => {
  it('rejects Google-only accounts without attempting to compare an absent password', async () => {
    vi.mocked(User.findOne).mockReturnValue({ select: vi.fn().mockResolvedValue({ googleId: 'subject', isActive: true }) } as any);
    expect(await authenticate('google@example.test', 'any-password')).toBeNull();
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });
  it('continues authenticating existing local accounts', async () => {
    const user = { passwordHash: 'existing-hash', isActive: true, role: 'faculty' };
    vi.mocked(User.findOne).mockReturnValue({ select: vi.fn().mockResolvedValue(user) } as any);
    vi.mocked(bcrypt.compare).mockImplementation(async () => true);
    expect(await authenticate(' Teacher@Example.Test ', 'local-password')).toBe(user);
    expect(User.findOne).toHaveBeenCalledWith({ email: 'teacher@example.test' });
  });
});
