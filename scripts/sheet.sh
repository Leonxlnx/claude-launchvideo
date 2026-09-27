#!/usr/bin/env bash
# Usage: scripts/sheet.sh <CompositionId> <from> <to> <every> <out.png> [entry]
# Renders every Nth frame of a range and tiles them into a labeled contact sheet.
set -euo pipefail
COMP=$1; FROM=$2; TO=$3; EVERY=$4; OUT=$5; ENTRY=${6:-src/index.ts}
TMP=$(mktemp -d /tmp/sheetXXXXXXXX); TMP=${TMP//./_}; mkdir -p "$TMP"
npx remotion render "$ENTRY" "$COMP" "$TMP" --sequence --frames="$FROM-$TO" --every-nth-frame="$EVERY" --image-format=jpeg --log=error >/dev/null
N=$(ls "$TMP" | wc -l)
COLS=4
i=0
for f in $(ls "$TMP" | sort); do
  fr=$((FROM + i * EVERY))
  ffmpeg -loglevel error -y -i "$TMP/$f" -vf "scale=480:-2,drawtext=text='f$fr  $(printf '%.2f' $(echo "$fr/60" | bc -l))s':x=8:y=8:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.55" "$TMP/l_$(printf '%04d' $i).png"
  i=$((i+1))
done
ROWS=$(( (N + COLS - 1) / COLS ))
ffmpeg -loglevel error -y -pattern_type glob -i "$TMP/l_*.png" -vf "tile=${COLS}x${ROWS}:padding=4:color=gray" -frames:v 1 "$OUT"
rm -rf "$TMP"
echo "$OUT ($N frames)"
