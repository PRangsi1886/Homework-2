#!/usr/bin/env bash
# Push local edits from project-mini-game/repo to YOUR GitHub repo
# (default: PRangsi1886/project-mini-game), not into Homework-2.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
DEST="$ROOT/repo"
MINE="${PROJECT_MINI_GAME_PUSH_URL:-https://github.com/PRangsi1886/project-mini-game.git}"
TOKEN="${BOARD_OF_REALITIES_TOKEN:-${GH_TOKEN:-${GITHUB_TOKEN:-}}}"
BRANCH="${1:-main}"

if [[ ! -d "$DEST/.git" ]]; then
  echo "No clone yet. Run ./project-mini-game/pull.sh first." >&2
  exit 1
fi

push_url="$MINE"
if [[ -n "$TOKEN" ]]; then
  # https://github.com/OWNER/REPO.git → https://x-access-token:TOKEN@github.com/OWNER/REPO.git
  push_url="$(echo "$MINE" | sed "s#https://github.com/#https://x-access-token:${TOKEN}@github.com/#")"
fi

if git -C "$DEST" remote get-url mine >/dev/null 2>&1; then
  git -C "$DEST" remote set-url mine "$push_url"
else
  git -C "$DEST" remote add mine "$push_url"
fi

git -C "$DEST" checkout -B "$BRANCH"
echo "Pushing $DEST → $MINE ($BRANCH)"
git -C "$DEST" push -u mine "$BRANCH"

# Store a token-free remote URL.
git -C "$DEST" remote set-url mine "$MINE"

echo "Done. Your copy: $MINE"
