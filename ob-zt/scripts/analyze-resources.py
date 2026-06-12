#!/usr/bin/env python3
"""
Parses resource metrics collected by collect-metrics.sh and produces:
  1. Console summary of CPU/memory/network per variant × pattern
  2. ob_resources.tex  — LaTeX table for the paper (CPU + Mem, HTTP pattern)
  3. ob_ra_model.tex   — LaTeX table: E[S], C²_s, ρ, predicted κ vs observed κ

For multi-run experiments each variant×pattern directory is named
v<V>-<P>-run<N>/; results are averaged across runs.

Usage:
    python3 scripts/analyze-resources.py results/experiments/
"""

import sys
import json
import re
import math
from pathlib import Path

VARIANT_NAMES = {
    1: "baseline", 2: "AC4A", 3: "SR", 4: "mTLS",
    5: "RA", 6: "All-GW", 7: "All+RA-MS",
}

SERVICES = {
    "gateway":    "zt-gateway",
    "frontend":   "frontend",
    "checkout":   "checkoutservice",
    "cart":       "cartservice",
    "catalog":    "productcatalogservice",
    "payment":    "paymentservice",
    "shipping":   "shippingservice",
    "currency":   "currencyservice",
    "recommend":  "recommendationservice",
    "email":      "emailservice",
    "ads":        "adservice",
    "risk-anal.": "risk-analysis",
}

APP_SVCS = {
    "frontend", "checkout", "cart", "catalog", "payment",
    "shipping", "currency", "recommend", "email", "ads",
}

MONITORING_RE = re.compile(r"(cadvisor|prometheus|grafana|jaeger|docker.stats)")

# Call-graph depth estimate per variant (RA calls per user request).
# v1-v4: no RA → d=0; v5,v6: gateway RA only → d≈1; v7: gateway + each MS → d≈6
CALL_GRAPH_DEPTH = {1: 0, 2: 0, 3: 0, 4: 0, 5: 1, 6: 1, 7: 6}

# Gatling load used in experiments (RPS)
LAMBDA_USER = 30.0


# ── Parsing helpers ──────────────────────────────────────────────────────────

def load_container_map(path: Path) -> dict[str, str]:
    result = {}
    if not path.exists():
        return result
    for line in path.read_text().strip().splitlines():
        parts = line.split("\t")
        if len(parts) == 2:
            name, full_id = parts[0].strip(), parts[1].strip()
            result[full_id] = name
    return result


def parse_prom_result(path: Path, container_map: dict | None = None) -> dict[str, float]:
    try:
        data = json.loads(path.read_text())
    except Exception:
        return {}
    if data.get("status") != "success":
        return {}
    out = {}
    for item in data["data"]["result"]:
        name = item["metric"].get("name", "")
        if not name and container_map:
            cgroup_id = item["metric"].get("id", "")
            m = re.match(r".*/docker-([0-9a-f]+)(?:\.scope)?$", cgroup_id)
            if m:
                partial = m.group(1)
                for full_id, cname in container_map.items():
                    if full_id.startswith(partial):
                        name = cname
                        break
        if not name or MONITORING_RE.search(name):
            continue
        try:
            out[name] = float(item["value"][1])
        except (KeyError, IndexError, ValueError):
            pass
    return out


def parse_scalar(path: Path) -> float | None:
    """Parse a Prometheus instant query that returns a single scalar result."""
    try:
        data = json.loads(path.read_text())
    except Exception:
        return None
    if data.get("status") != "success":
        return None
    results = data["data"]["result"]
    if not results:
        return None
    try:
        return float(results[0]["value"][1])
    except (KeyError, IndexError, ValueError):
        return None


def parse_histogram_buckets(path: Path) -> list[tuple[float, float]]:
    """
    Returns list of (upper_bound, cumulative_count) from a histogram_bucket result.
    Sorted by upper_bound ascending, excluding le="+Inf".
    """
    try:
        data = json.loads(path.read_text())
    except Exception:
        return []
    if data.get("status") != "success":
        return []
    buckets = []
    for item in data["data"]["result"]:
        le = item["metric"].get("le", "")
        if le == "+Inf":
            continue
        try:
            buckets.append((float(le), float(item["value"][1])))
        except (ValueError, KeyError, IndexError):
            pass
    return sorted(buckets, key=lambda x: x[0])


