import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { PassThrough } from 'node:stream';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { io as clientIo } from 'socket.io-client';
import { expect, it, vi } from 'vitest';
vi.mock('../models/User.js', () => ({ User: { findById: vi.fn() } }));
vi.mock('../models/LabSession.js', () => ({ LabSession: { findOne: vi.fn() } }));
vi.mock('../models/CommandLog.js', () => ({ CommandLog: { create: vi.fn(), findByIdAndUpdate: vi.fn() } }));
vi.mock('../services/labEngine.js', () => ({ getShellStream: vi.fn() }));
vi.mock('../services/vm/manager.js', () => ({ openTerminal: vi.fn() }));
vi.mock('../services/vm/access.js', () => ({ authorizeVm: vi.fn() }));
import { User } from '../models/User.js';
import { LabSession } from '../models/LabSession.js';
import { CommandLog } from '../models/CommandLog.js';
import { openTerminal } from '../services/vm/manager.js';
import { authorizeVm } from '../services/vm/access.js';
import { attachTerminalSocket } from '../sockets/terminalSocket.js';
import { env } from '../config/env.js';

it('forwards unchanged PTY input and records immediate output before asynchronous log creation', async () => {
  const id = '64b000000000000000000001';
  vi.mocked(User.findById).mockResolvedValue({ _id: 'student', role: 'student', isActive: true } as any);
  vi.mocked(LabSession.findOne).mockResolvedValue({ _id: id, attemptId: id, vmAttemptId: id, expiresAt: new Date(Date.now() + 60000) } as any);
  vi.mocked(authorizeVm).mockResolvedValue({} as any);
  const output = new PassThrough();
  const write = vi.fn(() => { output.write('ID=kali\r\n'); return true; });
  vi.mocked(openTerminal).mockResolvedValue({ input: { write }, output, close: () => output.destroy(), resize: vi.fn() } as any);
  let resolveLog!: (value: any) => void;
  vi.mocked(CommandLog.create).mockImplementation(() => new Promise(resolve => { resolveLog = resolve; }) as any);
  vi.mocked(CommandLog.findByIdAndUpdate).mockResolvedValue({} as any);
  const server = http.createServer(); const io = new Server(server); attachTerminalSocket(io);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const socket = clientIo(`http://127.0.0.1:${(server.address() as AddressInfo).port}`, { transports: ['websocket'], extraHeaders: {
    Origin: env.CLIENT_URL, Cookie: `cyberlabx_session=${jwt.sign({ sub: 'student' }, env.JWT_SECRET)}`,
  } });
  try {
    await new Promise<void>((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
    const ready = new Promise<void>(resolve => socket.once('terminal:ready', resolve));
    socket.emit('terminal:join', { labSessionId: id }); await ready;
    const received = new Promise<string>(resolve => socket.once('terminal:output', resolve));
    socket.emit('terminal:input', { labSessionId: id, data: 'cat /etc/os-release\r' });
    expect(await received).toBe('ID=kali\r\n');
    expect(write).toHaveBeenCalledWith('cat /etc/os-release\r');
    resolveLog({ _id: 'log-1' });
    await vi.waitFor(() => expect(CommandLog.findByIdAndUpdate).toHaveBeenCalledWith('log-1', { $set: { stdout: 'ID=kali\r\n' } }));
    expect(CommandLog.create).toHaveBeenCalledWith(expect.objectContaining({ command: 'cat /etc/os-release', attemptId: id }));
  } finally {
    socket.disconnect(); output.destroy();
    await new Promise<void>(resolve => io.close(() => resolve()));
  }
});
