#!/usr/bin/env python3
"""
analyze.py – Aggregate experiment results and produce paper-ready output.

Reads:
  results/experiments/v{N}_{pattern}/
    metadata.json            – variant/pattern/ZT flags/time window
    gatling/simulation.log   – raw Gatling request log
    prom_cpu.json            – Prometheus CPU time series
    prom_memory.json         – Prometheus memory time series
    jaeger_gateway_auth.json – Jaeger spans for zt.gateway.auth
    jaeger_risk_analysis.json
    jaeger_mtls_handshake.json
    jaeger_ac4a_other.json
    jaeger_vault_load_gw.json
    ...

Writes:
  results/analysis/
    tables/latency.tex            – P50/P99 per variant × pattern
    tables/zt_spans.tex           – ZT primitive span breakdown
    tables/resources.tex          – CPU / memory overhead
    figures/latency_boxplot.pdf   – latency box plots by ZT combination
    figures/span_breakdown.pdf    – stacked bar chart (biz logic vs ZT overhead)
    figures/pattern_comparison.pdf – latency by comm pattern
    summary.csv                   – all metrics in one flat file for further analysis

Usage:
  python3 scripts/analyze.py [--indir DIR] [--outdir DIR]
"""

import argparse
import json
import math
import os
import re
import sys
from pathlib import Path

# ── Optional imports – warn if missing rather than crash ─────────
try:
    import pandas as pd
    import numpy as np
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import matplotlib.ticker as mtick
    PLOTTING = True
except ImportError:
    PLOTTING = False
    print("⚠  pandas/numpy/matplotlib not installed — tables only, no figures.")
    print("   pip install pandas numpy matplotlib")

# ─────────────────────────────────────────────────────────────────
# PARSING HELPERS
# ─────────────────────────────────────────────────────────────────

def parse_simulation_log(log_path: 'Path') -> 'pd.DataFrame':
    """Parse Gatling simulation.log into a DataFrame of requests."""
    rows = []
    with open(log_path) as f:
        for line in f:
            parts = line.rstrip('\n').split('\t')
            if parts[0] != 'REQUEST':
                continue
            # FORMAT: REQUEST \t <group> \t <name> \t <start_ms> \t <end_ms> \t <status> \t <msg>
            try:
                name     = parts[2]
                start_ms = int(parts[3])
                end_ms   = int(parts[4])
                status   = parts[5]
                duration = end_ms - start_ms
                rows.append({'name': name, 'start_ms': start_ms,
                             'end_ms': end_ms, 'duration_ms': duration,
                             'ok': status == 'OK'})
            except (IndexError, ValueError):
                continue
    return pd.DataFrame(rows) if rows else pd.DataFrame(
        columns=['name', 'start_ms', 'end_ms', 'duration_ms', 'ok'])


def percentile(series, p):
    """p-th percentile of a pandas Series."""
    if len(series) == 0:
        return float('nan')
    return float(np.percentile(series, p))


def parse_jaeger(json_path: 'Path', operation: str = None) -> list:
    """Return list of span durations in milliseconds from a Jaeger traces JSON.

    If operation is given, only spans whose operationName matches are counted.
    Jaeger returns full traces (many spans each); without filtering the numbers
    are meaningless (mix of middleware, DB, HTTP child spans, etc.).
    The caller should always pass the target operation name.
    """
    if not json_path.exists():
        return []
    try:
        with open(json_path) as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError):
        return []
    durations = []
    for trace in data.get('data', []):
        for span in trace.get('spans', []):
            if operation and span.get('operationName') != operation:
                continue
            durations.append(span['duration'] / 1000.0)  # µs → ms
    return durations


def parse_jaeger_service_decomposition(json_path: 'Path') -> list:
    """Parse full distributed traces, returning per-trace service breakdowns.

    Each returned dict has:
      gw_total_ms    – root gateway span duration (full e2e at gateway)
      gw_zt_ms       – sum of zt.* spans at the gateway
      ms_total_ms    – root microservice span duration (service processing time)
      ms_zt_ms       – sum of zt.* spans at the microservice
      ms_service     – service name of the microservice (soy-ms-other / soy-ms-exercise)
    """
    if not json_path.exists():
        return []
    try:
        with open(json_path) as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError):
        return []

    ZT_OPS = {'zt.gateway.auth', 'zt.risk_analysis', 'zt.mtls.handshake',
              'zt.ac4a.verify', 'zt.vault.load'}
    results = []
    for trace in data.get('data', []):
        procs = trace.get('processes', {})
        spans = trace.get('spans', [])
        if not spans:
            continue

        span_ids = {s['spanID'] for s in spans}

        def svc(span):
            return procs.get(span.get('processID', ''), {}).get('serviceName', '')

        def has_parent_in_trace(span):
            return any(
                r.get('refType') == 'CHILD_OF' and r['spanID'] in span_ids
                for r in span.get('references', [])
            )

        # Single trace root = the one span with no parent in this trace
        gw_root = next(
            (s for s in spans if not has_parent_in_trace(s)), None
        )
        if gw_root is None or svc(gw_root) != 'soy-gateway':
            continue

        # Microservice root = longest-duration span from a non-gateway service
        ms_spans = [s for s in spans
                    if svc(s) not in ('soy-gateway', 'soy-risk-analysis', '')]
        if not ms_spans:
            continue
        ms_root = max(ms_spans, key=lambda s: s['duration'])
        ms_name = svc(ms_root)

        # ZT overhead per tier: sum all zt.* span durations
        gw_zt = sum(s['duration'] for s in spans
                    if svc(s) == 'soy-gateway' and s['operationName'] in ZT_OPS)
        ms_zt = sum(s['duration'] for s in spans
                    if svc(s) == ms_name and s['operationName'] in ZT_OPS)

        results.append({
            'gw_total_ms': gw_root['duration'] / 1000.0,
            'gw_zt_ms':    gw_zt / 1000.0,
            'ms_total_ms': ms_root['duration'] / 1000.0,
            'ms_zt_ms':    ms_zt / 1000.0,
            'ms_service':  ms_name,
        })
    return results


