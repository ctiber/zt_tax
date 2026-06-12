#!/usr/bin/env bash
# Collects CPU and memory metrics from Prometheus for a completed run.
# Queries are issued while containers are still running (before stop-variant.sh).
# Usage: collect-metrics.sh <label> <output-dir> [test_window_minutes]
#   test_window_minutes: lookback window covering ramp+test (default: 9)
set -euo pipefail

LABEL="${1:?Usage: collect-metrics.sh <label> <output-dir> [window_minutes]}"
OUT="${2:?Usage: collect-metrics.sh <label> <output-dir> [window_minutes]}"
WINDOW="${3:-9}"
PROM_URL="${PROM_URL:-http://localhost:9090}"

mkdir -p "$OUT"

# URL-encode a Prometheus query string
urlencode() { python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$1"; }

prom_query() {
  local query="$1" outfile="$2"
  curl -sf "${PROM_URL}/api/v1/query?query=$(urlencode "$query")" \
    -o "$outfile" 2>/dev/null || echo '{"status":"error","data":{"result":[]}}' > "$outfile"
}

echo "  Querying Prometheus for $LABEL (window=${WINDOW}m)..."

# ── CPU: average % of one core used during the test window ──────────────────
# docker-stats-exporter exposes docker_container_cpu_percent{name=...}
# Excludes monitoring infrastructure containers.
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

# ── Peak CPU per container during the window ─────────────────────────────────
prom_query \
  "max by (name) (
     max_over_time(docker_container_cpu_percent{
       name=~\"ob-zt-.*\",
       name!~\".*-(cadvisor|prometheus|grafana|jaeger|docker-stats)-.*\"
     }[${WINDOW}m])
   )" \
  "$OUT/cpu_peak.json"

echo "  Metrics saved to $OUT"
