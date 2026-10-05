#!/bin/bash
set -euo pipefail
if test -f /var/lib/somaiya-initialized; then touch /run/somaiya-ready; exit 0; fi
modprobe qemu_fw_cfg
python3 /opt/somaiya/guest/identity.py
hostnamectl set-hostname somaiya
PROFILE=$(cat /run/somaiya-profile)
mkdir -p /home/student/evidence /home/student/work
cp /opt/somaiya/docker/email-forensics/files/email_sample.eml /home/student/evidence/
cp /opt/somaiya/docker/file-forensics/files/disguised_image.sys /home/student/evidence/
chmod -R a-w /home/student/evidence
chown student:student /home/student/work
if [[ "$PROFILE" == keylogger-lab-v1 ]]; then
  cp -a /opt/somaiya/skeylogger /home/student/skeylogger
  chown -R student:student /home/student/skeylogger
fi
case "$PROFILE" in
  shell-target-v1|recon-v1|dos-analysis-v1)
    docker network create --internal --subnet 172.28.0.0/24 somaiya-lab
    case "$PROFILE" in
      shell-target-v1) IMAGE=target; NAME=nmap-target;;
      recon-v1) IMAGE=recon-target; NAME=recon-target;;
      dos-analysis-v1) IMAGE=dos-victim; NAME=victim;;
    esac
    docker load -i "/opt/somaiya/$IMAGE.tar"
    docker run -d --name "$NAME" --hostname "$NAME" --network somaiya-lab --ip 172.28.0.10 \
      --memory 128m --cpus 0.5 --pids-limit 64 "somaiya-$IMAGE:base"
    printf '172.28.0.10 %s\n' "$NAME" >> /etc/hosts
    for _ in $(seq 1 30); do
      test "$(docker inspect -f '{{.State.Health.Status}}' "$NAME")" = healthy && break
      sleep 1
    done
    test "$(docker inspect -f '{{.State.Health.Status}}' "$NAME")" = healthy
    if [[ "$PROFILE" == dos-analysis-v1 ]]; then
      docker load -i /opt/somaiya/dos-client.tar
      docker run -d --name legitimate-client --network somaiya-lab --memory 64m --cpus 0.25 --pids-limit 32 somaiya-dos-client:base
    fi
    ;;
  disk-forensics-v1)
    # Only the explicitly attached synthetic 2 GiB virtio disk, never the OS disk.
    test "$(blockdev --getsize64 /dev/vdb)" = 2147483648
    mkfs.ext4 -L SOMAIYA_EVIDENCE /dev/vdb
    mkdir -p /mnt/somaiya-evidence
    mount /dev/vdb /mnt/somaiya-evidence
    cp /opt/somaiya/docker/disk-forensics/files/evidence/* /mnt/somaiya-evidence/
    sync
    umount /mnt/somaiya-evidence
    ;;
esac
touch /var/lib/somaiya-initialized /run/somaiya-ready
