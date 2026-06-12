#!/usr/bin/env python3
"""
Parses cAdvisor CPU and memory JSON files collected by collect-metrics.sh
and produces a summary table per variant × pattern × service.

Usage:
    python3 scripts/analyze-resources.py results/experiments/
"""

import sys
import json
import re
from pathlib import Path

VARIANT_NAMES = {
    1: "baseline", 2: "AC4A", 3: "SR", 4: "mTLS",
    5: "RA", 6: "All-GW", 7: "All+RA-MS",
}

# Services to report (short name → container name fragment)
SERVICES = {
    "gateway":     "zt-gateway",
    "frontend":    "frontend",
    "checkout":    "checkoutservice",
    "cart":        "cartservice",
    "catalog":     "productcatalogservice",
    "payment":     "paymentservice",
    "shipping":    "shippingservice",
    "currency":    "currencyservice",
    "recommend":   "recommendationservice",
    "email":       "emailservice",
    "ads":         "adservice",
    "risk-anal.":  "risk-analysis",
}

# Short names that are OB application services (used for App CPU/Mem aggregate)
APP_SVCS = {
    "frontend", "checkout", "cart", "catalog", "payment",
    "shipping", "currency", "recommend", "email", "ads",
}

# Monitoring containers to exclude from aggregate totals
MONITORING_RE = re.compile(r"(cadvisor|prometheus|grafana|jaeger|docker.stats)")


def load_container_map(path: Path) -> dict[str, str]:
    """Returns {full_id: container_name} from container_map.tsv saved by collect-metrics.sh."""
    result = {}
    if not path.exists():
        return result
    for line in path.read_text().strip().splitlines():
        parts = line.split("\t")
        if len(parts) == 2:
            name, full_id = parts[0].strip(), parts[1].strip()
            result[full_id] = name
    return result


def resolve_name(metric: dict, container_map: dict[str, str]) -> str:
    """
    Returns a container name from a Prometheus metric dict.
    Handles both old-style (name label) and new-style (id cgroup path) labeling.
    """
    name = metric.get("name", "")
    if name:
        return name
    # cAdvisor raw factory: id = /system.slice/docker-<full_or_truncated_id>
    cgroup_id = metric.get("id", "")
    m = re.match(r".*/docker-([0-9a-f]+)(?:\.scope)?$", cgroup_id)
    if m and container_map:
        partial = m.group(1)
        for full_id, cname in container_map.items():
            if full_id.startswith(partial) or partial.startswith(full_id[:len(partial)]):
                return cname
    return ""


def parse_prom_result(path: Path, container_map: dict[str, str] | None = None) -> dict[str, float]:
    """Returns {container_name: value} from a Prometheus instant query result."""
    try:
        data = json.loads(path.read_text())
    except Exception:
        return {}
    if data.get("status") != "success":
        return {}
    out = {}
    for item in data["data"]["result"]:
        # docker-stats-exporter uses 'name' label directly
        # cAdvisor raw factory fallback uses cgroup 'id' label
        name = item["metric"].get("name", "")
        if not name:
            name = resolve_name(item["metric"], container_map or {})
        if not name or MONITORING_RE.search(name):
            continue
        try:
            out[name] = float(item["value"][1])
        except (KeyError, IndexError, ValueError):
            pass
    return out


def match_service(container_name: str) -> str | None:
    for short, fragment in SERVICES.items():
        if fragment in container_name:
            return short
    return None


def extract_variant_pattern(dirname: str):
    m = re.match(r"v(\d+)-(http|queue)", dirname)
    if m:
        return int(m.group(1)), m.group(2)
    return None, None


