#!/usr/bin/env bash
# Final render: picture from Remotion (muted), soundtrack muxed by ffmpeg.
# Remotion's own AAC mux leaves the encoder priming in place (~2.5 frames of audio lag),
# so the audio is always attached here and then verified by check-sync.py.
# Usage: scripts/render.sh <out.mp4> [--blur]
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=${1:-out/launch.mp4}
PROPS='{}'
[[ "${2:-}" == "--blur" ]] && PROPS='{"blur":true}'
npx tsx scripts/export-cues.ts
python3 scripts/soundtrack.py
TMP=$(mktemp -d /tmp/renderXXXXXX)
npx remotion render Launch "$TMP/picture.mp4" --muted --crf=14 --x264-preset=slow --props="$PROPS" --log=error
ffmpeg -loglevel error -y -i "$TMP/picture.mp4" -i public/audio/soundtrack.wav \
  -map 0:v -map 1:a -c:v copy -c:a aac -b:a 320k -movflags +faststart -shortest "$OUT"
rm -rf "$TMP"
python3 scripts/check-sync.py "$OUT"
