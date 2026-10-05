#!/usr/bin/env bash
# Run in Ubuntu WSL2 with libguestfs-tools, qemu-utils, p7zip-full, curl, gnupg.
# This is offline image preparation only; the runtime hypervisor is Windows QEMU/WHPX.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
VERSION=${KALI_VERSION:-2026.2}
[[ "$VERSION" =~ ^20[0-9]{2}\.[0-9]+$ ]] || { echo 'Invalid Kali release'; exit 1; }
DIR="$ROOT/infrastructure/vm/kali/base"
CACHE="$ROOT/infrastructure/vm/downloads"
mkdir -p "$DIR" "$CACHE"
test ! -e "$DIR/kali.qcow2" || { echo 'Base already exists; use a new build directory/version.'; exit 1; }
ARCHIVE="kali-linux-$VERSION-qemu-amd64.7z"
URL="https://cdimage.kali.org/kali-$VERSION"
curl --fail --location --retry 3 "$URL/SHA256SUMS" -o "$CACHE/SHA256SUMS"
curl --fail --location --retry 3 "$URL/SHA256SUMS.gpg" -o "$CACHE/SHA256SUMS.gpg"
curl --fail --location https://archive.kali.org/archive-key.asc -o "$CACHE/kali-key.asc"
KEYRING=$(mktemp -d)
trap 'rm -rf "$KEYRING"' EXIT
gpg --homedir "$KEYRING" --import "$CACHE/kali-key.asc"
gpg --homedir "$KEYRING" --with-colons --fingerprint | grep -q '827C8569F2518CC677FECA1AED65462EC8D5E4C5' || { echo 'Unexpected Kali signing key; review official key rotation.'; exit 1; }
gpg --homedir "$KEYRING" --verify "$CACHE/SHA256SUMS.gpg" "$CACHE/SHA256SUMS"
curl --fail --location --continue-at - --retry 3 "$URL/$ARCHIVE" -o "$CACHE/$ARCHIVE"
(cd "$CACHE"; grep -E "^[a-fA-F0-9]{64} +[*]?$ARCHIVE$" SHA256SUMS | sha256sum --check --strict)
EXTRACT=$(mktemp -d "$DIR/extract.XXXXXX")
7z x "$CACHE/$ARCHIVE" "-o$EXTRACT"
mapfile -t IMAGES < <(find "$EXTRACT" -name '*.qcow2' -type f)
[[ ${#IMAGES[@]} -eq 1 ]] || { echo 'Expected one official qcow2 image'; exit 1; }
qemu-img convert -f qcow2 -O qcow2 "${IMAGES[0]}" "$DIR/kali.qcow2.partial"
export LIBGUESTFS_BACKEND=direct
# TCG works on WSL installations without nested /dev/kvm; preparation may be slow.
export LIBGUESTFS_BACKEND_SETTINGS=force_tcg
virt-customize -a "$DIR/kali.qcow2.partial" --memsize 2048 --network \
  --mkdir /opt/somaiya --copy-in "$ROOT/docker:/opt/somaiya" \
  --copy-in "$ROOT/infrastructure/vm/guest:/opt/somaiya" \
  --run "$ROOT/infrastructure/vm/guest/prepare.sh"
qemu-img check "$DIR/kali.qcow2.partial"
mv "$DIR/kali.qcow2.partial" "$DIR/kali.qcow2"
HASH=$(sha256sum "$DIR/kali.qcow2" | cut -d' ' -f1)
printf '{"schema":1,"prepared":true,"kaliVersion":"%s","sha256":"%s"}\n' "$VERSION" "$HASH" > "$DIR/kali.qcow2.json"
chmod a-w "$DIR/kali.qcow2"
echo 'Base finalized. Apply a Windows read-only ACL before using it with the backend.'
