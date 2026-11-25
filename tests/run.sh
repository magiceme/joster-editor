#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
export JOSTER_TEST_DIR="${JOSTER_TEST_DIR:-$(mktemp -d)}"
mkdir -p "$JOSTER_TEST_DIR"
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "color=blue:s=320x180:r=30:d=2,drawbox=x=0:y=0:w=iw:h=ih:color=white:t=fill:enable='between(t,0.75,1.15)'" \
  -f lavfi -i "aevalsrc=0.55*sin(2*PI*660*t)*between(t\,0.75\,1.15):s=48000:d=2" \
  -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest "$JOSTER_TEST_DIR/sync.mp4"
ffmpeg -hide_banner -loglevel error -y -f lavfi -i sine=frequency=330:duration=2 "$JOSTER_TEST_DIR/tone.wav"
node tests/smoke.cjs
python3 tests/verify_export.py "$JOSTER_TEST_DIR"