def main():
    results_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("results/experiments")
    if not results_dir.exists():
        print(f"ERROR: {results_dir} does not exist.", file=sys.stderr)
        sys.exit(1)

    rows = []
    for run_dir in sorted(results_dir.iterdir()):
        if not run_dir.is_dir():
            continue
        variant, pattern = extract_variant_pattern(run_dir.name)
        if variant is None:
            continue

        container_map = load_container_map(run_dir / "container_map.tsv")
        cpu_avg = parse_prom_result(run_dir / "cpu_avg.json", container_map)
        mem_rss = parse_prom_result(run_dir / "mem_rss.json", container_map)

        if not cpu_avg and not mem_rss:
            print(f"  WARN: no resource data in {run_dir.name}")
            continue

        svc_data = {}
        for container, cpu in cpu_avg.items():
            svc = match_service(container)
            if svc:
                svc_data.setdefault(svc, {})["cpu_avg"] = round(cpu, 2)
        for container, mem in mem_rss.items():
            svc = match_service(container)
            if svc:
                svc_data.setdefault(svc, {})["mem_mib"] = round(mem / 1024**2, 1)

        rows.append({
            "variant": variant,
            "label": VARIANT_NAMES.get(variant, f"v{variant}"),
            "pattern": pattern,
            "services": svc_data,
        })

    if not rows:
        print("No resource data found.")
        return

    # ── Per-variant summary: total CPU and key service memory ───────────────
    print(f"\n{'var':>3}  {'label':<12}  {'pat':<5}  "
          f"{'cpu_gw':>7}  {'cpu_ra':>7}  {'cpu_cart':>8}  "
          f"{'mem_gw':>8}  {'mem_cart':>9}  {'mem_ra':>8}")
    print("-" * 82)
    for r in sorted(rows, key=lambda x: (x["pattern"], x["variant"])):
        s = r["services"]
        gw  = s.get("gateway", {})
        ra  = s.get("risk-anal.", {})
        cart = s.get("cart", {})
        print(f"{r['variant']:>3}  {r['label']:<12}  {r['pattern']:<5}  "
              f"{gw.get('cpu_avg', 0):>7.2f}  "
              f"{ra.get('cpu_avg', 0):>7.2f}  "
              f"{cart.get('cpu_avg', 0):>8.2f}  "
              f"{gw.get('mem_mib', 0):>8.1f}  "
              f"{cart.get('mem_mib', 0):>9.1f}  "
              f"{ra.get('mem_mib', 0):>8.1f}")

    # ── Per-service detail for HTTP pattern ─────────────────────────────────
    print("\n\n=== CPU avg (% of one core) — HTTP pattern ===")
    http_rows = [r for r in rows if r["pattern"] == "http"]
    all_svcs = sorted({s for r in http_rows for s in r["services"]})
    header = f"{'var':<3}  {'label':<12}  " + "  ".join(f"{s:>10}" for s in all_svcs)
    print(header)
    print("-" * len(header))
    for r in sorted(http_rows, key=lambda x: x["variant"]):
        vals = "  ".join(
            f"{r['services'].get(s, {}).get('cpu_avg', 0):>10.2f}"
            for s in all_svcs
        )
        print(f"{r['variant']:<3}  {r['label']:<12}  {vals}")

    # ── Generate LaTeX table ────────────────────────────────────────────────
    tex_path = results_dir.parent / "analysis" / "tables" / "ob_resources.tex"
    write_latex_table(rows, tex_path)


def write_latex_table(rows: list, out_path: Path) -> None:
    """
    Writes a LaTeX tabular for OB resource usage (HTTP pattern only).
    Columns: Variant | GW CPU | RA CPU | App CPU | GW Mem | RA Mem | App Mem
    """
    # Use HTTP pattern rows only (matches SoY resources.tex convention)
    by_variant: dict[int, list] = {}
    for r in rows:
        if r["pattern"] == "http":
            by_variant.setdefault(r["variant"], []).append(r)

    lines = [
        r"\begin{tabular}{lrrrrrr}",
        r"\toprule",
        r"Variant & \multicolumn{3}{c}{CPU (\%)} & \multicolumn{3}{c}{Mem (MB)} \\",
        r"\cmidrule(lr){2-4}\cmidrule(lr){5-7}",
        r" & GW & RA & App & GW & RA & App \\",
        r"\midrule",
    ]

    for v in sorted(by_variant):
        variant_rows = by_variant[v]
        label = f"v{v}-{VARIANT_NAMES.get(v, str(v))}"

        def avg_svc(svc_key: str, field: str) -> float | None:
            vals = [r["services"].get(svc_key, {}).get(field) for r in variant_rows]
            vals = [x for x in vals if x is not None]
            return sum(vals) / len(vals) if vals else None

        def avg_app(field: str) -> float | None:
            """Sum across OB application services (excluding gateway and RA)."""
            pattern_sums = []
            for r in variant_rows:
                s = r["services"]
                total = sum(
                    s[svc].get(field, 0)
                    for svc in APP_SVCS
                    if svc in s
                )
                if total > 0:
                    pattern_sums.append(total)
            return sum(pattern_sums) / len(pattern_sums) if pattern_sums else None

        def fmt(val: float | None, decimals: int = 1) -> str:
            if val is None:
                return r"\textemdash"
            return f"{val:.{decimals}f}"

        gw_cpu = avg_svc("gateway", "cpu_avg")
        ra_cpu = avg_svc("risk-anal.", "cpu_avg")
        app_cpu = avg_app("cpu_avg")
        gw_mem = avg_svc("gateway", "mem_mib")
        ra_mem = avg_svc("risk-anal.", "mem_mib")
        app_mem = avg_app("mem_mib")

        lines.append(
            f"{label} & {fmt(gw_cpu)} & {fmt(ra_cpu)} & {fmt(app_cpu)} & "
            f"{fmt(gw_mem, 0)} & {fmt(ra_mem, 0)} & {fmt(app_mem, 0)} \\\\"
        )

    lines += [r"\bottomrule", r"\end{tabular}"]
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(lines) + "\n")
    print(f"\nLaTeX table written to {out_path}")


if __name__ == "__main__":
    main()
