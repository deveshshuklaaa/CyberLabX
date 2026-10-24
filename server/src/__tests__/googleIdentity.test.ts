import { beforeEach, describe, expect, it, vi } from 'vitest';
const sdk = vi.hoisted(() => ({ getToken: vi.fn(), verifyIdToken: vi.fn(), generateAuthUrl: vi.fn() }));
vi.mock('google-auth-library', () => ({ OAuth2Client: vi.fn(() => sdk), CodeChallengeMethod: { S256: 'S256' } }));
vi.mock('../config/env.js', () => ({ env: { GOOGLE_CLIENT_ID: 'unit-test-client', GOOGLE_CLIENT_SECRET: 'unit-test-secret', GOOGLE_CALLBACK_URL: 'http://localhost:5000/api/auth/google/callback' } }));
vi.mock('../models/User.js', () => ({ User: { init: vi.fn(), findOne: vi.fn(), exists: vi.fn(), create: vi.fn(), findById: vi.fn(), findOneAndUpdate: vi.fn() } }));
import { User } from '../models/User.js';
import { exchangeGoogleIdentity, googleAuthorizationUrl, resolveGoogleUser } from '../services/googleAuthService.js';

const identity = { subject: 'google-subject', email: 'student@example.test', firstName: 'Test', lastName: 'Student' };
const payload = () => ({ sub: identity.subject, email: identity.email, email_verified: true, name: 'Test Student', given_name: 'Test', family_name: 'Student', nonce: 'expected-nonce', aud: 'unit-test-client', iss: 'https://accounts.google.com', exp: Date.now() / 1000 + 3600 });
beforeEach(() => { vi.resetAllMocks(); sdk.getToken.mockResolvedValue({ tokens: { id_token: 'signed-test-token' } }); sdk.verifyIdToken.mockResolvedValue({ getPayload: payload }); });

describe('Google OIDC verification (mocked provider)', () => {
  it('requests basic identity scopes, state, nonce and PKCE', () => {
    googleAuthorizationUrl({ state: 'state', nonce: 'nonce', codeChallenge: 'challenge' });
    expect(sdk.generateAuthUrl).toHaveBeenCalledWith(expect.objectContaining({ scope: ['openid', 'email', 'profile'], state: 'state', nonce: 'nonce', code_challenge: 'challenge', code_challenge_method: 'S256', access_type: 'online' }));
  });
  it('exchanges the code server-side and verifies the ID token for this client', async () => {
    expect(await exchangeGoogleIdentity('code', 'verifier', 'expected-nonce')).toEqual(identity);
    expect(sdk.getToken).toHaveBeenCalledWith({ code: 'code', codeVerifier: 'verifier' });
    expect(sdk.verifyIdToken).toHaveBeenCalledWith({ idToken: 'signed-test-token', audience: 'unit-test-client' });
  });
  it.each([
    { sub: '' }, { email_verified: false }, { email: 'invalid' }, { name: '' },
    { nonce: 'wrong' }, { aud: 'different-client' }, { iss: 'https://attacker.test' }, { exp: 1 },
  ])('rejects invalid identity claims: %j', async override => {
    sdk.verifyIdToken.mockResolvedValue({ getPayload: () => ({ ...payload(), ...override }) });
    await expect(exchangeGoogleIdentity('code', 'verifier', 'expected-nonce')).rejects.toHaveProperty('code', 'invalid_identity');
    expect(User.create).not.toHaveBeenCalled();
  });
  it('rejects a missing profile or missing ID token', async () => {
    sdk.verifyIdToken.mockResolvedValue({ getPayload: () => undefined });
    await expect(exchangeGoogleIdentity('code', 'verifier', 'expected-nonce')).rejects.toHaveProperty('code', 'invalid_identity');
    sdk.getToken.mockResolvedValue({ tokens: {} });
    await expect(exchangeGoogleIdentity('code', 'verifier', 'expected-nonce')).rejects.toHaveProperty('code', 'invalid_identity');
  });
  it('rejects signature verification failure and maps provider outages safely', async () => {
    sdk.verifyIdToken.mockRejectedValue(new Error('invalid signature'));
    await expect(exchangeGoogleIdentity('code', 'verifier', 'expected-nonce')).rejects.toHaveProperty('code', 'invalid_identity');
    sdk.getToken.mockRejectedValue(new Error('private network error'));
    await expect(exchangeGoogleIdentity('code', 'verifier', 'expected-nonce')).rejects.toHaveProperty('code', 'provider_unavailable');
    sdk.getToken.mockRejectedValue({ response: { data: { error: 'invalid_grant' } } });
    await expect(exchangeGoogleIdentity('code', 'verifier', 'expected-nonce')).rejects.toHaveProperty('code', 'invalid_callback');
  });
});

