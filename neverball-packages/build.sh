#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
mkdir -p bin
mapfile -t SOURCES < <(find src -name '*.java' | sort)
echo "Compiling ${#SOURCES[@]} Java sources..."
javac -encoding UTF-8 -d bin "${SOURCES[@]}"
echo "OK -> bin/"
