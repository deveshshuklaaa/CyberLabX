import { getVm } from './manager.js';
import { guestExec } from './ssh.js';

/** Fixed server-owned inspections only; never execute a browser-submitted command. */
const checks: Record<string, Record<string, string>> = {
  'shell-target-v1': {
    'live-host': 'nmap -sT -p 80 172.28.0.10 -oG - | grep "80/open"',
    'syn-scan': 'nmap -sT -p 80 172.28.0.10 -oG - | grep "80/open"',
    'os-detection': 'nmap -sT -p 80 172.28.0.10 -oG - | grep "80/open"',
    'service-detection': 'nmap -sT -p 80 172.28.0.10 -oG - | grep "80/open"',
  },
  'keylogger-lab-v1': {
    'compile-skeylogger': 'test -x /home/student/skeylogger/skeylogger',
    'launch-skeylogger': 'pgrep -x skeylogger',
    'inject-test-input': 'sudo test -s /var/log/skeylogger',
    'inspect-log': 'sudo test -s /var/log/skeylogger && ! pgrep -x skeylogger',
  },
  'email-forensics-v1': { 'extract-mime': 'test -s /home/student/work/attachments/AccountNotice.pdf' },
  'file-forensics-v1': {
    'rename-recovery': 'cmp /home/student/evidence/disguised_image.sys /home/student/work/recovered.jpg',
    'verify-integrity': 'cmp /home/student/evidence/disguised_image.sys /home/student/work/recovered.jpg',
  },
  'disk-forensics-v1': {
    'acquire-image': 'test "$(stat -c %s /home/student/work/disk_image.img)" = 2147483648',
    'clone-disk': 'cmp /home/student/work/disk_image.img /home/student/work/cloned_disk.img',
    'verify-clone': 'cmp /home/student/work/disk_image.img /home/student/work/cloned_disk.img',
    'recover-files': 'test -s /home/student/testdisk.log || test -s /home/student/work/testdisk.log',
    'verify-recovered-hash': 'cmp /opt/somaiya/docker/disk-forensics/files/evidence/confidential.txt /home/student/work/recovered/confidential.txt',
  },
};
export async function inspectVmTask(attemptId: string, taskId: string) {
  const vm = await getVm(attemptId);
  const command = checks[vm.profile]?.[taskId];
  if (!command) return true;
  try { await guestExec(vm, command); return true; } catch { return false; }
}