describe('Google account resolution', () => {
  it('creates only active students and persists the stable provider identifier', async () => {
    vi.mocked(User.findOne).mockResolvedValue(null); vi.mocked(User.exists).mockResolvedValue(null);
    const created = { _id: 'student', ...identity, role: 'student', isActive: true };
    vi.mocked(User.create).mockResolvedValue(created as any);
    expect(await resolveGoogleUser(identity)).toBe(created);
    expect(User.init).toHaveBeenCalledOnce();
    expect(User.create).toHaveBeenCalledWith(expect.objectContaining({ googleId: identity.subject, email: identity.email, role: 'student', isActive: true }));
    expect(vi.mocked(User.create).mock.calls[0][0]).not.toHaveProperty('passwordHash');
  });
  it('reuses provider identity even if Google email changed, preserving teacher/admin roles', async () => {
    const existing = { _id: 'existing', role: 'faculty', email: 'original@example.test', isActive: true };
    vi.mocked(User.findOne).mockResolvedValue(existing as any);
    expect(await resolveGoogleUser(identity)).toBe(existing);
    expect(User.exists).not.toHaveBeenCalled(); expect(User.create).not.toHaveBeenCalled();
  });
  it('rejects disabled accounts', async () => {
    vi.mocked(User.findOne).mockResolvedValue({ isActive: false } as any);
    await expect(resolveGoogleUser(identity)).rejects.toHaveProperty('code', 'account_disabled');
  });
  it('does not auto-link or duplicate an existing password account by email', async () => {
    vi.mocked(User.findOne).mockResolvedValue(null); vi.mocked(User.exists).mockResolvedValue({ _id: 'password-user' } as any);
    await expect(resolveGoogleUser(identity)).rejects.toHaveProperty('code', 'account_exists');
    expect(User.create).not.toHaveBeenCalled(); expect(User.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('returns the winning account after concurrent signup hits the unique provider index', async () => {
    const winner = { _id: 'winner', isActive: true, role: 'student' };
    vi.mocked(User.findOne).mockResolvedValueOnce(null).mockResolvedValueOnce(winner as any);
    vi.mocked(User.create).mockRejectedValue({ code: 11000 });
    expect(await resolveGoogleUser(identity)).toBe(winner);
    expect(User.create).toHaveBeenCalledOnce();
  });
  it('rejects a duplicate-email race involving a different provider subject', async () => {
    vi.mocked(User.findOne).mockResolvedValue(null); vi.mocked(User.create).mockRejectedValue({ code: 11000 });
    await expect(resolveGoogleUser(identity)).rejects.toHaveProperty('code', 'account_conflict');
  });
  it('links only the authenticated matching account without changing its role/password', async () => {
    const user = { _id: 'teacher', email: identity.email, role: 'faculty', isActive: true };
    vi.mocked(User.findOne).mockResolvedValue(null); vi.mocked(User.findById).mockResolvedValue(user as any);
    vi.mocked(User.findOneAndUpdate).mockResolvedValue({ ...user, googleId: identity.subject } as any);
    expect(await resolveGoogleUser(identity, 'teacher')).toHaveProperty('role', 'faculty');
    expect(User.findOneAndUpdate).toHaveBeenCalledWith(expect.objectContaining({ _id: 'teacher', isActive: true, googleId: { $exists: false } }), { $set: { googleId: identity.subject, avatarUrl: undefined } }, { new: true, runValidators: true });
  });
  it('rejects linking someone else\'s provider identity or a different email', async () => {
    vi.mocked(User.findOne).mockResolvedValue({ _id: 'another-account', isActive: true } as any);
    await expect(resolveGoogleUser(identity, 'teacher')).rejects.toHaveProperty('code', 'account_conflict');
    vi.mocked(User.findOne).mockResolvedValue(null);
    vi.mocked(User.findById).mockResolvedValue({ email: 'other@example.test', isActive: true } as any);
    await expect(resolveGoogleUser(identity, 'teacher')).rejects.toHaveProperty('code', 'account_conflict');
  });
});
