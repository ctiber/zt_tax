#!/usr/bin/env bash
# run-batched.sh – Run remaining 5 experiments in thermal-aware batches.
# Batches separated by 20-minute cool-down so the laptop can recover.
set -euo pipefail
cd "$(dirname "$0")/.."
LOG="results/sweep_20rps_batched.log"
exec >> "$LOG" 2>&1

RPS_OPTS="--target-rps 20.0 --ramp-up 60 --sustained 300 --ramp-down 60 --cooldown 60"

run_batch() {
  local variants="$1" patterns="$2"
  bash scripts/run-experiments.sh \
    --variants "$variants" \
    --patterns "$patterns" \
    $RPS_OPTS
}

cool_down() {
  local minutes="$1"
  echo ""
  echo "████  THERMAL COOL-DOWN: ${minutes} minutes  ████"
  echo "      $(date '+%H:%M:%S') — containers stopped, CPU cooling..."
  sleep $(( minutes * 60 ))
  echo "      $(date '+%H:%M:%S') — resuming."
  echo ""
}

echo "======================================================"
echo "  Batched sweep start: $(date '+%Y-%m-%d %H:%M:%S')"
echo "======================================================"

echo ">>> BATCH 1: v17_topic + v18_grpc"
run_batch "17" "topic"
run_batch "18" "grpc"
cool_down 20

echo ">>> BATCH 2: v18_websocket + v18_queue"
run_batch "18" "websocket"
run_batch "18" "queue"
cool_down 20

echo ">>> BATCH 3: v18_topic"
run_batch "18" "topic"

echo ""
echo "======================================================"
echo "  All done: $(date '+%Y-%m-%d %H:%M:%S')"
echo "======================================================"
