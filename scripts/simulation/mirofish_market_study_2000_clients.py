#!/usr/bin/env python3
"""
=============================================================================
MiroFish Market Study & Financial Feasibility Simulation: 2,000 Clients
=============================================================================
Simulates the adoption, token consumption, operational costs, unit economics,
customer sentiment, and friction points for Coco Squad scaling to 2,000 clients.

Infrastructure under analysis:
- LLM Provider: Google Gemini API (Pay-as-you-go: 2.0 Flash / Flash-Lite / 2.5 Flash)
- Server: Oracle Cloud Infrastructure (OCI) Ampere A1 (4 OCPU, 24 GB RAM, Always Free)
- Target: 2,000 paying / active clients at accessible, low-cost price points.
=============================================================================
"""

import os
import sys
import json
import time
import math
import random
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional

# Constants
SIMULATION_YEAR = 2026
EXCHANGE_RATE_USD_ARS = 1200.0  # Reference exchange rate ARS/USD

# Gemini API Pay-As-You-Go Pricing (per 1,000,000 tokens)
GEMINI_FLASH_INPUT_PER_M = 0.10     # $0.10 USD per 1M input tokens
GEMINI_FLASH_OUTPUT_PER_M = 0.40    # $0.40 USD per 1M output tokens
GEMINI_PRO_INPUT_PER_M = 1.25       # $1.25 USD per 1M input tokens (for heavy research if used)
GEMINI_PRO_OUTPUT_PER_M = 5.00      # $5.00 USD per 1M output tokens
CONTEXT_CACHING_DISCOUNT = 0.50     # 50% discount on cached system instructions & docs

# Infrastructure Costs
ORACLE_24GB_ALWAYS_FREE_COST = 0.0  # $0.00 / month on OCI Always Free tier
ORACLE_PAID_BACKUP_COST = 0.0       # Optional redundant reserve
DOMAIN_AND_DNS_MONTHLY = 1.25       # $15 / year
BACKUP_STORAGE_MONTHLY = 2.00       # 50 GB R2/S3 object storage for sqlite backups
PAYMENT_GATEWAY_FEE_PCT_MP = 0.065  # 6.5% Mercado Pago average blended fee
PAYMENT_GATEWAY_FEE_PCT_STRIPE = 0.029 # 2.9% + $0.30 Stripe fee


@dataclass
class SyntheticCustomerCohort:
    id: str
    name: str
    proportion: float               # Percentage of 2,000 users
    target_count: int
    persona_archetype: str
    daily_messages_mean: float      # Mean conversational messages / active day
    active_days_per_month: int      # Days active per month
    avg_prompt_tokens: int          # Tokens per prompt (context + query)
    avg_response_tokens: int        # Tokens per response
    monthly_docs_uploaded: float    # Documents devoured (PDF/Image)
    avg_doc_tokens: int             # Tokens extracted per doc
    monthly_deep_researches: float  # Coco Red deep research jobs / mo
    monthly_secretary_tasks: float  # Coco Blanco weekly plans / mo
    price_sensitivity: int          # 1 to 10 (10 = highest sensitivity)
    churn_rate_monthly: float       # Simulated monthly churn rate
    top_feature_value: str
    primary_friction: str


@dataclass
class CustomerAgent:
    id: int
    cohort_id: str
    name: str
    monthly_chat_tokens_in: int
    monthly_chat_tokens_out: int
    monthly_doc_tokens_in: int
    monthly_doc_tokens_out: int
    monthly_research_tokens_in: int
    monthly_research_tokens_out: int
    monthly_secretary_tokens_in: int
    monthly_secretary_tokens_out: int
    total_tokens_in: int
    total_tokens_out: int
    total_gemini_cost_usd: float
    nps_score: int
    csat_score: float
    feedback_quote: str
    friction_point: str


