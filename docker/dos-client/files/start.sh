#!/bin/sh
set -eu
while true; do curl --silent --max-time 2 http://victim/ >/dev/null || true; sleep 8; done