def compute_ra_stats(run_dir: Path) -> dict | None:
    """
    Computes E[S], E[S²], C²_s from the collected RA histogram.
    Returns None if data not available (no RA in this variant).
    """
    total_s = parse_scalar(run_dir / "ra_duration_sum.json")
    total_n = parse_scalar(run_dir / "ra_duration_count.json")
    buckets  = parse_histogram_buckets(run_dir / "ra_duration_buckets.json")

    if total_n is None or total_n < 1 or total_s is None:
        return None

    mean_s = total_s / total_n  # E[S] in seconds

    # Estimate E[S²] from histogram buckets via midpoint approximation.
    # Each bucket [prev_bound, upper_bound] contributes count_in_bucket * midpoint²
    e_s2 = 0.0
    prev_count = 0.0
    prev_bound = 0.0
    for upper, cum_count in buckets:
        freq = max(cum_count - prev_count, 0.0)
        midpoint = (prev_bound + upper) / 2.0
        e_s2 += freq * midpoint ** 2
        prev_count = cum_count
        prev_bound = upper
    # Observations beyond the last bucket: use last upper_bound as midpoint
    tail_freq = max(total_n - prev_count, 0.0)
    e_s2 += tail_freq * prev_bound ** 2
    e_s2 /= total_n

    var_s = max(e_s2 - mean_s ** 2, 0.0)
    c2s   = var_s / (mean_s ** 2) if mean_s > 0 else 0.0

    return {"mean_s": mean_s, "var_s": var_s, "c2s": c2s, "count": total_n}


# ── Queuing theory model ─────────────────────────────────────────────────────

def mg1_predicted_kappa(mean_s: float, c2s: float, d: int,
                        lambda_user: float = LAMBDA_USER) -> dict:
    """
    M/G/1 model for the end-to-end RA overhead per request.

    Aggregate RA call rate: λ_RA = d × λ_user
    Utilisation:            ρ = λ_RA × E[S]
    P-K mean waiting time:  E[W] = ρ·E[S]·(1+C²_s) / (2(1−ρ))
    Mean sojourn time:      E[T] = E[S] + E[W]

    For the tail we use the heavy-traffic exponential approximation:
        P(T > t) ≈ exp(−t / θ)   where θ = E[S]·(1+C²_s) / (2(1−ρ))
        T_q = −θ·ln(q)

    κ = ΔP99 / ΔP50  where Δ is relative to d=0 (no RA overhead).
    For d=0, ΔP50 = ΔP99 = 0 so κ is undefined; return None.
    """
    if d == 0:
        return {"rho": 0.0, "mean_sojourn_ms": 0.0, "kappa": None}

    lambda_ra = d * lambda_user
    rho = lambda_ra * mean_s

    if rho >= 1.0:
        return {"rho": rho, "mean_sojourn_ms": None, "kappa": None, "unstable": True}

    theta = mean_s * (1 + c2s) / (2 * (1 - rho))   # characteristic time
    e_t   = mean_s + rho * mean_s * (1 + c2s) / (2 * (1 - rho))

    # Quantiles under exponential tail: T_q = -theta * ln(q)
    t_p50 = -theta * math.log(0.50)
    t_p99 = -theta * math.log(0.01)

    kappa = t_p99 / t_p50 if t_p50 > 0 else None  # = ln(100)/ln(2) ≈ 6.64 for M/M/1

    # Scale by call-graph depth: d sequential calls compound the tail
    # Under independence, sum of d Exp(1/θ) RVs ~ Gamma(d, θ)
    # P99 of Gamma(d, θ) / P50 of Gamma(d, θ) for large d → 1 by CLT,
    # but for d≤10 the ratio remains meaningfully > 1.
    # We use the Gamma quantile for a more accurate compound-path estimate.
    try:
        import scipy.stats as stats
        scale = theta
        t_p50_d = stats.gamma.ppf(0.50, a=d, scale=scale)
        t_p99_d = stats.gamma.ppf(0.99, a=d, scale=scale)
        kappa_d = t_p99_d / t_p50_d if t_p50_d > 0 else None
    except ImportError:
        # Fallback: use normal approximation for large d
        mean_d  = d * theta
        std_d   = math.sqrt(d) * theta
        t_p50_d = mean_d
        t_p99_d = mean_d + 2.326 * std_d
        kappa_d = t_p99_d / t_p50_d if t_p50_d > 0 else None

    return {
        "rho":             rho,
        "mean_sojourn_ms": e_t * 1000,
        "theta_ms":        theta * 1000,
        "kappa_single":    kappa,        # κ for single RA call (d=1 path)
        "kappa_compound":  kappa_d,      # κ for d-hop compound path (Gamma model)
    }


