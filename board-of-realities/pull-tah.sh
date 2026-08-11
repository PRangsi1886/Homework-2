#!/usr/bin/env bash
# Pull Tah's Board of Realities repo into board-of-realities/repo
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
DEST="$ROOT/repo"
URL="${BOARD_OF_REALITIES_URL:-https://github.com/Tah-KMTS/Final-Project-board-of-realities.git}"

if [[ -d "$DEST/.git" ]]; then
  echo "Updating existing clone at $DEST"
  git -C "$DEST" fetch origin
  git -C "$DEST" checkout main
  git -C "$DEST" pull --ff-only origin main
else
  echo "Cloning $URL → $DEST"
  rm -rf "$DEST"
  git clone "$URL" "$DEST"
fi

echo "Done. Tree:"
ls -la "$DEST" | head -20
