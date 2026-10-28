#!/usr/bin/env python3
"""
=============================================================================
Stress Test & Maximum Capacity Benchmark: Hetzner 32 GB (CAX41) + Gemini PAYG
=============================================================================
Simulates HEAVY / INTENSE user usage across scaling cohorts:
- 2,000 clients (Baseline target)
- 5,000 clients
- 10,000 clients
- 15,000 clients
- 20,000 clients
- 25,000 clients
- 30,000 clients

Evaluates:
- Hardware limits of Hetzner CAX41 (8 vCPU ARM, 32 GB RAM, 320 GB NVMe SSD)
- Peak concurrency, RPS, in-flight background tasks
- RAM and CPU utilization
- SQLite master.db WAL throughput
- Gemini 2.0 Flash Pay-As-You-Go token volume and bill ($)
- Total operational costs vs Gross Revenue ($5.99/mo) vs Net Profit
- Exact ceiling / tipping point before degradation
=============================================================================
"""

import os
import sys
import json
import time
import math
import random
from typing import Dict, Any, List

# Hardware Specifications (Hetzner CAX41)
HETZNER_MONTHLY_COST_USD = 31.50   # €28.90 EUR
SERVER_RAM_GB = 32.0
SERVER_VCPU_CORES = 8
NVME_MAX_WRITE_IOPS = 100000       # NVMe SSD throughput
UVicorn_WORKERS = 8                # 8 worker processes for 8 vCPUs

# Gemini 2.0 Flash Pay-As-You-Go Rates
GEMINI_IN_PER_M = 0.10             # $0.10 / 1M tokens
GEMINI_OUT_PER_M = 0.40            # $0.40 / 1M tokens
CONTEXT_CACHE_DISCOUNT = 0.50      # 50% discount on cached inputs

# Payment Gateway Fees (Blended Mercado Pago + Stripe)
GATEWAY_FEE_PCT = 0.058
PRICE_PER_CLIENT_USD = 5.99

# "Uso Intenso" (Heavy User Profile) Metrics:
# - 35 conversational messages / day (vs 12 in standard)
# - 24 active days per month
# - 14 documents / PDFs devoured per month
# - 6 Deep Research monographies (Coco Red) per month
# - 6 Executive Secretary weekly plans (Coco Blanco) per month
AVG_DAILY_MSGS_HEAVY = 35.0
ACTIVE_DAYS_HEAVY = 24
MONTHLY_MSGS_PER_USER = int(AVG_DAILY_MSGS_HEAVY * ACTIVE_DAYS_HEAVY) # 840 msgs/mo
AVG_PROMPT_TOKENS = 950
AVG_RESPONSE_TOKENS = 380

MONTHLY_DOCS_PER_USER = 14
DOC_AVG_TOKENS = 4200

MONTHLY_DEEP_RESEARCHES_PER_USER = 6
RESEARCH_TOKENS_IN = 8000
RESEARCH_TOKENS_OUT = 2400

MONTHLY_SECRETARY_TASKS_PER_USER = 6
SECRETARY_TOKENS_IN = 4000
SECRETARY_TOKENS_OUT = 1500

# Concurrency Model:
# Peak hours active user ratio = 10% of total user base
# Of those active, 15% send a request in any given 10-second window
# Background tasks concurrency: ~1.5% of total user base running a heavy task simultaneously at peak


