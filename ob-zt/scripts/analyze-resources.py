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
    "risk-anal.":  "risk-analysis",
}


def parse_prom_result(path: Path) -> dict[str, float]:
    """Returns {container_name: value} from a Prometheus instant query result."""
    try:
        data = json.loads(path.read_text())
    except Exception:
        return {}
    if data.get("status") != "success":
        return {}
    out = {}
    for item in data["data"]["result"]:
        name = item["metric"].get("name", "")
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

        cpu_avg = parse_prom_result(run_dir / "cpu_avg.json")
        mem_rss = parse_prom_result(run_dir / "mem_rss.json")

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


if __name__ == "__main__":
    main()
