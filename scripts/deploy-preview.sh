#!/usr/bin/env bash
# Manual deploy: build the bundle locally and push it straight to the VM (needs gcloud access).
# Normal path is automatic: push to main -> .github/workflows/deploy-production.yml publishes the bundle to the
# "preview-latest" release -> the VM's modernite-autodeploy.timer installs it (see deploy/vm/).
# The VM runs modernite.service (systemd) behind Caddy; /opt/modernite/.env holds secrets.
# Public URLs: https://modernite.wenda.global (Cloudflare Tunnel "modernite-gcp6" -> Caddy :8080) and https://34-3-99-93.sslip.io.
set -euo pipefail

VM="${PREVIEW_VM:-gcp-free-06-us-west}"
ACCOUNT="${PREVIEW_ACCOUNT:-dashedasheeatys@gmail.com}"
PROJECT="${PREVIEW_PROJECT:-dash-free-vm-0927}"
ZONE="${PREVIEW_ZONE:-us-west1-a}"
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT

cd "$(dirname "$0")/.."
bash scripts/build-deploy-bundle.sh "$OUT"

GC=(--account="$ACCOUNT" --project="$PROJECT" --zone="$ZONE" --quiet)
gcloud compute scp "$OUT/modernite-deploy.tgz" "$VM:/tmp/" "${GC[@]}"
gcloud compute ssh "$VM" "${GC[@]}" --command 'set -e
sudo rm -rf /opt/modernite/public
sudo tar -xzf /tmp/modernite-deploy.tgz -C /opt/modernite && rm /tmp/modernite-deploy.tgz
sudo chown -R modernite:modernite /opt/modernite
sudo systemctl restart modernite
sleep 2 && systemctl is-active modernite'
