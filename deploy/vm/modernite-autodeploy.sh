#!/usr/bin/env bash
# Pull-based deploy: install the latest bundle published by .github/workflows/deploy-production.yml.
# Runs as root every minute from modernite-autodeploy.timer. No GitHub credentials are needed (public release).
set -euo pipefail

REPO="${MODERNITE_REPO:-524HaoSun/modernite-bipv-platform}"
BASE="https://github.com/$REPO/releases/download/preview-latest"
APP=/opt/modernite
STATE=/var/lib/modernite-deploy
HEALTH_URL="${MODERNITE_HEALTH_URL:-http://127.0.0.1:3000/}"

mkdir -p "$STATE"
exec 9>"$STATE/lock"
flock -n 9 || exit 0
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

curl -fsSL --retry 2 --max-time 30 "$BASE/manifest.txt?t=$(date +%s)" -o "$work/manifest.txt" || exit 0
commit="$(sed -n 's/^commit=//p' "$work/manifest.txt")"
sum="$(sed -n 's/^sha256=//p' "$work/manifest.txt")"
if [[ ! "$commit" =~ ^[0-9a-f]{40}$ || ! "$sum" =~ ^[0-9a-f]{64}$ ]]; then
  echo "ignoring malformed manifest"
  exit 0
fi
[[ "$commit" == "$(cat "$STATE/current" 2>/dev/null || true)" ]] && exit 0
[[ "$commit" == "$(cat "$STATE/failed" 2>/dev/null || true)" ]] && exit 0

curl -fsSL --retry 2 --max-time 300 "$BASE/modernite-deploy.tgz?t=$(date +%s)" -o "$work/bundle.tgz" || exit 0
if ! echo "$sum  $work/bundle.tgz" | sha256sum -c --quiet; then
  echo "checksum mismatch for $commit (upload in progress?), retrying next run"
  exit 0
fi
mkdir "$work/new"
tar -xzf "$work/bundle.tgz" -C "$work/new"
[[ -f "$work/new/server.mjs" && -f "$work/new/public/index.html" ]] || { echo "bundle incomplete"; echo "$commit" > "$STATE/failed"; exit 1; }

echo "deploying $commit"
rm -rf "$STATE/previous" && mkdir -p "$STATE/previous"
cp -a "$APP/server.mjs" "$APP/public" "$STATE/previous/" 2>/dev/null || true
install_from() {
  rm -rf "$APP/public"
  cp -a "$1/server.mjs" "$1/public" "$APP/"
  chown -R modernite:modernite "$APP/server.mjs" "$APP/public"
  systemctl restart modernite
}
healthy() {
  for _ in $(seq 30); do
    sleep 1
    systemctl is-active --quiet modernite && curl -fsS -o /dev/null --max-time 5 "$HEALTH_URL" && return 0
  done
  return 1
}

install_from "$work/new"
if healthy; then
  echo "$commit" > "$STATE/current"
  rm -f "$STATE/failed"
  echo "deployed $commit"
else
  echo "health check failed for $commit, rolling back"
  echo "$commit" > "$STATE/failed"
  [[ -f "$STATE/previous/server.mjs" ]] && install_from "$STATE/previous"
  exit 1
fi
