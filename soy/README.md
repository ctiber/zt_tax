# The Security Tax of Zero Trust Primitive Placement in Microservice Applications

> **Replication package** for the empirical study measuring the latency overhead introduced by Zero Trust (ZT) security primitives across enforcement placements and communication patterns in a microservice application.

---

## Table of Contents

1. [Overview](#overview)
2. [Repository Structure](#repository-structure)
3. [Prerequisites](#prerequisites)
4. [Application — Shell on You (SoY)](#application--shell-on-you-soy)
5. [Experimental Design](#experimental-design)
   - [Zero Trust Primitives](#zero-trust-primitives)
   - [Security Variants (18)](#security-variants-18)
   - [Communication Patterns (5)](#communication-patterns-5)
   - [Measurement Matrix and Load Levels](#measurement-matrix-and-load-levels)
   - [Load Test Scenarios](#load-test-scenarios)
   - [Metrics](#metrics)
6. [Pre-computed Results](#pre-computed-results)
7. [Replication — Step by Step](#replication--step-by-step)
   - [1. Clone and Prepare](#1-clone-and-prepare)
   - [2. Database Initialisation](#2-database-initialisation)
   - [3. Docker Network](#3-docker-network)
   - [4. Test Data Setup](#4-test-data-setup)
   - [5. Running a Single Variant](#5-running-a-single-variant)
   - [6. Running the Full Measurement Matrix](#6-running-the-full-measurement-matrix)
   - [7. Collecting Metrics](#7-collecting-metrics)
8. [Load Tests in Detail](#load-tests-in-detail)
9. [Troubleshooting](#troubleshooting)
10. [Citation](#citation)
11. [License](#license)

---

## Overview

This repository contains the full experimental setup for measuring the **security tax** — the latency overhead — introduced by Zero Trust security primitives in a microservice application.

The central thesis is that **enforcement placement is the primary design variable** governing the ZT overhead model. Two canonical placements are studied:

- **Gateway-centric:** all ZT checks run at the API gateway before any transport dispatch. Overhead is additive at P50, κ-amplified at P99 for blocking primitives, and transport-independent by construction.
- **Service-tier:** each microservice performs its own ZT checks at message-receipt time. Transport independence breaks immediately; tail latency is governed by the consumer execution model rather than the network layer.

**What is studied:**
113 experimental runs spanning 18 security variants (all 2⁴ subsets of four gateway-level ZT primitives plus two extended placement variants) × five communication patterns (HTTP, gRPC, WebSocket, AMQP, Kafka) at three load levels, using the SoY (Shell on You) microservice application as the subject system.

**Subject application: SoY (Shell on You)**
SoY is a real-world e-learning platform for Unix Shell programming used in university courses. It comprises three microservices (API gateway, user/session management, exercise management) and a PostgreSQL database, used as-is with no artificial simplification.

---

## Repository Structure

```
soy/
│
├── docker-compose.yml          # Main orchestration – all services + profiles
├── variables.env               # Base environment variables (placeholder secrets)
├── build.sh                    # Build all Docker images locally
├── pull_from_dockerHub.sh      # Pull pre-built images from Docker Hub
├── LICENSE.txt
│
├── gateway-http/               # API Gateway (Node.js 18)
│   ├── adapters/               # Communication pattern adapters
│   │   ├── http.js             #   HTTP/1.1 reverse proxy
│   │   ├── grpc.js             #   gRPC / HTTP/2 + Protobuf
│   │   ├── websocket.js        #   socket.io persistent connection
│   │   ├── queue.js            #   AMQP request-reply (RabbitMQ)
│   │   └── topic.js            #   Kafka publish-subscribe
│   └── index.js                # Entry point (gateway auth + RA + routing)
│
├── other-http/                 # ms-other: users, sessions, exercises (Node.js 14)
│   ├── middlewares/
│   │   └── accessControl.js   # ZT_AC4A feature flag
│   └── transports/             # Per-pattern transport servers
│
├── exercise-http/              # ms-exercise: productions, statements (Node.js 14)
│   ├── middlewares/
│   │   └── accessControl.js   # ZT_AC4A feature flag
│   └── transports/
│
├── risk-analysis/              # Risk Analysis microservice (RA primitive)
│
├── shared/                     # Transport consumer helpers (gRPC, WS, queue, topic)
│
├── FrontReact/                 # React + TypeScript SPA (not benchmarked)
├── soy-db/                     # PostgreSQL 12 init (extract v5-soy-db.tgz before first run)
│
├── proto/
│   └── soy.proto               # Generic HttpForward RPC (gRPC adapter)
│
├── vault/
│   └── init.sh                 # HashiCorp Vault bootstrap (SR primitive)
│
├── nginx/                      # Nginx mTLS sidecar configs (mTLS primitive)
│
├── certs/                      # Generated TLS certificates — not committed
│   └── .gitkeep                # Run scripts/generate-certs.sh to populate
│
├── monitoring/
│   ├── prometheus/prometheus.yml
│   └── grafana/                # Pre-built dashboards
│
├── variants/                   # 18 ZT variant env files (v1-baseline … v18-all-broker-mtls)
│
├── load-tests/                 # Gatling simulation (Maven / Scala 2.13)
│   ├── pom.xml
│   ├── Dockerfile
│   ├── test-data.env           # Session/exercise IDs written by setup-test-data.sh
│   └── src/gatling/
│       ├── scala/soy/SoySimulation.scala
│       └── resources/data/
│           ├── students.csv    # 30 test student accounts (cycling feeder)
│           └── answer.sh       # Sample shell-script exercise answer
│
├── scripts/
│   ├── generate-certs.sh       # Generate self-signed CA + per-service certs
│   ├── setup-test-data.sh      # Seed test users / session / exercise via API
│   ├── run-variant.sh          # Launch any variant × pattern combination
│   ├── stop-variant.sh         # Stop all SoY containers
│   ├── run-load-test.sh        # Single-run orchestration (launch + test + collect)
│   ├── run-experiments.sh      # Multi-run sweep over variants × patterns
│   ├── run-batched.sh          # Thermally-aware sweep with cooling breaks
│   ├── collect-metrics.sh      # Query Prometheus + Jaeger after a run
│   └── analyze.py              # Aggregate raw JSON → summary.csv + LaTeX tables + figures
│
└── results/
    └── analysis/               # Pre-computed analysis outputs (committed)
        ├── summary.csv         # One row per run: variant, pattern, RPS, P50, P99, κ, …
        ├── tables/             # LaTeX table fragments
        │   ├── latency.tex
        │   ├── kappa.tex
        │   ├── zt_spans.tex
        │   ├── failure_rates.tex
        │   └── service_decomp.tex
        └── figures/            # PDF figures
            ├── latency_boxplot.pdf
            ├── pattern_comparison.pdf
            ├── span_breakdown.pdf
            └── service_decomp.pdf
```

---

## Prerequisites

| Tool | Minimum version | Purpose |
|---|---|---|
| Docker Engine | 25.0 | Container runtime |
| Docker Compose plugin | 2.20 | Service orchestration |
| Java JDK | 11 or 17 | Running Gatling load tests |
| Apache Maven | 3.8 | Building / running Gatling |
| OpenSSL | any | mTLS certificate generation |
| `curl` | any | Test data setup script |
| Python 3 | 3.9+ | Analysis script (`scripts/analyze.py`) |
| `jq` | any | Metrics collection scripts |

**System requirements (full sweep):**
- RAM: ≥ 8 GB (full stack with monitoring needs ~4 GB)
- CPU: ≥ 4 cores. For reproducible results, disable frequency scaling:
  ```bash
  sudo cpupower frequency-set -g performance
  ```
- Disk: ≥ 10 GB free (Docker images + Gatling/Jaeger/Prometheus results per run)
- The full 113-run sweep takes approximately **16 hours**; a thermal-aware batching script (`scripts/run-batched.sh`) is provided for constrained hardware.

---

## Application — Shell on You (SoY)

SoY is an e-learning platform for Unix Shell programming. Instructors create **sessions** containing **exercises**; students write and submit shell-script answers that are automatically evaluated by a Python-based grader.

```
Browser / Gatling client
        │
        │  HTTP  (all variants: external traffic is always HTTP/1.1)
        ▼
  ┌───────────┐
  │  Gateway  │  :5001 (external)
  │  Node 18  │  ← Auth + RA checked here (all gateway-centric variants)
  └─────┬─────┘
        │  COM_PATTERN transport (HTTP / gRPC / WS / AMQP / Kafka)
   ┌────┴────┐
   ▼         ▼
┌────────┐ ┌─────────────┐
│ms-other│ │ms-exercise  │  :8080 (internal)
│Node 14 │ │Node 14      │  ← RA also enforced here for service-tier variants (v17, v18)
└───┬────┘ └──────┬──────┘
    │              │
    └──────┬───────┘
           ▼
     ┌──────────┐
     │PostgreSQL│  :5432 (internal)
     └──────────┘
```

---

## Experimental Design

### Zero Trust Primitives

| ID | Name | What it does | Where it runs | Feature flag |
|---|---|---|---|---|
| **AC4A** | Access Control for All | JWT verified at **every** microservice, not only the gateway | ms-other, ms-exercise middlewares | `ZT_AC4A=true` |
| **SR** | Secret Rotation | JWT secret + DB password fetched from HashiCorp Vault at startup; renewed every 2 min | All services at boot | `ZT_SR=true` |
| **mTLS** | Mutual TLS | Nginx sidecar proxies require a valid client cert for all gateway→service connections | Nginx containers | `ZT_MTLS=true` |
| **RA** | Risk Analysis | Dedicated service analyses each request for anomalies before forwarding | Gateway middleware | `ZT_RA=true` |
| **RA-MS** | Service-tier RA | RA also enforced inside each microservice at message-receipt time | ms-other, ms-exercise | `ZT_RA_MS=true` |
| **Broker-mTLS** | Broker TLS | AMQP uses `amqps://` port 5671; Kafka uses SSL port 9093 | RabbitMQ, Kafka | `ZT_BROKER_MTLS=true` |

### Security Variants (18)

**Gateway-level variants (v1–v16): exhaustive 2⁴ combinations**

| # | Label | AC4A | SR | mTLS | RA |
|---|---|:---:|:---:|:---:|:---:|
| v1  | Baseline | | | | |
| v2  | AC4A | ✓ | | | |
| v3  | SR | | ✓ | | |
| v4  | mTLS | | | ✓ | |
| v5  | RA | | | | ✓ |
| v6  | AC4A + SR | ✓ | ✓ | | |
| v7  | AC4A + mTLS | ✓ | | ✓ | |
| v8  | AC4A + RA | ✓ | | | ✓ |
| v9  | SR + mTLS | | ✓ | ✓ | |
| v10 | SR + RA | | ✓ | | ✓ |
| v11 | mTLS + RA | | | ✓ | ✓ |
| v12 | AC4A + SR + mTLS | ✓ | ✓ | ✓ | |
| v13 | AC4A + SR + RA | ✓ | ✓ | | ✓ |
| v14 | AC4A + mTLS + RA | ✓ | | ✓ | ✓ |
| v15 | SR + mTLS + RA | | ✓ | ✓ | ✓ |
| v16 | All gateway primitives | ✓ | ✓ | ✓ | ✓ |

**Extended placement variants**

| # | Label | Primitives | Purpose |
|---|---|---|---|
| v17 | RA-MS | v16 + `ZT_RA_MS=true` | Service-tier RA — breaks transport independence |
| v18 | All + Broker-mTLS | v16 + `ZT_RA_MS=true` + `ZT_BROKER_MTLS=true` | Multi-boundary stacking — false-positive amplification |

### Communication Patterns (5)

| ID | Label | Transport | Extra infrastructure | `COM_PATTERN` |
|---|---|---|---|---|
| P1 | HTTP/REST | HTTP/1.1 reverse proxy | None | `http` |
| P2 | gRPC | HTTP/2 + Protobuf (`proto/soy.proto`) | None | `grpc` |
| P3 | WebSocket | socket.io persistent connection | None | `websocket` |
| P4 | Async Queue | AMQP request-reply via RabbitMQ | RabbitMQ 3.12 | `queue` |
| P5 | Async Topic | Kafka produce/consume with correlation-ID | Kafka 7.5 + ZooKeeper | `topic` |

All adapters serialise the incoming HTTP request into the transport format and deserialise the response. Existing Express routes require zero changes; measured differences are purely transport and security overhead.

### Measurement Matrix and Load Levels

Three sweeps at three deliberately chosen load levels, each targeting a distinct research question:

**5 req/s — baseline sweep (80 runs: 16 variants × 5 patterns)**
Keeps utilisation well below service saturation so each primitive's additive contribution can be isolated without queuing artefacts.

**15 req/s — high-load subset (18 runs: 6 variants × 3 patterns)**
At 3× baseline, RA-containing variants enter visible queuing. Tests whether the κ amplification factor grows with utilisation (M/M/1 prediction). Covers variants v1–v5 and v16 across HTTP, gRPC, and AMQP queue.

**20 req/s — extended-primitive sweep (15 runs: v17 + v18 × 5 patterns)**
Service-tier RA introduces a second bottleneck (the consumer dispatch loop) that only saturates above the gateway queuing threshold. 20 req/s was the lowest level at which the gRPC sequential-dispatch effect becomes clearly measurable.

```
              http  grpc  websocket  queue  topic   Load levels
v1–v5            ●     ●      ●        ●      ●     5 RPS + 15 RPS (v1–v5, v16)
v6–v15           ●     ●      ●        ●      ●     5 RPS
v16              ●     ●      ●        ●      ●     5 RPS + 15 RPS
v17              ●     ●      ●        ●      ●     20 RPS
v18              ●     ●      ●        ●      ●     20 RPS
                                                    Total: 113 runs
```

### Load Test Scenarios

Two scenarios run concurrently with a trapezoidal profile: 60 s ramp-up, 300 s sustained, 60 s ramp-down.

**S1 – Classroom Beginning** *(read-only)*
```
Login → GET session → GET exercises → GET exercise → GET student-statement → Logout
```

**S2 – Exercise Submission** *(write + evaluation)*
```
Login → GET session → GET productions → POST production [answer.sh] → GET production → Logout
```

S2 starts at ramp-up + 100 s (delayed), runs at 30% of S1's rate. 30 student accounts cycle as feeders.

### Metrics

| Metric | Source | Unit |
|---|---|---|
| Response time P50, P99 | Gatling simulation.log | ms |
| Failure rate | Gatling simulation.log | % |
| Per-primitive span latency | Jaeger (OpenTelemetry) | ms |
| CPU per container | Prometheus + cAdvisor | % of 1 core |
| Memory per container | Prometheus + cAdvisor | MB |

The **amplification factor** κ = ΔP99 / ΔP50 measures how much worse tail latency is than the median overhead. κ = 1 means pure additivity; κ > 1 indicates tail amplification from queuing.

---

## Pre-computed Results

The `results/analysis/` directory contains all computed outputs from the 113 runs:

| File | Contents |
|---|---|
| `results/analysis/summary.csv` | One row per run: variant, pattern, RPS, S1/S2 P50/P99, failure rate, κ |
| `results/analysis/tables/latency.tex` | P50/P99 per variant × pattern × load level |
| `results/analysis/tables/kappa.tex` | κ amplification factor |
| `results/analysis/tables/zt_spans.tex` | Per-primitive mean span latencies (Jaeger) |
| `results/analysis/tables/failure_rates.tex` | Failure rates per variant × pattern × RPS |
| `results/analysis/tables/service_decomp.tex` | ZT overhead share per architectural tier |
| `results/analysis/figures/latency_boxplot.pdf` | P99 distribution across variants |
| `results/analysis/figures/pattern_comparison.pdf` | P99 across patterns: gateway vs service-tier |
| `results/analysis/figures/span_breakdown.pdf` | Stacked per-primitive span durations |
| `results/analysis/figures/service_decomp.pdf` | Overhead share by architectural tier |

To regenerate from raw experiment data (42 GB, not included in this repo):
```bash
python3 scripts/analyze.py --results-dir results/experiments --out-dir results/analysis
```

---

## Replication — Step by Step

### 1. Clone and Prepare

```bash
git clone https://github.com/ctiber/zt_tax.git
cd zt_tax
```

Edit `variables.env` to replace placeholder secrets:
```bash
openssl rand -hex 32   # use as SECRET_JWT
openssl rand -hex 16   # use as COOKIE_SECRET
```

### 2. Database Initialisation

Extract the PostgreSQL data archive **once**:
```bash
cd soy-db && tar -xzf v5-soy-db.tgz && cd ..
ls soy-db/v5-soy-db/   # verify: PG_VERSION, base/, global/, ...
```

### 3. Docker Network

```bash
docker network create appnet
```

### 4. Test Data Setup

Run **once** after first `docker compose up`. Creates 30 student accounts, 1 session, 1 exercise, and writes IDs to `load-tests/test-data.env`.

```bash
./scripts/run-variant.sh 1 http
sleep 30
./scripts/setup-test-data.sh
cat load-tests/test-data.env
```

If account activation fails:
```bash
docker exec soy_postgres psql -U plagedba -d plagedb \
  -c "UPDATE soyuser SET activated=true WHERE email LIKE '%@test.soy';"
```

### 5. Running a Single Variant

```bash
./scripts/run-variant.sh <variant-number> <pattern>
./scripts/stop-variant.sh                              # stop when done
```

Examples:
```bash
./scripts/run-variant.sh 1  http       # baseline, HTTP
./scripts/run-variant.sh 16 grpc       # full gateway ZT, gRPC
./scripts/run-variant.sh 17 websocket  # service-tier RA, WebSocket
./scripts/run-variant.sh 4  queue      # mTLS only, AMQP queue
```

For mTLS variants (v4, v7, v9, v11, v12, v14, v15, v16, v17, v18), generate certificates first:
```bash
./scripts/generate-certs.sh
```

**Service URLs while running:**

| Service | URL | Credentials |
|---|---|---|
| Gateway | http://localhost:5001 | — |
| Vault | http://localhost:8200 | token: `soy-dev-root-token` |
| RabbitMQ | http://localhost:15672 | guest / guest |

### 6. Running the Full Measurement Matrix

```bash
# Baseline sweep: 16 variants × 5 patterns at 5 RPS (80 runs)
bash scripts/run-experiments.sh \
  --variants "1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16" \
  --patterns "http grpc websocket queue topic" \
  --target-rps 5.0 --ramp-up 60 --sustained 300 --ramp-down 60 --cooldown 60

# High-load subset: 6 variants × 3 patterns at 15 RPS (18 runs)
bash scripts/run-experiments.sh \
  --variants "1 2 3 4 5 16" \
  --patterns "http grpc queue" \
  --target-rps 15.0 --ramp-up 60 --sustained 300 --ramp-down 60 --cooldown 60

# Extended sweep: v17, v18 × 5 patterns at 20 RPS (10 runs)
bash scripts/run-experiments.sh \
  --variants "17 18" \
  --patterns "http grpc websocket queue topic" \
  --target-rps 20.0 --ramp-up 60 --sustained 300 --ramp-down 60 --cooldown 60
```

On thermally constrained hardware:
```bash
setsid bash scripts/run-batched.sh &   # inserts 20-min cooling breaks between batches
```

### 7. Collecting Metrics

Metrics are collected automatically after each Gatling run. To regenerate analysis outputs manually:
```bash
python3 scripts/analyze.py \
  --results-dir results/experiments \
  --out-dir     results/analysis
```

---

## Load Tests in Detail

### Maven

```bash
cd load-tests
mvn gatling:test \
  -Dsoy.baseUrl=http://localhost:5001 \
  -Dsoy.rampUp=60 -Dsoy.sustained=300 -Dsoy.rampDown=60 \
  -Dsoy.targetRps=5.0 \
  -Dsoy.sessionId=$(grep SESSION load-tests/test-data.env | cut -d= -f2) \
  -Dsoy.exerciseId=$(grep EXERCISE load-tests/test-data.env | cut -d= -f2)
```

Report: `load-tests/target/gatling/soysimulation-*/index.html`

### Docker (no local Java required)

```bash
cd load-tests
docker build -t soy-load-tests .
docker run --rm \
  --add-host="host.docker.internal:host-gateway" \
  -v "$(pwd)/results:/load-tests/target/gatling-results" \
  -e baseUrl="http://host.docker.internal:5001" \
  -e rampUp=60 -e sustained=300 -e rampDown=60 -e targetRps=5.0 \
  soy-load-tests
```

---

## Troubleshooting

**401 on all requests** — accounts not activated:
```bash
docker exec soy_postgres psql -U plagedba -d plagedb \
  -c "UPDATE soyuser SET activated=true WHERE email LIKE '%@test.soy';"
```

**`appnet` network not found:**
```bash
docker network create appnet
```

**mTLS nginx sidecar fails to start:**
```bash
./scripts/generate-certs.sh && ./scripts/run-variant.sh 4 http
```

**SR variant Vault `permission denied`:**
```bash
docker rm -f soy_vault_init
docker compose -f docker-compose.yml --profile sr up vault-init
```

**gRPC `UNAVAILABLE` in gateway log:**
```bash
docker logs soy_ms_other 2>&1 | grep -i grpc
# Expected: [grpc-server] listening on :50051
```

**Queue / Topic timeouts:**
```bash
docker logs soy_rabbitmq   # queue pattern
docker logs soy_kafka       # topic pattern
# Brokers may need up to 45 s; adapters retry automatically
```

**v17 gRPC P99 ~1426 ms / v18 50% failure rate:**
This is documented behaviour, not an error.
- v17 gRPC tail: sequential dispatch in the Node.js gRPC consumer serialises RA calls within each stream.
- v18 failures: false-positive amplification — dual-boundary RA on a shared stateful policy service doubles the apparent per-user request rate, triggering the rate limiter.

---

## Citation

```bibtex
@inproceedings{tiber2025placement,
  title     = {The Security Tax of Zero Trust Primitive Placement
               in Microservice Applications},
  author    = {Tibermacine, Chouki},
  booktitle = {[Venue]},
  year      = {2025}
}
```

The subject application SoY (Shell on You):
```bibtex
@inproceedings{soy2024,
  authors  = {{Vincent Berry, Arnaud Castelltort, Benoit Lange, Joan Teriihoania, Chouki Tibermacine and Catia Trubiani}}
  title     = {Is It Worth Migrating a Monolith to Microservices? An Experience Report on Performance, Availability and Energy Usage},
  booktitle = {IEEE International Conference on Web Services (ICWS)},
  year      = {2024}
}
```

---

## License

The SoY application source code is distributed under the **GNU General Public License v3.0** — see [LICENSE.txt](LICENSE.txt).

The replication package additions (ZT primitives, load tests, monitoring, scripts) are released under the same license.
