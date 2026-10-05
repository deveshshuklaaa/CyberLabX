import type { Server } from 'node:http';
import net from 'node:net';
import jwt from 'jsonwebtoken';
import { WebSocketServer, WebSocket } from 'ws';
import { User } from '../models/User.js';
import { env } from '../config/env.js';
import { authorizeVm } from '../services/vm/access.js';
import { trackConnection } from '../services/vm/manager.js';
import { qmp } from '../services/vm/qmp.js';

export function attachDesktopSocket(server: Server) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024, perMessageDeflate: false });
  server.on('upgrade', async (request, socket, head) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith('/desktop/')) return; // Socket.IO owns its own path.
    const reject = () => { socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); socket.destroy(); };
    try {
      if (request.headers.origin !== new URL(env.CLIENT_URL).origin) return reject();
      const cookiePrefix = 'cyberlabx_session=';
      const token = request.headers.cookie?.split(';').map(c => c.trim()).find(c => c.startsWith(cookiePrefix))?.slice(cookiePrefix.length);
      if (!token) return reject();
      const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string };
      const user = await User.findById(payload.sub);
      if (!user?.isActive || user.role !== 'student') return reject();
      const id = url.pathname.slice('/desktop/'.length);
      const { vm } = await authorizeVm(id, String(user._id));
      const identity = await qmp(vm.qmpPort, 'query-uuid') as { UUID: string };
      if (identity.UUID !== vm.id) return reject();
      if (socket.destroyed) return;
      wss.handleUpgrade(request, socket, head, ws => {
        const tcp = net.connect({ host: '127.0.0.1', port: vm.vncPort });
        const close = () => { tcp.destroy(); ws.close(); };
        const untrack = trackConnection(vm.attemptId, close);
        // Bound lifetime even if nobody interacts with the lab page.
        const expiry = setTimeout(close, Math.max(1, Date.parse(vm.expiresAt) - Date.now()));
        const authCheck = setInterval(() => { authorizeVm(id, String(user._id)).catch(close); }, 5000);
        const cleanup = () => { clearTimeout(expiry); clearInterval(authCheck); untrack(); close(); };
        tcp.on('data', data => {
          if (ws.readyState !== WebSocket.OPEN) return;
          if (ws.bufferedAmount > 4 * 1024 * 1024) return close();
          ws.send(data, { binary: true });
        });
        ws.on('message', data => {
          if (tcp.writableLength > 1024 * 1024) return close();
          tcp.write(Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer));
        });
        tcp.on('error', cleanup); tcp.on('close', cleanup);
        ws.on('error', cleanup); ws.on('close', cleanup);
      });
    } catch { reject(); }
  });
}
