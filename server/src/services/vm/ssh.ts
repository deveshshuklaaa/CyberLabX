import { Client, type ClientChannel } from 'ssh2';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { VmRecord } from './config.js';

export async function connectGuest(vm: VmRecord): Promise<Client> {
  const privateKey = await readFile(path.join(vm.directory, 'identity'));
  return new Promise((resolve, reject) => {
    const client = new Client();
    client.once('ready', () => resolve(client));
    client.once('error', reject);
    client.connect({ host: '127.0.0.1', port: vm.sshPort, username: 'student', privateKey,
      readyTimeout: 10000, keepaliveInterval: 10000, keepaliveCountMax: 3,
      hostHash: 'sha256', hostVerifier: (hash: string) => hash === vm.hostKeyHash });
  });
}

export async function openGuestShell(vm: VmRecord) {
  const client = await connectGuest(vm);
  try {
    const channel = await new Promise<ClientChannel>((resolve, reject) => client.shell(
      { term: 'xterm-256color', cols: 100, rows: 30 }, (error, stream) => error ? reject(error) : resolve(stream)));
    const close = () => { channel.destroy(); client.end(); };
    channel.once('close', () => client.end());
    return { input: channel, output: channel, close,
      resize: (cols: number, rows: number) => channel.setWindow(rows, cols, 0, 0) };
  } catch (error) { client.end(); throw error; }
}

export async function guestExec(vm: VmRecord, command: string): Promise<string> {
  const client = await connectGuest(vm);
  return new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => { client.destroy(); reject(new Error('Guest inspection timed out.')); }, 15000);
    const finish = (error?: Error) => { clearTimeout(timeout); client.end(); if (error) reject(error); else resolve(output); };
    client.exec(command, (error, stream) => {
      if (error) return finish(error);
      stream.on('data', (data: Buffer) => { output = (output + data.toString()).slice(-100000); });
      stream.on('error', finish);
      stream.on('close', (code: number) => finish(code ? new Error(`Guest inspection exited ${code}.`) : undefined));
    });
  });
}
