import { describe, expect, it } from 'vitest';
import { environmentSchema } from '../config/env.js';
const base = { JWT_SECRET: 'unit-test-secret-with-enough-length', NODE_ENV: 'development', CLIENT_URL: 'http://localhost:5173' };
const google = { GOOGLE_CLIENT_ID: 'unit-test-client', GOOGLE_CLIENT_SECRET: 'unit-test-secret', GOOGLE_CALLBACK_URL: 'http://localhost:5000/api/auth/google/callback' };
describe('optional Google OAuth configuration', () => {
  it('keeps existing auth working with all Google values omitted or blank', () => {
    expect(environmentSchema.safeParse(base).success).toBe(true);
    expect(environmentSchema.safeParse({ ...base, GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '', GOOGLE_CALLBACK_URL: '' }).success).toBe(true);
  });
  it('requires all three Google values together', () => {
    expect(environmentSchema.safeParse({ ...base, GOOGLE_CLIENT_ID: google.GOOGLE_CLIENT_ID }).success).toBe(false);
    expect(environmentSchema.safeParse({ ...base, ...google }).success).toBe(true);
  });
  it.each(['not-a-url', 'http://public.example.test/api/auth/google/callback', 'https://api.example.test/wrong', 'https://user:password@api.example.test/api/auth/google/callback', 'https://api.example.test/api/auth/google/callback?returnTo=evil'])('rejects unsafe or incorrect callback URL %s', callback => {
    expect(environmentSchema.safeParse({ ...base, ...google, GOOGLE_CALLBACK_URL: callback }).success).toBe(false);
  });
  it('requires HTTPS for both production callback and frontend', () => {
    expect(environmentSchema.safeParse({ ...base, ...google, NODE_ENV: 'production' }).success).toBe(false);
    const production = { ...base, ...google, NODE_ENV: 'production', GOOGLE_CALLBACK_URL: 'https://api.example.test/api/auth/google/callback' };
    expect(environmentSchema.safeParse(production).success).toBe(false);
    expect(environmentSchema.safeParse({ ...production, CLIENT_URL: 'https://portal.example.test' }).success).toBe(true);
  });

  it('requires HTTPS in production even while Google login is disabled', () => {
    expect(environmentSchema.safeParse({ ...base, NODE_ENV: 'production' }).success).toBe(false);
    expect(environmentSchema.safeParse({ ...base, NODE_ENV: 'production', CLIENT_URL: 'https://portal.example.test' }).success).toBe(true);
  });
  it('canonicalizes the frontend origin for CORS and account-link origin comparisons', () => {
    expect(environmentSchema.parse({ ...base, CLIENT_URL: 'https://PORTAL.example.test:443/' }).CLIENT_URL).toBe('https://portal.example.test');
  });
  it.each(['not-a-url', 'https://portal.example.test/subpath', 'https://portal.example.test?next=evil', 'https://portal.example.test/#fragment', 'https://user:password@portal.example.test', 'ftp://portal.example.test'])('rejects a frontend URL that is not a safe web origin: %s', CLIENT_URL => {
    expect(environmentSchema.safeParse({ ...base, CLIENT_URL }).success).toBe(false);
  });
  it('defaults to direct access and permits only explicit local-proxy trust', () => {
    expect(environmentSchema.parse(base).TRUST_PROXY).toBe('false');
    expect(environmentSchema.parse({ ...base, TRUST_PROXY: 'loopback' }).TRUST_PROXY).toBe('loopback');
  });
  it.each(['true', '1', 'uniquelocal'])('rejects broad or ambiguous proxy trust: %s', TRUST_PROXY => {
    expect(environmentSchema.safeParse({ ...base, TRUST_PROXY }).success).toBe(false);
  });
});
