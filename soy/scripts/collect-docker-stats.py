#!/usr/bin/env python3
"""
Poll Docker Engine API for CPU and memory stats of soy_* containers
and save Prometheus matrix JSON files compatible with analyze.py.

Usage:
  python3 collect-docker-stats.py <outdir> [--interval 5] [--duration 300]

Outputs:
  <outdir>/prom_cpu.json    — rate(container_cpu_usage[interval]) as % of 1 core
  <outdir>/prom_memory.json — RSS bytes per container

The output format matches what Prometheus + cAdvisor would produce so that
analyze.py reads it without modification.
"""
import argparse
import json
import socket
import sys
import time
from pathlib import Path


DOCKER_SOCK = "/var/run/docker.sock"
CONTAINER_PREFIX = "soy_"


def docker_get(path: str) -> bytes:
    sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    sock.settimeout(10)
    sock.connect(DOCKER_SOCK)
    req = f"GET {path} HTTP/1.0\r\nHost: localhost\r\n\r\n"
    sock.sendall(req.encode())
    buf = b""
    while True:
        chunk = sock.recv(65536)
        if not chunk:
            break
        buf += chunk
    sock.close()
    sep = buf.find(b"\r\n\r\n")
    return buf[sep + 4:] if sep != -1 else buf


def list_containers(prefix: str) -> list[dict]:
    raw = docker_get("/containers/json")
    containers = json.loads(raw)
    return [
        {"id": c["Id"], "name": c["Names"][0].lstrip("/")}
        for c in containers
        if any(n.lstrip("/").startswith(prefix) for n in c["Names"])
    ]


def container_stats(cid: str) -> dict:
    raw = docker_get(f"/containers/{cid}/stats?stream=false")
    return json.loads(raw)


def cpu_percent_from_stats(stats: dict) -> float:
    try:
        cpu_d = (stats["cpu_stats"]["cpu_usage"]["total_usage"]
                 - stats["precpu_stats"]["cpu_usage"]["total_usage"])
        sys_d = (stats["cpu_stats"]["system_cpu_usage"]
                 - stats["precpu_stats"]["system_cpu_usage"])
        if sys_d <= 0:
            return 0.0
        n_cpus = stats["cpu_stats"].get(
            "online_cpus",
            len(stats["cpu_stats"]["cpu_usage"].get("percpu_usage", [1]))
        )
        return (cpu_d / sys_d) * n_cpus * 100.0
    except (KeyError, ZeroDivisionError):
        return 0.0


def mem_rss_bytes(stats: dict) -> float:
    try:
        mem_stats = stats["memory_stats"]["stats"]
        # cgroup v1: "rss"; cgroup v2: use "anon" or fall back to usage - cache
        rss = mem_stats.get("rss") or mem_stats.get("anon", 0)
        if rss == 0:
            # fallback: usage minus cache
            usage = stats["memory_stats"].get("usage", 0)
            cache = mem_stats.get("cache", mem_stats.get("file", 0))
            rss = max(0, usage - cache)
        return float(rss)
    except (KeyError, TypeError):
        return 0.0


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("outdir", help="Directory to write prom_cpu.json and prom_memory.json")
    parser.add_argument("--interval", type=float, default=5.0,
                        help="Polling interval in seconds (default 5)")
    parser.add_argument("--duration", type=float, default=300.0,
                        help="Total collection duration in seconds (default 300)")
    parser.add_argument("--prefix", default=CONTAINER_PREFIX,
                        help=f"Container name prefix (default: {CONTAINER_PREFIX})")
    args = parser.parse_args()

    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    cpu_series: dict[str, list] = {}   # name -> list of [timestamp, value]
    mem_series: dict[str, list] = {}

    t_start = time.time()
    t_end = t_start + args.duration

    print(f"[docker-stats] Collecting for {args.duration:.0f}s, interval={args.interval}s",
          flush=True)

    sample_count = 0
    while time.time() < t_end:
        t0 = time.time()
        try:
            containers = list_containers(args.prefix)
        except Exception as e:
            print(f"[docker-stats] list_containers error: {e}", flush=True)
            time.sleep(args.interval)
            continue

        ts = int(time.time())
        for c in containers:
            name = c["name"]
            try:
                stats = container_stats(c["id"])
                cpu = cpu_percent_from_stats(stats)
                mem = mem_rss_bytes(stats)
                cpu_series.setdefault(name, []).append([ts, str(cpu)])
                mem_series.setdefault(name, []).append([ts, str(mem)])
            except Exception as e:
                print(f"[docker-stats] stats error for {name}: {e}", flush=True)

        sample_count += 1
        elapsed = time.time() - t0
        sleep_time = max(0, args.interval - elapsed)
        time.sleep(sleep_time)

    print(f"[docker-stats] Done. {sample_count} samples for {len(cpu_series)} containers.",
          flush=True)

    def to_prom_matrix(series: dict) -> dict:
        return {
            "status": "success",
            "data": {
                "resultType": "matrix",
                "result": [
                    {"metric": {"name": name}, "values": values}
                    for name, values in sorted(series.items())
                ]
            }
        }

    cpu_out = outdir / "prom_cpu.json"
    mem_out = outdir / "prom_memory.json"
    cpu_out.write_text(json.dumps(to_prom_matrix(cpu_series)))
    mem_out.write_text(json.dumps(to_prom_matrix(mem_series)))
    print(f"[docker-stats] Wrote {cpu_out}", flush=True)
    print(f"[docker-stats] Wrote {mem_out}", flush=True)


if __name__ == "__main__":
    main()
