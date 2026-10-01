#!/usr/bin/env bash
# Build the standalone production bundle: OUT/modernite-deploy.tgz (server.mjs + public/) and OUT/manifest.txt.
# Used by scripts/deploy-preview.sh (manual) and .github/workflows/deploy-production.yml (CI).
set -euo pipefail

OUT="${1:?usage: build-deploy-bundle.sh OUT_DIR}"
cd "$(dirname "$0")/.."
COMMIT="${GITHUB_SHA:-$(git rev-parse HEAD)}"
mkdir -p "$OUT/stage"

pnpm exec vite build
pnpm exec esbuild server/_core/index.ts --platform=node --bundle --format=esm --target=node22 \
  --external:vite '--external:*/vite.config' \
  --banner:js="import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" \
  --outfile="$OUT/stage/server.mjs"
cp -r dist/public "$OUT/stage/public"
printf '{"commit":"%s","builtAt":"%s"}\n' "$COMMIT" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$OUT/stage/public/build.json"

tar -C "$OUT/stage" -czf "$OUT/modernite-deploy.tgz" server.mjs public
rm -rf "$OUT/stage"
printf 'commit=%s\nsha256=%s\n' "$COMMIT" "$(sha256sum "$OUT/modernite-deploy.tgz" | cut -d' ' -f1)" > "$OUT/manifest.txt"
echo "bundle ready: $OUT/modernite-deploy.tgz ($COMMIT)"
