#!/usr/bin/env bash
# Local admin / account demo (no email). Loopback only. Never use in production.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ "${NODE_ENV:-}" == "production" ]]; then
  echo "Refusing to start the admin demo in production." >&2
  exit 1
fi

export CONTROL_PREVIEW=1
export NODE_ENV=development
export HOST=127.0.0.1
export PORT="${PORT:-3018}"
export CONTROL_DB_PATH="${CONTROL_DB_PATH:-.data/control-preview.sqlite}"
export CONTROL_AUTH_KEY="${CONTROL_AUTH_KEY:-local-preview-auth-key-for-demo-only-32chars}"
export PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-http://127.0.0.1:${PORT}}"

mkdir -p .data
echo "Starting admin demo on ${PUBLIC_BASE_URL}/admin"
exec pnpm exec tsx server/_core/index.ts