def parse_prometheus(json_path: 'Path', container_filter=None) -> dict:
    """
    Return dict: container_name → list of float values (one per step).
    container_filter: regex applied to the 'name' label.
    """
    if not json_path.exists():
        return {}
    try:
        with open(json_path) as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError):
        return {}
    result = {}
    for series in data.get('data', {}).get('result', []):
        cname = series.get('metric', {}).get('name', 'unknown')
        if container_filter and not re.match(container_filter, cname):
            continue
        values = [float(v[1]) for v in series.get('values', []) if v[1] != 'NaN']
        if values:
            result[cname] = values
    return result


def parse_prom_scalar(json_path):
    """Return a single float from a Prometheus instant query result."""
    if not json_path.exists():
        return None
    try:
        data = json.loads(json_path.read_text())
    except Exception:
        return None
    if data.get('status') != 'success':
        return None
    try:
        results = data['data']['result']
        if results:
            return float(results[0]['value'][1])
    except (KeyError, IndexError, ValueError):
        return None
    return None


def parse_histogram_buckets(json_path) -> list:
    """Return list of (upper_bound, cumulative_count) from a histogram_bucket instant result."""
    if not json_path.exists():
        return []
    try:
        data = json.loads(json_path.read_text())
    except Exception:
        return []
    if data.get('status') != 'success':
        return []
    buckets = []
    for item in data['data']['result']:
        le = item['metric'].get('le', '')
        if le == '+Inf':
            continue
        try:
            buckets.append((float(le), float(item['value'][1])))
        except (ValueError, KeyError, IndexError):
            pass
    return sorted(buckets, key=lambda x: x[0])


def _histogram_stats(total_s, total_n, buckets):
    """Shared math for E[S], Var[S], C²s from a Prometheus histogram."""
    if total_n is None or total_n < 1 or total_s is None:
        return None
    mean_s = total_s / total_n
    e_s2 = 0.0
    prev_count = 0.0
    prev_bound = 0.0
    for upper, cum_count in buckets:
        freq = max(cum_count - prev_count, 0.0)
        midpoint = (prev_bound + upper) / 2.0
        e_s2 += freq * midpoint ** 2
        prev_count = cum_count
        prev_bound = upper
    tail_freq = max(total_n - prev_count, 0.0)
    e_s2 += tail_freq * prev_bound ** 2
    e_s2 /= total_n
    var_s = max(e_s2 - mean_s ** 2, 0.0)
    c2s = var_s / (mean_s ** 2) if mean_s > 0 else 0.0
    return {'mean_s': mean_s, 'var_s': var_s, 'c2s': c2s, 'count': total_n}


def compute_ra_stats(run_dir):
    """E[S] and C²_s from the RA service's own internal timer (zt_ra_duration_seconds)."""
    return _histogram_stats(
        parse_prom_scalar(run_dir / 'ra_duration_sum.json'),
        parse_prom_scalar(run_dir / 'ra_duration_count.json'),
        parse_histogram_buckets(run_dir / 'ra_duration_buckets.json'),
    )


def compute_ra_gw_stats(run_dir):
    """E[S] and C²_s from the gateway's RA round-trip timer (zt_ra_call_duration_seconds).

    Populated only when ra_gw_duration_*.json files exist (sweeps with fixed
    instrumentation).  Returns None for older runs.
    """
    return _histogram_stats(
        parse_prom_scalar(run_dir / 'ra_gw_duration_sum.json'),
        parse_prom_scalar(run_dir / 'ra_gw_duration_count.json'),
        parse_histogram_buckets(run_dir / 'ra_gw_duration_buckets.json'),
    )


def mean_or_nan(lst):
    return float(np.mean(lst)) if lst else float('nan')


# ─────────────────────────────────────────────────────────────────
# LOAD ALL RUNS
# ─────────────────────────────────────────────────────────────────