# ── Run data loading ─────────────────────────────────────────────────────────

def match_service(container_name: str) -> str | None:
    for short, fragment in SERVICES.items():
        if fragment in container_name:
            return short
    return None


def extract_variant_pattern_run(dirname: str):
    m = re.match(r"v(\d+)-(http|queue)-run(\d+)$", dirname)
    if m:
        return int(m.group(1)), m.group(2), int(m.group(3))
    return None, None, None


def load_run(run_dir: Path) -> dict | None:
    container_map = load_container_map(run_dir / "container_map.tsv")
    cpu_avg = parse_prom_result(run_dir / "cpu_avg.json", container_map)
    mem_rss = parse_prom_result(run_dir / "mem_rss.json", container_map)
    net_rx  = parse_prom_result(run_dir / "net_rx_bps.json", container_map)
    net_tx  = parse_prom_result(run_dir / "net_tx_bps.json", container_map)

    if not cpu_avg and not mem_rss:
        return None

    svc_data: dict[str, dict] = {}
    for container, cpu in cpu_avg.items():
        svc = match_service(container)
        if svc:
            svc_data.setdefault(svc, {})["cpu_avg"] = round(cpu, 3)
    for container, mem in mem_rss.items():
        svc = match_service(container)
        if svc:
            svc_data.setdefault(svc, {})["mem_mib"] = round(mem / 1024**2, 1)
    for container, rx in net_rx.items():
        svc = match_service(container)
        if svc:
            svc_data.setdefault(svc, {})["net_rx_kbps"] = round(rx / 1024, 2)
    for container, tx in net_tx.items():
        svc = match_service(container)
        if svc:
            svc_data.setdefault(svc, {})["net_tx_kbps"] = round(tx / 1024, 2)

    ra_stats = compute_ra_stats(run_dir)
    return {"services": svc_data, "ra_stats": ra_stats}


# ── Aggregation across runs ──────────────────────────────────────────────────

def mean_of(values: list[float | None]) -> float | None:
    vals = [v for v in values if v is not None]
    return sum(vals) / len(vals) if vals else None


def aggregate_runs(run_list: list[dict]) -> dict:
    """Average service metrics and RA stats across multiple runs."""
    all_svcs = set()
    for r in run_list:
        all_svcs.update(r["services"].keys())

    merged_svcs: dict[str, dict] = {}
    for svc in all_svcs:
        fields = ["cpu_avg", "mem_mib", "net_rx_kbps", "net_tx_kbps"]
        merged_svcs[svc] = {}
        for f in fields:
            vals = [r["services"].get(svc, {}).get(f) for r in run_list]
            v = mean_of(vals)
            if v is not None:
                merged_svcs[svc][f] = round(v, 3 if f == "cpu_avg" else 2)

    # RA stats: average across runs where data exists
    ra_runs = [r["ra_stats"] for r in run_list if r["ra_stats"]]
    if ra_runs:
        merged_ra = {
            "mean_s": mean_of([r["mean_s"] for r in ra_runs]),
            "c2s":    mean_of([r["c2s"]    for r in ra_runs]),
            "count":  sum(r["count"] for r in ra_runs),
        }
    else:
        merged_ra = None

    return {"services": merged_svcs, "ra_stats": merged_ra}


# ── Observed κ loading ────────────────────────────────────────────────────────

