#!/bin/bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y kali-desktop-xfce openssh-server sudo qemu-guest-agent xterm bash \
  nmap hping3 tshark wireshark gcc make bulk-extractor ripmime libimage-exiftool-perl \
  whois traceroute dnsutils xxd bsdextrautils file coreutils util-linux e2fsprogs \
  testdisk python3 git docker.io curl net-tools iproute2 iputils-ping xinput x11-utils
for tool in nmap hping3 tshark wireshark gcc bulk_extractor ripmime exiftool whois \
  traceroute nslookup xxd hexdump file dd losetup mount testdisk photorec python3 git docker; do
  command -v "$tool" || exit 1
done
chmod +x /opt/somaiya/guest/*.sh
# Windows checkout CRLFs must not leak into guest entrypoints.
find /opt/somaiya -type f \( -name '*.sh' -o -name Dockerfile \) -exec sed -i 's/\r$//' {} +
passwd -l kali || true
passwd -l root
rm -f /etc/ssh/ssh_host_* /home/kali/.ssh/authorized_keys
mkdir -p /etc/ssh/sshd_config.d /etc/lightdm/lightdm.conf.d
cat > /etc/ssh/sshd_config.d/00-somaiya.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
AllowUsers student
ListenAddress 10.0.2.15
HostKey /etc/ssh/ssh_host_ed25519_key
EOF
cat > /etc/lightdm/lightdm.conf.d/99-somaiya.conf <<'EOF'
[Seat:*]
autologin-user=student
autologin-user-timeout=0
user-session=xfce
EOF
cat > /etc/systemd/system/somaiya-init.service <<'EOF'
[Unit]
Description=Provision disposable Somaiya Kali attempt
Wants=network-online.target
After=network-online.target docker.service
Before=ssh.service lightdm.service
[Service]
Type=oneshot
ExecStart=/opt/somaiya/guest/first-boot.sh
RemainAfterExit=yes
[Install]
WantedBy=multi-user.target
EOF
mkdir -p /etc/systemd/system/ssh.service.d /etc/systemd/system/lightdm.service.d
printf '[Unit]\nRequires=somaiya-init.service\nAfter=somaiya-init.service\n' > /etc/systemd/system/ssh.service.d/somaiya.conf
cp /etc/systemd/system/ssh.service.d/somaiya.conf /etc/systemd/system/lightdm.service.d/somaiya.conf
systemctl enable somaiya-init ssh docker lightdm qemu-guest-agent
# Build target images in the image preparation appliance; no Windows Docker socket is mounted.
dockerd --storage-driver=vfs --iptables=false --bridge=none >/tmp/somaiya-docker-build.log 2>&1 &
DOCKER_PID=$!
trap 'kill "$DOCKER_PID" || true' EXIT
for _ in $(seq 1 60); do docker info >/dev/null 2>&1 && break; sleep 1; done
for name in target recon-target dos-victim dos-client; do
  docker build --network=host -t "somaiya-$name:base" "/opt/somaiya/docker/$name"
  docker save "somaiya-$name:base" -o "/opt/somaiya/$name.tar"
done
apt-get clean
git clone https://github.com/gsingh93/simple-key-logger.git /opt/somaiya/skeylogger
git -C /opt/somaiya/skeylogger checkout a687c72a59aae7462e448fb41bd0f1e1fc35d793
# Build once to catch missing dependencies; students receive sources and compile again.
make -C /opt/somaiya/skeylogger
install -m 0755 /opt/somaiya/skeylogger/skeylogger /usr/local/bin/skeylogger
make -C /opt/somaiya/skeylogger clean
truncate -s 0 /etc/machine-id
rm -f /var/lib/dbus/machine-id
ln -s /etc/machine-id /var/lib/dbus/machine-id
