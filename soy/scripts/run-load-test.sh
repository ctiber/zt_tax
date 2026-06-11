#!/usr/bin/env bash
# run-load-test.sh
#
# Full benchmark workflow:
#   1. (Optionally) launch a ZT variant of SoY
#   2. Wait for all services to be healthy
#   3. Run the Gatling simulation
#   4. Archive results with variant + pattern label
#
# Usage:
#   ./scripts/run-load-test.sh [OPTIONS]
#
# Options:
#   --variant   N          ZT variant number (1-16, default: current running)
#   --pattern   PATTERN    Communication pattern (http|grpc|websocket|queue|topic|cqrs)
#   --ramp-up   SECS       Ramp-up duration  (default: 60)
#   --sustained SECS       Sustained duration (default: 300)
#   --ramp-down SECS       Ramp-down duration (default: 60)
#   --target-rps N         Target requests/sec at peak (default: 5.0)
#   --session-id ID        Business-session ID (default: from test-data.env)
#   --exercise-id ID       Exercise ID         (default: from test-data.env)
#   --base-url URL         Gateway URL (default: http://localhost:5001)
#   --no-launch            Skip launching the variant (use whatever is already up)
#   --setup                Run setup-test-data.sh before the test
#   --docker               Run Gatling inside Docker (default: local Maven)
#
# Examples:
#   ./scripts/run-load-test.sh --variant 1  --pattern http
#   ./scripts/run-load-test.sh --variant 16 --pattern grpc --setup
#   ./scripts/run-load-test.sh --no-launch  --pattern queue --target-rps 3

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOAD_TEST_DIR="$SOY_DIR/load-tests"
RESULTS_DIR="$SOY_DIR/load-tests/results"

# ── Defaults ──────────────────────────────────────────────
VARIANT=""
PATTERN="http"
RAMP_UP=60
SUSTAINED=300
RAMP_DOWN=60
TARGET_RPS=5.0
SESSION_ID=""
EXERCISE_ID=""
BASE_URL="http://localhost:5001"
LAUNCH=true
RUN_SETUP=false
USE_DOCKER=false

# ── Argument parsing ───────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --variant)     VARIANT="$2";     shift 2 ;;
    --pattern)     PATTERN="$2";     shift 2 ;;
    --ramp-up)     RAMP_UP="$2";     shift 2 ;;
    --sustained)   SUSTAINED="$2";   shift 2 ;;
    --ramp-down)   RAMP_DOWN="$2";   shift 2 ;;
    --target-rps)  TARGET_RPS="$2";  shift 2 ;;
    --session-id)  SESSION_ID="$2";  shift 2 ;;
    --exercise-id) EXERCISE_ID="$2"; shift 2 ;;
    --base-url)    BASE_URL="$2";    shift 2 ;;
    --no-launch)   LAUNCH=false;     shift   ;;
    --setup)       RUN_SETUP=true;   shift   ;;
    --docker)      USE_DOCKER=true;  shift   ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ── Load test-data.env if present ─────────────────────────
TEST_DATA_ENV="$SOY_DIR/load-tests/test-data.env"
if [[ -f "$TEST_DATA_ENV" ]]; then
  source "$TEST_DATA_ENV"
  [[ -z "$SESSION_ID"  ]] && SESSION_ID="${SESSION_ID:-1}"
  [[ -z "$EXERCISE_ID" ]] && EXERCISE_ID="${EXERCISE_ID:-1}"
fi

SESSION_ID="${SESSION_ID:-1}"
EXERCISE_ID="${EXERCISE_ID:-1}"

# ── Launch variant if requested ───────────────────────────
if [[ "$LAUNCH" == true && -n "$VARIANT" ]]; then
  echo "▶  Launching variant $VARIANT with pattern $PATTERN..."
  bash "$SCRIPT_DIR/run-variant.sh" "$VARIANT" "$PATTERN"
  echo ""
  echo "Waiting 15 s for services to stabilise..."
  sleep 15
fi

# ── Setup test data ───────────────────────────────────────
if [[ "$RUN_SETUP" == true ]]; then
  echo "▶  Setting up test data..."
  bash "$SCRIPT_DIR/setup-test-data.sh" --base-url "$BASE_URL"
  # Reload in case setup-test-data wrote new IDs
  [[ -f "$TEST_DATA_ENV" ]] && source "$TEST_DATA_ENV"
  SESSION_ID="${SESSION_ID:-1}"
  EXERCISE_ID="${EXERCISE_ID:-1}"
