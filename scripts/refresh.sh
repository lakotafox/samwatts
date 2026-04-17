#!/usr/bin/env bash
# Pull latest media from Sam's public socials and rebuild the media index.
#   Instagram:  @mini_watts           (instaloader, uses Chrome cookies)
#   TikTok:     @.theguynextdoor      (yt-dlp)
#   YouTube:    @samuelwatts5995      (yt-dlp)
#
# Run from the server (triggered by /api/refresh) or manually:
#   bash scripts/refresh.sh
set -e

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
mkdir -p "$ROOT/assets/ig-scrape/photos" "$ROOT/assets/ig-scrape/videos" \
         "$ROOT/assets/tt-scrape" "$ROOT/assets/yt-scrape"

echo "== refresh starting @ $(date) =="

# locate tools (pipx-installed on this machine)
find_tool(){
  for candidate in "$HOME/.local/bin/$1" "/opt/homebrew/bin/$1" "$1"; do
    if command -v "$candidate" >/dev/null 2>&1; then echo "$candidate"; return; fi
  done
}
INSTA="$(find_tool instaloader)"
YTDLP="$(find_tool yt-dlp)"

# ---------------- Instagram ----------------
if [ -z "$INSTA" ]; then
  echo "SKIP instagram: instaloader not installed"
else
  echo "== instagram: @mini_watts =="
  cd "$ROOT/assets/ig-scrape"
  "$INSTA" \
    --no-metadata-json \
    --dirname-pattern=. \
    --filename-pattern='{date_utc}_{shortcode}' \
    --load-cookies chrome \
    --fast-update \
    mini_watts || echo "(instagram pull hit an error, continuing)"

  # sort loose files into photos/ and videos/
  for f in *.mp4; do
    [ -e "$f" ] || continue
    base="${f%.mp4}"
    mv "$f" videos/
    [ -f "${base}.jpg" ] && mv "${base}.jpg" videos/
    [ -f "${base}.txt" ] && mv "${base}.txt" videos/
  done
  for f in *.jpg; do
    [ -e "$f" ] || continue
    base="${f%.jpg}"
    if [ -f "videos/${base}.mp4" ]; then
      cp "$f" videos/; rm "$f"
      [ -f "${base}.txt" ] && rm -f "${base}.txt"
    else
      mv "$f" photos/
      [ -f "${base}.txt" ] && mv "${base}.txt" photos/
    fi
  done
  for f in *.txt; do [ -e "$f" ] || continue; mv "$f" photos/; done
fi

# ---------------- TikTok + YouTube via yt-dlp ----------------
if [ -z "$YTDLP" ]; then
  echo "SKIP tiktok/youtube: yt-dlp not installed"
else
  YTDLP_COMMON=(
    --ignore-errors
    --no-warnings
    --download-archive  "archive.txt"
    --write-thumbnail   --convert-thumbnails jpg
    --write-description
    --output            "%(upload_date>%Y-%m-%d)s_00-00-00_%(id)s.%(ext)s"
  )

  echo "== tiktok: @.theguynextdoor =="
  cd "$ROOT/assets/tt-scrape"
  "$YTDLP" "${YTDLP_COMMON[@]}" \
    "https://www.tiktok.com/@.theguynextdoor" || echo "(tiktok pull hit an error, continuing)"

  echo "== youtube: @samuelwatts5995 =="
  cd "$ROOT/assets/yt-scrape"
  "$YTDLP" "${YTDLP_COMMON[@]}" \
    "https://www.youtube.com/@samuelwatts5995/videos" || echo "(youtube pull hit an error, continuing)"
  "$YTDLP" "${YTDLP_COMMON[@]}" \
    "https://www.youtube.com/@samuelwatts5995/shorts" || echo "(youtube shorts pull hit an error, continuing)"

  # yt-dlp writes .description files — rename to .txt so build-index.py picks them up
  for dir in "$ROOT/assets/tt-scrape" "$ROOT/assets/yt-scrape"; do
    cd "$dir"
    for f in *.description; do
      [ -e "$f" ] || continue
      mv "$f" "${f%.description}.txt"
    done
  done
fi

echo "== rebuilding index.json =="
python3 "$ROOT/media-browser/build-index.py"

echo "== refresh done @ $(date) =="
