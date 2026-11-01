#!/usr/bin/env bash
set -euo pipefail
cd /workspaces/new-host-travel-system

LOG_FILE=/tmp/new-host-travel-dev.log

if curl --silent --fail http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
  echo "New Host Travel is already responding on port 3000."
  exit 0
fi

if pgrep -f '[n]ext dev --hostname 0.0.0.0' >/dev/null 2>&1; then
  echo "A Next.js process exists but the health endpoint is not responding."
  echo "===== Existing server log ====="
  tail -n 80 "$LOG_FILE" 2>/dev/null || true
  exit 1
fi

: > "$LOG_FILE"
nohup npm run dev -- --webpack > "$LOG_FILE" 2>&1 </dev/null &
DEV_PID=$!
echo "Started New Host Travel with PID $DEV_PID. Waiting for the database-backed health endpoint..."

for attempt in $(seq 1 30); do
  if curl --silent --fail http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    echo "New Host Travel is healthy on port 3000."
    exit 0
  fi

  if ! kill -0 "$DEV_PID" 2>/dev/null; then
    echo "The Next.js startup process exited before the health check succeeded."
    echo "===== Server log ====="
    tail -n 100 "$LOG_FILE" 2>/dev/null || true
    exit 1
  fi

  sleep 1
done

echo "New Host Travel did not become healthy within 30 seconds."
echo "===== Server log ====="
tail -n 100 "$LOG_FILE" 2>/dev/null || true
exit 1
