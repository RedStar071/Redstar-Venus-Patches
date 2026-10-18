#!/bin/sh
# Extract the supported Discord bundle into work/new and build the HBC index (developer-only, never committed).
#   sh scripts/hbc/setup.sh [Discord.apkm]
# The paths match AGENTS.md and scripts/hbc/README.md, so every command there works right after this.
set -e
cd "$(dirname "$0")/../.."
APKM="${1:-$(ls /home/user/uploaded_files/*.apkm 2>/dev/null | head -1)}"
mkdir -p work/new
[ -f work/new/assets/index.android.bundle ] || {
  [ -n "$APKM" ] || { echo "usage: sh scripts/hbc/setup.sh Discord.apkm" >&2; exit 1; }
  unzip -o -q "$APKM" base.apk -d work/new
  unzip -o -q work/new/base.apk assets/index.android.bundle -d work/new
}
sha256sum work/new/assets/index.android.bundle
python3 -c "import sys; sys.path.insert(0,'scripts/hbc'); from hbc import Bundle; B=Bundle('work/new/assets/index.android.bundle'); print(len(B.modules),'modules indexed')"