def load_run(run_dir: Path) -> 'dict | None':
    meta_path = run_dir / 'metadata.json'
    if not meta_path.exists():
        return None
    with open(meta_path) as f:
        meta = json.load(f)

    # ── Gatling ──────────────────────────────────────────────
    sim_log = next(run_dir.glob('gatling/**/simulation.log'), None)
    gatling_df = parse_simulation_log(sim_log) if sim_log else pd.DataFrame()

    def req_stats(df, names):
        """Full percentile profile + throughput/failure_rate for a set of request names."""
        sub = df[df['name'].isin(names)] if len(df) else pd.DataFrame()
        ok  = sub[sub['ok']] if len(sub) else pd.DataFrame()
        n   = len(sub)
        t_span = (sub['end_ms'].max() - sub['start_ms'].min()) / 1000.0 if n > 0 else 1
        dur = ok['duration_ms'] if len(ok) else pd.Series([], dtype=float)
        return {
            'p50':   percentile(dur, 50),
            'p75':   percentile(dur, 75),
            'p90':   percentile(dur, 90),
            'p95':   percentile(dur, 95),
            'p99':   percentile(dur, 99),
            'p999':  percentile(dur, 99.9),
            'mean':  float(dur.mean()) if len(dur) else float('nan'),
            'throughput':   len(ok) / t_span if t_span > 0 else 0.0,
            'failure_rate': (n - len(ok)) / n * 100 if n > 0 else 0.0,
            'count': n,
            'durations': dur.tolist(),  # raw values for box plots
        }

    # S1: classroom begin (read path) — login/logout excluded so that
    # percentiles reflect only the ZT-sensitive business operations.
    S1_NAMES = {'S1_getSession', 'S1_getSessionExercises',
                'S1_getExercise', 'S1_getStudentStatement'}
    # S2: exercise submit (write path)
    S2_NAMES = {'S2_checkSession', 'S2_listProductions',
                'S2_submitProduction', 'S2_getResult'}

    s1 = req_stats(gatling_df, S1_NAMES)
    s2 = req_stats(gatling_df, S2_NAMES)

    # ── Jaeger spans ──────────────────────────────────────────
    def span_stats(filename, operation):
        d = parse_jaeger(run_dir / filename, operation=operation)
        return {'p50': percentile(d, 50), 'p75': percentile(d, 75),
                'p95': percentile(d, 95), 'p99': percentile(d, 99),
                'mean': mean_or_nan(d), 'count': len(d)}

    spans = {
        'gateway_auth':   span_stats('jaeger_gateway_auth.json',    'zt.gateway.auth'),
        'risk_analysis':  span_stats('jaeger_risk_analysis.json',   'zt.risk_analysis'),
        'mtls_handshake': span_stats('jaeger_mtls_handshake.json',  'zt.mtls.handshake'),
        'ac4a_verify':    span_stats('jaeger_ac4a_other.json',      'zt.ac4a.verify'),
        'vault_load':     span_stats('jaeger_vault_load_gw.json',   'zt.vault.load'),
        # MS-level RA spans (ZT_RA_MS=true) — same operation name, different service in Jaeger
        'ra_ms_other':    span_stats('jaeger_ra_ms_other.json',     'zt.risk_analysis'),
        'ra_ms_exercise': span_stats('jaeger_ra_ms_exercise.json',  'zt.risk_analysis'),
    }

    # ── Prometheus resources ──────────────────────────────────
    def prom_mean(json_path, container):
        series = parse_prometheus(run_dir / json_path, f'^{re.escape(container)}$')
        vals = series.get(container, [])
        return mean_or_nan(vals)

    resources = {
        'gateway_cpu':    prom_mean('prom_cpu.json',    'soy_gateway'),
        'exercise_cpu':   prom_mean('prom_cpu.json',    'soy_ms_exercise'),
        'other_cpu':      prom_mean('prom_cpu.json',    'soy_ms_other'),
        'ra_cpu':         prom_mean('prom_cpu.json',    'soy_risk_analysis'),
        'gateway_mem_mb': prom_mean('prom_memory.json', 'soy_gateway')   / 1e6,
        'exercise_mem_mb':prom_mean('prom_memory.json', 'soy_ms_exercise')/ 1e6,
        'other_mem_mb':   prom_mean('prom_memory.json', 'soy_ms_other')  / 1e6,
    }

    # Per-service decomposition from full distributed traces
    # S1 path (read): traces go gateway → ms-other
    # S2 path (write): traces go gateway → ms-exercise
    svc_decomp_s1 = parse_jaeger_service_decomposition(run_dir / 'jaeger_ac4a_other.json')
    svc_decomp_s2 = parse_jaeger_service_decomposition(run_dir / 'jaeger_ac4a_exercise.json')

    def decomp_stats(records):
        if not records:
            return {'gw_total': float('nan'), 'gw_zt': float('nan'),
                    'ms_total': float('nan'), 'ms_zt': float('nan'),
                    'gw_zt_pct': float('nan'), 'ms_zt_pct': float('nan'), 'n': 0}
        gw_total = mean_or_nan([r['gw_total_ms'] for r in records])
        gw_zt    = mean_or_nan([r['gw_zt_ms']    for r in records])
        ms_total = mean_or_nan([r['ms_total_ms'] for r in records])
        ms_zt    = mean_or_nan([r['ms_zt_ms']    for r in records])
        total_zt = gw_zt + ms_zt
        return {
            'gw_total': gw_total, 'gw_zt': gw_zt,
            'ms_total': ms_total, 'ms_zt': ms_zt,
            'gw_zt_pct': gw_zt / total_zt * 100 if total_zt > 0 else float('nan'),
            'ms_zt_pct': ms_zt / total_zt * 100 if total_zt > 0 else float('nan'),
            'n': len(records),
        }

    decomp = {'s1': decomp_stats(svc_decomp_s1), 's2': decomp_stats(svc_decomp_s2)}

    # ── RA service-time statistics (E[S], C²_s from Prometheus histogram) ──
    ra_stats    = compute_ra_stats(run_dir)
    ra_gw_stats = compute_ra_gw_stats(run_dir)  # gateway round-trip; None for old runs

    return {**meta, 's1': s1, 's2': s2, 'spans': spans, 'resources': resources,
            'decomp': decomp, 'ra_stats': ra_stats, 'ra_gw_stats': ra_gw_stats,
            '_run_label': run_dir.name}


# ─────────────────────────────────────────────────────────────────
# MULTI-RUN AGGREGATION
# ─────────────────────────────────────────────────────────────────

def _median(vals):
    import statistics
    clean = [v for v in vals if v is not None and not (isinstance(v, float) and math.isnan(v))]
    return statistics.median(clean) if clean else float('nan')

def _mean_or_nan(vals):
    clean = [v for v in vals if v is not None and not (isinstance(v, float) and math.isnan(v))]
    return sum(clean) / len(clean) if clean else float('nan')

