#!/usr/bin/env bash
# Parallel chunked render: N independent Chromium instances (each with its own GPU process),
# then a lossless concat + audio mux. Usage: scripts/render-chunks.sh <out.mp4> [chunks] [crf] [extra remotion args...]
set -euo pipefail
OUT=$1; CHUNKS=${2:-4}; CRF=${3:-16}; shift 3 || true
cd "$(dirname "$0")/.."
npx tsx scripts/export-cues.ts >/dev/null; TOTAL=$(python3 -c "import json;print(json.load(open('out/cues.json'))['total'])")
TMP=$(mktemp -d /tmp/chunksXXXXXX)
npx remotion bundle src/index.ts --out-dir "$TMP/bundle" --log=error >/dev/null
per=$(( (TOTAL + CHUNKS - 1) / CHUNKS ))
pids=()
for ((i=0; i<CHUNKS; i++)); do
  a=$(( i * per )); b=$(( (i + 1) * per - 1 )); (( b >= TOTAL )) && b=$(( TOTAL - 1 ))
  npx remotion render "$TMP/bundle" Launch "$TMP/part$i.mp4" --frames="$a-$b" --concurrency=1 --crf="$CRF" --muted --log=error "$@" &
  pids+=($!)
done
for p in "${pids[@]}"; do wait "$p"; done
for ((i=0; i<CHUNKS; i++)); do echo "file '$TMP/part$i.mp4'"; done > "$TMP/list.txt"
ffmpeg -loglevel error -y -f concat -safe 0 -i "$TMP/list.txt" -c copy "$TMP/video.mp4"
ffmpeg -loglevel error -y -i "$TMP/video.mp4" -i public/audio/soundtrack.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -shortest "$OUT"
rm -rf "$TMP"
echo "$OUT"
