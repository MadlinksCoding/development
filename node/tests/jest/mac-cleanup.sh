#!/usr/bin/env bash
set -euo pipefail

JEST_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Cleanup Jest temp files"
read -r -p "Type YES to continue: " CONFIRM
if [[ "${CONFIRM}" != "YES" ]]; then
  exit 0
fi

rm -rf "$JEST_DIR/node_modules" || true
rm -f "$JEST_DIR/package-lock.json" || true

echo "Cleanup complete."
