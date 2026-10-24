import net from 'node:net';

/** Hold reservations until just before spawn; QEMU bind failures fail provisioning. */
export async function reservePorts(count = 3) {
  const sockets: net.Server[] = [];
  const ports: number[] = [];
  try {
    while (ports.length < count) {
      const server = net.createServer();
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen({ host: '127.0.0.1', port: 0, exclusive: true }, resolve);
      });
      const port = (server.address() as net.AddressInfo).port;
      // VNC uses a display number (port - 5900).
      if (port < 5900) { server.close(); continue; }
      sockets.push(server); ports.push(port);
    }
    return { ports, release: () => Promise.all(sockets.map(s => new Promise<void>(r => s.close(() => r())))) };
  } catch (error) { sockets.forEach(s => s.close()); throw error; }
}
