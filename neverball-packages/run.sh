#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
if [[ ! -d bin/org/neverball ]]; then
  ./build.sh
fi
exec java -cp "bin:packages" org.neverball.game.Main "$@"
