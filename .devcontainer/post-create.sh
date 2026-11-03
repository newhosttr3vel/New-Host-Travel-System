#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[codespaces] Workspace: $ROOT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "[codespaces] ERROR: Node.js is missing. Rebuild the Codespace using the configured TypeScript/Node image." >&2
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "[codespaces] ERROR: npm is missing from PATH. Rebuild the Codespace; do not run npm commands in recovery mode." >&2
  exit 1
fi

node --version
npm --version
node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major < 22 || (major === 22 && minor < 18)) { console.error("Node.js 22.18.0 or newer is required."); process.exit(1); }'

# .env is ignored by Git and is generated inside this Codespace only.
node scripts/codespaces-setup.mjs

# The repository tracks package-lock.json; npm ci keeps the install reproducible.
npm ci

npm run codespaces:repair-swc
npm run db:generate
npm run db:migrate

echo
echo "[codespaces] Setup completed successfully."
echo "[codespaces] The app starts automatically when the Codespace attaches."
echo "[codespaces] Open the private forwarded port 3000 to use the site."
