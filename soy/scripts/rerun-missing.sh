#!/usr/bin/env bash
# Targeted re-run for v6_queue_rps30_run3 and v7_queue_rps30_run2.
# These two runs failed during the main sweep due to RabbitMQ transient exit.
# This script replicates run-experiments.sh logic for exactly these two runs.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTDIR="$SOY_DIR/results/experiments"

RAMP_UP=60
SUSTAINED=300
RAMP_DOWN=60
TARGET_RPS=30.0
BASE_URL="http://localhost:5001"
PROM_URL="http://localhost:9090"
JAEGER_URL="http://localhost:16686"
COOLDOWN=30

export OTEL_ENABLED=true

RUNS_TO_DO=(
  "6 queue v6_queue_rps30_run3"
  "7 queue v7_queue_rps30_run2"
)

FAILED=()
RUN_NUM=0
TOTAL=${#RUNS_TO_DO[@]}

echo "═══════════════════════════════════════════════════════"
echo "  SoY Missing-Run Re-execution"
echo "  Targets: v6_queue_rps30_run3  v7_queue_rps30_run2"
echo "  RPS: $TARGET_RPS  Sustained: ${SUSTAINED}s"
echo "═══════════════════════════════════════════════════════"

for ENTRY in "${RUNS_TO_DO[@]}"; do
  VARIANT=$(echo "$ENTRY" | awk '{print $1}')
  PATTERN=$(echo "$ENTRY"  | awk '{print $2}')
  LABEL=$(echo "$ENTRY"    | awk '{print $3}')
  RUN_DIR="$OUTDIR/$LABEL"
  RUN_NUM=$((RUN_NUM + 1))

  echo ""
  echo "──────────────────────────────────────────────────────"
  echo "  [${RUN_NUM}/${TOTAL}]  ${LABEL}"
  echo "──────────────────────────────────────────────────────"

  mkdir -p "$RUN_DIR"

  # 1. Launch variant
  echo "  ▶ Starting variant ${VARIANT} / pattern ${PATTERN}..."
  bash "$SCRIPT_DIR/run-variant.sh" "$VARIANT" "$PATTERN" monitoring \
    >> "$RUN_DIR/startup.log" 2>&1 || {
      echo "  ✗ run-variant.sh failed — aborting this run"
      FAILED+=("$LABEL")
      continue
    }

  # 2. Wait for gateway
  echo "  ⏳ Waiting for gateway (up to 240 s)..."
  for attempt in $(seq 1 80); do
    if curl -s --max-time 3 "${BASE_URL}/" -o /dev/null 2>&1; then
      echo "  ✓ Gateway ready (attempt ${attempt})"
      break
    fi
    if [[ "$attempt" -eq 80 ]]; then
      echo "  ✗ Gateway not ready after 240 s"
      FAILED+=("$LABEL")
      bash "$SCRIPT_DIR/stop-variant.sh" --quiet 2>/dev/null || true
      continue 2
    fi
    sleep 3
  done

  # 3. Extra settle for queue broker
  echo "  ⏳ Queue settle 20 s..."
  sleep 20

  # 4. Test window start
  T_START=$(date +%s)
  echo "  ▶ Test window start: $(date -d @$T_START '+%Y-%m-%d %H:%M:%S')"

  # 5. Run Gatling
  echo "  ▶ Running Gatling..."
  bash "$SCRIPT_DIR/run-load-test.sh" \
    --no-launch \
    --variant    "$VARIANT" \
    --pattern    "$PATTERN" \
    --ramp-up    "$RAMP_UP" \
    --sustained  "$SUSTAINED" \
    --ramp-down  "$RAMP_DOWN" \
    --target-rps "$TARGET_RPS" \
    --base-url   "$BASE_URL" \
    >> "$RUN_DIR/gatling.log" 2>&1 || echo "  ⚠  Gatling exited non-zero (may still have results)"

  # 6. Copy Gatling results
  mkdir -p "$RUN_DIR/gatling"
  LATEST_GATLING=$(ls -td "$SOY_DIR/load-tests/target/gatling-results/"*/ 2>/dev/null | head -1 || true)
  if [[ -n "$LATEST_GATLING" ]]; then
    cp -r "$LATEST_GATLING/." "$RUN_DIR/gatling/"
    echo "  ✓ Gatling results copied from $(basename "$LATEST_GATLING")"
  else
    echo "  ⚠  No Gatling results found"
  fi

  # 7. Test window end
  T_END=$(date +%s)
  echo "  ▶ Test window end: $(date -d @$T_END '+%Y-%m-%d %H:%M:%S')  ($(( T_END - T_START ))s)"

  # 8. Metadata
  VARIANT_ENV_FILE=$(ls "$SOY_DIR/variants/v${VARIANT}-"*.env 2>/dev/null | head -1 || echo "unknown")
  VARIANT_NAME=$(basename "$VARIANT_ENV_FILE" .env)
  source "$VARIANT_ENV_FILE" 2>/dev/null || true

  cat > "$RUN_DIR/metadata.json" <<METAEOF
{
  "variant":      "$VARIANT",
  "variant_name": "$VARIANT_NAME",
  "pattern":      "$PATTERN",
  "zt_ac4a":        "${ZT_AC4A:-false}",
  "zt_sr":          "${ZT_SR:-false}",
  "zt_mtls":        "${ZT_MTLS:-false}",
  "zt_ra":          "${ZT_RA:-false}",
  "zt_ra_ms":       "${ZT_RA_MS:-false}",
  "zt_broker_mtls": "${ZT_BROKER_MTLS:-false}",
  "ramp_up":      $RAMP_UP,
  "sustained":    $SUSTAINED,
  "ramp_down":    $RAMP_DOWN,
  "target_rps":   $TARGET_RPS,
  "t_start":      $T_START,
  "t_end":        $T_END
}
METAEOF

  # 9. Collect metrics
  echo "  ▶ Collecting metrics..."
  bash "$SCRIPT_DIR/collect-metrics.sh" \
    --run-dir    "$RUN_DIR" \
    --t-start    "$T_START" \
    --t-end      "$T_END" \
    --prom-url   "$PROM_URL" \
    --jaeger-url "$JAEGER_URL" \
    >> "$RUN_DIR/collect.log" 2>&1 || echo "  ⚠  collect-metrics.sh had warnings"

  # 10. Stop variant
  echo "  ▶ Stopping variant..."
  bash "$SCRIPT_DIR/stop-variant.sh" --quiet 2>/dev/null || true

  echo "  ✓ Done → $RUN_DIR"

  if [[ $RUN_NUM -lt $TOTAL ]]; then
    echo "  ⏸  Cooldown ${COOLDOWN}s..."
    sleep "$COOLDOWN"
  fi
done

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Re-run complete. ${RUN_NUM} runs attempted."
if [[ ${#FAILED[@]} -gt 0 ]]; then
  echo "  FAILED: ${FAILED[*]}"
else
  echo "  All runs succeeded."
fi
echo "═══════════════════════════════════════════════════════"
