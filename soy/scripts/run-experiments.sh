#!/usr/bin/env bash
# run-experiments.sh – Automated benchmark sweep across ZT variants and comm patterns.
#
# For each (variant × pattern) pair the script:
#   1. Launches the SoY variant with monitoring (Prometheus + Grafana + Jaeger)
#   2. Waits for all services to be healthy
#   3. Runs the Gatling load test via run-load-test.sh
#   4. Queries Prometheus and Jaeger APIs for the test window → saves JSON
#   5. Stops the variant before the next run
#
# Usage:
#   ./scripts/run-experiments.sh [OPTIONS]
#
# Options:
#   --variants   "1 2 3 ..."   Space-separated list (default: 1..16)
#   --patterns   "http grpc …" Space-separated list (default: all 5)
#   --ramp-up    SECS          (default: 60)
#   --sustained  SECS          (default: 300)
#   --ramp-down  SECS          (default: 60)
#   --target-rps N             (default: 5.0)
#   --base-url   URL           (default: http://localhost:5001)
#   --prom-url   URL           Prometheus base URL (default: http://localhost:9090)
#   --jaeger-url URL           Jaeger base URL     (default: http://localhost:16686)
#   --cooldown   SECS          Sleep between runs  (default: 30)
#   --outdir     DIR           Results root        (default: ./results/experiments)
#   --dry-run                  Print what would run, no execution
#
# Examples:
#   ./scripts/run-experiments.sh
#   ./scripts/run-experiments.sh --variants "1 16" --patterns "http grpc"
#   ./scripts/run-experiments.sh --variants "1 2 3" --sustained 120 --target-rps 3

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Defaults ───────────────────────────────────────────────
VARIANTS="${VARIANTS:-1 2 3 4 5 6 7}"
PATTERNS="${PATTERNS:-http queue}"
RAMP_UP=60
SUSTAINED=300
RAMP_DOWN=60
TARGET_RPS=30.0
BASE_URL="http://localhost:5001"
PROM_URL="http://localhost:9090"
JAEGER_URL="http://localhost:16686"
COOLDOWN=30
OUTDIR="$SOY_DIR/results/experiments"
DRY_RUN=false

# ── Argument parsing ───────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --variants)   VARIANTS="$2";   shift 2 ;;
    --patterns)   PATTERNS="$2";   shift 2 ;;
    --ramp-up)    RAMP_UP="$2";    shift 2 ;;
    --sustained)  SUSTAINED="$2";  shift 2 ;;
    --ramp-down)  RAMP_DOWN="$2";  shift 2 ;;
    --target-rps) TARGET_RPS="$2"; shift 2 ;;
    --base-url)   BASE_URL="$2";   shift 2 ;;
    --prom-url)   PROM_URL="$2";   shift 2 ;;
    --jaeger-url) JAEGER_URL="$2"; shift 2 ;;
    --cooldown)   COOLDOWN="$2";   shift 2 ;;
    --outdir)     OUTDIR="$2";     shift 2 ;;
    --runs)       RUNS="$2";       shift 2 ;;
    --dry-run)    DRY_RUN=true;    shift   ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

RUNS="${RUNS:-1}"
mkdir -p "$OUTDIR"

TOTAL=0
for v in $VARIANTS; do for p in $PATTERNS; do TOTAL=$((TOTAL + RUNS)); done; done
echo "═══════════════════════════════════════════════════════"
echo "  SoY Experiment Sweep"
echo "  Variants  : $VARIANTS"
echo "  Patterns  : $PATTERNS"
echo "  Runs/combo: $RUNS"
echo "  Total runs: $TOTAL"
echo "  Shape     : rampUp=${RAMP_UP}s  sustained=${SUSTAINED}s  rampDown=${RAMP_DOWN}s"
echo "  RPS       : $TARGET_RPS"
echo "  Output    : $OUTDIR"
echo "  Dry run   : $DRY_RUN"
echo "═══════════════════════════════════════════════════════"

RUN_NUM=0
FAILED=()

