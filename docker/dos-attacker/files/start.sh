#!/bin/bash
set -eu
mkdir -p /var/run/cyberlabx
touch /var/run/cyberlabx/syn.log
chmod 644 /var/run/cyberlabx/syn.log
# This root-owned capture is deliberately restricted to the private victim.
/usr/bin/tshark -l -n -i eth0 -f 'tcp and host victim' -Y 'tcp.flags.syn == 1' -T fields -e frame.time_epoch -e ip.src -e ip.dst -e tcp.flags.syn > /var/run/cyberlabx/syn.log 2>/dev/null &
exec /usr/bin/python3 /usr/local/lib/cyberlabx/dos-service.py
