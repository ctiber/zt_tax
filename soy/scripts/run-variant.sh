#!/usr/bin/env bash
# run-variant.sh  <variant-number>  [com-pattern]  [extra-profiles...]
#
# com-pattern: http (default) | grpc | websocket | queue | topic | cqrs
#
# Examples:
#   ./scripts/run-variant.sh 1               # v1 baseline, HTTP
#   ./scripts/run-variant.sh 16 http         # v16 full ZT, HTTP
#   ./scripts/run-variant.sh 1  grpc         # v1 baseline, gRPC
#   ./scripts/run-variant.sh 1  queue        # v1 baseline, RabbitMQ
#   ./scripts/run-variant.sh 16 topic        # v16 full ZT, Kafka
#   ./scripts/run-variant.sh 1  http monitoring  # + Grafana
#
# The script:
#   1. Selects variants/v<N>-*.env  (ZT security flags)
#   2. Reads COM_PATTERN to add the broker profile when needed
#   3. Reads ZT_PROFILES from the env file for ZT-specific infrastructure
#   4. Exports COM_PATTERN + ZT_VARIANT_ENV for docker-compose

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$SOY_DIR/docker-compose.yml"

VALID_PATTERNS="http grpc websocket queue topic cqrs"

# ── Argument parsing ───────────────────────────────────────
VARIANT="${1:-}"
shift || true

# Second arg is the communication pattern (default: http)
COM_PATTERN="${1:-http}"
shift || true

# Remaining args are extra Docker Compose profiles
EXTRA_PROFILES=("$@")

if [[ -z "$VARIANT" ]]; then
  echo "Usage: $0 <variant-number> [com-pattern] [extra-profiles...]"
  echo ""
  echo "Communication patterns: $VALID_PATTERNS"
  echo ""
  echo "Available variants:"
  for f in "$SOY_DIR/variants"/v*.env; do
    n=$(basename "$f" .env)
    printf "  %-4s %s\n" "${n#v}" "$n"
  done
  exit 1
fi

if ! echo "$VALID_PATTERNS" | grep -qw "$COM_PATTERN"; then
  echo "ERROR: Unknown COM_PATTERN='$COM_PATTERN'. Valid: $VALID_PATTERNS"
  exit 1
fi

# ── Find the ZT variant env file ──────────────────────────
ENV_FILE=$(ls "$SOY_DIR/variants/v${VARIANT}-"*.env 2>/dev/null | head -1 || true)
if [[ -z "$ENV_FILE" ]]; then
  echo "ERROR: No variant file found for v${VARIANT} in $SOY_DIR/variants/"
  exit 1
fi

VARIANT_NAME=$(basename "$ENV_FILE" .env)
echo "▶  Launching ${VARIANT_NAME}  COM_PATTERN=${COM_PATTERN}"
echo "   Env file : $ENV_FILE"

# ── Read ZT_PROFILES from the env file ────────────────────
ZT_PROFILES=$(grep -E '^ZT_PROFILES=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'" || true)

# Accumulate profiles: ZT profiles + pattern broker profile + CLI extras
ALL_PROFILES=()

IFS=',' read -ra FILE_PROFILES <<< "${ZT_PROFILES:-}"
for p in "${FILE_PROFILES[@]}"; do [[ -n "$p" ]] && ALL_PROFILES+=("$p"); done

# Add broker profile automatically based on communication pattern
case "$COM_PATTERN" in
  queue)  ALL_PROFILES+=("queue")  ;;
  topic)  ALL_PROFILES+=("topic")  ;;
esac

for p in "${EXTRA_PROFILES[@]}"; do [[ -n "$p" ]] && ALL_PROFILES+=("$p"); done

# Deduplicate
ALL_PROFILES=($(printf '%s\n' "${ALL_PROFILES[@]}" | awk '!seen[$0]++'))

# ── Build --profile flags ──────────────────────────────────
PROFILE_FLAGS=()
for p in "${ALL_PROFILES[@]}"; do PROFILE_FLAGS+=("--profile" "$p"); done

echo "   Profiles : ${ALL_PROFILES[*]:-none}"

# ── Ensure Docker network exists ──────────────────────────
if ! docker network inspect appnet &>/dev/null; then
  echo "   Creating Docker network: appnet"
  docker network create appnet
fi

# ── Generate mTLS / broker TLS certs if needed ────────────
ZT_BROKER_MTLS_ENV=$(grep -E '^ZT_BROKER_MTLS=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' || true)
NEEDS_CERTS=false
if printf '%s\n' "${ALL_PROFILES[@]}" | grep -qx mtls; then NEEDS_CERTS=true; fi
if [[ "$ZT_BROKER_MTLS_ENV" == "true" ]]; then NEEDS_CERTS=true; fi

if [[ "$NEEDS_CERTS" == "true" ]]; then
  if [[ ! -f "$SOY_DIR/certs/ca.crt" ]] || \
     [[ ! -f "$SOY_DIR/certs/rabbitmq.crt" ]] || \
     [[ ! -f "$SOY_DIR/certs/kafka.server.keystore.jks" ]]; then
    echo "   Generating TLS certificates (including broker certs)..."
    bash "$SOY_DIR/scripts/generate-certs.sh"
  else
    echo "   TLS certificates already present"
  fi
fi

# ── Stop any running variant first ────────────────────────
echo "   Stopping previous variant..."
bash "$SCRIPT_DIR/stop-variant.sh" --quiet 2>/dev/null || true

# ── Export env ────────────────────────────────────────────
export ZT_VARIANT_ENV="variants/$(basename "$ENV_FILE")"
export COM_PATTERN
# Enable OTel tracing when monitoring profile is active
if printf '%s\n' "${ALL_PROFILES[@]}" | grep -qx monitoring; then
  export OTEL_ENABLED=true
else
  export OTEL_ENABLED=false
fi

# ── Launch ────────────────────────────────────────────────
echo ""
cd "$SOY_DIR"
docker compose \
  -f "$COMPOSE_FILE" \
  "${PROFILE_FLAGS[@]}" \
  --env-file "$ENV_FILE" \
  up --build -d

echo ""
echo "✓  ${VARIANT_NAME}  ×  COM_PATTERN=${COM_PATTERN}  is up."
echo "   Gateway     : http://localhost:${GATEWAY_PORT:-5001}"
echo "   Frontend    : http://localhost:${FRONT_PORT:-3001}"
printf '%s\n' "${ALL_PROFILES[@]}" | grep -qx monitoring && echo "   Grafana     : http://localhost:${GRAFANA_PORT:-3000}  (admin / soy-admin)" || true
printf '%s\n' "${ALL_PROFILES[@]}" | grep -qx monitoring && echo "   Jaeger UI   : http://localhost:${JAEGER_UI_PORT:-16686}" || true
printf '%s\n' "${ALL_PROFILES[@]}" | grep -qx sr          && echo "   Vault       : http://localhost:${VAULT_PORT:-8200}   (token: soy-dev-root-token)" || true
printf '%s\n' "${ALL_PROFILES[@]}" | grep -qx queue       && echo "   RabbitMQ    : http://localhost:${RABBITMQ_MGMT_PORT:-15672}  (guest/guest)" || true
printf '%s\n' "${ALL_PROFILES[@]}" | grep -qx topic       && echo "   Kafka       : localhost:${KAFKA_PORT:-9092}" || true