fi

# ── Derive result label ───────────────────────────────────
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LABEL="v${VARIANT:-x}_${PATTERN}_${TIMESTAMP}"
mkdir -p "$RESULTS_DIR/$LABEL"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  SoY Load Test"
echo "  Variant     : ${VARIANT:-<current>}  Pattern: $PATTERN"
echo "  Shape       : rampUp=${RAMP_UP}s  sustained=${SUSTAINED}s  rampDown=${RAMP_DOWN}s"
echo "  Target RPS  : $TARGET_RPS  (submit scenario: $(echo "$TARGET_RPS * 0.3" | bc))"
echo "  Session     : $SESSION_ID   Exercise: $EXERCISE_ID"
echo "  Base URL    : $BASE_URL"
echo "  Results     : $RESULTS_DIR/$LABEL"
echo "═══════════════════════════════════════════════════════"
echo ""

# ── Run Gatling ───────────────────────────────────────────
if [[ "$USE_DOCKER" == true ]]; then
  echo "Running Gatling in Docker..."
  docker build -t soy-load-tests "$LOAD_TEST_DIR"
  docker run --rm \
    -v "$RESULTS_DIR/$LABEL:/load-tests/target/gatling-results" \
    -e baseUrl="$BASE_URL" \
    -e rampUp="$RAMP_UP" \
    -e sustained="$SUSTAINED" \
    -e rampDown="$RAMP_DOWN" \
    -e targetRps="$TARGET_RPS" \
    -e sessionId="$SESSION_ID" \
    -e exerciseId="$EXERCISE_ID" \
    --network soy_appnet 2>/dev/null || \
  docker run --rm \
    -v "$RESULTS_DIR/$LABEL:/load-tests/target/gatling-results" \
    -e baseUrl="$BASE_URL" \
    -e rampUp="$RAMP_UP" \
    -e sustained="$SUSTAINED" \
    -e rampDown="$RAMP_DOWN" \
    -e targetRps="$TARGET_RPS" \
    -e sessionId="$SESSION_ID" \
    -e exerciseId="$EXERCISE_ID" \
    --add-host="host.docker.internal:host-gateway" \
    soy-load-tests
else
  echo "Running Gatling locally (Maven)..."
  cd "$LOAD_TEST_DIR"
  mvn gatling:test \
    -Dsoy.baseUrl="$BASE_URL"       \
    -Dsoy.rampUp="$RAMP_UP"         \
    -Dsoy.sustained="$SUSTAINED"    \
    -Dsoy.rampDown="$RAMP_DOWN"     \
    -Dsoy.targetRps="$TARGET_RPS"   \
    -Dsoy.sessionId="$SESSION_ID"   \
    -Dsoy.exerciseId="$EXERCISE_ID" \
    -Dgatling.core.outputDirectoryBaseName="$LABEL" \
    -q
  cd "$SOY_DIR"

  # Copy Gatling report to labelled directory (plugin writes to target/gatling-results/)
  GATLING_OUT=$(ls -td "$LOAD_TEST_DIR/target/gatling-results/"*/ 2>/dev/null | head -1 || true)
  if [[ -n "$GATLING_OUT" ]]; then
    cp -r "$GATLING_OUT"* "$RESULTS_DIR/$LABEL/" 2>/dev/null || true
  fi
fi

# ── Write metadata alongside the results ─────────────────
cat > "$RESULTS_DIR/$LABEL/metadata.env" <<EOF
VARIANT=${VARIANT:-unknown}
PATTERN=$PATTERN
RAMP_UP=$RAMP_UP
SUSTAINED=$SUSTAINED
RAMP_DOWN=$RAMP_DOWN
TARGET_RPS=$TARGET_RPS
SESSION_ID=$SESSION_ID
EXERCISE_ID=$EXERCISE_ID
BASE_URL=$BASE_URL
TIMESTAMP=$TIMESTAMP
EOF

echo ""
echo "✓  Load test complete."
echo "   Results: $RESULTS_DIR/$LABEL"
echo "   Open:    $RESULTS_DIR/$LABEL/index.html  (Gatling HTML report)"