def load_observed_kappa(results_dir: Path) -> dict[tuple[int, str], float | None]:
    """
    Load observed κ = ΔP99/ΔP50 for each variant×pattern from summary.csv.
    κ is computed relative to v1 baseline.
    """
    summary = results_dir / "summary.csv"
    if not summary.exists():
        return {}

    rows: dict[tuple, dict] = {}
    with open(summary) as f:
        header = None
        for line in f:
            line = line.strip()
            if not line:
                continue
            if header is None:
                header = [h.strip() for h in line.split(",")]
                continue
            vals = [v.strip() for v in line.split(",")]
            d = dict(zip(header, vals))
            try:
                v = int(d["variant"])
                p = d["pattern"]
                rows[(v, p)] = {
                    "p50": float(d["p50_ms"]),
                    "p99": float(d["p99_ms"]),
                }
            except (KeyError, ValueError):
                pass

    kappa: dict[tuple, float | None] = {}
    for (v, p), stats in rows.items():
        base = rows.get((1, p))
        if base is None or v == 1:
            kappa[(v, p)] = None
            continue
        dp50 = stats["p50"] - base["p50"]
        dp99 = stats["p99"] - base["p99"]
        kappa[(v, p)] = round(dp99 / dp50, 1) if dp50 > 0.5 else None
    return kappa


# ── LaTeX table writers ──────────────────────────────────────────────────────

def write_latex_resources(rows: list[dict], out_path: Path) -> None:
    """CPU + Mem table (HTTP pattern, averaged over runs)."""
    by_variant: dict[int, dict] = {}
    for r in rows:
        if r["pattern"] == "http":
            by_variant[r["variant"]] = r["agg"]

    lines = [
        r"\begin{tabular}{lrrrrrr}",
        r"\toprule",
        r"Variant & \multicolumn{3}{c}{CPU (\%)} & \multicolumn{3}{c}{Mem (MB)} \\",
        r"\cmidrule(lr){2-4}\cmidrule(lr){5-7}",
        r" & GW & RA & App & GW & RA & App \\",
        r"\midrule",
    ]

    for v in sorted(by_variant):
        agg = by_variant[v]
        s   = agg["services"]
        label = f"v{v}-{VARIANT_NAMES.get(v, str(v))}"

        def sv(svc, field):
            return s.get(svc, {}).get(field)

        def app_sum(field):
            vals = [s[k].get(field, 0) for k in APP_SVCS if k in s]
            return sum(vals) if vals else None

        def fmt(val, decimals=1):
            return r"\textemdash" if val is None else f"{val:.{decimals}f}"

        lines.append(
            f"{label} & {fmt(sv('gateway','cpu_avg'))} & {fmt(sv('risk-anal.','cpu_avg'))} & "
            f"{fmt(app_sum('cpu_avg'))} & {fmt(sv('gateway','mem_mib'),0)} & "
            f"{fmt(sv('risk-anal.','mem_mib'),0)} & {fmt(app_sum('mem_mib'),0)} \\\\"
        )

    lines += [r"\bottomrule", r"\end{tabular}"]
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(lines) + "\n")
    print(f"\nResources table → {out_path}")


