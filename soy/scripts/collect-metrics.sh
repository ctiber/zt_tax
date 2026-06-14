#!/usr/bin/env bash
# collect-metrics.sh – Query Prometheus and Jaeger after a Gatling run and
# save raw JSON into the run directory for later analysis by analyze.py.
#
# Usage (called by run-experiments.sh):
#   ./scripts/collect-metrics.sh \
#       --run-dir    DIR          Directory for this run's results
#       --t-start    UNIX_SECS    Test window start (epoch seconds)
#       --t-end      UNIX_SECS    Test window end   (epoch seconds)
#       --prom-url   URL          Prometheus base  (default: http://localhost:9090)
#       --jaeger-url URL          Jaeger base      (default: http://localhost:16686)

set -euo pipefail

RUN_DIR=""
T_START=""
T_END=""
PROM_URL="http://localhost:9090"
JAEGER_URL="http://localhost:16686"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --run-dir)    RUN_DIR="$2";    shift 2 ;;
    --t-start)    T_START="$2";    shift 2 ;;
    --t-end)      T_END="$2";      shift 2 ;;
    --prom-url)   PROM_URL="$2";   shift 2 ;;
    --jaeger-url) JAEGER_URL="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

[[ -z "$RUN_DIR" || -z "$T_START" || -z "$T_END" ]] && {
  echo "Usage: $0 --run-dir DIR --t-start SEC --t-end SEC"; exit 1; }

mkdir -p "$RUN_DIR"
DURATION=$(( T_END - T_START ))
STEP=$(( DURATION > 300 ? 15 : 5 ))   # query resolution: 15 s for long tests, 5 s for short

echo "[collect] window: $(date -d @$T_START '+%H:%M:%S') → $(date -d @$T_END '+%H:%M:%S')  (${DURATION}s)"

# ─────────────────────────────────────────────────────────────────
# PROMETHEUS
# ─────────────────────────────────────────────────────────────────
prom_range() {
  local query="$1" file="$2"
  curl -sf --max-time 30 \
    "${PROM_URL}/api/v1/query_range" \
    --data-urlencode "query=${query}" \
    --data-urlencode "start=${T_START}" \
    --data-urlencode "end=${T_END}" \
    --data-urlencode "step=${STEP}s" \
    -o "${RUN_DIR}/${file}" 2>/dev/null \
    && echo "[collect] ✓ prometheus/${file}" \
    || echo "[collect] ⚠  prometheus/${file} unavailable"
}

# Instant query at T_END with increase() over the full test window.
# Used for histogram aggregates (sum/count/buckets) where we want totals.
prom_instant() {
  local query="$1" file="$2"
  curl -sf --max-time 30 \
    "${PROM_URL}/api/v1/query" \
    --data-urlencode "query=${query}" \
    --data-urlencode "time=${T_END}" \
    -o "${RUN_DIR}/${file}" 2>/dev/null \
    && echo "[collect] ✓ prometheus/${file}" \
    || echo "[collect] ⚠  prometheus/${file} unavailable"
}

# CPU usage per SoY container (% of one core)
prom_range \
  'rate(container_cpu_usage_seconds_total{name=~"soy_.*"}[30s]) * 100' \
  "prom_cpu.json"

# RSS memory per container (bytes)
prom_range \
  'container_memory_rss{name=~"soy_.*"}' \
  "prom_memory.json"

# Network bytes received per container
prom_range \
  'rate(container_network_receive_bytes_total{name=~"soy_.*"}[30s])' \
  "prom_net_rx.json"

# Network bytes sent per container
prom_range \
  'rate(container_network_transmit_bytes_total{name=~"soy_.*"}[30s])' \
  "prom_net_tx.json"

# RA service duration histogram (for E[S] and C²_s)
# Only populated in variants where ZT_RA=true (v5, v6, v7).
WINDOW=$(( (T_END - T_START) / 60 + 1 ))
prom_instant \
  "sum(increase(zt_ra_duration_seconds_sum[${WINDOW}m]))" \
  "ra_duration_sum.json"

prom_instant \
  "sum(increase(zt_ra_duration_seconds_count[${WINDOW}m]))" \
  "ra_duration_count.json"

prom_instant \
  "sum by (le) (increase(zt_ra_duration_seconds_bucket[${WINDOW}m]))" \
  "ra_duration_buckets.json"

# ─────────────────────────────────────────────────────────────────
# JAEGER  – one file per ZT operation of interest
# ─────────────────────────────────────────────────────────────────
# Jaeger API timestamps are in microseconds
T_START_US=$(( T_START * 1000000 ))
T_END_US=$(( T_END   * 1000000 ))
# vault.load fires once at container startup, before the Gatling window.
# Look back 600 s (10 min) before T_START to capture the startup span.
T_STARTUP_US=$(( (T_START - 600) * 1000000 ))
# We ask for up to 5000 traces per operation to get good percentile coverage
LIMIT=5000

jaeger_traces() {
  local service="$1" operation="$2" file="$3" start_us="${4:-$T_START_US}"
  curl -sf -G --max-time 30 \
    "${JAEGER_URL}/api/traces" \
    --data-urlencode "service=${service}" \
    --data-urlencode "operation=${operation}" \
    --data-urlencode "start=${start_us}" \
    --data-urlencode "end=${T_END_US}" \
    --data-urlencode "limit=${LIMIT}" \
    -o "${RUN_DIR}/${file}" 2>/dev/null \
    && echo "[collect] ✓ jaeger/${file}" \
    || echo "[collect] ⚠  jaeger/${file} unavailable (tracing may not be active)"
}

# Gateway-side ZT operations
jaeger_traces "soy-gateway"      "zt.gateway.auth"    "jaeger_gateway_auth.json"
jaeger_traces "soy-gateway"      "zt.risk_analysis"   "jaeger_risk_analysis.json"
jaeger_traces "soy-gateway"      "zt.mtls.handshake"  "jaeger_mtls_handshake.json"
# vault.load fires at startup: use the extended window
jaeger_traces "soy-gateway"      "zt.vault.load"      "jaeger_vault_load_gw.json"       "$T_STARTUP_US"

# Microservice-side ZT operations
jaeger_traces "soy-ms-other"     "zt.ac4a.verify"     "jaeger_ac4a_other.json"
jaeger_traces "soy-ms-exercise"  "zt.ac4a.verify"     "jaeger_ac4a_exercise.json"
jaeger_traces "soy-ms-other"     "zt.vault.load"      "jaeger_vault_load_other.json"    "$T_STARTUP_US"
jaeger_traces "soy-ms-exercise"  "zt.vault.load"      "jaeger_vault_load_exercise.json" "$T_STARTUP_US"
# Microservice-level RA (ZT_RA_MS) — same operation name as gateway, different service
jaeger_traces "soy-ms-other"     "zt.risk_analysis"   "jaeger_ra_ms_other.json"
jaeger_traces "soy-ms-exercise"  "zt.risk_analysis"   "jaeger_ra_ms_exercise.json"

# Full request traces from gateway (for end-to-end span breakdown)
jaeger_traces "soy-gateway"      "GET /api/business-session/{sessionId}"   "jaeger_e2e_getsession.json"
jaeger_traces "soy-gateway"      "POST /api/exercise-production"           "jaeger_e2e_submit.json"

echo "[collect] Done. Files in ${RUN_DIR}/"
