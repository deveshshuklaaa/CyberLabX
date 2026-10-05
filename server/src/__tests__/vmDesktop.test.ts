import http from 'node:http';
import net from 'node:net';
import jwt from 'jsonwebtoken';
import { WebSocket } from 'ws';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../models/User.js', () => ({ User: { findById: vi.fn() } }));
vi.mock('../services/vm/access.js', () => ({ authorizeVm: vi.fn() }));
vi.mock('../services/vm/manager.js', () => ({ trackConnection: vi.fn(() => vi.fn()) }));
vi.mock('../services/vm/qmp.js', () => ({ qmp: vi.fn() }));
import { User } from '../models/User.js';
import { authorizeVm } from '../services/vm/access.js';
import { attachDesktopSocket } from '../sockets/desktopSocket.js';
import { env } from '../config/env.js';
import { qmp } from '../services/vm/qmp.js';

let server: http.Server;
let endpoint: string;
let target: net.Server;
let targetConnections = 0;
beforeEach(async () => {
  vi.resetAllMocks(); targetConnections = 0;
  target = net.createServer(socket => { targetConnections++; socket.write('RFB 003.008\n'); socket.on('data', data => socket.write(data)); });
  await new Promise<void>(resolve => target.listen(0, '127.0.0.1', resolve));
  vi.mocked(User.findById).mockResolvedValue({ _id: 'student-a', role: 'student', isActive: true } as any);
  vi.mocked(qmp).mockResolvedValue({ UUID: 'test-vm-identity' });
  vi.mocked(authorizeVm).mockImplementation(async id => {
    if (id !== '64b000000000000000000001') throw new Error('Not owned');
    return { vm: { id: 'test-vm-identity', attemptId: id, vncPort: (target.address() as net.AddressInfo).port, expiresAt: new Date(Date.now() + 60000).toISOString() } } as any;
  });
  server = http.createServer(); attachDesktopSocket(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  endpoint = `ws://127.0.0.1:${(server.address() as net.AddressInfo).port}/desktop/`;
});
afterEach(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
  await new Promise<void>(resolve => target.close(() => resolve()));
});
function connection(id: string, origin = env.CLIENT_URL, authenticated = true) {
  return new WebSocket(endpoint + id, { origin, headers: authenticated ? { Cookie: `cyberlabx_session=${jwt.sign({ sub: 'student-a' }, env.JWT_SECRET)}` } : {} });
}
it('proxies the authenticated owner to the selected loopback VNC endpoint', async () => {
  const ws = connection('64b000000000000000000001');
  const greeting = await new Promise<string>((resolve, reject) => { ws.once('message', data => resolve(data.toString())); ws.once('error', reject); });
  expect(greeting).toBe('RFB 003.008\n');
  expect(authorizeVm).toHaveBeenCalledWith('64b000000000000000000001', 'student-a');
  ws.close(); await new Promise<void>(resolve => ws.once('close', () => resolve()));
});
it.each(['other-owner', 'bad-origin', 'unauthenticated'])('rejects %s before connecting VNC', async mode => {
  const ws = connection(mode === 'other-owner' ? '64b000000000000000000002' : '64b000000000000000000001', mode === 'bad-origin' ? 'https://attacker.invalid' : env.CLIENT_URL, mode !== 'unauthenticated');
  const error = await new Promise<Error>(resolve => ws.once('error', resolve));
  expect(error.message).toContain('403'); expect(targetConnections).toBe(0);
});
it('rejects stale metadata pointing at another QEMU instance', async () => {
  vi.mocked(qmp).mockResolvedValue({ UUID: 'different-vm' });
  const ws = connection('64b000000000000000000001');
  const error = await new Promise<Error>(resolve => ws.once('error', resolve));
  expect(error.message).toContain('403'); expect(targetConnections).toBe(0);
});
