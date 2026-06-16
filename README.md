# ZT-Tax — Replication Package

Replication package for the paper:

> **Centralising or Distributing Zero Trust Enforcement in Microservice Architectures: An Overhead Measurement Study**

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
| Docker Engine | 27.x+ (official apt package; do **not** use snap Docker) |
| Docker Compose v2 | 2.x (`docker compose`) |
| Java + Maven | JDK 17+, Maven 3.9+ (for Gatling load tests) |
| Python 3 | 3.11+ |
| bash | any recent version |

> **Important:** Disable and stop any system Docker daemon before using snap
> Docker (or vice versa). Running two Docker daemons simultaneously causes
> iptables conflicts that prevent container-to-container communication.
> Use `sudo systemctl stop docker docker.socket && sudo systemctl disable docker docker.socket`
> to ensure only one daemon is active.

> **Note on snap Docker:** cAdvisor's Docker factory requires the containerd socket
> that snap Docker does not expose. The OB study uses a custom
> `docker-stats-exporter` instead (see `ob-zt/monitoring/`).

---

## Study 1 — SoY application (`soy/`)

SoY is a learning management system for shell-script programming exercises.
The ZT study sweeps 7 variants (v1–v7) across HTTP and Queue (AMQP)
communication patterns at 30 RPS, 3 runs each (42 total runs).

### Quick start

All images are built from source — no external registry required:

```bash
cd soy
docker compose build   # builds gateway, ms-exercise, ms-other, risk-analysis, queue-adapter
```

Create the external network used by all variants:
```bash
docker network create appnet
```

Then run the full sweep:

```bash
cd soy
bash scripts/run-experiments.sh \
  --variants "1 2 3 4 5 6 7" \
  --patterns "http queue" \
  --runs 3 \
  --target-rps 30 \
  --ramp-up 60 --sustained 300 --ramp-down 60

python3 scripts/analyze.py --indir results/experiments
```

### Variants

| Variant | ZT primitives enabled | mTLS implementation |
|---------|-----------------------|---------------------|
| v1 | Baseline (none) | — |
| v2 | AC4A | — |
| v3 | SR | — |
| v4 | mTLS | native HTTPS agent (keepAlive) |
| v5 | RA | — |
| v6 | AC4A + SR + mTLS + RA (all gateway) | native HTTPS agent |
| v7 | All-GW + RA at microservice tier | native HTTPS agent |

mTLS is implemented as a persistent Node.js `https.Agent` in the gateway,
establishing direct client-authenticated TLS connections to each microservice.
This native-agent approach adds minimal overhead (v4 P99 ≈ 157 ms, 0% failures).

### Communication patterns

`http` · `queue` (AMQP via RabbitMQ Direct Reply-to)

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
| v4 | mTLS — persistent HTTPS agent in gateway |
| v5 | RA — gateway Risk Analysis per request |
| v6 | All-GW — AC4A + SR + mTLS + RA at gateway |
| v7 | All+RA-MS — All-GW + RA at microservice tier |

### Communication patterns

`http` · `queue` (AMQP via RabbitMQ Direct Reply-to)

---

## Key findings

| Finding | SoY (2 services) | OB (11 services) |
|---------|-----------------|-----------------|
| P50 overhead (RA alone, v5, HTTP) | +34 ms (53 ms vs 19 ms baseline) | +5 ms (12 ms vs 7 ms baseline) |
| P99 amplification κ (gateway RA, HTTP) | ≈ 15 (v5: 681 ms vs 181 ms baseline) | ≈ 7.6 (v5: 66 ms vs 28 ms baseline) |
| P99 amplification κ (all-GW, HTTP) | ≈ 9.3 (v6: 3547 ms) | ≈ 7.6 (v6: 129 ms) |
| mTLS overhead (v4, HTTP, P99) | 157 ms, 0% failures | 107 ms, 0% failures |
| Error rate v1–v5 | 0% | 0% |
| Error rate v6 | 1–2% | 0% |
| Error rate v7 (RA-MS) | ~50% (RA blocking) | 0% (stable) |
| RA CPU — gateway only (v5) | 13–19% of 1 core | 9–10% |
| RA CPU — gateway + MS tier (v7) | ~26–38% of 1 core | 21.5% |

**Call-graph depth is the primary amplification variable.** Gateway-centric RA
placement caps the aggregate policy-service call rate at one per user request
regardless of topology. Service-tier placement scales it by call-graph depth *d*;
in OB (*d* ≈ 5–8) the same 30 RPS load generates 150–240 RA calls/s.

**mTLS implementation choice determines overhead.** Both applications use a
native persistent HTTPS agent, achieving near-zero overhead. A sidecar proxy
approach would introduce head-of-line blocking under sustained load.

**v7 (RA-MS) in SoY** shows ~50% failure rate from the risk-analysis
sliding-window detector flagging sessions as suspicious when the RA call rate
doubles (two calls per request instead of one). This is a policy-semantic effect,
not a capacity issue — the RA service CPU remains below saturation.

---

## Reproducing the SoY sweep (42 runs)

```bash
cd soy
# One-time network setup
docker network create appnet

# Full sweep: 7 variants × 2 patterns × 3 runs at 30 RPS
OTEL_ENABLED=true bash scripts/run-experiments.sh \
  --variants "1 2 3 4 5 6 7" \
  --patterns "http queue" \
  --runs 3 \
  --target-rps 30 \
  --ramp-up 60 --sustained 300 --ramp-down 60

# Analysis
python3 scripts/analyze.py --indir results/experiments
```

Results land in `soy/results/experiments/` (42 directories, one per run).
Analysis output lands in `soy/results/analysis/` (LaTeX tables + PDF figures).

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
