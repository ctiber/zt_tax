#!/usr/bin/env bash
# Runs all experiment variants × patterns × runs and collects metrics.
# Usage: bash scripts/run-experiments.sh [rps] [rampup] [duration] [runs]
#
#   rps      — requests per second for Gatling (default: 30)
#   rampup   — ramp-up duration in seconds    (default: 60)
#   duration — sustained load in seconds      (default: 300)
#   runs     — number of repetitions per variant×pattern (default: 3)
#
# Results layout:
#   results/experiments/v<V>-<P>/          ← symlink to latest run (backwards compat)
#   results/experiments/v<V>-<P>-run<N>/   ← individual run data
set -euo pipefail
cd "$(dirname "$0")/.."

RPS="${1:-30}"
RAMP="${2:-60}"
DURATION="${3:-300}"
RUNS="${4:-3}"

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

run_once() {
  local variant="$1" pattern="$2" run_n="$3"
  local label="v${variant}-${pattern}"
  local out="$RESULTS_DIR/${label}-run${run_n}"
  mkdir -p "$out"

  check_port_8080

  log "Starting ${label} run ${run_n}/${RUNS}..."
  bash scripts/run-variant.sh "$variant" "$pattern" >> "$LOG" 2>&1

  log "  Waiting for gateway and Prometheus to be ready..."
  wait_for_gateway  >> "$LOG" 2>&1 || true
  wait_for_prometheus >> "$LOG" 2>&1 || true
  # Extra settle time: at least 2 docker-stats-exporter scrape cycles (15 s each)
  sleep 35

  log "  Running Gatling (${RPS} rps, ${RAMP}s ramp, ${DURATION}s)..."
  mvn -f load-tests/pom.xml gatling:test \
    -DbaseUrl="http://localhost:8080" \
    -Drps="$RPS" \
    -DrampUp="$RAMP" \
    -Dduration="$DURATION" \
    "-Dgatling.resultsFolder=$(pwd)/$out/gatling" \
    >> "$LOG" 2>&1 || log "  WARN: Gatling exited non-zero for ${label} run ${run_n}"

  local window_min=$(( (RAMP + DURATION) / 60 + 2 ))
  log "  Collecting metrics (window=${window_min}m)..."
  bash scripts/collect-metrics.sh "$label" "$out" "$window_min" >> "$LOG" 2>&1 || true

  log "  Stopping ${label} run ${run_n}..."
  bash scripts/stop-variant.sh >> "$LOG" 2>&1
  sleep 10

  # Update backwards-compatible symlink to latest run
  local link="$RESULTS_DIR/${label}"
  ln -sfn "$(basename "$out")" "$link"
}

VARIANTS=(1 2 3 4 5 6 7)
PATTERNS=(http queue)
TOTAL=$(( ${#VARIANTS[@]} * ${#PATTERNS[@]} * RUNS ))

log "=== ob-zt experiment sweep: ${#VARIANTS[@]} variants × ${#PATTERNS[@]} patterns × ${RUNS} runs = ${TOTAL} total ==="
log "    RPS=$RPS  RAMP=${RAMP}s  DURATION=${DURATION}s"

for v in "${VARIANTS[@]}"; do
  for p in "${PATTERNS[@]}"; do
    for (( n=1; n<=RUNS; n++ )); do
      run_once "$v" "$p" "$n"
    done
  done
done

log "=== Sweep complete. Results in $RESULTS_DIR ==="
log "    Run: python3 scripts/analyze.py $RESULTS_DIR"
log "    Run: python3 scripts/analyze-resources.py $RESULTS_DIR"
