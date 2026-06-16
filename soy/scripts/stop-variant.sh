#!/usr/bin/env bash
# stop-variant.sh  [--quiet]
# Stops all SoY containers regardless of which variant is running.

set -euo pipefail

QUIET=false
[[ "${1:-}" == "--quiet" ]] && QUIET=true

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$SOY_DIR/docker-compose.yml"

$QUIET || echo "▶  Stopping all SoY containers..."

# Stop with every known profile so docker compose can remove all containers.
# --volumes removes prometheus_data and grafana_data named volumes so they
# don't accumulate across the 42-run sweep and exhaust RAM.
docker compose \
  -f "$COMPOSE_FILE" \
  --profile sr \
  --profile ra \
  --profile mtls \
  --profile queue \
  --profile topic \
  --profile monitoring \
  down --remove-orphans --volumes --timeout 30 2>/dev/null || true

$QUIET || echo "✓  Stopped."
