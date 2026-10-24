import { describe, expect, it } from 'vitest';
import { User } from '../models/User.js';
describe('Google user model', () => {
  it('defines unique sparse provider identity and unique email indexes', () => {
    expect(User.schema.indexes()).toEqual(expect.arrayContaining([
      [{ googleId: 1 }, expect.objectContaining({ unique: true, sparse: true })],
      [{ email: 1 }, expect.objectContaining({ unique: true })],
    ]));
    expect(User.schema.options.timestamps).toBe(true);
  });
  it('accepts a Google-only account without a fabricated password or family name', async () => {
    const user = new User({ firstName: 'SingleName', email: 'new@example.test', googleId: 'stable-google-subject' });
    await expect(user.validate()).resolves.toBeUndefined();
    expect(user.role).toBe('student'); expect(user.isActive).toBe(true);
  });
  it('continues requiring a password for local accounts and rejects unrecognized roles', async () => {
    const local = new User({ firstName: 'Local', lastName: 'User', email: 'local@example.test' });
    await expect(local.validate()).rejects.toHaveProperty('errors.passwordHash');
    const elevated = new User({ firstName: 'Test', email: 'new@example.test', googleId: 'subject', role: 'super-admin' });
    await expect(elevated.validate()).rejects.toHaveProperty('errors.role');
  });
});
