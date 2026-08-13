#!/usr/bin/env bash
# Pull Tah's Board of Realities into project-mini-game/repo (game files only).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
DEST="$ROOT/repo"
URL="${BOARD_OF_REALITIES_URL:-https://github.com/Tah-KMTS/Final-Project-board-of-realities.git}"
TOKEN="${BOARD_OF_REALITIES_TOKEN:-${GH_TOKEN:-${GITHUB_TOKEN:-}}}"

clone_url="$URL"
if [[ -n "$TOKEN" ]]; then
  clone_url="https://x-access-token:${TOKEN}@github.com/Tah-KMTS/Final-Project-board-of-realities.git"
fi

if [[ -d "$DEST/.git" ]]; then
  echo "Updating existing clone at $DEST"
  if [[ -n "$TOKEN" ]]; then
    git -C "$DEST" remote set-url origin "$clone_url"
  fi
  git -C "$DEST" fetch origin
  git -C "$DEST" checkout main
  git -C "$DEST" pull --ff-only origin main
else
  echo "Cloning Tah's repo → $DEST"
  rm -rf "$DEST"
  git clone "$clone_url" "$DEST"
fi

# Keep the stored remote URL token-free so it is never committed or logged.
git -C "$DEST" remote set-url origin "$URL"

echo "Pulled. Game files:"
ls -la "$DEST" | head -30
echo
echo "Edit files under: $DEST"
echo "Push your edits with:  ./project-mini-game/push.sh"
