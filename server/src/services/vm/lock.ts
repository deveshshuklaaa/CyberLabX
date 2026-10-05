import { mkdir, open, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { vmConfig } from './config.js';

/** Only one backend may recover or manage a runtime directory. */
export async function lockVmRuntime() {
  const directory = path.resolve(vmConfig().VM_RUNTIME_DIR);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if (process.platform === 'win32') {
    const exec = promisify(execFile);
    const { stdout } = await exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      '[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value'], { windowsHide: true });
    const sid = stdout.trim();
    if (!/^S-1-\d+(?:-\d+)+$/.test(sid)) throw new Error('Unable to identify VM runtime owner.');
    await exec('icacls.exe', [directory, '/inheritance:r', '/grant:r', `*${sid}:(OI)(CI)F`, '*S-1-5-18:(OI)(CI)F'], { windowsHide: true });
  }
  const filename = path.join(directory, 'manager.lock');
  try {
    const owner = Number(await readFile(filename, 'utf8'));
    if (!Number.isSafeInteger(owner) || owner <= 0) throw new Error('Invalid VM manager lock; inspect it before restarting.');
    let active = true;
    try { process.kill(owner, 0); } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ESRCH') active = false; else throw error;
    }
    if (active) throw new Error('Another VM manager owns this runtime directory.');
    await rm(filename);
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const handle = await open(filename, 'wx', 0o600);
  await handle.writeFile(String(process.pid)); await handle.close();
  return async () => { if (await readFile(filename, 'utf8') === String(process.pid)) await rm(filename); };
}
