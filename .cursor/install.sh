#!/usr/bin/env bash
# Durable environment setup for the Volvo OFV app (runs once to build the
# environment snapshot/baseline). Idempotent: safe to re-run.
#
# Runtime services (docker daemon, Supabase stack, dev server) are NOT started
# here — see .cursor/start.sh and the `terminals` config for per-boot startup.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Installing Node dependencies"
npm ci

# The following system tools are normally baked into the base image/snapshot.
# The guards make this script self-healing if it ever runs on a clean image.

if ! command -v docker >/dev/null 2>&1; then
  echo "==> Installing Docker Engine"
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER" || true
fi

if ! command -v fuse-overlayfs >/dev/null 2>&1; then
  echo "==> Installing fuse-overlayfs (nested-container storage driver)"
  sudo apt-get update -qq
  sudo apt-get install -y -qq fuse-overlayfs || true
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "==> Installing Supabase CLI"
  curl -fsSL https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz \
    | sudo tar -xz -C /usr/local/bin supabase
  sudo chmod +x /usr/local/bin/supabase
fi

# Docker must use fuse-overlayfs inside the Cloud Agent VM: the default nested
# overlayfs mount fails with "invalid argument".
echo "==> Configuring Docker daemon for nested containers"
sudo mkdir -p /etc/docker
if [ ! -f /etc/docker/daemon.json ]; then
  printf '%s\n' '{ "storage-driver": "fuse-overlayfs", "features": { "containerd-snapshotter": false } }' \
    | sudo tee /etc/docker/daemon.json >/dev/null
fi

echo "==> install.sh complete"
