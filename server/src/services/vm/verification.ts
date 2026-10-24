import { authorizeVm } from './access.js';
import { guestExec } from './ssh.js';

/** Require completed, server-captured Nmap output before awarding VM task credit. */
export function hasNmapEvidence(taskId: string, command: string, output: string) {
  const tokens = command.trim().replace(/^sudo\s+/, '').split(/\s+/);
  const flags: Record<string, string[]> = {
    'live-host': ['-sn'], 'syn-scan': ['-sS'],
    'os-detection': ['-O', '-A'], 'service-detection': ['-sV', '-A'],
  };
  if (tokens[0] !== 'nmap' || !flags[taskId]?.some(flag => tokens.includes(flag))) return false;
  // The golden path accepts one assigned target and simple scan options only.
  const args = tokens.slice(1);
  const targets = args.filter(arg => arg === 'nmap-target' || arg === '172.28.0.10');
  if (targets.length !== 1 || args.some(arg => !/^(?:nmap-target|172\.28\.0\.10|-sn|-sS|-O|-sV|-A|-Pn|-n|-v|--reason|--osscan-guess|-p(?:80|80,81|81,80)|-p|80|80,81|81,80)$/.test(arg))) return false;
  const clean = output.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').replace(/\r/g, '');
  if (!/Nmap done:[^\n]*\(1 host up\)/.test(clean)) return false;
  if (taskId === 'syn-scan' || taskId === 'service-detection') {
    if (!/^80\/tcp\s+open\s+http/m.test(clean)) return false;
  }
  if (taskId === 'os-detection' && !/OS details:|Running:|OS detection performed|No exact OS matches|Too many fingerprints/i.test(clean)) return false;
  return true;
}

export async function inspectVmTask(sessionId: string, studentId: string) {
  const { vm } = await authorizeVm(sessionId, studentId);
  if (vm.profile !== 'shell-target-v1') return false;
  // This is a connectivity check, not substituted evidence for the student's command.
  try {
    await guestExec(vm, 'nmap -sT -Pn -p 80 nmap-target -oG - | grep "80/open"');
    return true;
  } catch { return false; }
}