for VARIANT in $VARIANTS; do
  for PATTERN in $PATTERNS; do
    for (( RUN_IDX=1; RUN_IDX<=RUNS; RUN_IDX++ )); do
    RUN_NUM=$((RUN_NUM + 1))
    # Include target RPS in the label so sweeps at different loads
    # land in separate directories and never overwrite each other.
    RPS_TAG=$(echo "$TARGET_RPS" | sed 's/\.0$//')   # 5.0 → 5, 35.0 → 35
    if [[ "$RUNS" -gt 1 ]]; then
      LABEL="v${VARIANT}_${PATTERN}_rps${RPS_TAG}_run${RUN_IDX}"
    else
      LABEL="v${VARIANT}_${PATTERN}_rps${RPS_TAG}"
    fi
    RUN_DIR="$OUTDIR/$LABEL"

    echo ""
    echo "──────────────────────────────────────────────────────"
    echo "  [${RUN_NUM}/${TOTAL}]  ${LABEL}"
    echo "──────────────────────────────────────────────────────"

    if [[ "$DRY_RUN" == true ]]; then
      echo "  (dry-run — skipping)"
      continue
    fi

    mkdir -p "$RUN_DIR"

    # ── 1. Launch variant with monitoring profile ──────────
    echo "  ▶ Starting variant ${VARIANT} / pattern ${PATTERN}..."
    bash "$SCRIPT_DIR/run-variant.sh" "$VARIANT" "$PATTERN" monitoring \
      >> "$RUN_DIR/startup.log" 2>&1 || {
        echo "  ✗ run-variant.sh failed — skipping this run"
        FAILED+=("$LABEL")
        continue
      }

    # ── 2. Wait for gateway to be healthy ──────────────────
    # SoY gateway has no /health endpoint; any HTTP response means it is up.
    # 80 attempts × 3 s = 240 s covers image pull + Vault init on first run.
    echo "  ⏳ Waiting for gateway to accept connections (up to 240 s)..."
    for attempt in $(seq 1 80); do
      if curl -s --max-time 3 "${BASE_URL}/" -o /dev/null 2>&1; then
        echo "  ✓ Gateway ready (attempt ${attempt}, $((attempt * 3)) s)"
        break
      fi
      if [[ "$attempt" -eq 80 ]]; then
        echo "  ✗ Gateway not ready after 240 s — skipping (check startup.log)"
        FAILED+=("$LABEL")
        bash "$SCRIPT_DIR/stop-variant.sh" --quiet 2>/dev/null || true
        continue 2
      fi
      sleep 3
    done

    # Extra settle time for async transports (queue/topic brokers need more)
    case "$PATTERN" in
      queue|topic) sleep 20 ;;
      *)           sleep 5  ;;
    esac

    # ── 3. Record test window start ────────────────────────
    T_START=$(date +%s)
    echo "  ▶ Test window start: $(date -d @$T_START '+%Y-%m-%d %H:%M:%S')"

    # ── 4. Run Gatling ─────────────────────────────────────
    echo "  ▶ Running Gatling..."
    bash "$SCRIPT_DIR/run-load-test.sh" \
      --no-launch \
      --variant   "$VARIANT" \
      --pattern   "$PATTERN" \
      --ramp-up   "$RAMP_UP" \
      --sustained "$SUSTAINED" \
      --ramp-down "$RAMP_DOWN" \
      --target-rps "$TARGET_RPS" \
      --base-url  "$BASE_URL" \
      >> "$RUN_DIR/gatling.log" 2>&1 || echo "  ⚠  Gatling exited non-zero (may still have results)"

    # Copy the Gatling results (simulation.log + HTML report) into the run dir.
    # The Gatling Maven plugin 3.9.x writes to target/gatling-results/, not target/gatling/.
    mkdir -p "$RUN_DIR/gatling"
    LATEST_GATLING=$(ls -td "$SOY_DIR/load-tests/target/gatling-results/"*/ 2>/dev/null | head -1 || true)
    if [[ -n "$LATEST_GATLING" ]]; then
      cp -r "$LATEST_GATLING/." "$RUN_DIR/gatling/" 2>/dev/null || true
      echo "  ✓ Gatling results copied from $(basename "$LATEST_GATLING")"
    else
      echo "  ⚠  No Gatling results found in target/gatling-results/ — check gatling.log"
    fi

    # ── 5. Record test window end ──────────────────────────
    T_END=$(date +%s)
    echo "  ▶ Test window end:   $(date -d @$T_END '+%Y-%m-%d %H:%M:%S')  ($(( T_END - T_START ))s)"

    # Write metadata for downstream analysis
    # Resolve variant name from env file
    VARIANT_ENV_FILE=$(ls "$SOY_DIR/variants/v${VARIANT}-"*.env 2>/dev/null | head -1 || echo "unknown")
    VARIANT_NAME=$(basename "$VARIANT_ENV_FILE" .env)
    source "$VARIANT_ENV_FILE" 2>/dev/null || true

    cat > "$RUN_DIR/metadata.json" <<METAEOF
{
  "variant":      "$VARIANT",
  "variant_name": "$VARIANT_NAME",
  "pattern":      "$PATTERN",
  "zt_ac4a":        "${ZT_AC4A:-false}",
  "zt_sr":          "${ZT_SR:-false}",
  "zt_mtls":        "${ZT_MTLS:-false}",
  "zt_ra":          "${ZT_RA:-false}",
  "zt_ra_ms":       "${ZT_RA_MS:-false}",
  "zt_broker_mtls": "${ZT_BROKER_MTLS:-false}",
  "ramp_up":      $RAMP_UP,
  "sustained":    $SUSTAINED,
  "ramp_down":    $RAMP_DOWN,
  "target_rps":   $TARGET_RPS,
  "t_start":      $T_START,
  "t_end":        $T_END
}
METAEOF

    # ── 6. Collect Prometheus + Jaeger metrics ─────────────
    echo "  ▶ Collecting metrics..."
    bash "$SCRIPT_DIR/collect-metrics.sh" \
      --run-dir   "$RUN_DIR" \
      --t-start   "$T_START" \
      --t-end     "$T_END" \
      --prom-url  "$PROM_URL" \
      --jaeger-url "$JAEGER_URL" \
      >> "$RUN_DIR/collect.log" 2>&1 || echo "  ⚠  collect-metrics.sh had warnings (see collect.log)"

    # ── 7. Stop variant ────────────────────────────────────
    echo "  ▶ Stopping variant..."
    bash "$SCRIPT_DIR/stop-variant.sh" --quiet 2>/dev/null || true

    echo "  ✓ Done → $RUN_DIR"
    echo "  ⏸  Cooldown ${COOLDOWN}s before next run..."
    sleep "$COOLDOWN"
    done  # runs loop
  done   # patterns loop
done     # variants loop

# ── Summary ────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Sweep complete.  ${RUN_NUM} runs attempted."
if [[ ${#FAILED[@]} -gt 0 ]]; then
  echo "  Failed runs (${#FAILED[@]}): ${FAILED[*]}"
fi
echo ""
echo "  Run analysis:"
echo "    python3 scripts/analyze.py --indir $OUTDIR"
echo "═══════════════════════════════════════════════════════"
