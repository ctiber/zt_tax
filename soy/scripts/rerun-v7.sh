#!/usr/bin/env bash
# Re-run v7 experiments without the monitoring profile (cadvisor incompatible).
set -euo pipefail
cd "$(dirname "$0")/.."
SOY_DIR="$(pwd)"
LOAD_TEST_DIR="$SOY_DIR/load-tests"
OUTDIR="$SOY_DIR/results/experiments"

source "$SOY_DIR/load-tests/test-data.env" 2>/dev/null || true
SESSION_ID="${SESSION_ID:-77}"
EXERCISE_ID="${EXERCISE_ID:-1}"
BASE_URL="${BASE_URL:-http://localhost:5001}"
TARGET_RPS=30.0
RAMP_UP=60
SUSTAINED=300
RAMP_DOWN=60

run_one() {
  local VARIANT="$1" PATTERN="$2" RUN_IDX="$3"
  local LABEL="v${VARIANT}_${PATTERN}_rps30_run${RUN_IDX}"
  local RUN_DIR="$OUTDIR/$LABEL"
  mkdir -p "$RUN_DIR/gatling"

  echo "──────────────────────────────────────────────────"
  echo "  [$LABEL]  starting..."

  # Start variant WITHOUT monitoring to avoid cadvisor issues
  bash scripts/run-variant.sh "$VARIANT" "$PATTERN" >> "$RUN_DIR/startup.log" 2>&1
  echo "  ✓ Variant up"

  # Wait for gateway
  for attempt in $(seq 1 80); do
    if curl -s --max-time 3 "${BASE_URL}/" -o /dev/null 2>&1; then
      echo "  ✓ Gateway ready (${attempt}×3 s)"
      break
    fi
    [[ "$attempt" -eq 80 ]] && { echo "  ✗ Gateway timeout"; bash scripts/stop-variant.sh --quiet; return 1; }
    sleep 3
  done

  # Extra settle for queue broker
  [[ "$PATTERN" == "queue" ]] && sleep 20

  T_START=$(date +%s)
  echo "  ▶ Running Gatling ($RAMP_UP+$SUSTAINED+$RAMP_DOWN s @ ${TARGET_RPS} rps)..."
  cd "$LOAD_TEST_DIR"
  mvn gatling:test \
    -DbaseUrl="$BASE_URL" \
    -DrampUp="$RAMP_UP" \
    -Dsustained="$SUSTAINED" \
    -DrampDown="$RAMP_DOWN" \
    -DtargetRps="$TARGET_RPS" \
    -DsessionId="$SESSION_ID" \
    -DexerciseId="$EXERCISE_ID" \
    -q >> "$RUN_DIR/gatling.log" 2>&1 || echo "  ⚠  Gatling non-zero exit"
  cd "$SOY_DIR"

  # Copy simulation results
  LATEST=$(ls -td "$LOAD_TEST_DIR/target/gatling-results/"*/ 2>/dev/null | head -1 || true)
  [[ -n "$LATEST" ]] && cp -r "$LATEST/." "$RUN_DIR/gatling/" && echo "  ✓ Results copied"

  T_END=$(date +%s)

  # Write metadata
  cat > "$RUN_DIR/metadata.json" <<METAEOF
{
  "variant": "7",
  "variant_name": "v7-ra-ms",
  "pattern": "$PATTERN",
  "ramp_up": $RAMP_UP,
  "sustained": $SUSTAINED,
  "ramp_down": $RAMP_DOWN,
  "target_rps": $TARGET_RPS,
  "t_start": $T_START,
  "t_end": $T_END
}
METAEOF

  echo "  ▶ Stopping variant..."
  bash scripts/stop-variant.sh --quiet
  echo "  ✓ Done → $RUN_DIR"
  echo "  ⏸  Cooldown 30s..."
  sleep 30
}

run_one 7 http 1
run_one 7 http 2
run_one 7 http 3
run_one 7 queue 1
run_one 7 queue 2
run_one 7 queue 3

echo "======================================================"
echo "  All 6 v7 runs complete."
echo "======================================================"
