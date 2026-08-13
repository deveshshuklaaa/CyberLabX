/**
 * Docker Integration Smoke Test
 * ──────────────────────────────
 * Verifies that the target container created with CyberLabX's exact
 * Dockerode configuration (CapDrop ALL + CapAdd NET_BIND_SERVICE)
 * becomes healthy.
 *
 * Prerequisites:
 *   - Docker Desktop running
 *   - cyberlabx-target:latest image built
 *
 * Usage:
 *   npx tsx scripts/verify-target-health.ts
 */
import Docker from 'dockerode';

const docker = process.platform === 'win32'
    ? new Docker({ socketPath: '//./pipe/docker_engine' })
    : new Docker({ socketPath: '/var/run/docker.sock' });

const IMAGE = 'cyberlabx-target:latest';
const NAME = 'cyberlabx-health-verify';

/* Helpers */
async function removeQuietly(fn: () => Promise<unknown>) {
    try { await fn(); } catch { /* ok */ }
}

async function waitForHealthy(containerId: string, timeoutMs = 60_000): Promise<string> {
    const finish = Date.now() + timeoutMs;
    while (Date.now() < finish) {
        const info = await docker.getContainer(containerId).inspect();
        const state = info.State;
        const status = state.Health?.Status;

        if (!state.Running) {
            const lastLog = state.Health?.Log?.slice(-1)[0]?.Output?.trim() ?? '(none)';
            return `FAIL — container exited (ExitCode=${state.ExitCode}, lastHealthLog="${lastLog}")`;
        }
        if (status === 'healthy') return 'PASS';
        if (status === 'unhealthy') {
            const lastLog = state.Health?.Log?.slice(-1)[0]?.Output?.trim() ?? '(none)';
            return `FAIL — unhealthy (lastHealthLog="${lastLog}")`;
        }
        await new Promise(r => setTimeout(r, 1000));
    }
    return 'FAIL — timed out';
}

/* ─── Main ───────────────────────────────────────────────────────── */
async function main() {
    console.log('=== CyberLabX Target Container Health Verification ===\n');

    // 1. Verify Docker is reachable
    try {
        await docker.ping();
        console.log('✅  Docker daemon reachable.\n');
    } catch (err) {
        console.error('❌  Cannot reach Docker daemon:', err);
        process.exit(1);
    }

    // 2. Clean up any previous test container
    await removeQuietly(() => docker.getContainer(NAME).remove({ force: true }));

    // 3. Create container with the SAME config as labEngine.ts targetResources
    console.log(`Creating container "${NAME}" from "${IMAGE}" ...`);
    console.log('  CapDrop: ALL');
    console.log('  CapAdd:  NET_BIND_SERVICE, SETUID, SETGID');
    console.log('  PidsLimit: 128');
    console.log('  Memory: 512 MB');
    console.log('  SecurityOpt: no-new-privileges:true\n');

    const container = await docker.createContainer({
        Image: IMAGE,
        name: NAME,
        Hostname: 'nmap-target',
        HostConfig: {
            Memory: 512 * 1024 * 1024,
            NanoCpus: 500_000_000,
            PidsLimit: 128,
            CapDrop: ['ALL'],
            CapAdd: ['NET_BIND_SERVICE', 'SETUID', 'SETGID'],
            SecurityOpt: ['no-new-privileges:true'],
        },
    });

    await container.start();
    console.log(`Container started: ${container.id.slice(0, 12)}`);
    console.log('Waiting for health check ...\n');

    const result = await waitForHealthy(container.id);

    // 4. Inspect and print
    const info = await docker.getContainer(container.id).inspect();
    console.log(`Health status : ${info.State.Health?.Status ?? 'N/A'}`);
    console.log(`Running       : ${info.State.Running}`);
    console.log(`PID           : ${info.State.Pid}`);
    console.log(`CapDrop       : ${JSON.stringify(info.HostConfig?.CapDrop)}`);
    console.log(`CapAdd        : ${JSON.stringify(info.HostConfig?.CapAdd)}`);
    console.log(`Published Ports: ${JSON.stringify(info.HostConfig?.PortBindings ?? {})}`);
    console.log();

    // 5. Report
    if (result === 'PASS') {
        console.log(`✅  RESULT: ${result} — target container is healthy with NET_BIND_SERVICE.\n`);
    } else {
        console.error(`❌  RESULT: ${result}\n`);
    }

    // 6. Also verify that NET_RAW alone FAILS (our regression case)
    console.log('--- Regression check: NET_RAW alone (should fail) ---\n');
    const regName = 'cyberlabx-regression-netraw';
    await removeQuietly(() => docker.getContainer(regName).remove({ force: true }));

    const regContainer = await docker.createContainer({
        Image: IMAGE,
        name: regName,
        Hostname: 'nmap-target',
        HostConfig: {
            Memory: 512 * 1024 * 1024,
            NanoCpus: 500_000_000,
            PidsLimit: 128,
            CapDrop: ['ALL'],
            CapAdd: ['NET_RAW'],       // <-- the old buggy config
            SecurityOpt: ['no-new-privileges:true'],
        },
    });

    await regContainer.start();
    console.log(`Regression container started: ${regContainer.id.slice(0, 12)}`);

    // Give it a moment to crash
    await new Promise(r => setTimeout(r, 3000));
    const regResult = await waitForHealthy(regContainer.id, 5000);

    if (regResult !== 'PASS') {
        console.log(`✅  Regression confirmed: NET_RAW alone → ${regResult}`);
    } else {
        console.error(`⚠️  Unexpected: NET_RAW alone passed. The original bug may not be reproducible on this Docker version.`);
    }

    // 7. Cleanup
    console.log('\nCleaning up ...');
    await removeQuietly(() => container.remove({ force: true }));
    await removeQuietly(() => regContainer.remove({ force: true }));
    console.log('Done.\n');

    process.exit(result === 'PASS' ? 0 : 1);
}

main().catch(err => {
    console.error('Script failed:', err);
    process.exit(1);
});
