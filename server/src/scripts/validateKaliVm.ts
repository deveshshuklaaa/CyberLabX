import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import '../config/env.js';
import { assertVmReady, createVm, destroyVm, getVmStatus, openTerminal, vmDirectory } from '../services/vm/manager.js';
import { guestExec } from '../services/vm/ssh.js';
import { lockVmRuntime } from '../services/vm/lock.js';
import { vmConfig, projectRoot } from '../services/vm/config.js';
import { hasNmapEvidence } from '../services/vm/verification.js';

// Infrastructure-only live check: no database, accounts, dashboards or fabricated guest output.
const boot = process.argv.includes('--boot');
const config = vmConfig();
const attemptId = randomBytes(12).toString('hex');
const result = {
  timestamp: new Date().toISOString(), mode: boot ? 'boot' : 'preflight',
  platform: process.platform, baseImage: config.VM_BASE_IMAGE,
  availableMemoryMB: Math.floor(os.freemem() / 1048576),
  requiredMemoryMB: config.VM_MEMORY_MB + config.VM_HOST_RESERVE_MB,
  preflightPassed: false, vmStarted: false, kaliCommandExecuted: false,
  sshPtyPassed: false, targetReachable: false, cleanupPassed: false,
  scans: [] as { taskId: string; command: string; output: string; passed: boolean }[],
  error: undefined as string | undefined, cleanupError: undefined as string | undefined,
};
let release: (() => Promise<void>) | undefined;
let attempted = false;
try {
  await assertVmReady();
  result.preflightPassed = true;
  if (boot) {
    release = await lockVmRuntime();
    attempted = true;
    const vm = await createVm({ attemptId, studentId: randomBytes(12).toString('hex'),
      profile: 'shell-target-v1', expiresAt: new Date(Date.now() + 15 * 60_000) });
    result.vmStarted = await getVmStatus(attemptId);
    if (!result.vmStarted) throw new Error('QMP did not confirm the running VM identity.');
    const identity = await guestExec(vm, 'cat /etc/os-release; id; uname -a; command -v nmap');
    if (!/^ID=kali$/m.test(identity)) throw new Error('SSH guest is not Kali.');
    result.kaliCommandExecuted = true;
    console.log(identity);
    const shell = await openTerminal(attemptId);
    try {
      await new Promise<void>((resolve, reject) => {
        let output = '';
        const timeout = setTimeout(() => reject(new Error('SSH PTY output timed out.')), 15_000);
        shell.output.on('data', (data: Buffer) => {
          output += data.toString();
          if (/(?:^|\n)__CYBERLABX_PTY_OK__\r?\n/.test(output)) { clearTimeout(timeout); resolve(); }
        });
        shell.output.once('error', (error: Error) => { clearTimeout(timeout); reject(error); });
        shell.resize(100, 30);
        shell.input.write("cat /etc/os-release; printf '\\n__CYBERLABX_PTY_OK__\\n'\r");
      });
      result.sshPtyPassed = true;
    } finally { shell.close(); }
    const target = await guestExec(vm, 'curl --fail --max-time 10 http://nmap-target');
    if (!target.includes('Controlled Nmap Training Target')) throw new Error('Unexpected HTTP target.');
    result.targetReachable = true;
    for (const [taskId, command] of [
      ['live-host', 'sudo nmap -sn nmap-target'],
      ['syn-scan', 'sudo nmap -sS -p 80 nmap-target'],
      ['os-detection', 'sudo nmap -O -p 80,81 nmap-target'],
      ['service-detection', 'nmap -sV -p 80 nmap-target'],
    ]) {
      const output = await guestExec(vm, command);
      const passed = hasNmapEvidence(taskId, command, output);
      result.scans.push({ taskId, command, output, passed });
      if (!passed) throw new Error(`Live Nmap evidence check failed: ${taskId}`);
    }
  }
} catch (error) {
  result.error = error instanceof Error ? error.message : String(error);
  process.exitCode = 1;
} finally {
  if (attempted) {
    try {
      await destroyVm(attemptId);
      let exists = true;
      try { await access(vmDirectory(attemptId)); } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        exists = false;
      }
      result.cleanupPassed = !exists && !await getVmStatus(attemptId);
      if (!result.cleanupPassed) throw new Error('VM resources remain after cleanup.');
    } catch (error) {
      result.cleanupError = error instanceof Error ? error.message : String(error);
      process.exitCode = 1;
    }
  }
  if (!result.cleanupError) await release?.();
  const output = path.join(projectRoot, 'infrastructure/vm', `validation-${boot ? 'boot' : 'preflight'}.json`);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
  console.log(`Evidence: ${output}`);
}
