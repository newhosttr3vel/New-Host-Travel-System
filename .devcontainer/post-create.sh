#!/usr/bin/env bash
set -euo pipefail
cd /workspaces/new-host-travel-system
node scripts/codespaces-setup.mjs
npm install
npm run db:generate
npm run db:migrate
echo
echo "Codespaces setup completed."
echo "The site starts automatically when the Codespace attaches."
echo "Use the private forwarded port 3000 to open the preview."
