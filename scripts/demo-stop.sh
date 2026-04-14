#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="$ROOT_DIR/.underline-api.pid"
API_PORT="${API_PORT:-8787}"

PID_FROM_PORT="$(lsof -tiTCP:${API_PORT} -sTCP:LISTEN | head -1 || true)"
PID_FROM_FILE=""

if [ -f "$PID_FILE" ]; then
  PID_FROM_FILE="$(cat "$PID_FILE" || true)"
fi

TARGET_PID="${PID_FROM_PORT:-$PID_FROM_FILE}"

if [ -z "$TARGET_PID" ]; then
  echo "No Underline API process found on port ${API_PORT}."
  exit 0
fi

kill "$TARGET_PID" 2>/dev/null || true
rm -f "$PID_FILE"

echo "Stopped Underline API process ${TARGET_PID}."