def aggregate_runs_by_key(runs: list) -> list:
    """
    Group runs by (variant, pattern, target_rps).
    When a group has >1 run, median-aggregate latency stats and
    mean-aggregate spans/resources; concatenate raw durations for box plots.
    Single-run groups are returned unchanged.
    """
    from collections import defaultdict
    groups: dict = defaultdict(list)
    for r in runs:
        key = (r.get('variant', ''), r.get('pattern', ''), r.get('target_rps', 5.0))
        groups[key].append(r)

    aggregated = []
    for key, group in sorted(groups.items(), key=lambda x: (int(x[0][0] or 0), x[0][1], x[0][2])):
        if len(group) == 1:
            group[0]['_n_runs'] = 1
            aggregated.append(group[0])
            continue

        base = {k: v for k, v in group[0].items()}
        base['_n_runs'] = len(group)
        base['_run_label'] = group[0]['_run_label'].rsplit('_run', 1)[0]  # strip _runN suffix

        stat_fields = ('p50', 'p75', 'p90', 'p95', 'p99', 'p999', 'mean',
                       'throughput', 'failure_rate')
        for scenario in ('s1', 's2'):
            agg = dict(base[scenario])
            for f in stat_fields:
                vals = [r[scenario].get(f) for r in group]
                agg[f] = _median(vals)
            agg['count'] = sum(r[scenario].get('count', 0) for r in group)
            # Concatenate raw durations so box plots show all data points
            agg['durations'] = [d for r in group for d in r[scenario].get('durations', [])]
            base[scenario] = agg

        # Spans: mean across runs
        if all('spans' in r for r in group):
            all_span_keys = set(k for r in group for k in r['spans'])
            merged_spans = {}
            for sk in all_span_keys:
                span_vals = [r['spans'].get(sk, {}) for r in group]
                merged_spans[sk] = {
                    'p50':   _mean_or_nan([s.get('p50')   for s in span_vals]),
                    'p75':   _mean_or_nan([s.get('p75')   for s in span_vals]),
                    'p95':   _mean_or_nan([s.get('p95')   for s in span_vals]),
                    'p99':   _mean_or_nan([s.get('p99')   for s in span_vals]),
                    'mean':  _mean_or_nan([s.get('mean')  for s in span_vals]),
                    'count': sum(s.get('count', 0)        for s in span_vals),
                }
            base['spans'] = merged_spans

        # Resources: mean across runs (flat {key: float} structure)
        if all('resources' in r for r in group):
            all_keys = set(k for r in group for k in r['resources'])
            merged_res = {}
            for k in all_keys:
                vals = [r['resources'].get(k, float('nan')) for r in group]
                merged_res[k] = _mean_or_nan(vals)
            base['resources'] = merged_res

        aggregated.append(base)

    return aggregated


# ─────────────────────────────────────────────────────────────────
# TABLE FORMATTERS
# ─────────────────────────────────────────────────────────────────

def fmt(v, decimals=1):
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return r'\textemdash'
    return f'{v:.{decimals}f}'


def write_latency_table(runs: list, out_path: Path):
    """LaTeX table: variant × pattern × RPS → S1 and S2 full percentile profile."""
    # Detect whether multiple load levels are present
    rps_values = sorted({r.get('target_rps', 5.0) for r in runs})
    multi_rps = len(rps_values) > 1

    col_spec = r'lllrrrrrrrrrrr' if multi_rps else r'llrrrrrrrrrrr'
    rps_col  = r' RPS &' if multi_rps else ''
    lines = [
        rf'\begin{{tabular}}{{{col_spec}}}',
        r'\toprule',
        rf'Variant & Pattern &{rps_col}'
        r' \multicolumn{5}{c}{S1 – Classroom Begin (read)} &'
        r' \multicolumn{5}{c}{S2 – Exercise Submit (write)} & Fail\% \\',
        rf'\cmidrule(lr){{{"4-8" if multi_rps else "3-7"}}}'
        rf'\cmidrule(lr){{{"9-13" if multi_rps else "8-12"}}}',
        rf' & &{rps_col} P50 & P75 & P90 & P95 & P99 & P50 & P75 & P90 & P95 & P99 & \\',
        r'\midrule',
    ]
    prev_key = None
    sort_key = (lambda x: (int(x['variant']), x['pattern'], x.get('target_rps', 5.0)))
    for r in sorted(runs, key=sort_key):
        vname = r.get('variant_name', '')
        key = (vname, r['pattern']) if multi_rps else vname
        variant_label = vname.replace('_', r'\_') if key != prev_key else ''
        prev_key = key
        s1, s2 = r['s1'], r['s2']
        rps_cell = f" {r.get('target_rps', 5.0):.0f} &" if multi_rps else ''
        line = (f"{variant_label} & {r['pattern']} &{rps_cell}"
                f" {fmt(s1['p50'])} & {fmt(s1['p75'])} & {fmt(s1['p90'])} &"
                f" {fmt(s1['p95'])} & {fmt(s1['p99'])} &"
                f" {fmt(s2['p50'])} & {fmt(s2['p75'])} & {fmt(s2['p90'])} &"
                f" {fmt(s2['p95'])} & {fmt(s2['p99'])} &"
                f" {fmt(r['s1']['failure_rate'])} \\\\")
        lines.append(line)
    lines += [r'\bottomrule', r'\end{tabular}']
    out_path.write_text('\n'.join(lines))
    print(f"  ✓ {out_path.name}")


