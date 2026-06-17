# ZT-Tax — Replication Package

Replication package for the paper:

> **Placement Determines Predictability: Zero Trust Overhead Across Microservice Architectures**

The study measures the latency and resource overhead of four Zero Trust
primitives — Access Control on All services (AC4A), Secret Rotation (SR),
mutual TLS (mTLS), and Risk Analysis (RA) — across two structurally different
microservice applications and two communication patterns (HTTP, AMQP queue),
comparing gateway-centric vs. service-tier enforcement placement.

---

## Repository structure

```
zt_tax/
├── soy/        # SoY application — primary study (Node.js, 2 services, 7 variants)
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

SoY (*Shell-on-You*) is a two-service learning management system for shell-script
programming exercises.  It is swept across **7 ZT variant combinations × 2
communication patterns (HTTP, Queue/AMQP) at 30 RPS**.

Architecture: `gateway → ms-other → postgres` and `gateway → ms-exercise → postgres`.
All inter-service communication is routed through the API gateway.

### Quick start

All services build from source — no Docker Hub images required.

**First-time setup** (one-off, ~3 min):

```bash
cd soy

# 1. Build all images
docker compose build

# 2. Start the stack (v1 baseline to initialise the DB)
bash scripts/run-variant.sh 1 http

# 3. Populate test accounts and write load-tests/test-data.env
bash scripts/setup-test-data.sh

# 4. Stop the stack
bash scripts/stop-variant.sh
```

> The DB schema and reference data are loaded automatically on the first start
> via `soy-db/init.sql` (PostgreSQL 17).  The `setup-test-data.sh` step creates
> 30 student accounts and subscribes them to the benchmark session; it only
> needs to be run once — the data persists in `soy/soy-db/v5-soy-db/`.

**Run a single variant:**

```bash
# Variant 5 (RA only), HTTP pattern, 30 RPS, 60 s ramp, 300 s sustained
bash scripts/run-variant.sh 5 http
```

**Run the full 7-variant × 2-pattern sweep:**

```bash
bash scripts/run-experiments.sh 30 60 300
# args: <rps> <ramp_seconds> <duration_seconds>
# 7 variants × 2 patterns = 14 runs (~3 hours)
```

**Analyse results:**

```bash
python3 scripts/analyze.py results/experiments/
# outputs results/analysis/tables/*.tex and figures/*.pdf
```

### Variants (paper mapping)

| Paper variant | ZT primitives enabled | SoY env file |
|---|---|---|
| v1 | Baseline (none) | v1-baseline.env |
| v2 | AC4A | v2-ac4a.env |
| v3 | SR | v3-sr.env |
| v4 | mTLS | v4-mtls.env |
| v5 | RA (gateway) | v5-ra.env |
| v6 | All-GW (AC4A + SR + mTLS + RA) | v6-all.env |
| v7 | All + RA at microservice tier | v7-ra-ms.env |

### Communication patterns

`http` (synchronous REST) · `queue` (AMQP request-reply via RabbitMQ)

### SoY results at 30 RPS

Median over 3 runs. S1 = Classroom Begin (read), S2 = Exercise Submit (write). HTTP pattern.

| Variant | S1 P50 | S1 P99 | S2 P50 | S2 P99 | Err% | Note |
|---------|-------:|-------:|-------:|-------:|-----:|------|
| v1 baseline | 19 | 181 | 8 | 78 | 0% | |
| v2 AC4A | 34 | 373 | 20 | 230 | 0% | |
| v3 SR | 19 | 198 | 8 | 112 | 0% | |
| v4 mTLS | 18 | 157 | 8 | 67 | 0% | native HTTPS agent, TLS handshake amortised |
| v5 RA | 53 | 681 | 39 | 531 | 0% | κ_P99 ≈ 15 |
| v6 All-GW | 380 | 3547 | 1851 | 3770 | 1.1% | super-additive tail from AC4A+RA interaction |
| v7 All+RA-MS | 129 | 3209 | 1174 | 3055 | 0.7% | service-tier RA viable at d=2, ρ≪1 |

Resource usage (HTTP, 30 RPS, average over sustained load window):

| Variant | GW CPU | ms-other CPU | ms-ex CPU | GW Mem | ms-other Mem | ms-ex Mem |
|---------|-------:|-------------:|----------:|-------:|-------------:|----------:|
| v1 baseline | 45.6% | 64.3% | 14.4% | 40 MB | 79 MB | 59 MB |
| v2 AC4A | 56.2% | 60.2% | 13.3% | 54 MB | 73 MB | 78 MB |
| v3 SR | 41.6% | 61.1% | 14.2% | 63 MB | 108 MB | 76 MB |
| v5 RA | 58.7% | 64.9% | 14.0% | 72 MB | 131 MB | 68 MB |

---

## Study 2 — Online Boutique ZT overlay (`ob-zt/`)

Google Online Boutique is a polyglot eleven-service e-commerce benchmark
(Go, C#, C++, Python, Java, Node.js) with all inter-service communication
over gRPC.  The ZT overlay adds a Node.js gateway in front of the OB frontend
and instruments each service with per-language JWT interceptors.
The sweep covers **7 ZT variants × 2 patterns at 30 RPS, 3 runs per variant**.

### One-time setup

```bash
cd ob-zt
bash setup.sh          # clones GoogleCloudPlatform/microservices-demo @ v0.10.1,
                       # applies ZT patches, generates TLS certificates
