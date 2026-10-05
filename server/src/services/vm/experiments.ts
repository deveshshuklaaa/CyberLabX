import type { IExperiment, Task } from '../../models/Experiment.js';

function task(id: string, title: string, command: string, order: number, output: string[] = [], marks = 15): Task {
  const tokens = command.replace(/^sudo /, '').split(' ');
  return { id, title, description: `Run ${command} in Kali. Inspect the genuine output.`, hints: [command], order, marks,
    verification: [{ type: 'command', tool: tokens[0], requiredTarget: 'none' },
      ...(output.length ? [{ type: 'output_contains' as const, requiredOutput: output }] : [])] };
}

/** A VM-specific view: stored legacy curriculum remains available until live validation. */
export function vmExperiment<T extends IExperiment>(original: T): T {
  // Preserve Mongo ObjectId serialization in the public experiment response.
  const value = { ...original, lab: { ...original.lab, terminal: { ...original.lab.terminal } } } as T;
  value.lab.terminal.promptLabel = 'student@somaiya:~$';
  const profile = value.lab.profile;
  const intro = ['Start Kali and use its real bash terminal. Use sudo for privileged tools.',
    'Use only assigned targets and synthetic evidence. Install packages only when faculty enables Internet access.'];
  switch (profile) {
    case 'shell-target-v1':
      value.tasks = value.tasks.map(t => ({ ...t, hints: t.hints.map(h => h.replace(/^nmap/, 'sudo nmap')) }));
      break;
    case 'recon-v1':
      value.tasks = [
        task('recon-connectivity', 'Confirm target connectivity', 'ping -c 3 recon-target', 1, ['3 received']),
        task('recon-dns', 'Query the laboratory DNS server', 'nslookup recon-target 172.28.0.10', 2, ['172.28.0.10']),
        task('recon-route', 'Inspect target route', 'traceroute recon-target', 3, ['172.28.0.10']),
        task('recon-service', 'Discover actual target services', 'nmap -sV recon-target', 4, ['80/tcp']),
        task('recon-local-sockets', 'Inspect Kali sockets', 'ss -tuln', 5, ['LISTEN']),
        task('recon-osint', 'Enumerate controlled DNS footprint', 'dig @172.28.0.10 portal.recon-target', 6, ['172.28.0.10']),
      ];
      value.description = 'Use genuine Kali reconnaissance utilities against the assigned lab target. External OSINT requires faculty-approved egress and targets.';
      break;
    case 'dos-analysis-v1':
      value.tasks = [
        task('baseline', 'Measure normal victim HTTP response', 'curl http://victim', 1, ['CyberLabX']),
        task('controlled-syn', 'Send a bounded SYN probe series', 'sudo hping3 -S -p 80 -c 60 -i u100000 victim', 2, ['60 packets transmitted']),
        task('capture-syn', 'Inspect actual SYN packets', 'sudo tshark -r /home/student/work/traffic.pcap -Y tcp.flags.syn==1', 3, ['SYN']),
        task('analyze-anomaly', 'Measure packet timing', 'sudo tshark -r /home/student/work/traffic.pcap -q -z io,stat,1', 4, ['IO Statistics']),
      ];
      intro.push('Before task 2, start sudo tshark -i any -f "host 172.28.0.10" -a duration:30 -w /home/student/work/traffic.pcap in the GUI terminal. Then send only the bounded probe series in the browser terminal.');
      value.description = 'Analyze genuine bounded hping3 traffic to the assigned guest-internal victim alongside the legitimate HTTP client.';
      break;
    case 'keylogger-lab-v1':
      value.tasks = [
        task('compile-skeylogger', 'Compile upstream skeylogger', 'make -C /home/student/skeylogger', 1),
        task('launch-skeylogger', 'Start guest keyboard observation', 'sudo /home/student/skeylogger/skeylogger &', 2),
        task('inject-test-input', 'Confirm virtual keyboard events', 'sudo cat /var/log/skeylogger', 3),
        task('inspect-log', 'Stop observation and inspect the log', 'sudo cat /var/log/skeylogger', 4),
      ];
      intro.push('Open Kali Desktop. After starting skeylogger, type SomaiyaLabTest2026 in the GUI terminal; use only test text. SSH keystrokes are not virtual keyboard events.',
        'Stop the process using sudo pkill -x skeylogger before the final task. No keylogger is started automatically.');
      value.description = 'Compile upstream skeylogger and observe only QEMU virtual keyboard input inside the disposable Kali guest.';
      break;
    case 'email-forensics-v1':
      value.tasks = [
        task('hash-original-email', 'Hash the original synthetic email', 'sha256sum evidence/email_sample.eml', 1, ['email_sample.eml']),
        task('header-analysis', 'Inspect authentication headers', 'grep -E "Received:|Authentication-Results:" evidence/email_sample.eml', 2, ['dkim=fail']),
        task('extract-mime', 'Extract MIME evidence', 'ripmime -i evidence/email_sample.eml -d work/attachments', 3),
        task('identify-attachment', 'Identify extracted file formats', 'file work/attachments/AccountNotice.pdf', 4, ['PDF']),
        task('metadata-inspection', 'Inspect attachment metadata', 'exiftool work/attachments/AccountNotice.pdf', 5, ['File Type']),
      ];
      intro.push('Keep evidence/ unchanged. Do not open extracted links or execute extracted files. bulk_extractor and whois are installed; external WHOIS requires faculty authorization.');
      break;
    case 'file-forensics-v1':
      value.tasks = [
        task('inspect-initial', 'Identify disguised evidence', 'file evidence/disguised_image.sys', 1, ['JPEG']),
        task('hex-signature', 'Inspect the JPEG signature', 'xxd -l 32 evidence/disguised_image.sys', 2, ['ffd8']),
        task('rename-recovery', 'Create a working JPEG copy', 'cp evidence/disguised_image.sys work/recovered.jpg', 3),
        task('verify-integrity', 'Compare original and working hashes', 'sha256sum evidence/disguised_image.sys work/recovered.jpg', 4, ['recovered.jpg']),
      ];
      break;
    case 'disk-forensics-v1':
      value.tasks = [
        task('acquire-image', 'Acquire the disposable forensic disk', 'sudo dd if=/dev/vdb of=/home/student/work/disk_image.img bs=4M status=progress', 1, ['bytes']),
        task('hash-image', 'Hash the acquired image', 'sha256sum work/disk_image.img', 2, ['disk_image.img']),
        task('clone-disk', 'Clone the working image', 'sudo dd if=/home/student/work/disk_image.img of=/home/student/work/cloned_disk.img bs=4M', 3, ['bytes']),
        task('verify-clone', 'Verify clone integrity', 'sha256sum work/disk_image.img work/cloned_disk.img', 4, ['cloned_disk.img']),
        task('recover-files', 'Inspect the genuine filesystem with TestDisk', 'sudo testdisk /log /home/student/work/disk_image.img', 5),
        task('verify-recovered-hash', 'Inspect synthetic recovered evidence', 'sha256sum work/recovered/confidential.txt', 6, ['confidential.txt']),
      ];
      intro.push('Run lsblk -o NAME,SIZE,LABEL first: /dev/vda is Kali; /dev/vdb is the disposable 2 GiB SOMAIYA_EVIDENCE disk.',
        'Preserve the acquired image; use a copy with TestDisk or PhotoRec. In TestDisk select None partition table for the whole-device ext4 filesystem and copy confidential.txt into /home/student/work/recovered/.',
        'losetup, mount, mkfs.ext4, TestDisk and PhotoRec are real guest tools. Formatting /dev/vdb is allowed only after acquisition.');
      break;
  }
  // Preserve established grading weights and quiz totals.
  value.tasks = value.tasks.map((t, i) => ({ ...t, marks: original.tasks[i]?.marks ?? t.marks }));
  value.procedureSections = [...intro, ...value.tasks.map(t => `${t.title}: ${t.hints[0] ?? t.description}`)];
  value.objectives = value.tasks.map(t => t.title);
  return value;
}
