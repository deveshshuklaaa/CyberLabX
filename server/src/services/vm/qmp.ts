import net from 'node:net';

/** One bounded QMP transaction; events are ignored, replies matched by id. */
export function qmp(port: number, command: string, args?: Record<string, unknown>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    let pending = '';
    const finish = (error?: Error, result?: unknown) => {
      socket.destroy();
      if (error) reject(error); else resolve(result);
    };
    socket.setTimeout(5000, () => finish(new Error('QMP timed out.')));
    socket.on('error', reject);
    socket.on('end', () => reject(new Error('QMP closed before reply.')));
    socket.on('data', chunk => {
      pending += chunk.toString();
      if (pending.length > 1024 * 1024) return finish(new Error('QMP reply too large.'));
      let newline: number;
      while ((newline = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, newline); pending = pending.slice(newline + 1);
        try {
          const value = JSON.parse(line);
          if (value.QMP) socket.write(JSON.stringify({ execute: 'qmp_capabilities', id: 'hello' }) + '\n');
          else if (value.error) finish(new Error(value.error.desc));
          else if (value.id === 'hello') socket.write(JSON.stringify({ execute: command, arguments: args, id: 'request' }) + '\n');
          else if (value.id === 'request') finish(undefined, value.return);
        } catch (error) { finish(error as Error); }
      }
    });
  });
}
