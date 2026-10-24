import http from 'node:http';
import { Server } from 'socket.io';
import { app } from './app.js';
import { env } from './config/env.js';
import { connectDatabase } from './config/db.js';
import { attachTerminalSocket } from './sockets/terminalSocket.js';
import { expireLabs, recoverOrphanedLabs } from './services/labEngine.js';
import { migrateLegacyExperimentLabDefinitions } from './services/experimentMigrations.js';
import { lockVmRuntime } from './services/vm/lock.js';
import { reapStoppedVms } from './services/vm/reaper.js';
import { LabSession } from './models/LabSession.js';

async function main() {
    await connectDatabase();
    await migrateLegacyExperimentLabDefinitions();
    const needsVmRuntime = env.LAB_BACKEND === 'qemu' || Boolean(await LabSession.exists({
        vmAttemptId: { $exists: true }, status: { $in: ['provisioning', 'running', 'stopping', 'failed'] },
    }));
    const releaseVmLock = needsVmRuntime ? await lockVmRuntime() : async () => undefined;

    // Recover any orphaned lab sessions/Docker resources from prior crash
    // Unsafe VM recovery must block startup; Docker orphan cleanup already tolerates an offline daemon.
    await recoverOrphanedLabs();

    const server = http.createServer(app);
    const io = new Server(server, { cors: { origin: env.CLIENT_URL, credentials: true } });
    attachTerminalSocket(io);

    let cleaning = false;
    setInterval(() => {
        if (cleaning) return;
        cleaning = true;
        void (async () => {
            await expireLabs();
            // Use persisted session references even after switching the default back to Docker.
            await reapStoppedVms();
        })().catch(console.error).finally(() => { cleaning = false; });
    }, 15_000).unref();

    let stopping = false;
    for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => {
        if (stopping) return;
        stopping = true;
        server.close();
        void recoverOrphanedLabs().then(releaseVmLock).then(() => process.exit(0)).catch(error => {
            console.error('Shutdown cleanup failed; recovery metadata retained.', error);
            process.exit(1);
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
