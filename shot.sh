#!/bin/sh
# shot.sh <url> <name> [width] [height]  ->  shots/<name>.png
# Headless Chrome (the same engine as the real browser), for full-page visual checks.
# Headless windows can't go narrower than ~500px, so narrow widths render the page
# inside an iframe of exactly that width (a true phone-width viewport for media queries).
W=${3:-1440}; H=${4:-2400}
DIR=$(cd "$(dirname "$0")" && pwd)
TARGET="$1"
WIN=$W
if [ "$W" -lt 600 ]; then
  WRAP="$DIR/shots/_frame-$2.html"
  printf '<!doctype html><html><body style="margin:0;background:#888"><iframe src="%s" style="border:0;display:block;width:%spx;height:%spx"></iframe></body></html>' "$1" "$W" "$H" > "$WRAP"
  TARGET="file:///$(cygpath -m "$WRAP")"
  WIN=600
fi
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --hide-scrollbars \
  --user-data-dir="$(cygpath -w "$LOCALAPPDATA/Temp/mdr-shot-profile")" --window-size="$WIN,$H" --virtual-time-budget=6000 \
  --screenshot="$(cygpath -w "$DIR/shots/$2.png")" "$TARGET" >/dev/null 2>&1
if [ "$W" -lt 600 ]; then python -c "from PIL import Image; im=Image.open(r'$(cygpath -w "$DIR/shots/$2.png")'); im.crop((0,0,$W,$H)).save(r'$(cygpath -w "$DIR/shots/$2.png")')"; rm -f "$WRAP"; fi
echo "shots/$2.png"
