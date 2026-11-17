#!/usr/bin/env bash
# Shrinks every video in public/uploads that is too big for Cloudflare (25 MB per file).
# Runs automatically on GitHub after each upload (.github/workflows/compress-videos.yml);
# can also be run by hand: bash tools/compress-videos.sh
set -euo pipefail

LIMIT=$((20 * 1024 * 1024))   # compress anything over 20 MB, safely below Cloudflare's 25 MB
HARD=$((24 * 1024 * 1024))    # the result must end up below this
DIR="public/uploads"
changed=0

size() { stat -c %s "$1" 2>/dev/null || stat -f %z "$1"; }

encode() {   # encode <in> <out> <max width> <quality: lower is better>
  local audio=(-an)
  if ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$1" | grep -q .; then
    audio=(-c:a aac -b:a 128k)
  fi
  ffmpeg -v error -y -i "$1" \
    -vf "scale='min($3,iw)':-2:flags=lanczos" \
    -c:v libx264 -preset slow -crf "$4" -pix_fmt yuv420p -movflags +faststart \
    "${audio[@]}" "$2"
}

shopt -s nullglob nocaseglob
for f in "$DIR"/*.{mp4,mov,m4v,webm}; do
  [ "$(size "$f")" -gt "$LIMIT" ] || continue
  base="${f%.*}"
  out="$base.mp4"
  tmp="$(mktemp --suffix=.mp4 2>/dev/null || mktemp -t vid).mp4"
  before=$(size "$f")

  # first try: 1920px wide, high quality; if still too big, step down
  for step in "1920 23" "1600 26" "1280 28" "1080 31"; do
    set -- $step
    encode "$f" "$tmp" "$1" "$2"
    [ "$(size "$tmp")" -lt "$HARD" ] && break
  done
  if [ "$(size "$tmp")" -ge "$HARD" ]; then
    echo "::warning::$f is still over 24 MB after compressing. Upload a shorter clip." ; rm -f "$tmp"; continue
  fi

  mv "$tmp" "$out"
  if [ "$f" != "$out" ]; then
    # a .mov or .webm became .mp4: remove the original and point the content files at the new name
    rm -f "$f"
    old="uploads/$(basename "$f")"; new="uploads/$(basename "$out")"
    for j in public/content/*.json; do
      python3 - "$j" "$old" "$new" <<'PY'
import sys
p, old, new = sys.argv[1:]
s = open(p, encoding="utf-8").read()
if old in s:
    open(p, "w", encoding="utf-8").write(s.replace(old, new))
PY
    done
  fi
  echo "Compressed $(basename "$f"): $((before / 1048576)) MB -> $(( $(size "$out") / 1048576 )) MB"
  changed=1
done

echo "changed=$changed" >> "${GITHUB_OUTPUT:-/dev/null}"