```

`setup.sh` clones the Online Boutique repository into `online-boutique/`
(not committed here), copies the ZT middleware into each service, patches
Dockerfiles, and generates a local CA + per-service certificates.

### Running the full experiment sweep

```bash
bash scripts/run-experiments.sh 30 60 300
# args: <rps> <ramp_seconds> <duration_seconds>
# 7 variants × 2 patterns × 3 runs = 42 runs (~8 hours)
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

### Analyzing results

```bash
# Latency summary (P50, P99, error rate) — median over 3 runs per variant
python3 scripts/analyze.py results/experiments/

# CPU and memory resource summary → results/analysis/tables/ob_resources.tex
python3 scripts/analyze-resources.py results/experiments/

# RA M/G/1 model fit → results/analysis/tables/ob_ra_model.tex
python3 scripts/analyze-ra-model.py results/experiments/
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

### OB results at 30 RPS (median over 3 runs)

Latency (ms), HTTP and Queue patterns:

| Variant | HTTP P50 | HTTP P99 | Queue P50 | Queue P99 | Err% |
|---------|--------:|---------:|----------:|----------:|-----:|
| v1 baseline | 7 | 28 | 11 | 70 | 0% |
| v2 AC4A | 15 | 431 | 20 | 91 | 0% |
| v3 SR | 9 | 239 | 13 | 44 | 0% |
| v4 mTLS | 8 | 107 | 13 | 73 | 0% |
| v5 RA | 12 | 66 | 19 | 221 | 0% |
| v6 All-GW | 22 | 129 | 32 | 161 | 0% |
| v7 All+RA-MS | 26 | 94 | 39 | 194 | 0%* |

\* v7-Queue: 1 of 3 runs saturated (83% errors, excluded from median); stable runs: P50=39ms, P99=194ms.

Resource usage (HTTP pattern, average over sustained load window):

| Variant | GW CPU | RA CPU | App CPU | GW Mem | RA Mem | App Mem |
|---------|-------:|-------:|--------:|-------:|-------:|--------:|
| v1 baseline | 31.5% | — | 102.1% | 85 MB | — | 435 MB |
| v2 AC4A | 47.6% | — | 153.1% | 83 MB | — | 415 MB |
| v3 SR | 45.6% | — | 101.5% | 84 MB | — | 413 MB |
| v4 mTLS | 42.8% | — | 110.0% | 81 MB | — | 396 MB |
| v5 RA | 56.7% | 9.2% | 110.0% | 93 MB | 63 MB | 397 MB |
| v6 All-GW | 67.1% | 9.7% | 165.5% | 97 MB | 49 MB | 417 MB |
| v7 All+RA-MS | 72.5% | 21.5% | 174.1% | 94 MB | 55 MB | 400 MB |

RA M/G/1 model fit (HTTP pattern):

| Variant | E[S] | C²s | ρ | κ̂₁ | κ̂d | κ_obs |
|---------|-----:|----:|---:|---:|---:|------:|
| v5 RA | 4.4 ms | 4.18 | 0.13 | 6.6 | 6.6 | 7.6 |
| v6 All-GW | 5.2 ms | 2.66 | 0.16 | 6.6 | 6.6 | 6.7 |
| v7 All+RA-MS | 5.0 ms | 1.02 | 0.91 | 6.6 | 2.3 | 3.5 |

---

## Key findings

| Finding | SoY (2 services, 30 RPS) | OB (11 services, 30 RPS) |
|---------|-------------------------|--------------------------|
| Additive model at P50 | Confirmed (all variants) | Confirmed (all variants) |
| RA overhead at P50 (gateway) | +34 ms (v5: 53 ms vs v1: 19 ms) | +5 ms (v5: 12 ms vs v1: 7 ms) |
| RA tail amplification κ at P99 (gateway, HTTP) | ≈ 15 (v5: 681 ms vs v1: 181 ms) | ≈ 7.6 (v5: 66 ms vs v1: 28 ms) |
| RA tail amplification κ at P99 (MS-tier, HTTP) | ≈ comparable to v6 (v7: 3209 ms, 0.7% err) | ≈ 3.5 (v7: 94 ms, 0% err) |
| mTLS overhead (v4, HTTP P99) | 157 ms, 0% failure | 107 ms, 0% failure |
| v6 all-GW (AC4A+SR+mTLS+RA) | S1 P99 3547 ms, 1.1% err | S1 P99 129 ms, 0% err |
| Communication-pattern independence | Confirmed (all gateway variants) | Confirmed (all gateway variants) |
| Error rate (non-mTLS variants, v1–v5) | 0% | 0% |
| Error rate v6/v7 | 0.7–1.1% | 0% (v7-Queue: 1/3 runs at ρ=0.91) |

**Call-graph depth is the primary RA amplification variable.**
Gateway-centric RA placement caps the policy-service call rate at one per
user request regardless of call-graph depth.  In SoY (depth 1–2) the RA
service stays well below saturation; in OB (depth 5–8) the same 30 RPS
generates 150–240 RA calls/s at the microservice tier, pushing ρ → 0.91.

---

## Reproducing specific paper findings

| Finding | Study | Command | Load |
|---------|-------|---------|------|
| Additive P50 model (SoY) | `soy/` | `run-experiments.sh 30 60 300` | 30 RPS |
| RA κ-amplification at P99 (SoY v5) | `soy/` | `run-experiments.sh 30 60 300` | 30 RPS |
| OB gateway-centric sweep + RA model | `ob-zt/` | `scripts/run-experiments.sh 30 60 300` | 30 RPS |
| OB resource metrics | `ob-zt/` | `python3 scripts/analyze-resources.py results/experiments/` | — |
| M/G/1 κ model fit | `ob-zt/` | `python3 scripts/analyze-ra-model.py results/experiments/` | — |

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
