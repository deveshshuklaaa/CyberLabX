import net from 'node:net';
import { expect, it } from 'vitest';
import { qmp } from '../services/vm/qmp.js';
it('negotiates QMP capabilities, ignores events, and matches command replies', async () => {
  const received: string[] = [];
  const server = net.createServer(socket => {
    socket.write('{"QMP":{"version":{}}}\r\n');
    let buffer = '';
    socket.on('data', data => {
      buffer += data.toString();
      let i: number;
      while ((i = buffer.indexOf('\n')) >= 0) {
        const msg = JSON.parse(buffer.slice(0, i)); buffer = buffer.slice(i + 1);
        received.push(msg.execute);
        socket.write('{"event":"RESUME"}\n');
        socket.write(JSON.stringify({ return: msg.id === 'hello' ? {} : { running: true }, id: msg.id }) + '\n');
      }
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await expect(qmp((server.address() as net.AddressInfo).port, 'query-status')).resolves.toEqual({ running: true });
    expect(received).toEqual(['qmp_capabilities', 'query-status']);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
