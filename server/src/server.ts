import http from 'node:http';
import { Server } from 'socket.io';
import { app } from './app.js';
import { env } from './config/env.js';
import { connectDatabase } from './config/db.js';
import { attachTerminalSocket } from './sockets/terminalSocket.js';
import { attachDesktopSocket } from './sockets/desktopSocket.js';
import { expireLabs, recoverOrphanedLabs } from './services/labEngine.js';
import { migrateLegacyExperimentLabDefinitions } from './services/experimentMigrations.js';

async function main() {
    await connectDatabase();
    await migrateLegacyExperimentLabDefinitions();

    // Recover any orphaned lab sessions/Docker resources from prior crash
    await recoverOrphanedLabs();

    const server = http.createServer(app);
    const io = new Server(server, { cors: { origin: env.CLIENT_URL, credentials: true } });
    attachTerminalSocket(io);
    attachDesktopSocket(server);

    setInterval(() => { expireLabs().catch(console.error); }, 60_000).unref();

    server.listen(env.SERVER_PORT, () =>
        console.log(`CyberLabX API listening on ${env.SERVER_PORT}`),
    );
}

main().catch(error => {
    console.error('Server startup failed', error);
    process.exit(1);
});
