import express from 'express';
import cookieParser from 'cookie-parser';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
const sdk = vi.hoisted(() => ({ getToken: vi.fn(), verifyIdToken: vi.fn(), generateAuthUrl: vi.fn() }));
vi.mock('google-auth-library', () => ({ OAuth2Client: vi.fn(() => sdk), CodeChallengeMethod: { S256: 'S256' } }));
vi.mock('../config/env.js', () => ({ env: {
  GOOGLE_CLIENT_ID: 'unit-test-client', GOOGLE_CLIENT_SECRET: 'unit-test-secret', GOOGLE_CALLBACK_URL: 'https://api.example.test/api/auth/google/callback',
  CLIENT_URL: 'https://portal.example.test', JWT_SECRET: 'unit-test-session-secret-long-enough', JWT_EXPIRES_IN: '7d',
}, isProduction: true }));
vi.mock('../models/User.js', () => ({ User: { init: vi.fn(), findOne: vi.fn(), exists: vi.fn(), create: vi.fn(), findById: vi.fn(), findOneAndUpdate: vi.fn() } }));
vi.mock('express-rate-limit', () => ({ default: () => (_req: unknown, _res: unknown, next: () => void) => next() }));
vi.mock('../controllers/dashboardController.js', () => {
  const respond = (_req: unknown, res: any) => res.json({ allowed: true });
  return { studentDashboard: respond, studentHistory: respond, facultyDashboard: respond, adminDashboard: respond };
});
import { authRouter } from '../routes/authRoutes.js';
import { dashboardRouter } from '../routes/dashboardRoutes.js';
import { User } from '../models/User.js';
import { env } from '../config/env.js';

let server: http.Server; let base: string; let nonce: string;
const userId = '64b000000000000000000001';
const existing = (role = 'student') => ({ _id: userId, firstName: 'Test', lastName: 'User', email: 'test@example.test', googleId: 'google-sub', role, isActive: true });
const session = (role = 'student') => `cyberlabx_session=${jwt.sign({ sub: userId, role }, env.JWT_SECRET)}`;
const setCookies = (response: globalThis.Response) => response.headers.getSetCookie();
beforeAll(async () => {
  const app = express(); app.use(express.json(), cookieParser()); app.use('/api/auth', authRouter); app.use('/api', dashboardRouter);
  server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });
beforeEach(() => {
  vi.resetAllMocks(); nonce = '';
  sdk.generateAuthUrl.mockImplementation((options: Record<string, unknown>) => {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    for (const [key, value] of Object.entries(options)) url.searchParams.set(key, Array.isArray(value) ? value.join(' ') : String(value));
    return url.toString();
  });
  sdk.getToken.mockResolvedValue({ tokens: { id_token: 'mock-id-token', access_token: 'never-expose-this-access-token' } });
  sdk.verifyIdToken.mockResolvedValue({ getPayload: () => ({ sub: 'google-sub', email: 'test@example.test', email_verified: true, name: 'Test User', nonce, aud: env.GOOGLE_CLIENT_ID, iss: 'https://accounts.google.com', exp: Date.now() / 1000 + 3600 }) });
  vi.mocked(User.findOne).mockResolvedValue(existing() as any);
  vi.mocked(User.findById).mockImplementation(() => Object.assign(Promise.resolve(existing()), { select: vi.fn().mockResolvedValue(existing()) }) as any);
});
async function start(link = false) {
  const response = await fetch(base + '/api/auth/google' + (link ? '/link' : ''), {
    method: link ? 'POST' : 'GET', redirect: 'manual', headers: link ? { Cookie: session(), Origin: env.CLIENT_URL } : {},
  });
  expect(response.status).toBe(link ? 200 : 302);
  const header = setCookies(response).find(value => value.startsWith('cyberlabx_google_oauth='))!;
  const cookie = header.split(';')[0];
  const transaction = jwt.verify(decodeURIComponent(cookie.slice(cookie.indexOf('=') + 1)), env.JWT_SECRET,
    { audience: 'cyberlabx:google-oauth', issuer: 'cyberlabx' }) as any;
  nonce = transaction.nonce;
  return { response, cookie, transaction, header };
}
async function callback(cookie: string, query: Record<string, string>) {
  return fetch(base + '/api/auth/google/callback?' + new URLSearchParams(query), { headers: { Cookie: cookie }, redirect: 'manual' });
}

