#!/usr/bin/env bash
# Copy Capital Syndicate into Tah's Board of Realities and push.
# Target path: Final-Project-board-of-realities/minigames/capital-syndicate/
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
HW2="$(cd "$ROOT/.." && pwd)"
SRC="$HW2/minigames/capital-syndicate"
DEST="$ROOT/repo"
TAH="${BOARD_OF_REALITIES_URL:-https://github.com/Tah-KMTS/Final-Project-board-of-realities.git}"
TOKEN="${BOARD_OF_REALITIES_TOKEN:-${GH_TOKEN:-${GITHUB_TOKEN:-}}}"
BRANCH="${1:-main}"

if [[ ! -d "$SRC" ]]; then
  echo "Missing source game: $SRC" >&2
  exit 1
fi

echo "1/4 Pull Tah's repo"
if ! "$ROOT/pull.sh"; then
  echo >&2
  echo "Cannot clone Tah's repo from this machine." >&2
  echo "Tah must add PRangsi1886 as a Write collaborator, then re-run:" >&2
  echo "  ./project-mini-game/commit-to-tah.sh" >&2
  exit 1
fi

echo "2/4 Copy Capital Syndicate → minigames/capital-syndicate/"
mkdir -p "$DEST/minigames"
rm -rf "$DEST/minigames/capital-syndicate"
cp -a "$SRC" "$DEST/minigames/capital-syndicate"

echo "3/4 Commit"
git -C "$DEST" add minigames/capital-syndicate
if git -C "$DEST" diff --cached --quiet; then
  echo "No changes to commit (game already matches)."
else
  git -C "$DEST" commit -m "Add Capital Syndicate minigame (Operation Ferrum Wings)

Drop-in at minigames/capital-syndicate/ from PRangsi1886/Homework-2.
"
fi

echo "4/4 Push to Tah ($TAH $BRANCH)"
push_url="$TAH"
if [[ -n "$TOKEN" ]]; then
  push_url="https://x-access-token:${TOKEN}@github.com/Tah-KMTS/Final-Project-board-of-realities.git"
fi
git -C "$DEST" remote set-url origin "$push_url"
if git -C "$DEST" push -u origin "$BRANCH"; then
  git -C "$DEST" remote set-url origin "$TAH"
  echo "Pushed. Path on Tah's repo:"
  echo "  minigames/capital-syndicate/"
else
  git -C "$DEST" remote set-url origin "$TAH"
  echo >&2
  echo "Push rejected. You need Write access on Tah's repo." >&2
  echo "Ask Tah to add PRangsi1886 as a collaborator (Write), then re-run." >&2
  exit 1
fi
