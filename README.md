# ZT-Tax — Replication Package

Replication package for the paper:

> **The Security Tax of Zero Trust Primitive Placement in Microservice Applications**

The study measures the latency and resource overhead of four Zero Trust
primitives — Access Control on All services (AC4A), Secret Rotation (SR),
mutual TLS (mTLS), and Risk Analysis (RA) — across two structurally different
microservice applications and multiple communication patterns, comparing
gateway-centric vs. service-tier enforcement placement.

---

## Repository structure

```
zt_tax/
├── soy/      # SoY application — primary study (Node.js, 2 services)
└── ob-zt/    # Online Boutique ZT overlay — replication study (polyglot, 11 services)
```

---

## Prerequisites

Both studies share the same toolchain:

| Tool | Version tested |
|------|---------------|
| Docker Engine | 29.x |
| Docker Compose v2 | 2.x (`docker compose`) |
| Java + Maven | JDK 17+, Maven 3.9+ (for Gatling load tests) |
| Python 3 | 3.11+ |
| bash | any recent version |

---

## Study 1 — SoY application (`soy/`)

SoY is a learning management system for shell-script programming exercises.
It exposes five communication patterns (HTTP, gRPC, WebSocket, Queue/AMQP,
Topic/Kafka) and was swept across all 2⁴ = 16 ZT primitive combinations.

### Quick start

Pre-built Docker images are available on Docker Hub — no local build required:

```bash
cd soy
bash pull_from_dockerHub.sh   # pulls icws24submission/* images
```

Then run a variant:

```bash
# Example: variant 16 (all primitives), HTTP pattern, 5 RPS
bash scripts/run-variant.sh 16 http
bash scripts/run-experiments.sh 5 60 300
python3 scripts/analyze.py results/experiments/
```

### Variants

| Variant | ZT primitives enabled |
|---------|----------------------|
| v1 | Baseline (none) |
| v2 | AC4A |
| v3 | SR |
| v4 | mTLS |
| v5 | RA |
| … | all 2⁴ = 16 combinations |
| v16 | AC4A + SR + mTLS + RA |
| v17 | All + RA at microservice tier |
| v18 | All + RA-MS + Broker-mTLS |

### Communication patterns

`http` · `grpc` · `websocket` · `queue` · `topic`

---

## Study 2 — Online Boutique ZT overlay (`ob-zt/`)

Google Online Boutique is a polyglot eleven-service e-commerce benchmark
(Go, C#, C++, Python, Java, Node.js) with all inter-service communication
over gRPC. This study replays the gateway-centric sweep with seven ZT
variants across HTTP and AMQP queue patterns at 20 RPS.

### One-time setup

```bash
cd ob-zt
bash setup.sh          # clones GoogleCloudPlatform/microservices-demo,
                       # applies ZT patches, generates TLS certificates
```

`setup.sh` clones the Online Boutique repository into `online-boutique/`
(not committed here), copies the ZT middleware into each service, patches
Dockerfiles, and generates a local CA + per-service certificates.

### Running the full experiment sweep

```bash
bash scripts/run-experiments.sh 20 60 300
# args: <rps> <ramp_seconds> <duration_seconds>
# 7 variants × 2 patterns = 14 runs (~2.5 hours)
```

Results land in `results/experiments/`.

### Analyzing results

```bash
# Latency summary (P50, P99, error rate)
python3 scripts/analyze.py results/experiments/

# CPU and memory resource summary
python3 scripts/analyze-resources.py results/experiments/
```

### Variants

| Variant | ZT primitives |
|---------|--------------|
| v1 | Baseline |
| v2 | AC4A — JWT verification at each OB service |
| v3 | SR — JWT signing key from HashiCorp Vault |
| v4 | mTLS — nginx sidecar per OB service |
| v5 | RA — gateway Risk Analysis per request |
| v6 | All-GW — AC4A + SR + mTLS + RA at gateway |
| v7 | All+RA-MS — All-GW + RA at microservice tier |

### Communication patterns

`http` · `queue` (AMQP via RabbitMQ Direct Reply-to)

### Selective re-runs

```bash
# Re-run a single variant/pattern
bash scripts/run-variant.sh 5 http
bash scripts/run-experiments.sh 20 60 300 results/my-run/

# Re-run only v5 and v6 HTTP (replicate study)
bash scripts/run-replicate.sh 20 60 300 results/replicate/
```

---

## Reproducing specific paper findings

| Finding | Script | Load |
|---------|--------|------|
| Additive P50 model | `run-experiments.sh 5 60 300` | 5 RPS |
| κ amplification at P99 | `run-experiments.sh 15 60 300` | 15 RPS |
| Service-tier consumer model (gRPC vs HTTP) | `run-experiments.sh 20 60 300` | 20 RPS |
| OB gateway-centric sweep | `ob-zt/scripts/run-experiments.sh 20 60 300` | 20 RPS |
| RA tail instability (5 replicates) | `ob-zt/scripts/run-replicate.sh` × 5 | 20 RPS |

---

## Security notes

- TLS certificates are **generated locally** by `setup.sh` / `scripts/generate-certs.sh`
  and are excluded from git (`certs/*.key`, `certs/*.crt`).
  Re-generate them on each new machine.
- `variables.env` contains only placeholder secrets used in development.
  Do not use these values in production.
- The `online-boutique/` directory is created by `setup.sh` and is not committed.
