#!/usr/bin/env python3
"""
Parses Gatling simulation.log files from ob-zt experiment runs and produces
a summary CSV + console table comparable to the SoY paper results.

Usage:
    python3 scripts/analyze.py results/experiments/
"""

import os
import sys
import csv
import json
import re
from collections import defaultdict
from pathlib import Path
from statistics import median, quantiles, stdev

VARIANT_NAMES = {
    1: "baseline",
    2: "AC4A",
    3: "SR",
    4: "mTLS",
    5: "RA",
    6: "All-GW",
    7: "All+RA-MS",
}


def parse_gatling_log(log_path: Path) -> dict:
    """Parses a Gatling simulation.log and returns P50/P99/mean latency, error rate, and raw durations."""
    latencies = []
    total = ok = 0
    with open(log_path) as f:
        for line in f:
            parts = line.strip().split("\t")
            if len(parts) < 5:
                continue
            record_type = parts[0]
            if record_type != "REQUEST":
                continue
            total += 1
            # Gatling 3.x REQUEST format (tab-separated):
            # REQUEST \t <group> \t <name> \t <start_ms> \t <end_ms> \t OK|KO \t <message>
            status = parts[5] if len(parts) > 5 else ""
            if status == "OK":
                ok += 1
            try:
                start_ts = int(parts[3])
                end_ts   = int(parts[4])
                latencies.append(end_ts - start_ts)
            except (ValueError, IndexError):
                pass
    if not latencies:
        return {}
    qs = quantiles(latencies, n=100)
    return {
        "p50_ms":     round(median(latencies), 1),
        "p99_ms":     round(qs[98], 1),
        "mean_ms":    round(sum(latencies) / len(latencies), 1),
        "requests":   total,
        "error_pct":  round((total - ok) / max(total, 1) * 100, 2),
        "durations":  latencies,
    }


def find_simulation_log(run_dir: Path) -> Path | None:
    logs = list(run_dir.rglob("simulation.log"))
    if not logs:
        return None
    return max(logs, key=lambda p: p.stat().st_mtime)


def extract_variant_pattern(dirname: str):
    # Only match explicit run directories (v1-http-run2) to avoid stale single-run dirs
    m = re.match(r"v(\d+)-(http|queue)-run\d+$", dirname)
    if m:
        return int(m.group(1)), m.group(2)
    return None, None


