import http from 'node:http';
import type { AddressInfo } from 'node:net';
import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../config/env.js', () => ({ env: {
  CLIENT_URL: 'https://portal.example.test', JWT_SECRET: 'health-test-secret-with-enough-length',
  LAB_BACKEND: 'docker', TRUST_PROXY: 'loopback',
}, isProduction: true }));
import { app } from '../app.js';

let server: http.Server;
let base: string;
const ping = vi.fn();
const originalDatabase = Object.getOwnPropertyDescriptor(mongoose.connection, 'db');
let database: any;
let connected = 1;
beforeAll(async () => {
  vi.spyOn(mongoose.connection, 'readyState', 'get').mockImplementation(() => connected);
  Object.defineProperty(mongoose.connection, 'db', { configurable: true, get: () => database });
  server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  if (originalDatabase) Object.defineProperty(mongoose.connection, 'db', originalDatabase);
  else Reflect.deleteProperty(mongoose.connection, 'db');
  vi.restoreAllMocks();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});
beforeEach(() => {
  connected = 1;
  ping.mockReset().mockResolvedValue({ ok: 1 });
  database = { admin: () => ({ command: ping }) };
});

describe('public API/database readiness over HTTP (mocked driver)', () => {
  it('returns success only after a bounded database ping', async () => {
    const response = await fetch(base + '/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(ping).toHaveBeenCalledWith({ ping: 1 }, { timeoutMS: 1500 });
  });
  it.each([0, 2, 3])('returns 503 without querying when connection state is %s', async state => {
    connected = state;
    const response = await fetch(base + '/health');
    expect(response.status).toBe(503); expect(await response.json()).toEqual({ status: 'unavailable' });
    expect(ping).not.toHaveBeenCalled();
  });
  it('returns 503 if a connection is reported but no database handle exists', async () => {
    database = undefined;
    expect((await fetch(base + '/health')).status).toBe(503);
  });
  it('returns a generic uncached response when a connected database fails its ping', async () => {
    ping.mockRejectedValue(new Error('private database URI and credentials must not escape'));
    const response = await fetch(base + '/health');
    expect(response.status).toBe(503); expect(await response.json()).toEqual({ status: 'unavailable' });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
  it('rejects an unsuccessful database command result', async () => {
    ping.mockResolvedValue({ ok: 0 });
    expect((await fetch(base + '/health')).status).toBe(503);
  });
  it('allows the configured credentialed origin without reflecting arbitrary origins', async () => {
    for (const origin of ['https://portal.example.test', 'https://foreign.example.test']) {
      const response = await fetch(base + '/health', { headers: { Origin: origin } });
      expect(response.headers.get('access-control-allow-origin')).toBe('https://portal.example.test');
      expect(response.headers.get('access-control-allow-credentials')).toBe('true');
    }
  });
  it('trusts only the explicitly configured local reverse proxy', () => {
    expect(app.get('trust proxy')).toBe('loopback');
    const trusted = app.get('trust proxy fn');
    expect(trusted('127.0.0.1')).toBe(true); expect(trusted('::1')).toBe(true);
    expect(trusted('203.0.113.10')).toBe(false);
  });
});
