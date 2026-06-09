#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

OB_COMPOSE="ob-base.yml"

docker compose \
  -f "$OB_COMPOSE" \
  -f docker-compose.zt.yml \
  --profile sr --profile ra --profile queue --profile monitoring \
  down --remove-orphans --timeout 30 2>/dev/null || true

echo ">>> All containers stopped."
