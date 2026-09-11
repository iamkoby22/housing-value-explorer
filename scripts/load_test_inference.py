"""Run a modest local HTTP concurrency check against the production service."""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import socket
import subprocess
import sys
import threading
import time
import urllib.request
from pathlib import Path
from statistics import mean
from typing import Any

import psutil


ROOT = Path(__file__).resolve().parents[1]
PROFILE = {
    "zip_code": "37601",
    "bedrooms": 3,
    "other_rooms": 4,
    "lot_size": 1,
    "year_built": 1995,
    "structure_type": "2",
    "heating_fuel": "3",
    "household_income": 85000,
    "household_size": 3,
    "household_type": "1",
    "year_moved": 2018,
    "first_mortgage": 1800,
    "hoa_fee": 0,
    "electricity": 160,
    "gas": 80,
    "other_fuel": 0,
    "water_sewer": 900,
}


def available_port() -> int:
    with socket.socket() as server:
        server.bind(("127.0.0.1", 0))
        return int(server.getsockname()[1])


def request_json(url: str, payload: dict[str, Any] | None = None) -> tuple[float, int]:
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"} if body else {},
        method="POST" if body else "GET",
    )
    started = time.perf_counter()
    with urllib.request.urlopen(request, timeout=30) as response:
        content = response.read()
        if response.status != 200:
            raise RuntimeError(f"HTTP {response.status}: {content[:200]!r}")
    return time.perf_counter() - started, len(content)


def percentile(values: list[float], fraction: float) -> float:
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, round((len(ordered) - 1) * fraction))]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path)
    arguments = parser.parse_args()

    port = available_port()
    base_url = f"http://127.0.0.1:{port}"
    environment = os.environ.copy()
    environment.update(
        {
            "HOUSING_NUM_THREADS": "1",
            "OMP_NUM_THREADS": "1",
            "OPENBLAS_NUM_THREADS": "1",
            "MKL_NUM_THREADS": "1",
            "NUMEXPR_NUM_THREADS": "1",
        }
    )
    command = [
        sys.executable,
        "-m",
        "uvicorn",
        "inference.valuation_service:app",
        "--host",
        "127.0.0.1",
        "--port",
        str(port),
        "--workers",
        "1",
        "--no-access-log",
    ]
    started = time.perf_counter()
    server = subprocess.Popen(
        command,
        cwd=ROOT,
        env=environment,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    process = psutil.Process(server.pid)
    peak_rss = 0
    monitoring = True

    def monitor() -> None:
        nonlocal peak_rss
        while monitoring:
            try:
                peak_rss = max(peak_rss, process.memory_info().rss)
            except psutil.Error:
                return
            time.sleep(0.02)

    monitor_thread = threading.Thread(target=monitor, daemon=True)
    monitor_thread.start()
    try:
        deadline = time.monotonic() + 30
        while True:
            if server.poll() is not None:
                raise RuntimeError(f"Inference server exited with code {server.returncode}.")
            try:
                request_json(f"{base_url}/health")
                break
            except Exception:
                if time.monotonic() >= deadline:
                    raise RuntimeError("Inference server did not become ready in 30 seconds.")
                time.sleep(0.05)

        cold_start_seconds = time.perf_counter() - started
        request_json(f"{base_url}/predict", PROFILE)
        batches = []
        for concurrency in (1, 2, 5, 10):
            cpu_before = sum(process.cpu_times()[:2])
            wall_started = time.perf_counter()
            errors = []
            latencies = []
            with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as pool:
                futures = [
                    pool.submit(request_json, f"{base_url}/predict", PROFILE)
                    for _ in range(concurrency)
                ]
                for future in concurrent.futures.as_completed(futures):
                    try:
                        latency, _ = future.result()
                        latencies.append(latency)
                    except Exception as error:  # pragma: no cover - diagnostic path
                        errors.append(str(error))
            wall_seconds = time.perf_counter() - wall_started
            cpu_seconds = sum(process.cpu_times()[:2]) - cpu_before
            batches.append(
                {
                    "concurrency": concurrency,
                    "requests": concurrency,
                    "errors": len(errors),
                    "wall_seconds": wall_seconds,
                    "mean_latency_ms": mean(latencies) * 1000 if latencies else None,
                    "p95_latency_ms": percentile(latencies, 0.95) * 1000 if latencies else None,
                    "throughput_requests_per_second": concurrency / wall_seconds,
                    "single_core_cpu_utilization_pct": cpu_seconds / wall_seconds * 100,
                }
            )

        result = {
            "environment": "local development machine; not a Render timing guarantee",
            "workers": 1,
            "numerical_threads": 1,
            "cold_start_seconds": cold_start_seconds,
            "peak_rss_mib": peak_rss / 1024 / 1024,
            "batches": batches,
        }
        encoded = json.dumps(result, indent=2)
        print(encoded)
        if arguments.output:
            arguments.output.write_text(encoded + "\n", encoding="utf-8")
    finally:
        monitoring = False
        server.terminate()
        try:
            server.wait(timeout=10)
        except subprocess.TimeoutExpired:
            server.kill()
        monitor_thread.join(timeout=1)


if __name__ == "__main__":
    main()