def write_kappa_table(runs: list, out_path: Path):
    """LaTeX table: κ = ΔPxx / ΔP50 for RA variants, HTTP.
    Each variant is compared against the v1 baseline at the SAME RPS level.
    When multiple RPS levels exist a RPS column is added to show load-amplification.
    An extra column shows the span-based κ_RA = P99/P50 of the isolated RA call
    (from the zt.risk_analysis Jaeger span), free of DB latency contamination.
    """
    http_runs = [r for r in runs if r['pattern'] == 'http']
    rps_values = sorted({r.get('target_rps', 5.0) for r in http_runs})
    multi_rps  = len(rps_values) > 1

    # baseline per RPS level
    baselines = {}
    for rps in rps_values:
        b = next((r for r in http_runs
                  if r['variant'] == '1' and r.get('target_rps', 5.0) == rps), None)
        if b:
            baselines[rps] = b

    def kappa(delta_pxx, delta_p50):
        if math.isnan(delta_p50) or delta_p50 < 1.0:
            return r'\textemdash'
        return fmt(delta_pxx / delta_p50, 2)

    def kappa_ra_span(r):
        """κ_RA from the isolated zt.risk_analysis span (P99/P50)."""
        ra = r.get('spans', {}).get('risk_analysis', {})
        p50 = ra.get('p50', float('nan'))
        p99 = ra.get('p99', float('nan'))
        if math.isnan(p50) or p50 < 0.01 or ra.get('count', 0) < 10:
            return r'\textemdash'
        return fmt(p99 / p50, 2)

    col_spec  = r'\begin{tabular}{llrrrrrrrrrrr}' if multi_rps else r'\begin{tabular}{lrrrrrrrrrrr}'
    rps_hdr   = r' RPS &' if multi_rps else ''
    cmidr_s1  = r'\cmidrule(lr){3-7}' if multi_rps else r'\cmidrule(lr){2-6}'
    cmidr_s2  = r'\cmidrule(lr){8-12}' if multi_rps else r'\cmidrule(lr){7-11}'

    lines = [
        col_spec,
        r'\toprule',
        rf'Variant &{rps_hdr}'
        r' \multicolumn{5}{c}{S1 – $\kappa_{\text{S1}}$ at percentile} &'
        r' \multicolumn{5}{c}{S2 – $\kappa_{\text{S2}}$ at percentile} &'
        r' $\kappa_{\text{RA}}$ \\',
        f'{cmidr_s1}{cmidr_s2}',
        rf' &{rps_hdr} P75 & P90 & P95 & P99 & P99.9 & P75 & P90 & P95 & P99 & P99.9 & (span) \\',
        r'\midrule',
    ]

    # One row per (variant, rps) — include gateway RA (zt_ra) and MS-level RA (zt_ra_ms)
    ra_rows = sorted(
        [(r, r.get('target_rps', 5.0)) for r in http_runs
         if r.get('zt_ra') == 'true' or r.get('zt_ra_ms') == 'true'],
        key=lambda x: (int(x[0]['variant']), x[1])
    )
    prev_vname = None
    for r, rps in ra_rows:
        if rps not in baselines:
            continue
        b = baselines[rps]
        s1, s2, b1, b2 = r['s1'], r['s2'], b['s1'], b['s2']
        dp50_s1 = s1['p50'] - b1['p50']
        dp50_s2 = s2['p50'] - b2['p50']
        vname = r['variant_name'].replace('_', r'\_')
        name_cell = vname if vname != prev_vname else ''
        prev_vname = vname
        rps_cell = f' {rps:.0f} &' if multi_rps else ''
        line = (f"{name_cell} &{rps_cell}"
                f" {kappa(s1['p75']  - b1['p75'],  dp50_s1)} &"
                f" {kappa(s1['p90']  - b1['p90'],  dp50_s1)} &"
                f" {kappa(s1['p95']  - b1['p95'],  dp50_s1)} &"
                f" {kappa(s1['p99']  - b1['p99'],  dp50_s1)} &"
                f" {kappa(s1['p999'] - b1['p999'], dp50_s1)} &"
                f" {kappa(s2['p75']  - b2['p75'],  dp50_s2)} &"
                f" {kappa(s2['p90']  - b2['p90'],  dp50_s2)} &"
                f" {kappa(s2['p95']  - b2['p95'],  dp50_s2)} &"
                f" {kappa(s2['p99']  - b2['p99'],  dp50_s2)} &"
                f" {kappa(s2['p999'] - b2['p999'], dp50_s2)} &"
                f" {kappa_ra_span(r)} \\\\")
        lines.append(line)
    lines += [r'\bottomrule', r'\end{tabular}']
    out_path.write_text('\n'.join(lines))
    print(f"  ✓ {out_path.name}")


def write_span_table(runs: list, out_path: Path):
    """LaTeX table: per variant, mean duration (ms) of each ZT span."""
    lines = [
        r'\begin{tabular}{llrrrrr}',
        r'\toprule',
        r'Variant & Pattern & Auth\textsubscript{GW} & RA call & mTLS & AC4A verify & Vault load \\',
        r' & & (ms) & (ms) & (ms) & (ms) & (ms) \\',
        r'\midrule',
    ]
    prev_variant = None
    for r in sorted(runs, key=lambda x: (int(x['variant']), x['pattern'])):
        s = r['spans']
        variant_label = r['variant_name'].replace('_', r'\_') if r.get('variant_name') != prev_variant else ''
        prev_variant = r.get('variant_name')
        line = (f"{variant_label} & {r['pattern']} &"
                f" {fmt(s['gateway_auth']['mean'], 2)} &"
                f" {fmt(s['risk_analysis']['mean'], 2)} &"
                f" {fmt(s['mtls_handshake']['mean'], 2)} &"
                f" {fmt(s['ac4a_verify']['mean'], 2)} &"
                f" {fmt(s['vault_load']['mean'], 2)} \\\\")
        lines.append(line)
    lines += [r'\bottomrule', r'\end{tabular}']
    out_path.write_text('\n'.join(lines))
    print(f"  ✓ {out_path.name}")


def write_resource_table(runs: list, out_path: Path):
    """LaTeX table: mean CPU % and memory MB per container per variant (HTTP pattern only)."""
    http_runs = [r for r in runs if r['pattern'] == 'http']
    lines = [
        r'\begin{tabular}{lrrrrrr}',
        r'\toprule',
        r'Variant & \multicolumn{3}{c}{CPU (\%)} & \multicolumn{3}{c}{Mem (MB)} \\',
        r'\cmidrule(lr){2-4}\cmidrule(lr){5-7}',
        r' & GW & Other & Exer. & GW & Other & Exer. \\',
        r'\midrule',
    ]
    for r in sorted(http_runs, key=lambda x: int(x['variant'])):
        res = r['resources']
        line = (f"{r['variant_name'].replace('_', r'\_')} &"
                f" {fmt(res['gateway_cpu'])} &"
                f" {fmt(res['other_cpu'])} &"
                f" {fmt(res['exercise_cpu'])} &"
                f" {fmt(res['gateway_mem_mb'], 0)} &"
                f" {fmt(res['other_mem_mb'], 0)} &"
                f" {fmt(res['exercise_mem_mb'], 0)} \\\\")
        lines.append(line)
    lines += [r'\bottomrule', r'\end{tabular}']
    out_path.write_text('\n'.join(lines))
    print(f"  ✓ {out_path.name}")


