import http from 'node:http';
import { Server } from 'socket.io';
import { app } from './app.js';
import { env } from './config/env.js';
import { connectDatabase } from './config/db.js';
import { attachTerminalSocket } from './sockets/terminalSocket.js';
import { attachDesktopSocket } from './sockets/desktopSocket.js';
import { lockVmRuntime } from './services/vm/lock.js';
import { reapStoppedVms } from './services/vm/reaper.js';
import { expireLabs, recoverOrphanedLabs } from './services/labEngine.js';
import { migrateLegacyExperimentLabDefinitions } from './services/experimentMigrations.js';

async function main() {
    await connectDatabase();
    await migrateLegacyExperimentLabDefinitions();
    const releaseVmLock = env.LAB_BACKEND === 'qemu' ? await lockVmRuntime() : async () => undefined;

    // Recover any orphaned lab sessions/Docker resources from prior crash
    await recoverOrphanedLabs();

    const server = http.createServer(app);
    const io = new Server(server, { cors: { origin: env.CLIENT_URL, credentials: true }, destroyUpgrade: false });
    attachTerminalSocket(io);
    attachDesktopSocket(server);

    let cleaning = false;
    setInterval(() => {
        if (cleaning) return;
        cleaning = true;
        void (async () => {
            await expireLabs();
            if (env.LAB_BACKEND === 'qemu') await reapStoppedVms();
        })().catch(console.error).finally(() => { cleaning = false; });
    }, 15000).unref();

    let stopping = false;
    for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => {
        if (stopping) return;
        stopping = true;
        server.close();
        void recoverOrphanedLabs().then(releaseVmLock).then(() => process.exit(0)).catch(error => {
            console.error('Shutdown cleanup failed; recovery metadata retained.', error); process.exit(1);
        });
    });

    server.listen(env.SERVER_PORT, () =>
        console.log(`CyberLabX API listening on ${env.SERVER_PORT}`),
    );
}

main().catch(error => {
    console.error('Server startup failed', error);
    process.exit(1);
});
