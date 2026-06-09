#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

RPS="${1:-20}"
RAMP="${2:-60}"
DURATION="${3:-300}"
RESULTS_DIR="${4:-results/experiments_r2}"

mkdir -p "$RESULTS_DIR"
LOG="$RESULTS_DIR/sweep_v6_$(date +%Y%m%d_%H%M%S).log"
log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG"; }

label="v6-http"
out="$RESULTS_DIR/$label"
mkdir -p "$out"

log "Starting $label..."
bash scripts/run-variant.sh 6 http >> "$LOG" 2>&1

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

log "=== Done. Run: python3 scripts/analyze.py $RESULTS_DIR ==="
