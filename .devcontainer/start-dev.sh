#!/usr/bin/env bash
set -euo pipefail
cd /workspaces/new-host-travel-system
if curl --silent --fail http://127.0.0.1:3000/ >/dev/null 2>&1; then
  echo "New Host Travel is already responding on port 3000."
  exit 0
fi
nohup npm run dev > /tmp/new-host-travel-dev.log 2>&1 </dev/null &
echo "Starting New Host Travel in the Codespace. The private port 3000 will open when ready."
