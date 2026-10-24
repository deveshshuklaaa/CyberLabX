import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { PassThrough } from 'node:stream';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { io as clientIo } from 'socket.io-client';
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../models/User.js', () => ({ User: { findById: vi.fn() } }));
vi.mock('../models/LabSession.js', () => ({ LabSession: { findOne: vi.fn() } }));
vi.mock('../models/CommandLog.js', () => ({ CommandLog: { create: vi.fn(), findByIdAndUpdate: vi.fn() } }));
vi.mock('../services/labEngine.js', () => ({ getShellStream: vi.fn() }));
vi.mock('../services/vm/manager.js', () => ({ openTerminal: vi.fn() }));
vi.mock('../services/vm/access.js', () => ({ authorizeVm: vi.fn() }));
import { User } from '../models/User.js';
import { LabSession } from '../models/LabSession.js';
import { getShellStream } from '../services/labEngine.js';
import { openTerminal } from '../services/vm/manager.js';
import { attachTerminalSocket } from '../sockets/terminalSocket.js';
import { env } from '../config/env.js';
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(User.findById).mockResolvedValue({ _id: 'owner', role: 'student', isActive: true } as any);
});
async function fixture(headers: Record<string, string> = {}) {
  const server = http.createServer(); const io = new Server(server); attachTerminalSocket(io);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const socket = clientIo(`http://127.0.0.1:${(server.address() as AddressInfo).port}`, {
    transports: ['websocket'], reconnection: false, timeout: 3000, extraHeaders: {
      Origin: env.CLIENT_URL, Cookie: `cyberlabx_session=${jwt.sign({ sub: 'owner' }, env.JWT_SECRET)}`, ...headers,
    },
  });
  return { socket, close: async () => { socket.disconnect(); await new Promise<void>(resolve => io.close(() => resolve())); } };
}
it.each<Record<string, string>>([
  { Cookie: '' }, { Origin: 'https://foreign.example' },
])('rejects an unauthenticated or foreign-origin socket', async headers => {
  const f = await fixture(headers);
  try {
    const message = await new Promise<string>(resolve => f.socket.once('connect_error', error => resolve(error.message)));
    expect(message).toMatch(/Unauthorized/);
    expect(openTerminal).not.toHaveBeenCalled();
  } finally { await f.close(); }
});
it('rejects a foreign-owned or expired session before opening a VM terminal', async () => {
  vi.mocked(LabSession.findOne).mockResolvedValue(null);
  const f = await fixture();
  try {
    await new Promise<void>((resolve, reject) => { f.socket.once('connect', resolve); f.socket.once('connect_error', reject); });
    const denied = new Promise<{ message: string }>(resolve => f.socket.once('terminal:error', resolve));
    f.socket.emit('terminal:join', { labSessionId: '64b000000000000000000001' });
    expect((await denied).message).toContain('unavailable');
    expect(LabSession.findOne).toHaveBeenCalledWith(expect.objectContaining({ studentId: 'owner', status: 'running' }));
    expect(openTerminal).not.toHaveBeenCalled();
  } finally { await f.close(); }
});
it('still opens Docker terminals through the existing shell path', async () => {
  const id = '64b000000000000000000002'; const output = new PassThrough(); const write = vi.fn();
  vi.mocked(LabSession.findOne).mockResolvedValue({ _id: id, attemptId: id, studentContainerId: 'docker-kali', expiresAt: new Date(Date.now() + 60000) } as any);
  vi.mocked(getShellStream).mockResolvedValue({ input: { write }, output } as any);
  const f = await fixture();
  try {
    await new Promise<void>((resolve, reject) => { f.socket.once('connect', resolve); f.socket.once('connect_error', reject); });
    const ready = new Promise<void>(resolve => f.socket.once('terminal:ready', resolve));
    f.socket.emit('terminal:join', { labSessionId: id }); await ready;
    expect(getShellStream).toHaveBeenCalledWith('docker-kali', undefined);
    expect(openTerminal).not.toHaveBeenCalled();
    f.socket.emit('terminal:input', { labSessionId: id, data: 'pwd' });
    await vi.waitFor(() => expect(write).toHaveBeenCalledWith('pwd'));
  } finally { output.destroy(); await f.close(); }
});
