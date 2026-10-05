#!/bin/sh
set -e

MY_IP=$(hostname -i | awk '{print $1}')
echo "127.0.0.1 localhost" > /etc/dnsmasq.hosts
echo "$MY_IP recon-target mail.recon-target portal.recon-target api.recon-target" >> /etc/dnsmasq.hosts

# Launch dnsmasq (it daemonizes itself)
dnsmasq --no-resolv --addn-hosts=/etc/dnsmasq.hosts --listen-address=0.0.0.0 --port=53

# Launch lighttpd in foreground
exec lighttpd -D -f /etc/lighttpd/lighttpd.conf
