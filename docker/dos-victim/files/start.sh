#!/bin/sh
set -eu
exec lighttpd -D -f /etc/lighttpd/lighttpd.conf