class MiroFishMarketSimulator:
    def __init__(self, total_clients: int = 2000):
        self.total_clients = total_clients
        random.seed(42)  # Deterministic reproducibility

        self.cohort_specs: List[SyntheticCustomerCohort] = [
            SyntheticCustomerCohort(
                id="salud",
                name="Salud & Bienestar (Clínicas, Psicólogos, Nutricionistas)",
                proportion=0.25,
                target_count=int(total_clients * 0.25),
                persona_archetype="Médicos, terapeutas, kinesiólogos con consultorio particular",
                daily_messages_mean=14.0,
                active_days_per_month=22,
                avg_prompt_tokens=900,
                avg_response_tokens=380,
                monthly_docs_uploaded=8.5,
                avg_doc_tokens=3200,
                monthly_deep_researches=1.2,
                monthly_secretary_tasks=4.0,
                price_sensitivity=5,
                churn_rate_monthly=0.038,
                top_feature_value="Bóveda Local Zero-Storage (Privacidad Médica de Datos)",
                primary_friction="Desean sincronización segura entre el consultorio (PC) y el celular sin romper la privacidad local"
            ),
            SyntheticCustomerCohort(
                id="retail_gastronomia",
                name="Comercios, Retail & Gastronomía (PyMEs de Venta Directa)",
                proportion=0.30,
                target_count=int(total_clients * 0.30),
                persona_archetype="Dueños de locales de ropa, rotiserías, delivery y tiendas online",
                daily_messages_mean=18.5,
                active_days_per_month=26,
                avg_prompt_tokens=750,
                avg_response_tokens=280,
                monthly_docs_uploaded=4.0,
                avg_doc_tokens=2100,
                monthly_deep_researches=0.5,
                monthly_secretary_tasks=4.5,
                price_sensitivity=7,
                churn_rate_monthly=0.052,
                top_feature_value="Atención Nocturna Omnicanal (Coco Blu) y Pagos Rápidos",
                primary_friction="Necesidad de facturación automática (Factura A / CUIT) en Mercado Pago y catálogo visual"
            ),
            SyntheticCustomerCohort(
                id="academia_investigacion",
                name="Academia, Posgrados & Universitarios",
                proportion=0.20,
                target_count=int(total_clients * 0.20),
                persona_archetype="Estudiantes universitarios avanzados, tesistas, docentes e investigadores",
                daily_messages_mean=11.0,
                active_days_per_month=20,
                avg_prompt_tokens=1400,
                avg_response_tokens=650,
                monthly_docs_uploaded=12.0,
                avg_doc_tokens=6800,
                monthly_deep_researches=6.5,
                monthly_secretary_tasks=2.0,
                price_sensitivity=9,
                churn_rate_monthly=0.065,
                top_feature_value="Lectura Multi-PDF y Monografías de Coco Red con arXiv/Crossref",
                primary_friction="Sensibilidad extrema al precio en dólares: exigen cobro en moneda local accesible"
            ),
            SyntheticCustomerCohort(
                id="servicios_profesionales",
                name="Servicios Profesionales, Contadores & Consultores B2B",
                proportion=0.25,
                target_count=int(total_clients * 0.25),
                persona_archetype="Contadores, abogados, asesores financieros, directores de pequeñas agencias",
                daily_messages_mean=16.0,
                active_days_per_month=24,
                avg_prompt_tokens=1100,
                avg_response_tokens=420,
                monthly_docs_uploaded=7.0,
                avg_doc_tokens=4500,
                monthly_deep_researches=2.8,
                monthly_secretary_tasks=8.0,
                price_sensitivity=4,
                churn_rate_monthly=0.032,
                top_feature_value="Coco Blanco como Secretario Ejecutivo y Planificación Semanal en 2º Plano",
                primary_friction="Quieren exportación a Excel/Calendar y enlace directo con WhatsApp de clientes"
            ),
        ]

    def run_simulation(self) -> Dict[str, Any]:
        """Runs the agent-based simulation for all 2,000 synthetic customers."""
        agents: List[CustomerAgent] = []
        customer_id_counter = 1

        quote_templates = {
            "salud": [
                ("La bóveda local donde las recetas no suben a la nube me dio la tranquilidad legal que necesitaba.", 10),
                ("Uso a Coco Verde para revisar comprobantes y a Blanco para la agenda. Excelente relación costo/beneficio.", 9),
                ("Muy buena app, pero si limpio las cookies del navegador pierdo las notas si no hice backup.", 8),
                ("Falta que se sincronice automáticamente con la secretaria en recepción sin subir datos a un servidor central.", 7),
            ],
            "retail_gastronomia": [
                ("Me salvó los pedidos de las 11 de la noche cuando ya cerré el local. Se paga solo el primer día.", 10),
                ("La velocidad de respuesta es impresionante. Coco Blu responde como si fuera yo.", 9),
                ("A un precio bajo como este lo mantengo fijo todo el año sin dudarlo.", 9),
                ("Necesito poder emitir factura electrónica automática por Mercado Pago para compras grandes.", 8),
                ("A veces los clientes mandan audios de 3 minutos de WhatsApp y quiero que los transcriba al toque.", 7),
            ],
            "academia_investigacion": [
                ("Coco Red haciendo la monografía con citas de arXiv y descargable en PDF es oro puro para mi tesis.", 10),
                ("Poder meterle 3 PDFs pesados y que me arme el cuadro comparativo en memoria me ahorra horas.", 10),
                ("El precio es ideal para un estudiante o becario. Si costara $20 USD como ChatGPT no lo pagaría.", 9),
                ("Quiero que el visor de PDFs tenga resaltador directo en el texto.", 8),
                ("A veces la investigación tarda 20 segundos y me pongo ansioso, aunque la barra ayuda.", 8),
            ],
            "servicios_profesionales": [
                ("La función de planificación semanal en segundo plano de Coco Blanco es de nivel secretaría de alta gama.", 10),
                ("Poder chatear mientras Blanco me audita la agenda semanal sin congelar la app es una maravilla.", 10),
                ("Tengo a los 4 mochis activos: Blanco para coordinar, Verde para contratos, Red para investigar y Blu para clientes.", 10),
                ("Me gustaría sincronizar directamente con Google Calendar o Outlook de forma nativa.", 8),
                ("La interfaz es súper limpia y moderna. Los chips de acción ahorran mucho tipeo.", 9),
            ]
        }

        cohort_aggregates: Dict[str, Dict[str, Any]] = {}

        for cohort in self.cohort_specs:
            cohort_agents: List[CustomerAgent] = []
            
            total_cohort_tokens_in = 0
            total_cohort_tokens_out = 0
            total_cohort_cost = 0.0
            nps_sum = 0
            csat_sum = 0.0

            for _ in range(cohort.target_count):
                # Apply Gaussian noise to activity levels
                activity_mult = max(0.4, random.gauss(1.0, 0.25))
                doc_mult = max(0.2, random.gauss(1.0, 0.35))
                research_mult = max(0.0, random.gauss(1.0, 0.40))

                active_days = min(30, int(cohort.active_days_per_month * min(1.2, activity_mult)))
                daily_msgs = max(3.0, cohort.daily_messages_mean * activity_mult)
                monthly_msgs = int(active_days * daily_msgs)

                # 1. Chat tokens (with Context Caching applied to 40% of system prompt inputs)
                chat_in = int(monthly_msgs * cohort.avg_prompt_tokens * (1.0 - CONTEXT_CACHING_DISCOUNT * 0.35))
                chat_out = int(monthly_msgs * cohort.avg_response_tokens)

                # 2. Document reading tokens (PDFs / OCR extracts)
                docs_count = max(0, int(cohort.monthly_docs_uploaded * doc_mult))
                doc_in = int(docs_count * cohort.avg_doc_tokens)
                doc_out = int(docs_count * 450)  # Synthesis response

                # 3. Deep Research tokens (Coco Red: dossier compilation + monografía)
                res_count = max(0, int(cohort.monthly_deep_researches * research_mult))
                res_in = int(res_count * 7500)
                res_out = int(res_count * 2200)

                # 4. Secretary tasks tokens (Coco Blanco: agenda audit + weekly planning)
                sec_count = max(0, int(cohort.monthly_secretary_tasks * activity_mult))
                sec_in = int(sec_count * 3800)
                sec_out = int(sec_count * 1400)

                # Sum totals
                tot_in = chat_in + doc_in + res_in + sec_in
                tot_out = chat_out + doc_out + res_out + sec_out

                # Gemini API Pay-As-You-Go Cost calculation
                # Blended: 85% Flash 2.0 ($0.10 in / $0.40 out), 15% Heavy ($0.15 in / $0.60 out)
                blended_rate_in = (0.85 * GEMINI_FLASH_INPUT_PER_M + 0.15 * 0.15) / 1_000_000
                blended_rate_out = (0.85 * GEMINI_FLASH_OUTPUT_PER_M + 0.15 * 0.60) / 1_000_000

                gemini_cost = (tot_in * blended_rate_in) + (tot_out * blended_rate_out)

                # Sentiment & NPS
                quote_pick, base_nps = random.choice(quote_templates[cohort.id])
                nps_val = max(1, min(10, int(random.gauss(base_nps, 0.8))))
                csat_val = round(max(3.0, min(5.0, (nps_val / 2.0) + random.uniform(-0.2, 0.2))), 1)

                agent = CustomerAgent(
                    id=customer_id_counter,
                    cohort_id=cohort.id,
                    name=f"Cliente #{customer_id_counter} ({cohort.id})",
                    monthly_chat_tokens_in=chat_in,
                    monthly_chat_tokens_out=chat_out,
                    monthly_doc_tokens_in=doc_in,
                    monthly_doc_tokens_out=doc_out,
                    monthly_research_tokens_in=res_in,
                    monthly_research_tokens_out=res_out,
                    monthly_secretary_tokens_in=sec_in,
                    monthly_secretary_tokens_out=sec_out,
                    total_tokens_in=tot_in,
                    total_tokens_out=tot_out,
                    total_gemini_cost_usd=gemini_cost,
                    nps_score=nps_val,
                    csat_score=csat_val,
                    feedback_quote=quote_pick,
                    friction_point=cohort.primary_friction
                )
                agents.append(agent)
                cohort_agents.append(agent)

                total_cohort_tokens_in += tot_in
                total_cohort_tokens_out += tot_out
                total_cohort_cost += gemini_cost
                nps_sum += nps_val
                csat_sum += csat_val
                customer_id_counter += 1

            c_count = len(cohort_agents)
            cohort_aggregates[cohort.id] = {
                "name": cohort.name,
                "count": c_count,
                "avg_tokens_in": int(total_cohort_tokens_in / c_count),
                "avg_tokens_out": int(total_cohort_tokens_out / c_count),
                "total_tokens_in": total_cohort_tokens_in,
                "total_tokens_out": total_cohort_tokens_out,
                "total_gemini_cost_usd": round(total_cohort_cost, 2),
                "avg_gemini_cost_per_client_usd": round(total_cohort_cost / c_count, 3),
                "avg_nps": round(nps_sum / c_count, 1),
                "avg_csat": round(csat_sum / c_count, 2),
                "top_value": cohort.top_feature_value,
                "primary_friction": cohort.primary_friction,
            }

        # Global totals
        total_tokens_in = sum(a.total_tokens_in for a in agents)
        total_tokens_out = sum(a.total_tokens_out for a in agents)
        total_gemini_cost_usd = sum(a.total_gemini_cost_usd for a in agents)
        avg_cost_per_client_usd = total_gemini_cost_usd / len(agents)

        # NPS calculation (% Promoters 9-10 minus % Detractors 0-6)
        promoters = sum(1 for a in agents if a.nps_score >= 9)
        passives = sum(1 for a in agents if 7 <= a.nps_score <= 8)
        detractors = sum(1 for a in agents if a.nps_score <= 6)
        global_nps = round(((promoters - detractors) / len(agents)) * 100, 1)
        global_csat = round(sum(a.csat_score for a in agents) / len(agents), 2)

        return {
            "total_clients": len(agents),
            "total_tokens_in_millions": round(total_tokens_in / 1_000_000, 2),
            "total_tokens_out_millions": round(total_tokens_out / 1_000_000, 2),
            "total_gemini_cost_monthly_usd": round(total_gemini_cost_usd, 2),
            "avg_gemini_cost_per_client_monthly_usd": round(avg_cost_per_client_usd, 3),
            "global_nps": global_nps,
            "global_csat": global_csat,
            "promoters_pct": round((promoters / len(agents)) * 100, 1),
            "passives_pct": round((passives / len(agents)) * 100, 1),
            "detractors_pct": round((detractors / len(agents)) * 100, 1),
            "cohort_breakdown": cohort_aggregates,
        }


