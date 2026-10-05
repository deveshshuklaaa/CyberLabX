import ssh2 from 'ssh2';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { expect, it } from 'vitest';
import type { VmRecord } from '../services/vm/config.js';
import { connectGuest, openGuestShell } from '../services/vm/ssh.js';

it('pins SSH host keys and streams a PTY with window resizing and reconnect', async () => {
  // Real SSH protocol against a test server; this is not a Kali execution test.
  const host = ssh2.utils.generateKeyPairSync('ed25519');
  const identity = ssh2.utils.generateKeyPairSync('ed25519');
  const directory = await mkdtemp(path.join(os.tmpdir(), 'somaiya-ssh-test-'));
  await writeFile(path.join(directory, 'identity'), identity.private);
  let pty = false; let resized = false;
  const server = new ssh2.Server({ hostKeys: [host.private] }, client => {
    client.on('error', () => undefined);
    client.on('authentication', ctx => ctx.method === 'publickey' ? ctx.accept() : ctx.reject());
    client.on('ready', () => client.on('session', accept => {
      const session = accept();
      session.on('pty', acceptPty => { pty = true; acceptPty?.(); });
      session.on('window-change', acceptChange => { resized = true; acceptChange?.(); });
      session.on('shell', acceptShell => {
        const stream = acceptShell();
        stream.on('data', (data: Buffer) => stream.write(data));
      });
    }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const vm = { directory, sshPort: (server.address() as AddressInfo).port, hostKeyHash: createHash('sha256').update(Buffer.from(host.public.split(' ')[1], 'base64')).digest('hex') } as VmRecord;
  try {
    await expect(connectGuest({ ...vm, hostKeyHash: '0'.repeat(64) })).rejects.toThrow();
    for (let i = 0; i < 2; i++) {
      const shell = await openGuestShell(vm);
      shell.resize(120, 40);
      const output = new Promise<string>(resolve => shell.output.once('data', (data: Buffer) => resolve(data.toString())));
      shell.input.write('ssh-protocol-test\n');
      expect(await output).toBe('ssh-protocol-test\n');
      shell.close();
    }
    expect(pty).toBe(true); expect(resized).toBe(true);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});
