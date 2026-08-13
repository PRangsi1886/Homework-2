#!/usr/bin/env bash
# Run this on YOUR laptop (logged into GitHub as PRangsi1886), not in the
# Cloud Agent. It clones Tah's private repo, creates
# PRangsi1886/project-mini-game, and pushes so the agent can pull it.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
DEST="$ROOT/repo"
TAH="${BOARD_OF_REALITIES_URL:-https://github.com/Tah-KMTS/Final-Project-board-of-realities.git}"
MINE="${PROJECT_MINI_GAME_PUSH_URL:-https://github.com/PRangsi1886/project-mini-game.git}"

if [[ -d "$DEST/.git" ]]; then
  echo "Clone already exists at $DEST"
else
  echo "Cloning $TAH → $DEST"
  rm -rf "$DEST"
  git clone "$TAH" "$DEST"
fi

cd "$DEST"
if ! git remote get-url mine >/dev/null 2>&1; then
  git remote add mine "$MINE"
fi
git remote set-url mine "$MINE"

if gh repo view PRangsi1886/project-mini-game >/dev/null 2>&1; then
  echo "GitHub repo already exists; pushing…"
  git push -u mine HEAD:main
else
  echo "Creating PRangsi1886/project-mini-game and pushing…"
  gh repo create PRangsi1886/project-mini-game --public --source=. --remote=mine --push
fi

echo
echo "Your copy: https://github.com/PRangsi1886/project-mini-game"
echo "Reply to the Cloud Agent with that URL so it can pull the game files."
