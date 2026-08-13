/**
 * Docker Integration Smoke Test — Nmap File Capabilities
 * ────────────────────────────────────────────────────────
 * Verifies that the Kali image's /usr/lib/nmap/nmap has NO file
 * capabilities, and that nmap is fully executable inside a
 * container hardened with the same security config as labEngine.ts:
 *
 *   CapDrop: ALL
 *   CapAdd:  NET_RAW
 *   SecurityOpt: no-new-privileges:true
 *
 * Prerequisites:
 *   - Docker Desktop running
 *   - cyberlabx-kali:latest image built
 *
 * Usage:
 *   npx tsx scripts/verify-nmap-caps.ts
 */
import Docker from 'dockerode';

const docker = process.platform === 'win32'
    ? new Docker({ socketPath: '//./pipe/docker_engine' })
    : new Docker({ socketPath: '/var/run/docker.sock' });

const IMAGE = 'cyberlabx-kali:latest';
const NAME = 'cyberlabx-nmap-caps-verify';

/* Helpers */
async function removeQuietly(fn: () => Promise<unknown>) {
    try { await fn(); } catch { /* ok */ }
}

async function execInContainer(
    container: Docker.Container,
    cmd: string[],
): Promise<{ exitCode: number; output: string }> {
    const exec = await container.exec({
        Cmd: cmd,
        AttachStdout: true,
        AttachStderr: true,
    });
    const stream = await exec.start({ hijack: true, stdin: false });

    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', resolve);
        stream.on('error', reject);
    });

    const inspectResult = await exec.inspect();
    return {
        exitCode: inspectResult.ExitCode ?? -1,
        output: Buffer.concat(chunks).toString('utf-8').trim(),
    };
}

/* ─── Main ───────────────────────────────────────────────────────── */
async function main() {
    console.log('=== CyberLabX Nmap File Capabilities Smoke Test ===\n');

    let passed = 0;
    let failed = 0;

    function check(label: string, ok: boolean, detail?: string) {
        if (ok) {
            console.log(`  ✅  ${label}`);
            passed++;
        } else {
            console.log(`  ❌  ${label}${detail ? ` — ${detail}` : ''}`);
            failed++;
        }
    }

    // 1. Verify Docker is reachable
    try {
        await docker.ping();
        console.log('Docker daemon reachable.\n');
    } catch (err) {
        console.error('❌  Cannot reach Docker daemon:', err);
        process.exit(1);
    }

    // 2. Clean up any previous test container
    await removeQuietly(() => docker.getContainer(NAME).remove({ force: true }));

    // 3. Create container with EXACT labEngine.ts student hardening
    console.log(`Creating container "${NAME}" from "${IMAGE}" ...`);
    console.log('  CapDrop: ALL');
    console.log('  CapAdd:  NET_RAW');
    console.log('  SecurityOpt: no-new-privileges:true\n');

    const container = await docker.createContainer({
        Image: IMAGE,
        name: NAME,
        Hostname: 'kali-student',
        Cmd: ['/bin/bash'],
        Tty: true,
        OpenStdin: true,
        HostConfig: {
            Memory: 512 * 1024 * 1024,
            NanoCpus: 500_000_000,
            PidsLimit: 128,
            CapDrop: ['ALL'],
            CapAdd: ['NET_RAW'],
            SecurityOpt: ['no-new-privileges:true'],
        },
    });

    await container.start();
    console.log(`Container started: ${container.id.slice(0, 12)}\n`);

    // ── Test 1: getcap shows no file capabilities ──
    console.log('--- Test 1: getcap /usr/lib/nmap/nmap ---');
    const getcapResult = await execInContainer(container, ['getcap', '/usr/lib/nmap/nmap']);
    const hasNoCaps = getcapResult.output === '' || getcapResult.output.trim() === '';
    check(
        'No file capabilities on /usr/lib/nmap/nmap',
        hasNoCaps,
        hasNoCaps ? undefined : `got: "${getcapResult.output}"`,
    );

    // ── Test 2: nmap --version succeeds ──
    console.log('\n--- Test 2: nmap --version ---');
    const versionResult = await execInContainer(container, ['nmap', '--version']);
    check(
        'nmap --version exits 0',
        versionResult.exitCode === 0,
        `exitCode=${versionResult.exitCode}`,
    );
    if (versionResult.exitCode === 0) {
        // Print first line of version output
        const firstLine = versionResult.output.split('\n').find(l => l.includes('Nmap'));
        if (firstLine) console.log(`       ${firstLine.replace(/[^\x20-\x7E]/g, '').trim()}`);
    }

    // ── Test 3: nmap -sT localhost succeeds (TCP connect — no raw sockets) ──
    console.log('\n--- Test 3: nmap -sT localhost ---');
    const stResult = await execInContainer(container, ['nmap', '-sT', 'localhost']);
    check(
        'nmap -sT localhost exits 0',
        stResult.exitCode === 0,
        `exitCode=${stResult.exitCode}`,
    );

    // ── Summary ──
    console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);

    // Cleanup
    console.log('Cleaning up ...');
    await removeQuietly(() => container.remove({ force: true }));
    console.log('Done.\n');

    process.exit(failed === 0 ? 0 : 1);
}

main().catch(err => {
    console.error('Script failed:', err);
    process.exit(1);
});
