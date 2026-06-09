#!/usr/bin/env bash
# Runs a targeted replicate for specific variant/pattern pairs.
# Usage: bash scripts/run-replicate.sh [rps] [rampup] [duration] [results_dir]
set -euo pipefail
cd "$(dirname "$0")/.."

RPS="${1:-20}"
RAMP="${2:-60}"
DURATION="${3:-300}"
RESULTS_DIR="${4:-results/experiments_r2}"

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

  log "  Waiting 30s for startup..."
  sleep 30

  log "  Running Gatling (${RPS} rps, ${RAMP}s ramp, ${DURATION}s)..."
  mvn -f load-tests/pom.xml gatling:test \
    -DbaseUrl="http://localhost:8080" \
    -Drps="$RPS" \
    -DrampUp="$RAMP" \
    -Dduration="$DURATION" \
    "-Dgatling.resultsFolder=$(pwd)/$out/gatling" \
    >> "$LOG" 2>&1 || log "  WARN: Gatling exited non-zero for $label"

  log "  Collecting metrics..."
  bash scripts/collect-metrics.sh "$label" "$out" >> "$LOG" 2>&1 || true

  log "  Stopping $label..."
  bash scripts/stop-variant.sh >> "$LOG" 2>&1
  sleep 10
}

log "=== ob-zt targeted replicate: RPS=$RPS RAMP=${RAMP}s DURATION=${DURATION}s ==="

run_variant 5 http
run_variant 6 http

log "=== Replicate complete. Results in $RESULTS_DIR ==="
log "    Run: python3 scripts/analyze.py $RESULTS_DIR"
