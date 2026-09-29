"""
OIL-TWIN AI - Real HTTP/API Latency Benchmark
Measures end-to-end API response times across the ASGI stack for what-if and twin endpoints.
Reports true p50, p95, p99 latencies.
"""
import asyncio
import os
import sys
import time

import numpy as np

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import httpx

from app.main import app


async def run_benchmark(n_runs: int = 100):
    print("=" * 70)
    print("OIL-TWIN AI - REAL HTTP/API BENCHMARK")
    print(f"Sampling {n_runs} requests per endpoint across full ASGI stack...")
    print("=" * 70)

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        # 1. Warm-up
        await client.get("/api/health")
        await client.get("/api/wells/BW-01/state")

        endpoints = [
            (
                "POST /api/wells/BW-01/css/forecast",
                "POST",
                "/api/wells/BW-01/css/forecast",
                {
                    "steamVolumeTonnes": 1500.0,
                    "injPressure": 120.0,
                    "soakDays": 5.0,
                    "productionCutoffWaterCut": 92.0,
                },
            ),
            (
                "POST /api/wells/BW-01/srp/analysis",
                "POST",
                "/api/wells/BW-01/srp/analysis",
                {
                    "strokeLength": 3.0,
                    "spm": 6.5,
                    "vfdHz": 50.0,
                },
            ),
            (
                "GET /api/wells/BW-01/joint",
                "GET",
                "/api/wells/BW-01/joint",
                None,
            ),
            (
                "GET /api/wells/BW-01/state",
                "GET",
                "/api/wells/BW-01/state",
                None,
            ),
            (
                "GET /api/field/summary",
                "GET",
                "/api/field/summary",
                None,
            ),
        ]

        results = {}

        for name, method, url, payload in endpoints:
            latencies = []
            for _ in range(n_runs):
                t0 = time.perf_counter()
                if method == "POST":
                    resp = await client.post(url, json=payload)
                else:
                    resp = await client.get(url)
                t1 = time.perf_counter()
                if resp.status_code != 200:
                    print(f"Error {resp.status_code} on {url}: {resp.text}")
                assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
                latencies.append((t1 - t0) * 1000.0)  # ms

            p50 = float(np.percentile(latencies, 50))
            p95 = float(np.percentile(latencies, 95))
            p99 = float(np.percentile(latencies, 99))
            avg = float(np.mean(latencies))
            results[name] = {"p50": p50, "p95": p95, "p99": p99, "avg": avg}

            print(f"\n{name}:")
            print(f"  Mean: {avg:.2f} ms | p50: {p50:.2f} ms | p95: {p95:.2f} ms | p99: {p99:.2f} ms")

    print("\n" + "=" * 70)
    print("SUMMARY (Measured HTTP/API latency)")
    print("=" * 70)
    for name, m in results.items():
        print(f"{name:38s} | p50: {m['p50']:6.2f} ms | p95: {m['p95']:6.2f} ms | p99: {m['p99']:6.2f} ms")
    print("=" * 70)
    return results


if __name__ == "__main__":
    asyncio.run(run_benchmark(100))
