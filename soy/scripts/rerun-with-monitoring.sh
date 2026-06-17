#!/usr/bin/env bash
# rerun-with-monitoring.sh — Collect CPU/memory resource data for v4/v6/v7
# using the Docker socket API (no cAdvisor required).
#
# For each variant × pattern pair, the script:
#   1. Starts the variant (via run-variant.sh)
#   2. Waits for the gateway on port 5001
#   3. Runs collect-docker-stats.py in the background
#   4. Runs a full Gatling load test (to produce realistic resource load)
#   5. Stops the variant and waits for the stats poller to finish
#   6. Copies prom_cpu.json and prom_memory.json into all 3 existing run dirs
#
# The existing Gatling results (simulation.log, latency data) are NOT overwritten;
# only prom_cpu.json and prom_memory.json are populated in the run directories.
#
# Usage:
#   cd soy/
#   bash scripts/rerun-with-monitoring.sh [4 6 7]   (default: 4 6 7)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOAD_TEST_DIR="$SOY_DIR/load-tests"
RESULTS_DIR="$SOY_DIR/results/experiments"

RAMP_UP=60
SUSTAINED=300
RAMP_DOWN=60
TARGET_RPS=30
COOLDOWN=30

BASE_URL="http://localhost:5001"

source "$SOY_DIR/load-tests/test-data.env" 2>/dev/null || true
SESSION_ID="${SESSION_ID:-77}"
EXERCISE_ID="${EXERCISE_ID:-1}"

VARIANTS_TO_RUN="${*:-4 6 7}"

cd "$SOY_DIR"

collect_variant_pattern() {
  local VARIANT="$1"
  local PATTERN="$2"

  local TAG="v${VARIANT}_${PATTERN}_rps${TARGET_RPS}_monitoring"
  local TMP_DIR="/tmp/soy_stats_${TAG}"
  mkdir -p "$TMP_DIR"

  echo "══════════════════════════════════════════════════════"
  echo "  Collecting resources: variant=$VARIANT pattern=$PATTERN"
  echo "══════════════════════════════════════════════════════"

  # ── 1. Start variant ────────────────────────────────────
  bash "$SCRIPT_DIR/run-variant.sh" "$VARIANT" "$PATTERN" > "$TMP_DIR/startup.log" 2>&1
  echo "  ✓ Variant up"

  # ── 2. Wait for gateway on port 5001 ────────────────────
  for attempt in $(seq 1 80); do
    if curl -s --max-time 3 "${BASE_URL}/" -o /dev/null 2>&1; then
      echo "  ✓ Gateway ready (attempt ${attempt})"
      break
    fi
    if [[ "$attempt" -eq 80 ]]; then
      echo "  ✗ Gateway not ready after 240 s — aborting"
      bash "$SCRIPT_DIR/stop-variant.sh" --quiet 2>/dev/null || true
      return 1
    fi
    sleep 3
  done

  # Extra settle for queue broker
  if [[ "$PATTERN" == "queue" ]]; then
    echo "  ⏳ Extra 20 s for queue broker..."
    sleep 20
  fi

  # ── 3. Start docker-stats collector in background ───────
  local STATS_DURATION=$(( RAMP_UP + SUSTAINED + RAMP_DOWN + 30 ))
  python3 "$SCRIPT_DIR/collect-docker-stats.py" \
    "$TMP_DIR" \
    --interval 5 \
    --duration "$STATS_DURATION" > "$TMP_DIR/stats.log" 2>&1 &
  local STATS_PID=$!
  echo "  ✓ Stats collector started (pid=$STATS_PID, duration=${STATS_DURATION}s)"

  # ── 4. Run Gatling (same invocation as rerun-v7.sh) ─────
  local T_START
  T_START=$(date +%s)
  echo "  ▶ Running Gatling (${RAMP_UP}+${SUSTAINED}+${RAMP_DOWN}s @ ${TARGET_RPS} rps)..."
  cd "$LOAD_TEST_DIR"
  mvn gatling:test \
    -DbaseUrl="$BASE_URL" \
    -DrampUp="$RAMP_UP" \
    -Dsustained="$SUSTAINED" \
    -DrampDown="$RAMP_DOWN" \
    -DtargetRps="$TARGET_RPS" \
    -DsessionId="$SESSION_ID" \
    -DexerciseId="$EXERCISE_ID" \
    -q > "$TMP_DIR/gatling.log" 2>&1 || echo "  ⚠  Gatling non-zero exit (see $TMP_DIR/gatling.log)"
  local T_END
  T_END=$(date +%s)
  cd "$SOY_DIR"
  echo "  ✓ Gatling done ($(( T_END - T_START ))s)"

  # ── 5. Stop variant ─────────────────────────────────────
  echo "  ▶ Stopping variant..."
  bash "$SCRIPT_DIR/stop-variant.sh" --quiet 2>/dev/null || true

  # ── 6. Wait for stats poller ─────────────────────────────
  echo "  ⏳ Waiting for stats collector to finish..."
  wait "$STATS_PID" 2>/dev/null || true
  echo "  ✓ Stats collected → $TMP_DIR/prom_cpu.json"

  # Verify the stats files were written
  if [[ ! -f "$TMP_DIR/prom_cpu.json" || ! -f "$TMP_DIR/prom_memory.json" ]]; then
    echo "  ✗ Stats files missing — check $TMP_DIR/stats.log"
    return 1
  fi

  # Quick sanity: count series
  local N_CPU N_MEM
  N_CPU=$(python3 -c "import json; d=json.load(open('$TMP_DIR/prom_cpu.json')); print(len(d['data']['result']))")
  N_MEM=$(python3 -c "import json; d=json.load(open('$TMP_DIR/prom_memory.json')); print(len(d['data']['result']))")
  echo "  ✓ CPU series: $N_CPU  Memory series: $N_MEM"

  if [[ "$N_CPU" -eq 0 ]]; then
    echo "  ✗ No CPU data collected — aborting copy"
    return 1
  fi

  # ── 7. Copy prom files into all 3 existing run dirs ─────
  for RUN in 1 2 3; do
    local RUN_DIR="$RESULTS_DIR/v${VARIANT}_${PATTERN}_rps${TARGET_RPS}_run${RUN}"
    if [[ -d "$RUN_DIR" ]]; then
      cp "$TMP_DIR/prom_cpu.json"    "$RUN_DIR/prom_cpu.json"
      cp "$TMP_DIR/prom_memory.json" "$RUN_DIR/prom_memory.json"
      echo "  ✓ Copied to $RUN_DIR"
    else
      echo "  ⚠  Run dir not found: $RUN_DIR (skipping)"
    fi
  done

  rm -rf "$TMP_DIR"
  echo "  ✓ Done → variant $VARIANT / $PATTERN"
}

for V in $VARIANTS_TO_RUN; do
  for PAT in http queue; do
    collect_variant_pattern "$V" "$PAT"
    echo "  ⏸  Cooldown ${COOLDOWN}s..."
    sleep "$COOLDOWN"
  done
done

echo ""
echo "══════════════════════════════════════════════════════"
echo "  Resource collection complete."
echo "  Next: cd soy && python3 scripts/analyze.py \\"
echo "        --indir results/experiments \\"
echo "        --outdir results/analysis"
echo "══════════════════════════════════════════════════════"