def write_service_decomposition_table(runs: list, out_path: Path):
    """LaTeX table: where in the architecture is the ZT tax paid?
    Shows mean ZT span overhead at the gateway vs. each microservice,
    for the HTTP pattern, variants where AC4A is active (microservice ZT visible).
    Rows: variant. Columns: GW ZT (ms), GW ZT (%), ms-other ZT (ms), ms ZT (%).
    """
    # Use HTTP runs that have AC4A enabled (so microservice ZT spans are non-zero)
    # For variants without AC4A, ms_zt ≈ 0 — still show them for completeness
    http_runs = [r for r in runs
                 if r['pattern'] == 'http' and r.get('target_rps', 5.0) == 5.0]
    if not http_runs:
        return

    lines = [
        r'\begin{tabular}{lrrrrrrrr}',
        r'\toprule',
        r'Variant'
        r' & \multicolumn{4}{c}{S1 – read path (gateway $\to$ ms-other)}'
        r' & \multicolumn{4}{c}{S2 – write path (gateway $\to$ ms-exercise)} \\',
        r'\cmidrule(lr){2-5}\cmidrule(lr){6-9}',
        r' & GW ZT & GW\% & MS ZT & MS\% & GW ZT & GW\% & MS ZT & MS\% \\',
        r' & (ms) & & (ms) & & (ms) & & (ms) & \\',
        r'\midrule',
    ]
    for r in sorted(http_runs, key=lambda x: int(x['variant'])):
        d1 = r['decomp']['s1']
        d2 = r['decomp']['s2']
        name = r['variant_name'].replace('_', r'\_')
        line = (f"{name} &"
                f" {fmt(d1['gw_zt'], 2)} & {fmt(d1['gw_zt_pct'], 0)} &"
                f" {fmt(d1['ms_zt'], 2)} & {fmt(d1['ms_zt_pct'], 0)} &"
                f" {fmt(d2['gw_zt'], 2)} & {fmt(d2['gw_zt_pct'], 0)} &"
                f" {fmt(d2['ms_zt'], 2)} & {fmt(d2['ms_zt_pct'], 0)} \\\\")
        lines.append(line)
    lines += [r'\bottomrule', r'\end{tabular}']
    out_path.write_text('\n'.join(lines))
    print(f"  ✓ {out_path.name}")


def fig_service_decomposition(runs: list, out_path: Path):
    """Stacked 100% bar chart: % of total ZT overhead at gateway vs microservice,
    for each variant (HTTP, 5 RPS). Shows where in the architecture the tax is paid."""
    http_runs = sorted(
        [r for r in runs if r['pattern'] == 'http' and r.get('target_rps', 5.0) == 5.0],
        key=lambda x: int(x['variant'])
    )
    # Only variants where we have decomposition data
    valid = [r for r in http_runs if not math.isnan(r['decomp']['s1']['gw_zt_pct'])]
    if not valid:
        print(f"  ⚠  No decomposition data — skipping {out_path.name}")
        return

    labels   = [r['variant_name'].replace('v', 'V').replace('-', '\n') for r in valid]
    gw_pcts  = [r['decomp']['s1']['gw_zt_pct']  for r in valid]
    ms_pcts  = [r['decomp']['s1']['ms_zt_pct']  for r in valid]

    fig, ax = plt.subplots(figsize=(max(10, len(valid) * 0.85), 5))
    x = range(len(valid))
    ax.bar(x, gw_pcts, label='Gateway ZT overhead', color='#fd8d3c', alpha=0.85)
    ax.bar(x, ms_pcts, bottom=gw_pcts, label='Microservice ZT overhead',
           color='#74c476', alpha=0.85)

    ax.set_xticks(list(x))
    ax.set_xticklabels(labels, rotation=45, ha='right')
    ax.set_ylabel('Share of total ZT overhead (%)')
    ax.set_ylim(0, 110)
    ax.set_title('ZT Overhead Distribution Across Architecture — S1 Read Path (HTTP, 5 RPS)')
    ax.legend(loc='upper right')
    ax.axhline(100, color='black', linewidth=0.5, linestyle='--')
    plt.tight_layout()
    fig.savefig(out_path, dpi=150)
    plt.close(fig)
    print(f"  ✓ {out_path.name}")


def write_failure_table(runs: list, out_path: Path):
    """LaTeX table: failure rate (%) by variant × pattern × RPS — key for high-load analysis."""
    rps_values = sorted({r.get('target_rps', 5.0) for r in runs})
    patterns   = sorted({r['pattern'] for r in runs})
    # Index: (variant, pattern, rps) → failure_rate
    idx = {(r['variant'], r['pattern'], r.get('target_rps', 5.0)):
           max(r['s1']['failure_rate'], r['s2']['failure_rate'])
           for r in runs}

    col_spec = 'l' + 'r' * (len(patterns) * len(rps_values))
    header_rps   = ' & '.join(
        f'\\multicolumn{{{len(rps_values)}}}{{c}}{{{p.upper()}}}' for p in patterns)
    header_sub   = ' & '.join(
        f'{rps:.0f}~RPS' for _ in patterns for rps in rps_values)
    cmidrules = ''.join(
        rf'\cmidrule(lr){{{2 + i*len(rps_values)}-{1 + (i+1)*len(rps_values)}}}'
        for i in range(len(patterns)))

    lines = [
        rf'\begin{{tabular}}{{{col_spec}}}',
        r'\toprule',
        rf'Variant & {header_rps} \\',
        cmidrules,
        rf' & {header_sub} \\',
        r'\midrule',
    ]

    variants = sorted({r['variant'] for r in runs}, key=int)
    for var in variants:
        vname = next((r['variant_name'] for r in runs if r['variant'] == var), var)
        cells = []
        for pat in patterns:
            for rps in rps_values:
                v = idx.get((var, pat, rps))
                cells.append(fmt(v, 1) if v is not None else r'\textemdash')
        lines.append(f"{vname.replace('_', r'_')} & {' & '.join(cells)} \\\\")
    lines += [r'\bottomrule', r'\end{tabular}']
    out_path.write_text('\n'.join(lines))
    print(f"  ✓ {out_path.name}")