def write_latex_ra_model(rows: list[dict], obs_kappa: dict,
                         out_path: Path) -> None:
    """
    M/G/1 model table: E[S], C²_s, ρ, predicted κ (single & compound),
    observed κ (HTTP pattern).
    """
    http_rows = {r["variant"]: r for r in rows if r["pattern"] == "http"}

    lines = [
        r"\begin{tabular}{lrrrrrr}",
        r"\toprule",
        r"Variant & $E[S]$ (ms) & $C^2_s$ & $\rho$ & "
        r"$\hat{\kappa}_1$ & $\hat{\kappa}_d$ & $\kappa_{\text{obs}}$ \\",
        r"\midrule",
    ]

    for v in sorted(http_rows):
        r   = http_rows[v]
        agg = r["agg"]
        ra  = agg.get("ra_stats")
        d   = CALL_GRAPH_DEPTH.get(v, 0)
        label = f"v{v}-{VARIANT_NAMES.get(v, str(v))}"

        if ra and ra["mean_s"] is not None and d > 0:
            mean_ms = ra["mean_s"] * 1000
            c2s     = ra["c2s"]
            model   = mg1_predicted_kappa(ra["mean_s"], c2s, d)
            rho     = model["rho"]
            k1      = model.get("kappa_single")
            kd      = model.get("kappa_compound")
            rho_str = f"{rho:.2f}"
            k1_str  = f"{k1:.1f}" if k1 is not None else r"\textemdash"
            kd_str  = f"{kd:.1f}" if kd is not None else r"\textemdash"
            es_str  = f"{mean_ms:.1f}"
            c2s_str = f"{c2s:.2f}"
        else:
            es_str = c2s_str = rho_str = k1_str = kd_str = r"\textemdash"

        k_obs = obs_kappa.get((v, "http"))
        k_obs_str = f"{k_obs:.1f}" if k_obs is not None else r"\textemdash"

        lines.append(
            f"{label} & {es_str} & {c2s_str} & {rho_str} & "
            f"{k1_str} & {kd_str} & {k_obs_str} \\\\"
        )

    lines += [r"\bottomrule", r"\end{tabular}"]
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(lines) + "\n")
    print(f"M/G/1 model table → {out_path}")


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    results_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("results/experiments")
    if not results_dir.exists():
        print(f"ERROR: {results_dir} does not exist.", file=sys.stderr)
        sys.exit(1)

    # Collect all run directories; group by (variant, pattern)
    groups: dict[tuple[int, str], list[dict]] = {}
    for run_dir in sorted(results_dir.iterdir()):
        if not run_dir.is_dir() or run_dir.is_symlink():
            continue
        variant, pattern, run_n = extract_variant_pattern_run(run_dir.name)
        if variant is None:
            continue
        data = load_run(run_dir)
        if data is None:
            print(f"  WARN: no resource data in {run_dir.name}")
            continue
        groups.setdefault((variant, pattern), []).append(data)

    if not groups:
        print("No resource data found.")
        return

    # Build summary rows
    rows = []
    for (variant, pattern), run_list in sorted(groups.items()):
        agg = aggregate_runs(run_list)
        rows.append({
            "variant": variant,
            "label":   VARIANT_NAMES.get(variant, f"v{variant}"),
            "pattern": pattern,
            "n_runs":  len(run_list),
            "agg":     agg,
        })

    # ── Console summary ───────────────────────────────────────────────────────
    print(f"\n{'var':>3}  {'label':<12}  {'pat':<5}  {'runs':>4}  "
          f"{'cpu_gw':>7}  {'cpu_ra':>7}  {'mem_gw':>8}  "
          f"{'ra_E[S]ms':>10}  {'C2s':>6}  {'rho':>5}")
    print("-" * 90)
    for r in sorted(rows, key=lambda x: (x["pattern"], x["variant"])):
        s  = r["agg"]["services"]
        ra = r["agg"].get("ra_stats") or {}
        d  = CALL_GRAPH_DEPTH.get(r["variant"], 0)
        model = mg1_predicted_kappa(
            ra.get("mean_s", 0) or 0,
            ra.get("c2s", 0) or 0,
            d,
        ) if ra.get("mean_s") else {}

        print(f"{r['variant']:>3}  {r['label']:<12}  {r['pattern']:<5}  {r['n_runs']:>4}  "
              f"{s.get('gateway',{}).get('cpu_avg',0):>7.2f}  "
              f"{s.get('risk-anal.',{}).get('cpu_avg',0):>7.2f}  "
              f"{s.get('gateway',{}).get('mem_mib',0):>8.1f}  "
              f"{(ra.get('mean_s',0) or 0)*1000:>10.2f}  "
              f"{ra.get('c2s',0) or 0:>6.2f}  "
              f"{model.get('rho',0) or 0:>5.2f}")

    # ── Network summary ───────────────────────────────────────────────────────
    print("\n=== Network throughput (kB/s) — HTTP pattern, gateway + risk-analysis ===")
    http_rows = [r for r in rows if r["pattern"] == "http"]
    for r in sorted(http_rows, key=lambda x: x["variant"]):
        s   = r["agg"]["services"]
        gw  = s.get("gateway", {})
        ra  = s.get("risk-anal.", {})
        print(f"  v{r['variant']}-{r['label']:<12}  "
              f"gw rx={gw.get('net_rx_kbps',0):6.1f} tx={gw.get('net_tx_kbps',0):6.1f}  "
              f"ra rx={ra.get('net_rx_kbps',0):6.1f} tx={ra.get('net_tx_kbps',0):6.1f}")

    # ── LaTeX tables ──────────────────────────────────────────────────────────
    tables_dir = results_dir.parent / "analysis" / "tables"
    obs_kappa  = load_observed_kappa(results_dir)

    write_latex_resources(rows, tables_dir / "ob_resources.tex")
    write_latex_ra_model(rows, obs_kappa, tables_dir / "ob_ra_model.tex")


if __name__ == "__main__":
    main()