describe('Google authorization-code callback over HTTP (mocked Google)', () => {
  it('starts a browser-bound, expiring, HttpOnly transaction with PKCE and nonce', async () => {
    const { response, transaction, header } = await start();
    const destination = new URL(response.headers.get('location')!);
    expect(destination.origin).toBe('https://accounts.google.com');
    expect(destination.searchParams.get('state')).toBe(transaction.state);
    expect(destination.searchParams.get('nonce')).toBe(transaction.nonce);
    expect(destination.searchParams.get('code_challenge_method')).toBe('S256');
    expect(transaction.exp - transaction.iat).toBe(600);
    expect(header).toMatch(/HttpOnly/); expect(header).toMatch(/Secure/); expect(header).toMatch(/SameSite=Lax/);
    expect(header).toContain('Path=/api/auth/google');
    expect(destination.toString()).not.toContain('unit-test-secret');
  });
  it.each([['student', '/student'], ['faculty', '/teacher'], ['admin', '/admin']])('logs in the existing %s with the existing session cookie', async (role, path) => {
    vi.mocked(User.findOne).mockResolvedValue(existing(role) as any);
    const { cookie, transaction } = await start();
    const response = await callback(cookie, { state: transaction.state, code: 'code' });
    expect(response.status).toBe(303); expect(response.headers.get('location')).toBe(env.CLIENT_URL + path);
    const header = setCookies(response).find(value => value.startsWith('cyberlabx_session='))!;
    expect(header).toMatch(/HttpOnly/); expect(header).toMatch(/Secure/); expect(header).toMatch(/SameSite=Lax/);
    const token = decodeURIComponent(header.split(';')[0].split('=')[1]);
    expect(jwt.verify(token, env.JWT_SECRET)).toMatchObject({ sub: userId, role });
    expect(setCookies(response).some(value => value.startsWith('cyberlabx_google_oauth=;'))).toBe(true);
    expect(await response.text()).not.toContain('never-expose-this-access-token');
    expect(User.create).not.toHaveBeenCalled();
  });
  it('creates a new Google user as student despite role parameters in the callback', async () => {
    vi.mocked(User.findOne).mockResolvedValue(null); vi.mocked(User.create).mockResolvedValue(existing() as any);
    const { cookie, transaction } = await start();
    const response = await callback(cookie, { state: transaction.state, code: 'code', role: 'admin' });
    expect(response.headers.get('location')).toBe(env.CLIENT_URL + '/student');
    expect(User.create).toHaveBeenCalledWith(expect.objectContaining({ googleId: 'google-sub', role: 'student' }));
  });
  it('rejects missing, mismatched and expired transaction state before contacting Google', async () => {
    const { cookie, transaction } = await start();
    for (const [sentCookie, state] of [['', transaction.state], [cookie, '0'.repeat(64)]]) {
      const response = await callback(sentCookie, { state, code: 'code' });
      expect(response.headers.get('location')).toBe(env.CLIENT_URL + '/login?oauth_error=invalid_callback');
    }
    const expired = jwt.sign({ state: transaction.state, nonce: transaction.nonce, verifier: transaction.verifier }, env.JWT_SECRET,
      { issuer: 'cyberlabx', audience: 'cyberlabx:google-oauth', expiresIn: -1 });
    const response = await callback(`cyberlabx_google_oauth=${expired}`, { state: transaction.state, code: 'code' });
    expect(response.headers.get('location')).toContain('invalid_callback');
    expect(sdk.getToken).not.toHaveBeenCalled();
  });
  it('handles consent denial and provider failure without exposing raw errors', async () => {
    const { cookie, transaction } = await start();
    const denied = await callback(cookie, { state: transaction.state, error: 'access_denied' });
    expect(denied.headers.get('location')).toContain('oauth_error=access_denied');
    expect(sdk.getToken).not.toHaveBeenCalled();
    sdk.getToken.mockRejectedValue(new Error('secret internal provider error'));
    const response = await callback(cookie, { state: transaction.state, code: 'code' });
    expect(response.headers.get('location')).toContain('oauth_error=provider_unavailable');
    expect(await response.text()).not.toContain('secret internal');
  });
  it('refuses disabled accounts and unverified identities without setting a session', async () => {
    const { cookie, transaction } = await start();
    vi.mocked(User.findOne).mockResolvedValue({ ...existing(), isActive: false } as any);
    const response = await callback(cookie, { state: transaction.state, code: 'code' });
    expect(response.headers.get('location')).toContain('account_disabled');
    expect(setCookies(response).some(value => value.startsWith('cyberlabx_session='))).toBe(false);
    sdk.verifyIdToken.mockResolvedValue({ getPayload: () => ({ email_verified: false }) });
    const invalid = await callback(cookie, { state: transaction.state, code: 'code' });
    expect(invalid.headers.get('location')).toContain('invalid_identity');
  });
  it('links a Google identity only while the same teacher is authenticated', async () => {
    const teacher = { ...existing('faculty'), googleId: undefined };
    vi.mocked(User.findById).mockImplementation(() => Object.assign(Promise.resolve(teacher), { select: vi.fn().mockResolvedValue(teacher) }) as any);
    vi.mocked(User.findOne).mockResolvedValue(null);
    vi.mocked(User.findOneAndUpdate).mockResolvedValue({ ...teacher, googleId: 'google-sub' } as any);
    const { cookie, transaction } = await start(true);
    const withoutSession = await callback(cookie, { state: transaction.state, code: 'code' });
    expect(withoutSession.status).toBe(401); expect(User.findOneAndUpdate).not.toHaveBeenCalled();
    const linked = await callback(cookie + '; ' + session('faculty'), { state: transaction.state, code: 'code' });
    expect(linked.headers.get('location')).toBe(env.CLIENT_URL + '/teacher');
    expect(User.findOneAndUpdate).toHaveBeenCalledOnce();
  });
  it('forbids cross-origin or unauthenticated account linking', async () => {
    const denied = await fetch(base + '/api/auth/google/link', { method: 'POST', headers: { Cookie: session(), Origin: 'https://foreign.test' } });
    expect(denied.status).toBe(403);
    const anonymous = await fetch(base + '/api/auth/google/link', { method: 'POST', headers: { Origin: env.CLIENT_URL } });
    expect(anonymous.status).toBe(401); expect(sdk.generateAuthUrl).not.toHaveBeenCalled();
  });
  it('clears both the session and pending OAuth cookie on logout', async () => {
    const response = await fetch(base + '/api/auth/logout', { method: 'POST', headers: { Cookie: session() } });
    expect(response.status).toBe(204);
    const cookies = setCookies(response);
    for (const name of ['cyberlabx_session', 'cyberlabx_google_oauth']) {
      const header = cookies.find(value => value.startsWith(name + '=;'))!;
      expect(header).toContain('HttpOnly'); expect(header).toContain('Secure'); expect(header).toContain('Expires=Thu, 01 Jan 1970');
    }
  });
  it('rejects a replay when Google refuses an already-used code, without issuing another session', async () => {
    const { cookie, transaction } = await start();
    expect((await callback(cookie, { state: transaction.state, code: 'one-use-code' })).headers.get('location')).toBe(env.CLIENT_URL + '/student');
    sdk.getToken.mockRejectedValue({ response: { data: { error: 'invalid_grant' } } });
    const replay = await callback(cookie, { state: transaction.state, code: 'one-use-code' });
    expect(replay.headers.get('location')).toContain('oauth_error=invalid_callback');
    expect(setCookies(replay).some(value => value.startsWith('cyberlabx_session='))).toBe(false);
    expect(setCookies(replay).some(value => value.startsWith('cyberlabx_google_oauth=;'))).toBe(true);
  });
  it('rejects linking if the active account changes before callback', async () => {
    const { cookie, transaction } = await start(true);
    vi.mocked(User.findById).mockReturnValue({ select: vi.fn().mockResolvedValue({ ...existing(), _id: '64b000000000000000000002' }) } as any);
    const response = await callback(cookie + '; ' + session(), { state: transaction.state, code: 'code' });
    expect(response.headers.get('location')).toContain('oauth_error=account_conflict');
    expect(sdk.getToken).not.toHaveBeenCalled(); expect(User.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe('existing backend role authorization over HTTP', () => {
  it('rejects missing, invalid and disabled sessions', async () => {
    for (const cookie of ['', 'cyberlabx_session=invalid']) {
      const response = await fetch(base + '/api/student/dashboard', { headers: { Cookie: cookie } });
      expect(response.status).toBe(401);
    }
    vi.mocked(User.findById).mockReturnValue({ select: vi.fn().mockResolvedValue({ ...existing(), isActive: false }) } as any);
    expect((await fetch(base + '/api/student/dashboard', { headers: { Cookie: session() } })).status).toBe(401);
  });
  it.each([
    ['student', '/student/dashboard', 200], ['student', '/teacher/dashboard', 403], ['student', '/admin/dashboard', 403],
    ['faculty', '/teacher/dashboard', 200], ['faculty', '/faculty/dashboard', 200], ['faculty', '/admin/dashboard', 403], ['faculty', '/student/dashboard', 403],
    ['admin', '/admin/dashboard', 200], ['admin', '/teacher/dashboard', 200], ['admin', '/student/dashboard', 403],
  ])('checks current DB role %s on %s, ignoring a forged admin role claim', async (role, path, status) => {
    vi.mocked(User.findById).mockReturnValue({ select: vi.fn().mockResolvedValue(existing(role)) } as any);
    const response = await fetch(base + '/api' + path, { headers: { Cookie: session('admin') } });
    expect(response.status).toBe(status);
  });
});
