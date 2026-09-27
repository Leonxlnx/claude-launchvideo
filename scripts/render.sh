#!/usr/bin/env bash
# Render: picture from Remotion (muted), soundtrack muxed by ffmpeg.
# Remotion's own AAC mux leaves the encoder priming in place (~2.5 frames of audio lag),
# so the audio is always attached here and then verified by check-sync.py.
#
# --blur renders the motion-blurred master: a sharp render is measured for on-screen speed
# (scripts/measure-speed.py decides the samples per frame), Remotion renders the film as
# sub-frames (the LaunchSub composition) and scripts/accumulate.py averages them in float.
#
# Usage: scripts/render.sh <out.mp4> [--blur]
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=${1:-out/launch.mp4}
npx tsx scripts/export-cues.ts
python3 scripts/soundtrack.py
TMP=$(mktemp -d /tmp/renderXXXXXX)
trap 'rm -rf "$TMP"' EXIT
if [[ "${2:-}" == "--blur" ]]; then
  npx remotion render Launch "$TMP/sharp.mp4" --muted --crf=12 --x264-preset=veryfast --log=error
  python3 scripts/measure-speed.py "$TMP/sharp.mp4" out/samples.json
  npx remotion render LaunchSub "$TMP/sub.mp4" --props=out/samples.json --muted --crf=6 --x264-preset=veryfast --pixel-format=yuv444p --log=error
  python3 scripts/accumulate.py "$TMP/sub.mp4" out/samples.json "$TMP/picture.mp4"
else
  npx remotion render Launch "$TMP/picture.mp4" --muted --crf=14 --x264-preset=slow --log=error
fi
ffmpeg -loglevel error -y -i "$TMP/picture.mp4" -i public/audio/soundtrack.wav \
  -map 0:v -map 1:a -c:v copy -c:a aac -b:a 320k -movflags +faststart -shortest "$OUT"
python3 scripts/check-sync.py "$OUT"
