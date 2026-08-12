import http from 'node:http';
import { Server } from 'socket.io';
import { app } from './app.js';
import { env } from './config/env.js';
import { connectDatabase } from './config/db.js';
import { attachTerminalSocket } from './sockets/terminalSocket.js';
import { expireLabs, recoverOrphanedLabs } from './services/labEngine.js';

async function main() {
    await connectDatabase();

    // Recover any orphaned lab sessions/Docker resources from prior crash
    await recoverOrphanedLabs().catch(err =>
        console.warn('Orphan recovery completed with warnings:', err),
    );

    const server = http.createServer(app);
    const io = new Server(server, { cors: { origin: env.CLIENT_URL, credentials: true } });
    attachTerminalSocket(io);

    setInterval(() => { expireLabs().catch(console.error); }, 60_000).unref();

    server.listen(env.SERVER_PORT, () =>
        console.log(`CyberLabX API listening on ${env.SERVER_PORT}`),
    );
}

main().catch(error => {
    console.error('Server startup failed', error);
    process.exit(1);
});
