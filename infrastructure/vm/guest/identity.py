"""Read per-attempt identity from QEMU firmware, with no host filesystem share."""
import json
import pathlib
import re
import subprocess

config = json.loads(pathlib.Path('/sys/firmware/qemu_fw_cfg/by_name/opt/org.somaiya/config/raw').read_bytes())
assert re.fullmatch(r'[a-fA-F0-9]{24}', config['attemptId'])
assert config['profile'] in ['shell-target-v1', 'recon-v1', 'dos-analysis-v1', 'keylogger-lab-v1', 'email-forensics-v1', 'file-forensics-v1', 'disk-forensics-v1']
subprocess.run(['useradd', '-m', '-s', '/bin/bash', '-G', 'sudo', 'student'], check=True)
# A locked password would prevent some PAM/SSH configurations; an unguessable hash
# permits public-key SSH, while password authentication remains disabled.
import secrets
password = subprocess.run(['openssl', 'passwd', '-6', '-stdin'], input=secrets.token_urlsafe(48), text=True, capture_output=True, check=True).stdout.strip()
subprocess.run(['usermod', '-p', password, 'student'], check=True)
ssh = pathlib.Path('/home/student/.ssh')
ssh.mkdir(mode=0o700)
(ssh / 'authorized_keys').write_text(config['publicKey'] + '\n')
(ssh / 'authorized_keys').chmod(0o600)
subprocess.run(['chown', '-R', 'student:student', str(ssh)], check=True)
private = pathlib.Path('/etc/ssh/ssh_host_ed25519_key')
private.write_text(config['hostPrivateKey'])
private.chmod(0o600)
pathlib.Path('/etc/ssh/ssh_host_ed25519_key.pub').write_text(config['hostPublicKey'] + '\n')
sudo = pathlib.Path('/etc/sudoers.d/somaiya-student')
sudo.write_text('student ALL=(ALL:ALL) NOPASSWD: ALL\n')
sudo.chmod(0o440)
pathlib.Path('/run/somaiya-profile').write_text(config['profile'])
pathlib.Path('/home/student/.bashrc').write_text("export PS1='student@somaiya:\\w\\$ '\n")