def write_summary_csv(runs: list, out_path: Path):
    """Flat CSV with all metrics — convenient for R or further Python analysis."""
    rows = []
    for r in runs:
        base = {
            'variant':      r['variant'],
            'variant_name': r.get('variant_name', ''),
            'pattern':      r['pattern'],
            'target_rps':   r.get('target_rps', 5.0),
            'zt_ac4a':        r.get('zt_ac4a', 'false'),
            'zt_sr':          r.get('zt_sr', 'false'),
            'zt_mtls':        r.get('zt_mtls', 'false'),
            'zt_ra':          r.get('zt_ra', 'false'),
            'zt_ra_ms':       r.get('zt_ra_ms', 'false'),
            'zt_broker_mtls': r.get('zt_broker_mtls', 'false'),
        }
        for scenario, sdata in [('s1', r['s1']), ('s2', r['s2'])]:
            for k, v in sdata.items():
                if k == 'durations':
                    continue  # raw arrays belong in box plots, not the flat CSV
                base[f'{scenario}_{k}'] = v
        for span_name, sdata in r['spans'].items():
            for k, v in sdata.items():
                base[f'span_{span_name}_{k}'] = v
        for k, v in r['resources'].items():
            base[f'res_{k}'] = v
        rows.append(base)
    df = pd.DataFrame(rows)
    df.to_csv(out_path, index=False)
    print(f"  ✓ {out_path.name}")


# ─────────────────────────────────────────────────────────────────
# FIGURES
# ─────────────────────────────────────────────────────────────────

ZT_COLORS = {
    'baseline':        '#6baed6',
    'AC4A':            '#fd8d3c',
    'SR':              '#74c476',
    'MTLS':            '#9e9ac8',
    'RA':              '#f768a1',
    'AC4A+SR+MTLS+RA': '#d62728',
}

def variant_label(r: dict) -> str:
    flags = [f for f, k in [
        ('AC4A','zt_ac4a'), ('SR','zt_sr'), ('MTLS','zt_mtls'),
        ('RA','zt_ra'), ('RA-MS','zt_ra_ms'), ('BRK-TLS','zt_broker_mtls'),
    ] if r.get(k) == 'true']
    return '+'.join(flags) if flags else 'baseline'


def _draw_boxplot(ax, groups: dict, labels: list, title: str, ylabel: str):
    """Helper: draw a single boxplot panel onto ax."""
    import matplotlib
    data = [groups[l] for l in labels]
    bp_kwargs = dict(patch_artist=True, notch=False, showfliers=False,
                     medianprops=dict(color='black', linewidth=2))
    if tuple(int(x) for x in matplotlib.__version__.split('.')[:2]) >= (3, 9):
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
    ax.set_ylabel(ylabel, fontsize=11)
    ax.set_title(title, fontsize=11)
    ax.tick_params(axis='x', rotation=45, labelsize=10)


def fig_latency_boxplot(runs: list, out_path: 'Path'):
    """
    Two-panel box plot: S1 (Classroom Begin) on top, S2 (Exercise Submit) below.
    Each panel pools raw request duration samples across ALL comm patterns.
    """
    from collections import defaultdict

    g_s1, g_s2 = defaultdict(list), defaultdict(list)
    for r in runs:
        lbl = variant_label(r)
        g_s1[lbl].extend(r['s1'].get('durations', []))
        g_s2[lbl].extend(r['s2'].get('durations', []))

    if not g_s1:
        print(f"  ⚠  No duration data for box plot — skipping {out_path.name}")
        return

    labels = sorted(g_s1.keys(), key=lambda x: (len(x), x))
    w = max(11, len(labels) * 1.8)
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(w, 10), sharex=True)

    _draw_boxplot(ax1, g_s1, labels,
                  'S1 – Classroom Begin (read)',
                  'Request Duration (ms)')
    _draw_boxplot(ax2, g_s2, labels,
                  'S2 – Exercise Submit (write)',
                  'Request Duration (ms)')

    ax2.set_xlabel('ZT Primitive Combination', fontsize=11)
    fig.suptitle('SoY Latency Distribution by ZT Combination (all patterns pooled)',
                 fontsize=12, y=1.01)
    plt.tight_layout()
    fig.savefig(out_path, dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f"  ✓ {out_path.name}")


def fig_span_breakdown(runs: list, out_path: Path):
    """
    Stacked bar chart: for each ZT variant (HTTP), show mean span durations
    (zt.gateway.auth, zt.risk_analysis, zt.mtls.handshake, zt.ac4a.verify)
    stacked to visualise how much of the total ZT overhead each primitive contributes.
    """
    http_runs = sorted([r for r in runs if r['pattern'] == 'http'],
                       key=lambda x: int(x['variant']))
    if not http_runs:
        return

    labels = [r['variant_name'].replace('v', 'V').replace('-', '\n') for r in http_runs]
    span_keys = [
        ('gateway_auth',   'Auth@GW (AC4A)',    '#fd8d3c'),
        ('risk_analysis',  'RA call',            '#f768a1'),
        ('mtls_handshake', 'TLS handshake',      '#9e9ac8'),
        ('ac4a_verify',    'Auth@MS (AC4A)',     '#fdae6b'),
    ]

    fig, ax = plt.subplots(figsize=(max(10, len(http_runs) * 0.8), 6))
    bottom = [0.0] * len(http_runs)

    for key, label, color in span_keys:
        vals = [r['spans'][key]['mean'] if not math.isnan(r['spans'][key]['mean']) else 0.0
                for r in http_runs]
        ax.bar(labels, vals, bottom=bottom, label=label, color=color, alpha=0.85)
        bottom = [b + v for b, v in zip(bottom, vals)]

    ax.set_xlabel('ZT Variant')
    ax.set_ylabel('Mean span duration (ms)')
    ax.set_title('ZT Primitive Overhead Breakdown by Variant (HTTP pattern)')
    ax.legend(loc='upper left', fontsize=9)
    ax.tick_params(axis='x', rotation=45)
    plt.tight_layout()
    fig.savefig(out_path, dpi=150)
    plt.close(fig)
    print(f"  ✓ {out_path.name}")


