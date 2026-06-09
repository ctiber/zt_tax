#!/usr/bin/env bash
# Usage: run-variant.sh <variant-number> <pattern>
# Example: run-variant.sh 6 queue
set -euo pipefail
cd "$(dirname "$0")/.."

VARIANT="${1:?Usage: run-variant.sh <variant-number> <pattern>}"
PATTERN="${2:?Usage: run-variant.sh <variant-number> <pattern>}"

ENV_FILE="variants/v${VARIANT}-$(ls variants/ | grep "^v${VARIANT}-" | head -1 | sed 's/^v[0-9]*-//' | sed 's/\.env$//'  ).env"
# Simpler: find the file directly
ENV_FILE=$(ls variants/v${VARIANT}-*.env 2>/dev/null | head -1)
if [ -z "$ENV_FILE" ]; then
  echo "ERROR: no env file found for variant $VARIANT" >&2
  exit 1
fi

# Set pattern in a temp env file
TMP_ENV=$(mktemp)
cp "$ENV_FILE" "$TMP_ENV"
sed -i "s/^COM_PATTERN=.*/COM_PATTERN=${PATTERN}/" "$TMP_ENV"
grep -q "^COM_PATTERN=" "$TMP_ENV" || echo "COM_PATTERN=${PATTERN}" >> "$TMP_ENV"

OB_COMPOSE="ob-base.yml"
if [ ! -f "$OB_COMPOSE" ]; then
  echo "ERROR: ob-base.yml not found (repo root)." >&2
  exit 1
fi
if [ ! -d "online-boutique/src/frontend" ]; then
  echo "ERROR: online-boutique/ not cloned. Run bash setup.sh first." >&2
  exit 1
fi

PROFILES="--profile monitoring"
[ "$PATTERN" = "queue" ] && PROFILES="$PROFILES --profile queue"

ZT_RA=$(grep "^ZT_RA=" "$TMP_ENV" | cut -d= -f2)
[ "$ZT_RA" = "true" ] && PROFILES="$PROFILES --profile ra"

ZT_SR=$(grep "^ZT_SR=" "$TMP_ENV" | cut -d= -f2)
[ "$ZT_SR" = "true" ] && PROFILES="$PROFILES --profile sr"

echo ">>> Starting v${VARIANT} (${PATTERN})  env=${ENV_FILE}"
docker compose \
  -f "$OB_COMPOSE" \
  -f docker-compose.zt.yml \
  $PROFILES \
  --env-file "$TMP_ENV" \
  up --build -d

rm -f "$TMP_ENV"
echo ">>> v${VARIANT} (${PATTERN}) is up. Gateway: http://localhost:8080"
