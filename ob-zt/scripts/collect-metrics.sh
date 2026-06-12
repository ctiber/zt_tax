#!/usr/bin/env bash
# Collects CPU, memory, network, and RA histogram metrics from Prometheus.
# Called while containers are still running (before stop-variant.sh).
# Usage: collect-metrics.sh <label> <output-dir> [test_window_minutes]
set -euo pipefail

LABEL="${1:?Usage: collect-metrics.sh <label> <output-dir> [window_minutes]}"
OUT="${2:?Usage: collect-metrics.sh <label> <output-dir> [window_minutes]}"
WINDOW="${3:-9}"
PROM_URL="${PROM_URL:-http://localhost:9090}"

mkdir -p "$OUT"

urlencode() { python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$1"; }

prom_query() {
  local query="$1" outfile="$2"
  curl -sf "${PROM_URL}/api/v1/query?query=$(urlencode "$query")" \
    -o "$outfile" 2>/dev/null || echo '{"status":"error","data":{"result":[]}}' > "$outfile"
}

echo "  Querying Prometheus for $LABEL (window=${WINDOW}m)..."

# ── CPU: average % of one core used during the test window ──────────────────
prom_query \
  "avg by (name) (
     avg_over_time(docker_container_cpu_percent{
       name=~\"ob-zt-.*\",
       name!~\".*-(cadvisor|prometheus|grafana|jaeger|docker-stats)-.*\"
     }[${WINDOW}m])
   )" \
  "$OUT/cpu_avg.json"

# ── Memory: RSS in bytes (averaged over test window) ─────────────────────────
prom_query \
  "avg by (name) (
     avg_over_time(docker_container_memory_rss_bytes{
       name=~\"ob-zt-.*\",
       name!~\".*-(cadvisor|prometheus|grafana|jaeger|docker-stats)-.*\"
     }[${WINDOW}m])
   )" \
  "$OUT/mem_rss.json"

# ── Peak CPU per container ────────────────────────────────────────────────────
prom_query \
  "max by (name) (
     max_over_time(docker_container_cpu_percent{
       name=~\"ob-zt-.*\",
       name!~\".*-(cadvisor|prometheus|grafana|jaeger|docker-stats)-.*\"
     }[${WINDOW}m])
   )" \
  "$OUT/cpu_peak.json"

# ── Network: average bytes/s received per container ─────────────────────────
# rate() on a counter gives bytes/s; avg over the window smooths bursts.
prom_query \
  "avg by (name) (
     avg_over_time(
       rate(docker_container_network_rx_bytes_total{
         name=~\"ob-zt-.*\",
         name!~\".*-(cadvisor|prometheus|grafana|jaeger|docker-stats)-.*\"
       }[2m])[${WINDOW}m:]
     )
   )" \
  "$OUT/net_rx_bps.json"

prom_query \
  "avg by (name) (
     avg_over_time(
       rate(docker_container_network_tx_bytes_total{
         name=~\"ob-zt-.*\",
         name!~\".*-(cadvisor|prometheus|grafana|jaeger|docker-stats)-.*\"
       }[2m])[${WINDOW}m:]
     )
   )" \
  "$OUT/net_tx_bps.json"

# ── RA histogram: sum, count, and buckets over the test window ───────────────
# These let analyze-resources.py compute E[S] and C²_s of the RA call latency.
# Only populated in variants where ZT_RA=true (v5, v6, v7).
prom_query \
  "sum(increase(zt_ra_call_duration_seconds_sum[${WINDOW}m]))" \
  "$OUT/ra_duration_sum.json"

prom_query \
  "sum(increase(zt_ra_call_duration_seconds_count[${WINDOW}m]))" \
  "$OUT/ra_duration_count.json"

# Full histogram buckets: {le="..."} cumulative counts for variance estimation
prom_query \
  "sum by (le) (increase(zt_ra_call_duration_seconds_bucket[${WINDOW}m]))" \
  "$OUT/ra_duration_buckets.json"

# Container map: name → full ID (needed for cgroup fallback in analyze-resources)
docker ps --format '{{.Names}}\t{{.ID}}' \
  | grep "^ob-zt-" > "$OUT/container_map.tsv" 2>/dev/null || true

echo "  Metrics saved to $OUT"