def main():
    results_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("results/experiments")
    if not results_dir.exists():
        print(f"ERROR: {results_dir} does not exist.", file=sys.stderr)
        sys.exit(1)

    # Collect all runs, group by (variant, pattern), then average across runs
    groups: dict[tuple, list] = {}
    for run_dir in sorted(results_dir.iterdir()):
        if not run_dir.is_dir() or run_dir.is_symlink():
            continue
        variant, pattern = extract_variant_pattern(run_dir.name)
        if variant is None:
            continue
        sim_log = find_simulation_log(run_dir)
        if not sim_log:
            continue
        metrics = parse_gatling_log(sim_log)
        if not metrics:
            continue
        # Skip clearly failed runs (>10% error rate) — likely transient saturation
        if metrics.get("error_pct", 0) > 10.0:
            print(f"  SKIP {run_dir.name}: {metrics['error_pct']:.1f}% errors", file=sys.stderr)
            continue
        groups.setdefault((variant, pattern), []).append(metrics)

    rows = []
    for (variant, pattern), run_metrics in sorted(groups.items()):
        def med(field):
            vals = [m[field] for m in run_metrics if m.get(field) is not None]
            return round(median(vals), 1) if vals else 0.0
        rows.append({
            "variant":   variant,
            "label":     VARIANT_NAMES.get(variant, f"v{variant}"),
            "pattern":   pattern,
            "n_runs":    len(run_metrics),
            "p50_ms":    med("p50_ms"),
            "p99_ms":    med("p99_ms"),
            "mean_ms":   med("mean_ms"),
            "error_pct": med("error_pct"),
        })

    if not rows:
        print("No results found.")
        return

    # Print table
    header = f"{'var':>3}  {'label':<12}  {'pattern':<5}  {'runs':>4}  {'p50':>7}  {'p99':>7}  {'mean':>7}  {'err%':>6}"
    print(header)
    print("-" * len(header))
    for r in sorted(rows, key=lambda x: (x["pattern"], x["variant"])):
        print(f"{r['variant']:>3}  {r['label']:<12}  {r['pattern']:<5}  "
              f"{r.get('n_runs',1):>4}  "
              f"{r['p50_ms']:>7.1f}  {r['p99_ms']:>7.1f}  {r['mean_ms']:>7.1f}  "
              f"{r['error_pct']:>6.2f}")

    # Write CSV
    csv_path = results_dir / "summary.csv"
    fieldnames = ["variant", "label", "pattern", "p50_ms", "p99_ms", "mean_ms",
                  "requests", "error_pct"]
    with open(csv_path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        w.writerows(sorted(rows, key=lambda x: (x["pattern"], x["variant"])))
    print(f"\nSummary written to {csv_path}")

    # ── Boxplot ────────────────────────────────────────────────────────────────
    fig_dir = results_dir.parent / "analysis" / "figures"
    fig_dir.mkdir(parents=True, exist_ok=True)

    # Collect raw durations per variant (pool both patterns and all runs)
    raw_by_variant: dict[str, list] = defaultdict(list)
    for run_dir in sorted(results_dir.iterdir()):
        if not run_dir.is_dir() or run_dir.is_symlink():
            continue
        variant, pattern = extract_variant_pattern(run_dir.name)
        if variant is None:
            continue
        sim_log = find_simulation_log(run_dir)
        if not sim_log:
            continue
        metrics = parse_gatling_log(sim_log)
        if not metrics or metrics.get("error_pct", 0) > 10.0:
            continue
        label = f"v{variant}-{VARIANT_NAMES.get(variant, str(variant))}"
        raw_by_variant[label].extend(metrics.get("durations", []))

    if raw_by_variant:
        try:
            import matplotlib
            matplotlib.use("Agg")
            import matplotlib.pyplot as plt

            ZT_COLORS = {
                "v1-baseline":  "#74c476",
                "v2-AC4A":      "#fd8d3c",
                "v3-SR":        "#6baed6",
                "v4-mTLS":      "#9e9ac8",
                "v5-RA":        "#f768a1",
                "v6-All-GW":    "#d62728",
                "v7-All+RA-MS": "#8c564b",
            }

            labels = sorted(raw_by_variant.keys(),
                            key=lambda x: int(x.split("-")[0][1:]))
            data = [raw_by_variant[l] for l in labels]

            fig, ax = plt.subplots(figsize=(max(10, len(labels) * 1.8), 6))
            bp_kwargs = dict(patch_artist=True, notch=False, showfliers=False,
                             medianprops=dict(color='black', linewidth=2))
            ver = tuple(int(x) for x in matplotlib.__version__.split('.')[:2])
            if ver >= (3, 9):
                bp_kwargs['tick_labels'] = labels
            else:
                bp_kwargs['labels'] = labels
            bp = ax.boxplot(data, **bp_kwargs)
            for patch, lbl in zip(bp['boxes'], labels):
                patch.set_facecolor(ZT_COLORS.get(lbl, '#aaaaaa'))
                patch.set_alpha(0.7)
            for i, (lbl, d) in enumerate(zip(labels, data)):
                ax.text(i + 1, ax.get_ylim()[0], f'n={len(d)}',
                        ha='center', va='bottom', fontsize=8, color='#555555')

            ax.set_xlabel('ZT Variant', fontsize=11)
            ax.set_ylabel('Request Duration (ms)', fontsize=11)
            ax.set_title('OB Latency Distribution by ZT Variant (HTTP + Queue pooled)',
                         fontsize=12)
            ax.tick_params(axis='x', rotation=45, labelsize=10)
            plt.tight_layout()
            out_fig = fig_dir / "ob_latency_boxplot.pdf"
            fig.savefig(out_fig, dpi=150, bbox_inches='tight')
            plt.close(fig)
            print(f"  ✓ {out_fig.name}")
        except ImportError:
            print("  ⚠  matplotlib not available — skipping boxplot")


if __name__ == "__main__":
    main()
