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
├── soy/        # SoY application — primary study (Node.js, 2 services)
├── ob-zt/      # Online Boutique ZT overlay — replication study (polyglot, 11 services)
└── paper/      # Paper source (submodule → ctiber/zt_tax_paper)
```

---

## Prerequisites

Both studies share the same toolchain:

| Tool | Version tested |
|------|---------------|
| Docker Engine | 29.x (snap Docker not supported — use official package) |
| Docker Compose v2 | 2.x (`docker compose`) |
| Java + Maven | JDK 17+, Maven 3.9+ (for Gatling load tests) |
| Python 3 | 3.11+ |
| bash | any recent version |

> **Note on snap Docker:** cAdvisor's Docker factory requires the containerd socket
> that snap Docker does not expose. The OB study uses a custom
> `docker-stats-exporter` instead (see `ob-zt/monitoring/`).

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
# Example: variant 5 (RA only), HTTP pattern, 30 RPS
bash scripts/run-variant.sh 5 http
bash scripts/run-experiments.sh 30 60 300
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

### Communication patterns

`http` · `grpc` · `websocket` · `queue` · `topic`

---

## Study 2 — Online Boutique ZT overlay (`ob-zt/`)

Google Online Boutique is a polyglot eleven-service e-commerce benchmark
(Go, C#, C++, Python, Java, Node.js) with all inter-service communication
over gRPC. This study sweeps seven ZT variants across HTTP and AMQP queue
patterns at 30 RPS.

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
bash scripts/run-experiments.sh 30 60 300
# args: <rps> <ramp_seconds> <duration_seconds>
# 7 variants × 2 patterns = 14 runs (~2 hours)
```

Results land in `results/experiments/`.

### Monitoring

The monitoring stack (`docker compose --profile monitoring up`) starts:

- **Prometheus** — scrapes `docker-stats-exporter` and cAdvisor
- **Grafana** — pre-built dashboard at `http://localhost:3000`
- **Jaeger** — distributed traces at `http://localhost:16686`
- **docker-stats-exporter** (`ob-zt/monitoring/`) — custom Python exporter
  that queries the Docker socket API and exposes per-container CPU and RSS
  memory as Prometheus metrics on port 9338.
  Required because snap Docker does not expose the containerd socket that
  cAdvisor's Docker factory needs.

### Analyzing results

```bash
# Latency summary (P50, P99, error rate)
python3 scripts/analyze.py results/experiments/

# CPU and memory resource summary → results/analysis/tables/ob_resources.tex
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

---

## Key findings

| Finding | SoY (2 services) | OB (11 services) |
|---------|-----------------|-----------------|
| P50 overhead (RA) | +6 ms (v5) | +6 ms (v5) |
| P99 amplification κ (gateway RA, HTTP) | < 1 | ≈ 63 (v5: 411 ms vs 32 ms baseline) |
| P99 amplification κ (MS-tier RA, HTTP) | < 1 | ≈ 9 (v7: 199 ms) |
| RA CPU — gateway only | < 1 % | 10.6 % |
| RA CPU — gateway + MS tier | < 1 % | 21.1 % |
| Error rate (all variants) | 0 % | 0 % |

**Call-graph depth is the primary amplification variable.** Gateway-centric RA
placement caps the aggregate policy-service call rate at one per user request
regardless of topology. Service-tier placement scales it by call-graph depth $d$;
in OB ($d \approx 5$–8) the same 30 RPS load generates 150–240 RA calls/s.

---

## Reproducing specific paper findings

| Finding | Script | Load |
|---------|--------|------|
| Additive P50 model | `run-experiments.sh 5 60 300` | 5 RPS |
| κ amplification at P99 (SoY) | `run-experiments.sh 15 60 300` | 15 RPS |
| OB gateway-centric sweep + resources | `ob-zt/scripts/run-experiments.sh 30 60 300` | 30 RPS |
| OB resource metrics | `ob-zt/scripts/analyze-resources.py results/experiments/` | — |

---

## Security notes

- TLS certificates are **generated locally** by `setup.sh` / `scripts/generate-certs.sh`
  and are excluded from git (`certs/*.key`, `certs/*.crt`).
  Re-generate them on each new machine.
- `variables.env` contains only placeholder secrets used in development.
  Do not use these values in production.
- The `online-boutique/` directory is created by `setup.sh` and is not committed.
- Vault AppRole credentials (`ob-zt/vault/role_id`, `ob-zt/vault/secret_id`) are
  development-only placeholders. Replace them with your own Vault AppRole before
  running in a shared environment.
