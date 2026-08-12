#!/usr/bin/env bash
# Per-boot startup for the Volvo OFV local development environment.
# Brings up the Docker daemon and the local Supabase stack, and writes the
# local .env.local. Idempotent: safe to run on every boot / re-run.
set -euo pipefail

cd "$(dirname "$0")/.."

# 1. Start the Docker daemon if it is not already running. There is no systemd
#    in the Cloud Agent VM, so dockerd is launched directly and detached.
if ! sudo docker info >/dev/null 2>&1; then
  echo "==> Starting dockerd"
  sudo rm -f /var/run/docker.pid 2>/dev/null || true
  # Use a fresh, per-boot log path. A stale /tmp/dockerd.log captured in a base
  # snapshot can be non-writable (even by root), which would prevent dockerd
  # from starting — so never reuse a fixed path unconditionally.
  dockerd_log="/tmp/dockerd-$(date +%s%N).log"
  # Fully detach: redirect the launcher's own std streams too, otherwise the
  # long-lived dockerd process keeps this script's stdout/stderr open and the
  # `start` command never returns.
  sudo setsid bash -c "dockerd >'$dockerd_log' 2>&1" </dev/null >/dev/null 2>&1 &
  disown 2>/dev/null || true
  for _ in $(seq 1 60); do
    sudo docker info >/dev/null 2>&1 && break
    sleep 1
  done
  echo "==> dockerd log: $dockerd_log"
fi

# 2. Same-bridge container-to-container traffic is dropped when bridged packets
#    are forced through the (empty) filter chains. Disabling this bridge netfilter
#    hook lets the Supabase containers reach the local Postgres container.
sudo sysctl -w net.bridge.bridge-nf-call-iptables=0 >/dev/null 2>&1 || true
sudo sysctl -w net.bridge.bridge-nf-call-ip6tables=0 >/dev/null 2>&1 || true

# 3. Local Supabase env (fixed local dev keys — safe for local use only).
if [ ! -f .env.local ]; then
  echo "==> Writing .env.local"
  cat > .env.local <<'EOF'
# Local development environment (Supabase local stack via `supabase start`).
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
OFV_API_BASE_URL=https://integrasjon-ofv.qanto.no
OFV_API_USERNAME=
OFV_API_PASSWORD=
SYNC_SECRET=local-dev-sync-secret
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
EOF
fi

# 4. Start the local Supabase stack (applies migrations + seed on first init).
#    Heavy, unused services are excluded to speed startup. Idempotent: a no-op
#    if the stack is already running.
echo "==> Starting local Supabase stack"
supa_excludes="realtime,storage-api,imgproxy,edge-runtime,logflare,vector,supavisor"
for attempt in 1 2 3 4 5; do
  if sudo supabase start -x "$supa_excludes"; then
    break
  fi
  if [ "$attempt" = 5 ]; then
    echo "!! supabase start did not become ready after $attempt attempts" >&2
    exit 1
  fi
  echo "   supabase not ready yet (attempt $attempt); waiting for containers to settle..."
  sleep 10
done

# 5. Start the Next.js dev server in the background (guarded against duplicates)
#    so the app is reachable on http://localhost:3000 right after boot.
if pgrep -f "next dev" >/dev/null 2>&1 || curl -sf -o /dev/null http://localhost:3000/login 2>/dev/null; then
  echo "==> Next.js dev server already running"
else
  echo "==> Starting Next.js dev server (background) on http://localhost:3000"
  setsid bash -c 'npm run dev > /tmp/next-dev.log 2>&1' </dev/null >/dev/null 2>&1 &
  disown 2>/dev/null || true
fi

echo "==> start.sh complete — Supabase up on :54321, Next.js dev server on :3000"
