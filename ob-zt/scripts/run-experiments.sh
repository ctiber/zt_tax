#!/usr/bin/env bash
# Runs all experiment variants × patterns and collects metrics.
# Usage: bash scripts/run-experiments.sh [rps] [rampup] [duration] [results_dir]
set -euo pipefail
cd "$(dirname "$0")/.."

RPS="${1:-5}"
RAMP="${2:-60}"
DURATION="${3:-300}"
RESULTS_DIR="results/experiments"

mkdir -p "$RESULTS_DIR"
LOG="$RESULTS_DIR/sweep_$(date +%Y%m%d_%H%M%S).log"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG"; }

run_variant() {
  local variant="$1" pattern="$2"
  local label="v${variant}-${pattern}"
  local out="$RESULTS_DIR/${label}"
  mkdir -p "$out"

  log "Starting $label..."
  bash scripts/run-variant.sh "$variant" "$pattern" >> "$LOG" 2>&1

  # Wait for services to stabilise
  log "  Waiting 30s for startup..."
  sleep 30

  # Run load test
  log "  Running Gatling (${RPS} rps, ${RAMP}s ramp, ${DURATION}s)..."
  mvn -f load-tests/pom.xml gatling:test \
    -DbaseUrl="http://localhost:8080" \
    -Drps="$RPS" \
    -DrampUp="$RAMP" \
    -Dduration="$DURATION" \
    "-Dgatling.resultsFolder=$(pwd)/$out/gatling" \
    >> "$LOG" 2>&1 || log "  WARN: Gatling exited non-zero for $label"

  # Collect Prometheus metrics snapshot (window = ramp + duration + 2 min margin)
  local window_min=$(( (RAMP + DURATION) / 60 + 2 ))
  log "  Collecting metrics (window=${window_min}m)..."
  bash scripts/collect-metrics.sh "$label" "$out" "$window_min" >> "$LOG" 2>&1 || true

  # Tear down
  log "  Stopping $label..."
  bash scripts/stop-variant.sh >> "$LOG" 2>&1
  sleep 10
}

VARIANTS=(1 2 3 4 5 6 7)
PATTERNS=(http queue)

log "=== ob-zt experiment sweep: ${#VARIANTS[@]} variants × ${#PATTERNS[@]} patterns ==="
log "    RPS=$RPS  RAMP=${RAMP}s  DURATION=${DURATION}s"

for v in "${VARIANTS[@]}"; do
  for p in "${PATTERNS[@]}"; do
    run_variant "$v" "$p"
  done
done

log "=== Sweep complete. Results in $RESULTS_DIR ==="
log "    Run: python3 scripts/analyze.py $RESULTS_DIR"