def compute_financial_models(sim_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Computes Unit Economics and Profit Margins for 3 Accessible Low-Cost Pricing Strategies:
    Option 1: Ultra Low-Cost Flat ($3.99 USD / mo ~ $4,800 ARS)
    Option 2: Low-Cost Standard ($5.99 USD / mo ~ $7,200 ARS)
    Option 3: Balanced Value ($7.99 USD / mo ~ $9,600 ARS)
    """
    total_clients = sim_data["total_clients"]
    gemini_cost_usd = sim_data["total_gemini_cost_monthly_usd"]
    
    # Fixed operational overhead
    fixed_infra_monthly_usd = (
        ORACLE_24GB_ALWAYS_FREE_COST +  # $0.00
        DOMAIN_AND_DNS_MONTHLY +        # $1.25
        BACKUP_STORAGE_MONTHLY          # $2.00
    ) # Total $3.25 USD

    pricing_options = [
        {
            "name": "Opción 1: Ultra Low-Cost (Entrada Masiva)",
            "price_usd": 3.99,
            "price_ars": 3.99 * EXCHANGE_RATE_USD_ARS,
            "description": "Precio hiperaccesible (equivalente a 2 cafés). Diseñado para conquistar el mercado sin barreras de entrada.",
        },
        {
            "name": "Opción 2: Low-Cost Estándar (Punto Dulce)",
            "price_usd": 5.99,
            "price_ars": 5.99 * EXCHANGE_RATE_USD_ARS,
            "description": "Precio súper competitivo (1/3 de ChatGPT Plus). Deja margen holgado para publicidad y reinversión.",
        },
        {
            "name": "Opción 3: Valor Equilibrado Pro",
            "price_usd": 7.99,
            "price_ars": 7.99 * EXCHANGE_RATE_USD_ARS,
            "description": "Tarifa profesional baja para PyMEs y consultorios. Maximiza la rentabilidad neta.",
        },
    ]

    results = []
    for opt in pricing_options:
        price = opt["price_usd"]
        gross_revenue_monthly = total_clients * price
        
        # Blended payment gateway fee (assumes 70% Mercado Pago @ 6.5%, 30% Stripe @ 2.9% + $0.30)
        gateway_fee_monthly = (
            (gross_revenue_monthly * 0.70 * PAYMENT_GATEWAY_FEE_PCT_MP) +
            (gross_revenue_monthly * 0.30 * PAYMENT_GATEWAY_FEE_PCT_STRIPE + (total_clients * 0.30 * 0.30))
        )
        
        total_costs_monthly = gemini_cost_usd + fixed_infra_monthly_usd + gateway_fee_monthly
        net_profit_monthly = gross_revenue_monthly - total_costs_monthly
        margin_pct = (net_profit_monthly / gross_revenue_monthly) * 100
        annual_revenue = gross_revenue_monthly * 12
        annual_net_profit = net_profit_monthly * 12
        break_even_clients = math.ceil(
            (fixed_infra_monthly_usd) / 
            (price * (1 - 0.055) - (gemini_cost_usd / total_clients))
        )

        results.append({
            "name": opt["name"],
            "price_usd": opt["price_usd"],
            "price_ars": round(opt["price_ars"]),
            "gross_revenue_monthly_usd": round(gross_revenue_monthly, 2),
            "gross_revenue_annual_usd": round(annual_revenue, 2),
            "gemini_api_cost_usd": round(gemini_cost_usd, 2),
            "payment_gateway_fee_usd": round(gateway_fee_monthly, 2),
            "fixed_infra_cost_usd": round(fixed_infra_monthly_usd, 2),
            "total_costs_monthly_usd": round(total_costs_monthly, 2),
            "net_profit_monthly_usd": round(net_profit_monthly, 2),
            "net_profit_annual_usd": round(annual_net_profit, 2),
            "net_margin_pct": round(margin_pct, 1),
            "break_even_clients": break_even_clients,
            "cogs_per_client_usd": round(total_costs_monthly / total_clients, 2),
        })

    return {
        "fixed_infra_monthly_usd": fixed_infra_monthly_usd,
        "scenarios": results
    }


def main():
    print("=" * 75)
    print("🚀 EJECUTANDO SIMULACIÓN MIROFISH: ESTUDIO DE MERCADO Y COSTOS (2.000 CLIENTES)")
    print("=" * 75)

    simulator = MiroFishMarketSimulator(total_clients=2000)
    sim_data = simulator.run_simulation()
    fin_data = compute_financial_models(sim_data)

    print(f"✅ Población simulada: {sim_data['total_clients']} clientes")
    print(f"📊 Tokens Entrada Mensuales: {sim_data['total_tokens_in_millions']} M tokens")
    print(f"📊 Tokens Salida Mensuales: {sim_data['total_tokens_out_millions']} M tokens")
    print(f"💰 Costo Total Gemini Pay-As-You-Go: ${sim_data['total_gemini_cost_monthly_usd']} USD/mes")
    print(f"🏷️ Costo Gemini promedio por cliente: ${sim_data['avg_gemini_cost_per_client_monthly_usd']} USD/mes")
    print(f"🌟 Net Promoter Score (NPS): {sim_data['global_nps']} (Promotores: {sim_data['promoters_pct']}%)")
    print(f"⭐ Satisfacción (CSAT): {sim_data['global_csat']} / 5.0")
    print("-" * 75)
    print("ESCENARIOS FINANCIEROS (PRECIOS BAJOS):")
    for s in fin_data["scenarios"]:
        print(f"-> {s['name']} (${s['price_usd']} USD / ${s['price_ars']} ARS):")
        print(f"   MRR: ${s['gross_revenue_monthly_usd']} USD | Ganancia Neta: ${s['net_profit_monthly_usd']} USD/mes ({s['net_margin_pct']}%)")
        print(f"   Ganancia Neta Anual: ${s['net_profit_annual_usd']} USD | COGS por cliente: ${s['cogs_per_client_usd']} USD")
    print("=" * 75)

    # Save structured JSON summary
    output_json_path = os.path.join(os.path.dirname(__file__), "logs", "mirofish_market_study_2000_clients.json")
    os.makedirs(os.path.dirname(output_json_path), exist_ok=True)
    with open(output_json_path, "w", encoding="utf-8") as f:
        json.dump({"simulation": sim_data, "financials": fin_data}, f, indent=2, ensure_ascii=False)
    print(f"📁 Datos crudos guardados en: {output_json_path}")


if __name__ == "__main__":
    main()
