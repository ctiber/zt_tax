#!/usr/bin/env bash
# Runs all experiment variants × patterns and collects metrics.
# Usage: bash scripts/run-experiments.sh [rps] [rampup] [duration] [results_dir]
set -euo pipefail
cd "$(dirname "$0")/.."

RPS="${1:-30}"
RAMP="${2:-60}"
DURATION="${3:-300}"
RESULTS_DIR="results/experiments"

mkdir -p "$RESULTS_DIR"
LOG="$RESULTS_DIR/sweep_$(date +%Y%m%d_%H%M%S).log"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG"; }

wait_for_gateway() {
  local deadline=$(( $(date +%s) + 60 ))
  while [ $(date +%s) -lt $deadline ]; do
    if curl -sf http://localhost:8080/healthz -o /dev/null 2>/dev/null; then
      return 0
    fi
    sleep 2
  done
  log "  WARN: gateway did not become healthy within 60s"
  return 1
}

wait_for_prometheus() {
  local deadline=$(( $(date +%s) + 60 ))
  while [ $(date +%s) -lt $deadline ]; do
    if curl -sf http://localhost:9090/-/ready -o /dev/null 2>/dev/null; then
      return 0
    fi
    sleep 2
  done
  log "  WARN: Prometheus did not become ready within 60s"
  return 1
}

check_port_8080() {
  if ss -tlnp | grep -q ':8080 ' 2>/dev/null; then
    local holder
    holder=$(ss -tlnp | grep ':8080 ' | awk '{print $NF}')
    log "  ERROR: port 8080 already in use by: $holder"
    log "  Aborting sweep — free port 8080 and re-run."
    exit 1
  fi
}

run_variant() {
  local variant="$1" pattern="$2"
  local label="v${variant}-${pattern}"
  local out="$RESULTS_DIR/${label}"
  mkdir -p "$out"

  check_port_8080

  log "Starting $label..."
  bash scripts/run-variant.sh "$variant" "$pattern" >> "$LOG" 2>&1

  # Wait for gateway and Prometheus to be healthy before running the test
  log "  Waiting for gateway and Prometheus to be ready..."
  wait_for_gateway >> "$LOG" 2>&1 || true
  wait_for_prometheus >> "$LOG" 2>&1 || true
  # Extra settle time so cAdvisor has at least 2 scrape cycles (scrape_interval=15s)
  sleep 35

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
