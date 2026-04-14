#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT_DIR/.logs"
PID_FILE="$ROOT_DIR/.underline-api.pid"
API_LOG_FILE="$LOG_DIR/underline-api.log"
API_ENTRY_FILE="$ROOT_DIR/apps/api/dist/index.js"
API_PORT="${API_PORT:-8787}"
HEALTH_URL="http://localhost:${API_PORT}/health"

mkdir -p "$LOG_DIR"
cd "$ROOT_DIR"

if [ ! -d "$ROOT_DIR/node_modules" ]; then
  echo "Installing dependencies..."
  npm install --no-fund --no-audit
fi

echo "Building extension output..."
npm run build --workspace @underline/extension
echo "Building API output..."
npm run build --workspace @underline/api

RUNNING_PID="$(lsof -tiTCP:${API_PORT} -sTCP:LISTEN | head -1 || true)"

if [ -n "$RUNNING_PID" ]; then
  echo "API already running on port ${API_PORT} (pid ${RUNNING_PID})."
  echo "$RUNNING_PID" > "$PID_FILE"
else
  echo "Starting local API on port ${API_PORT}..."
  nohup node "$API_ENTRY_FILE" > "$API_LOG_FILE" 2>&1 < /dev/null &
  API_PID=$!
  echo "$API_PID" > "$PID_FILE"
  disown "$API_PID" 2>/dev/null || true

  READY=0
  for _ in $(seq 1 40); do
    if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
      READY=1
      break
    fi
    sleep 0.5
  done

  if [ "$READY" -ne 1 ]; then
    echo "API failed to start. Last log lines:"
    tail -n 40 "$API_LOG_FILE" || true
    exit 1
  fi
fi

echo
echo "Underline demo is ready."
echo "Extension directory:"
echo "  $ROOT_DIR/apps/extension/.output/chrome-mv3"
echo
echo "Do this in Chrome:"
echo "  1. Open chrome://extensions"
echo "  2. Refresh the Underline extension"
echo "  3. Refresh the article page you want to test"
echo "  4. Open the popup and click 开启导师模式"
echo "  5. Highlight text, then click the floating explain button"
echo
echo "Local API:"
echo "  $HEALTH_URL"
echo "API log:"
echo "  $API_LOG_FILE"
