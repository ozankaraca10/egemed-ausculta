#!/bin/zsh
set -e
BASE="https://data.mendeley.com/public-api/datasets/8972jxbpmp/files?folder_id=root&version=3"
DEST="${1:-/tmp/egemed-ausculta/hls-cmds}"
mkdir -p "$DEST"
API=$(curl -sL "$BASE")
for f in HS.csv LS.csv Mix.csv HS.zip LS.zip Mix.zip; do
  id=$(echo "$API" | python3 -c "import json,sys; print(next(f['id'] for f in json.load(sys.stdin) if f['filename']=='$f'))")
  echo "Downloading $f ..."
  curl -sL "https://data.mendeley.com/public-files/datasets/8972jxbpmp/files/$id/file_downloaded" -o "$DEST/$f"
done
ls -la "$DEST"
