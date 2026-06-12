#!/usr/bin/env python3
"""
Minimal Prometheus exporter for Docker container CPU and memory stats.
Uses only Python stdlib — calls the Docker Engine API via the Unix socket.
Exposes /metrics on port 9338 in Prometheus text format.
"""
import http.server
import json
import socket
import time
import threading

DOCKER_SOCK = "/var/run/docker.sock"
PORT = 9338
SCRAPE_INTERVAL = 15  # seconds — match Prometheus scrape_interval

_cache: list[tuple[str, str, float, float]] = []  # (name, id, cpu%, mem_bytes)
_cache_lock = threading.Lock()


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
    # Strip HTTP headers
    sep = buf.find(b"\r\n\r\n")
    return buf[sep + 4:] if sep != -1 else buf


def cpu_percent(stats: dict) -> float:
    try:
        cpu_d = (stats["cpu_stats"]["cpu_usage"]["total_usage"]
                 - stats["precpu_stats"]["cpu_usage"]["total_usage"])
        sys_d = (stats["cpu_stats"]["system_cpu_usage"]
                 - stats["precpu_stats"]["system_cpu_usage"])
        if sys_d <= 0:
            return 0.0
        n_cpus = stats["cpu_stats"].get("online_cpus",
                 len(stats["cpu_stats"]["cpu_usage"].get("percpu_usage", [1])))
        return (cpu_d / sys_d) * n_cpus * 100.0
    except (KeyError, ZeroDivisionError):
        return 0.0


def mem_rss(stats: dict) -> float:
    try:
        return float(stats["memory_stats"]["stats"].get(
            "rss", stats["memory_stats"].get("usage", 0)))
    except KeyError:
        return 0.0


def collect_once() -> list[tuple[str, str, float, float]]:
    containers_raw = docker_get("/containers/json")
    containers = json.loads(containers_raw)
    results = []
    for c in containers:
        cid = c["Id"]
        name = c["Names"][0].lstrip("/")
        try:
            stats_raw = docker_get(f"/containers/{cid}/stats?stream=false")
            stats = json.loads(stats_raw)
            results.append((name, cid[:12], cpu_percent(stats), mem_rss(stats)))
        except Exception:
            pass
    return results


def background_collect():
    global _cache
    while True:
        try:
            data = collect_once()
            with _cache_lock:
                _cache = data
        except Exception as e:
            print(f"collect error: {e}")
        time.sleep(SCRAPE_INTERVAL)


class MetricsHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/metrics":
            self.send_response(404)
            self.end_headers()
            return
        with _cache_lock:
            data = list(_cache)
        lines = [
            "# HELP docker_container_cpu_percent CPU usage percent (1 core = 100%)",
            "# TYPE docker_container_cpu_percent gauge",
        ]
        for name, cid, cpu, _ in data:
            lines.append(f'docker_container_cpu_percent{{name="{name}",id="{cid}"}} {cpu:.4f}')
        lines += [
            "# HELP docker_container_memory_rss_bytes RSS memory in bytes",
            "# TYPE docker_container_memory_rss_bytes gauge",
        ]
        for name, cid, _, mem in data:
            lines.append(f'docker_container_memory_rss_bytes{{name="{name}",id="{cid}"}} {mem:.0f}')
        body = "\n".join(lines) + "\n"
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; version=0.0.4")
        self.send_header("Content-Length", str(len(body.encode())))
        self.end_headers()
        self.wfile.write(body.encode())

    def log_message(self, *args):
        pass  # suppress access log noise


if __name__ == "__main__":
    print(f"Starting docker-stats-exporter on :{PORT}")
    t = threading.Thread(target=background_collect, daemon=True)
    t.start()
    # Give first collection a moment
    time.sleep(2)
    server = http.server.HTTPServer(("0.0.0.0", PORT), MetricsHandler)
    server.serve_forever()
