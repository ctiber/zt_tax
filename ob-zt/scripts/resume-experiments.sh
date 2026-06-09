#!/usr/bin/env bash
# Resume experiment sweep from a given variant/pattern.
# Usage: bash scripts/resume-experiments.sh <start_variant> <start_pattern> [rps] [rampup] [duration]
set -euo pipefail
cd "$(dirname "$0")/.."

START_V="${1:?Usage: resume-experiments.sh <start_variant> <start_pattern> [rps] [rampup] [duration]}"
START_P="${2:?}"
RPS="${3:-20}"
RAMP="${4:-60}"
DURATION="${5:-300}"
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

VARIANTS=(1 2 3 4 5 6 7)
PATTERNS=(http queue)

# Determine start index
SKIP=true
log "=== ob-zt resume sweep from v${START_V}-${START_P}: RPS=$RPS RAMP=${RAMP}s DURATION=${DURATION}s ==="

for v in "${VARIANTS[@]}"; do
  for p in "${PATTERNS[@]}"; do
    if [ "$SKIP" = true ]; then
      if [ "$v" = "$START_V" ] && [ "$p" = "$START_P" ]; then
        SKIP=false
      else
        log "Skipping v${v}-${p} (already done)"
        continue
      fi
    fi
    run_variant "$v" "$p"
  done
done

log "=== Sweep complete. Results in $RESULTS_DIR ==="
log "    Run: python3 scripts/analyze.py $RESULTS_DIR"