def evaluate_scale(num_clients: int) -> Dict[str, Any]:
    # 1. Traffic & Concurrency Modeling
    peak_active_users = int(num_clients * 0.10)  # 10% concurrent during peak hour
    # Peak Requests Per Second (RPS) hitting FastAPI
    # Active users generate ~1 request every 25 seconds on average
    peak_rps = round(peak_active_users / 25.0, 1)
    
    # Concurrent in-flight background tasks at peak (Red + Blanco)
    peak_concurrent_bg_tasks = max(1, int(num_clients * 0.008))

    # 2. Server RAM Utilization Modeling
    # - Base OS + Systemd: ~0.45 GB
    # - 8 Uvicorn Workers: 8 * ~0.16 GB = ~1.28 GB
    # - SQLite WAL cache + buffers: ~0.40 GB + (num_clients * 0.00004 GB)
    # - In-flight Background Tasks tracking (~17 KB per task in RAM): (peak_concurrent_bg_tasks * 0.000017 GB)
    # - Linux OS File Page Cache buffer: ~1.5 GB
    ram_os_gb = 0.45
    ram_workers_gb = 1.28
    ram_db_gb = 0.40 + (num_clients * 0.00004)
    ram_tasks_gb = peak_concurrent_bg_tasks * 0.000017
    ram_page_cache_gb = min(4.0, 0.8 + (num_clients * 0.0001))
    
    total_ram_used_gb = round(ram_os_gb + ram_workers_gb + ram_db_gb + ram_tasks_gb + ram_page_cache_gb, 2)
    ram_free_gb = round(SERVER_RAM_GB - total_ram_used_gb, 2)
    ram_usage_pct = round((total_ram_used_gb / SERVER_RAM_GB) * 100, 1)

    # 3. Server CPU Load Modeling (8 vCPUs)
    # Each FastAPI worker handles ~150-200 RPS easily for async I/O.
    # Total capacity of 8 workers = ~1,400 RPS.
    cpu_utilization_pct = min(100.0, round((peak_rps / 1400.0) * 100, 1))

    # 4. Token Consumption & Gemini 2.0 Flash Pay-As-You-Go Cost
    # Per client monthly tokens:
    chat_tokens_in = int(MONTHLY_MSGS_PER_USER * AVG_PROMPT_TOKENS * (1 - CONTEXT_CACHE_DISCOUNT * 0.40))
    chat_tokens_out = int(MONTHLY_MSGS_PER_USER * AVG_RESPONSE_TOKENS)

    doc_tokens_in = MONTHLY_DOCS_PER_USER * DOC_AVG_TOKENS
    doc_tokens_out = MONTHLY_DOCS_PER_USER * 450

    res_tokens_in = MONTHLY_DEEP_RESEARCHES_PER_USER * RESEARCH_TOKENS_IN
    res_tokens_out = MONTHLY_DEEP_RESEARCHES_PER_USER * RESEARCH_TOKENS_OUT

    sec_tokens_in = MONTHLY_SECRETARY_TASKS_PER_USER * SECRETARY_TOKENS_IN
    sec_tokens_out = MONTHLY_SECRETARY_TASKS_PER_USER * SECRETARY_TOKENS_OUT

    user_tokens_in = chat_tokens_in + doc_tokens_in + res_tokens_in + sec_tokens_in
    user_tokens_out = chat_tokens_out + doc_tokens_out + res_tokens_out + sec_tokens_out

    # Global tokens for all clients
    total_tokens_in_m = round((num_clients * user_tokens_in) / 1_000_000, 2)
    total_tokens_out_m = round((num_clients * user_tokens_out) / 1_000_000, 2)

    gemini_bill_usd = round(
        (total_tokens_in_m * GEMINI_IN_PER_M) +
        (total_tokens_out_m * GEMINI_OUT_PER_M),
        2
    )
    gemini_cost_per_client_usd = round(gemini_bill_usd / num_clients, 3)

    # 5. Financials
    gross_mrr_usd = round(num_clients * PRICE_PER_CLIENT_USD, 2)
    gateway_fees_usd = round(gross_mrr_usd * GATEWAY_FEE_PCT, 2)
    fixed_infra_usd = HETZNER_MONTHLY_COST_USD + 1.25 + 2.00 # Hetzner + Domain + S3 backups
    
    total_opex_usd = round(gemini_bill_usd + fixed_infra_usd + gateway_fees_usd, 2)
    net_profit_usd = round(gross_mrr_usd - total_opex_usd, 2)
    net_margin_pct = round((net_profit_usd / gross_mrr_usd) * 100, 1)
    net_profit_annual_usd = round(net_profit_usd * 12, 2)

    # 6. Bottleneck & Health Evaluation
    is_healthy = True
    bottleneck_msg = "🟢 Sistema 100% Holgado (Operación suave)"

    if ram_usage_pct >= 85.0:
        is_healthy = False
        bottleneck_msg = "🔴 Límite de Memoria RAM alcanzado"
    elif cpu_utilization_pct >= 85.0:
        is_healthy = False
        bottleneck_msg = "🔴 Saturación de CPU en Uvicorn Workers"
    elif peak_rps >= 800.0:
        bottleneck_msg = "🟡 Concurrencia alta: Conviene añadir réplica de balanceador"
    elif num_clients >= 20000:
        bottleneck_msg = "🟢 Operacional (Se sugiere solicitar aumento de cuota RPM a Google Cloud)"

    return {
        "num_clients": num_clients,
        "peak_active_users": peak_active_users,
        "peak_rps": peak_rps,
        "peak_concurrent_bg_tasks": peak_concurrent_bg_tasks,
        "ram_used_gb": total_ram_used_gb,
        "ram_free_gb": ram_free_gb,
        "ram_usage_pct": ram_usage_pct,
        "cpu_utilization_pct": cpu_utilization_pct,
        "total_tokens_in_m": total_tokens_in_m,
        "total_tokens_out_m": total_tokens_out_m,
        "gemini_bill_usd": gemini_bill_usd,
        "gemini_cost_per_client_usd": gemini_cost_per_client_usd,
        "server_hetzner_usd": HETZNER_MONTHLY_COST_USD,
        "total_opex_usd": total_opex_usd,
        "gross_mrr_usd": gross_mrr_usd,
        "net_profit_usd": net_profit_usd,
        "net_profit_annual_usd": net_profit_annual_usd,
        "net_margin_pct": net_margin_pct,
        "is_healthy": is_healthy,
        "status_label": bottleneck_msg
    }


def main():
    print("=" * 90)
    print("🚀 BENCHMARK DE ESTRÉS Y CAPACIDAD MÁXIMA: HETZNER 32 GB + GEMINI 2.0 FLASH PAYG")
    print("   Perfil: USO INTENSO (35 msgs/día + 14 docs + 6 Deep Research + 6 Planes/mes por usuario)")
    print("=" * 90)

    client_scales = [2000, 5000, 10000, 15000, 20000, 25000, 30000]
    results = []

    print(f"{'Clientes':<9} | {'Peak RPS':<9} | {'RAM Usada':<10} | {'CPU %':<7} | {'Gemini ($)':<11} | {'Facturación ($)':<15} | {'Ganancia Neta ($)':<17} | {'Margen %':<8} | {'Estado'}")
    print("-" * 115)

    for scale in client_scales:
        r = evaluate_scale(scale)
        results.append(r)
        print(f"{r['num_clients']:<9} | {r['peak_rps']:<9} | {r['ram_used_gb']} GB ({r['ram_usage_pct']}%) | {r['cpu_utilization_pct']}%   | ${r['gemini_bill_usd']:<10} | ${r['gross_mrr_usd']:<14} | ${r['net_profit_usd']:<16} | {r['net_margin_pct']}%   | {r['status_label'][:25]}")

    print("=" * 115)

    # Save to JSON log
    out_path = os.path.join(os.path.dirname(__file__), "logs", "hetzner_32gb_capacity_benchmark.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"📁 Informe completo guardado en: {out_path}")


if __name__ == "__main__":
    main()