def fig_pattern_comparison(runs: list, out_path: Path):
    """Grouped bar chart: P99 S1 latency for each communication pattern, one group per pattern."""
    patterns = ['http', 'queue']
    # v1 = baseline, v6 = full gateway ZT (AC4A+SR+mTLS+RA)
    variants_of_interest = ['1', '6']
    colors = {'1': '#6baed6', '6': '#d62728'}
    labels_map = {'1': 'v1-baseline', '6': 'v6-all-gw'}

    x = range(len(patterns))
    width = 0.35
    fig, ax = plt.subplots(figsize=(7, 5))

    for i, vnum in enumerate(variants_of_interest):
        vals = []
        for pat in patterns:
            match = [r for r in runs if r['variant'] == vnum and r['pattern'] == pat]
            vals.append(match[0]['s1']['p99'] if match and not math.isnan(match[0]['s1']['p99']) else 0.0)
        offset = (i - 0.5) * width
        ax.bar([xi + offset for xi in x], vals, width,
               label=labels_map[vnum], color=colors[vnum], alpha=0.8)

    ax.set_xticks(list(x))
    ax.set_xticklabels(['HTTP', 'Queue (AMQP)'])
    ax.set_ylabel('P99 Latency S1 (ms)')
    ax.set_title('P99 S1 Latency by Transport — Baseline vs Full Gateway ZT (30 RPS)')
    ax.legend()
    plt.tight_layout()
    fig.savefig(out_path, dpi=150)
    plt.close(fig)
    print(f"  ✓ {out_path.name}")


# ─────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Analyze SoY experiment results')
    parser.add_argument('--indir',  default='results/experiments',
                        help='Directory containing per-run result directories')
    parser.add_argument('--outdir', default='results/analysis',
                        help='Output directory for tables and figures')
    args = parser.parse_args()

    indir  = Path(args.indir)
    outdir = Path(args.outdir)

    if not indir.exists():
        print(f"✗  Input directory not found: {indir}")
        sys.exit(1)

    (outdir / 'tables').mkdir(parents=True, exist_ok=True)
    (outdir / 'figures').mkdir(parents=True, exist_ok=True)

    # ── Load all runs ──────────────────────────────────────────
    print(f"\nLoading runs from {indir} ...")
    # Only load directories with explicit _runN suffix when such dirs exist,
    # to avoid mixing old single-run dirs with new multi-run dirs.
    all_dirs = [d for d in sorted(indir.iterdir()) if d.is_dir()]
    has_run_suffix = any(re.search(r'_run\d+$', d.name) for d in all_dirs)
    runs = []
    for run_dir in all_dirs:
        if has_run_suffix and not re.search(r'_run\d+$', run_dir.name):
            print(f"  skip    {run_dir.name}  (no _runN suffix — superseded by multi-run dirs)")
            continue
        r = load_run(run_dir)
        if r is None:
            continue
        runs.append(r)
        print(f"  loaded  {run_dir.name}  "
              f"S1-P99={fmt(r['s1']['p99'])}ms  S2-P99={fmt(r['s2']['p99'])}ms")

    if not runs:
        print("✗  No valid runs found.")
        sys.exit(1)

    # Exclude known-contaminated runs (soy_front build running during test)
    EXCLUDED = set()
    before = len(runs)
    runs = [r for r in runs if r.get('_run_label', '') not in EXCLUDED]
    if len(runs) < before:
        print(f"  ⚠  Excluded {before - len(runs)} contaminated run(s): {EXCLUDED}")

    # Aggregate multiple runs for the same (variant, pattern, rps) — median latency
    runs = aggregate_runs_by_key(runs)
    n_groups = len(runs)
    n_multi  = sum(1 for r in runs if r.get('_n_runs', 1) > 1)
    if n_multi:
        print(f"  Aggregated into {n_groups} variant×pattern groups "
              f"({n_multi} with >1 run, median latency)")

    print(f"\nGenerating tables ({len(runs)} variant×pattern combinations) ...")
    write_latency_table(runs,  outdir / 'tables' / 'latency.tex')
    write_kappa_table(runs,    outdir / 'tables' / 'kappa.tex')
    write_failure_table(runs,  outdir / 'tables' / 'failure_rates.tex')
    write_span_table(runs,     outdir / 'tables' / 'zt_spans.tex')
    write_resource_table(runs, outdir / 'tables' / 'resources.tex')
    write_service_decomposition_table(runs, outdir / 'tables' / 'service_decomp.tex')
    write_summary_csv(runs,    outdir / 'summary.csv')

    if PLOTTING:
        print("\nGenerating figures ...")
        fig_latency_boxplot(      runs, outdir / 'figures' / 'latency_boxplot.pdf')
        fig_span_breakdown(       runs, outdir / 'figures' / 'span_breakdown.pdf')
        fig_pattern_comparison(   runs, outdir / 'figures' / 'pattern_comparison.pdf')
        fig_service_decomposition(runs, outdir / 'figures' / 'service_decomp.pdf')

        # Sync figures to paper/figures/ so LaTeX can find them without manual copies
        import shutil
        paper_figs = Path(__file__).parent.parent / 'paper' / 'figures'
        if paper_figs.exists():
            for pdf in (outdir / 'figures').glob('*.pdf'):
                shutil.copy2(pdf, paper_figs / pdf.name)
            print(f"  ✓ synced figures → {paper_figs}")
    else:
        print("\nSkipping figures (matplotlib not available).")

    print(f"\n✓  Analysis complete → {outdir}/")
    print("   Include tables in LaTeX with, e.g.:")
    print(f"     \\input{{{outdir}/tables/latency.tex}}")


if __name__ == '__main__':
    main()
