#!/usr/bin/env bash
set -euo pipefail

JEST_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_JSON="$JEST_DIR/test-runner.config.js"
ROOT_DIR=""
TEST_PATH=""

printf "Run Jest tests\n---------------\nEnter 'all' to run all tests, or enter a class name from test-runner.config.js (e.g. ErrorHandler)\n> "
read -r TEST_FILTER

ROOT_DIR="$(node -e "const cfg=require(process.env.CONFIG_JSON); process.stdout.write(cfg.rootDir||'');" CONFIG_JSON="$CONFIG_JSON")"
if [[ -z "$ROOT_DIR" ]]; then
  echo "Failed to read config: $CONFIG_JSON"
  exit 1
fi

if [[ "${TEST_FILTER,,}" == "all" || -z "$TEST_FILTER" ]]; then
  TEST_PATH="$JEST_DIR/tests"
else
  TEST_PATH="$(node -e "const cfg=require(process.env.CONFIG_JSON); const cls=(cfg.classes||[]).find(c=>String(c.name||'').toLowerCase()===process.env.CLASS.toLowerCase()); if(!cls){process.exit(2);} process.stdout.write(cls.test||'');" CONFIG_JSON="$CONFIG_JSON" CLASS="$TEST_FILTER" || true)"
  if [[ -z "$TEST_PATH" ]]; then
    echo "Test class '$TEST_FILTER' not found in $CONFIG_JSON"
    echo "Available classes:"
    node -e "const cfg=require(process.env.CONFIG_JSON); (cfg.classes||[]).forEach(c=>console.log(c.name));" CONFIG_JSON="$CONFIG_JSON"
    exit 1
  fi
  TEST_PATH="$ROOT_DIR/$TEST_PATH"
fi

cd "$ROOT_DIR"
if [[ ! -d "$JEST_DIR/node_modules" ]]; then
  echo "Installing local Jest dependencies..."
  (cd "$JEST_DIR" && npm install --no-fund --no-audit --silent)
fi

# Ensure joi and lru-cache are installed in ROOT_DIR (where ErrorHandler.js is located)
if ! node -e "require('joi')" 2>/dev/null; then
  echo "Installing joi in $ROOT_DIR..."
  npm install joi --no-fund --no-audit --silent
fi
if ! node -e "require('lru-cache')" 2>/dev/null; then
  echo "Installing lru-cache in $ROOT_DIR..."
  npm install lru-cache --no-fund --no-audit --silent
fi

if [[ "$TEST_PATH" == "$JEST_DIR/tests" ]]; then
  echo "Running all Jest tests..."
  "$JEST_DIR/node_modules/.bin/jest" --runTestsByPath "$TEST_PATH"
else
  echo "Running Jest test: $TEST_PATH"
  "$JEST_DIR/node_modules/.bin/jest" --runTestsByPath "$TEST_PATH"
fi
