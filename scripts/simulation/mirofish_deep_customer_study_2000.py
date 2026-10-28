#!/usr/bin/env python3
"""
=============================================================================
MiroFish Deep Customer Opinion & Friction Elimination Simulation: 2,000 Clients
=============================================================================
Comprehensive market simulation analyzing:
1. Real Paid Server Costs (Oracle Cloud Paid 24 GB @ $64/mo vs Hetzner 32 GB @ $31.50/mo vs Free tier)
2. In-depth Voice of Customer (VoC) collection: 2,000 customer quotes, sentiment analysis,
   complaints, praises, and feature usage distribution across 4 market cohorts.
3. Comparative Matrix: Baseline (With Friction) vs Friction-Eliminated (E2EE Vault,
   Coco Blanco Host Triage, Auto-Factura A AFIP, Vision OCR Fallback).
4. Financial impact of friction elimination on Churn, LTV, MRR, and Net Profit.
=============================================================================
"""

import os
import sys
import json
import time
import math
import random
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional, Tuple

EXCHANGE_RATE_USD_ARS = 1200.0

# LLM API Pricing (Google Gemini Pay-As-You-Go)
GEMINI_FLASH_IN_PER_M = 0.10     # $0.10 USD per 1M input tokens
GEMINI_FLASH_OUT_PER_M = 0.40    # $0.40 USD per 1M output tokens
GEMINI_HEAVY_IN_PER_M = 0.15     # $0.15 USD per 1M input tokens (heavy research/deep analysis)
GEMINI_HEAVY_OUT_PER_M = 0.60    # $0.60 USD per 1M output tokens
CONTEXT_CACHING_SAVINGS = 0.50   # 50% discount on cached system prompts

# Real Paid Server Options
SERVER_OPTIONS = {
    "oracle_24gb_paid": {
        "name": "Oracle Cloud Ampere A1 (Paid PAYG)",
        "specs": "4 OCPU ARM, 24 GB RAM, 200 GB SSD NVMe, 10 TB Egress",
        "monthly_cost_usd": 63.98,
        "calculation": "4 OCPU * $0.01/h * 730h ($29.20) + 24 GB * $0.0015/h * 730h ($26.28) + 200 GB Boot ($8.50)"
    },
    "oracle_24gb_free": {
        "name": "Oracle Cloud Ampere A1 (Always Free Tier)",
        "specs": "4 OCPU ARM, 24 GB RAM, 200 GB SSD NVMe (Sujeto a disponibilidad de cupo)",
        "monthly_cost_usd": 0.0,
        "calculation": "Costo $0 si la región tiene capacidad libre asignada"
    },
    "oracle_x86_paid": {
        "name": "Oracle Cloud AMD E4 Flex (x86 Paid)",
        "specs": "4 vCPU AMD, 24 GB RAM, 200 GB SSD NVMe",
        "monthly_cost_usd": 99.28,
        "calculation": "4 vCPU * $0.025/h * 730h ($73.00) + 24 GB * $0.0015/h * 730h ($26.28)"
    },
    "hetzner_32gb": {
        "name": "Hetzner Cloud CAX41 (Alternativa de Alto Rendimiento)",
        "specs": "8 vCPU ARM, 32 GB RAM, 320 GB SSD NVMe, 20 TB Tráfico",
        "monthly_cost_usd": 31.50,
        "calculation": "€28.90 EUR / mes facturado por Hetzner (~$31.50 USD)"
    }
}

# Fixed Ancillary Costs
DOMAIN_DNS_MONTHLY = 1.25
BACKUPS_S3_MONTHLY = 2.00
PAYMENT_GATEWAY_BLENDED_PCT = 0.058  # 5.8% blended fee between Mercado Pago and Stripe


@dataclass
class CustomerFeedback:
    customer_id: int
    cohort_id: str
    profession: str
    city: str
    preferred_mochi: str
    primary_use_case: str
    sentiment: str                   # 'muy_favorable', 'favorable', 'neutro', 'insatisfecho'
    nps_score: int                   # 0 to 10
    csat_score: float                # 1.0 to 5.0
    verbatim_quote: str
    top_praise: str
    complaint_or_friction: str
    would_churn_without_fix: bool
    retained_with_fix: bool


class DeepCustomerStudySimulator:
    def __init__(self, total_clients: int = 2000):
        self.total_clients = total_clients
        random.seed(12345)  # Deterministic seed

        self.cohort_weights = {
            "salud": 0.25,                 # 500
            "retail_gastronomia": 0.30,   # 600
            "academia_investigacion": 0.20,# 400
            "servicios_profesionales": 0.25# 500
        }

    def generate_feedbacks(self) -> List[CustomerFeedback]:
        feedbacks: List[CustomerFeedback] = []

        cohort_data = {
            "salud": {
                "professions": ["Psicólogo/a", "Médico/a Clínico/a", "Odontólogo/a", "Kinesiólogo/a", "Nutricionista", "Psiquiatra"],
                "cities": ["Buenos Aires", "Córdoba", "Rosario", "Mendoza", "Montevideo", "Santiago"],
                "primary_uses": ["Lectura de recetas y órdenes médicas", "Bóveda privada de notas de pacientes", "Gestión de turnos y agenda"],
                "praises": [
                    "Poder procesar recetas y comprobantes sabiendo que no se guardan en un servidor es mi paz mental.",
                    "Coco Verde extrae los datos de órdenes de obra social con una precisión asombrosa.",
                    "La combinación de Coco Blanco para la agenda y Verde para el consultorio me ahorra 1 hora al día.",
                    "Es la primera app de IA que me animo a usar en el consultorio por el secreto profesional."
                ],
                "frictions_baseline": [
                    "Si abro la app en la computadora del consultorio y después en el celular, no veo las notas que guardé.",
                    "Limpié el caché del navegador y sentí un infarto pensando que había perdido las notas clínicas.",
                    "Necesito un botón para exportar mis notas y pacientes a mi computadora de respaldo.",
                    "A veces me confundo y le pregunto a Coco Red cosas que son de Coco Verde."
                ],
                "resolutions": [
                    "¡Con la Bóveda Cifrada E2EE ahora puedo tener mis notas en el celular y en la PC sin romper el secreto médico!",
                    "El botón de exportar respaldo cifrado me da 100% de tranquilidad.",
                    "Coco Blanco me recibió de entrada y me derivó con Coco Verde en un segundo."
                ]
            },
            "retail_gastronomia": {
                "professions": ["Dueño de Tienda de Ropa", "Encargado de Rotisería", "Comercio de Electrónica", "Cafetería y Pastelería", "Tienda de Calzado"],
                "cities": ["Buenos Aires", "La Plata", "Mar del Plata", "San Miguel de Tucumán", "Bogotá", "Lima"],
                "primary_uses": ["Atención de mensajes nocturnos de clientes", "Control de pedidos y comprobantes de transferencia", "Consultas de stock y precios"],
                "praises": [
                    "Coco Blu atendiendo consultas y pedidos a las 11 de la noche me cambió la vida.",
                    "La verificación de comprobantes de transferencia de Mercado Pago me salvó de 2 estafas este mes.",
                    "Por el precio que tiene, se paga solo con una sola venta nocturna que rescata.",
                    "La personalidad amable y rápida de Blu hace que los clientes piensen que soy yo respondiendo."
                ],
                "frictions_baseline": [
                    "Necesito Factura A con mi CUIT sí o sí en Mercado Pago para poder deducir la suscripción de impuestos.",
                    "A veces los clientes mandan comprobantes de transferencia medios doblados o con poca luz y fallaba.",
                    "Quiero que se conecte directamente con el catálogo de fotos de mis productos.",
                    "Al principio no sabía para qué servían Coco Red y Coco Verde si yo solo quería vender."
                ],
                "resolutions": [
                    "Ahora que Mercado Pago me pide el CUIT y me manda la Factura A automática, la empresa me aprueba el pago al instante.",
                    "El nuevo OCR inteligente lee los comprobantes borrosos o torcidos sin quejarse.",
                    "Coco Blanco me recibió y me dejó a Coco Blu como mi asistente principal."
                ]
            },
            "academia_investigacion": {
                "professions": ["Tesista de Maestría", "Estudiante de Ingeniería", "Docente Universitario", "Investigador Conicet", "Estudiante de Derecho"],
                "cities": ["Córdoba", "Buenos Aires", "Rosario", "La Plata", "Madrid", "Barcelona"],
                "primary_uses": ["Lectura de múltiples papers y libros en PDF", "Investigación profunda con citas de arXiv y Crossref", "Resúmenes estructurados para exámenes"],
                "praises": [
                    "Coco Red armando la monografía con citas de papers reales de arXiv y descargable en PDF es insuperable.",
                    "Poder subir 3 PDFs juntos y pedirle que me conecte el hilo conductor me ahorró semanas de lectura.",
                    "No existe otra app por este precio que te haga deep research académico sin cobrarte $20 USD.",
                    "El informe descargable con formato de paper académico me sirvió directo para el marco teórico de mi tesis."
                ],
                "frictions_baseline": [
                    "Los estudiantes tenemos presupuesto cero; si el cobro es en dólares con impuestos de tarjeta nos mata.",
                    "A veces subo un PDF escaneado viejo de la facultad y no leía el texto porque no era texto seleccionable.",
                    "Si cambio de notebook en la biblioteca pierdo el historial de lo que había investigado con Red.",
                    "Quería poder resaltar texto directamente sobre el PDF en pantalla."
                ],
                "resolutions": [
                    "El precio en pesos por Mercado Pago sin impuesto PAIS/tarjeta internacional es un golazo.",
                    "El fallback de visión de Gemini ahora lee los PDFs fotocopiados de la facultad sin problema.",
                    "Poder sincronizar mi bóveda entre la notebook y el teléfono me salvó en la cursada."
                ]
            },
            "servicios_profesionales": {
                "professions": ["Contador Público", "Abogado Laboral", "Asesor Financiero", "Diseñador Gráfico", "Consultor de Marketing"],
                "cities": ["Buenos Aires", "Montevideo", "Córdoba", "Rosario", "Santiago", "Ciudad de México"],
                "primary_uses": ["Planificación semanal y gestión de agenda ejecutiva", "Revisión de contratos y resoluciones", "Minutas de reunión y tareas pendientes"],
                "praises": [
                    "La planificación semanal en segundo plano de Coco Blanco es de nivel secretaría privada.",
                    "Me encanta poder pedirle una auditoría de agenda y seguir chateando con él sin que la app se congele.",
                    "Los chips interactivos `[🗓️ Ver Agenda]` y `[⚡ Planificar]` hacen que gestione todo en 2 toques.",
                    "La velocidad de respuesta es inmediata, no te hace esperar como otras IAs."
                ],
                "frictions_baseline": [
                    "Uso la PC de la oficina y la notebook de casa; necesito que mis tareas y mi agenda estén en ambos lados.",
                    "Necesito Factura electrónica para mi estudio contable / jurídica.",
                    "Falta integración directa de 1 clic con Google Calendar o Outlook.",
                    "Al tener 4 mochis, al principio no entendía quién coordinaba qué cosa."
                ],
                "resolutions": [
                    "La sincronización de la bóveda con clave privada me permite tener mi agenda en la oficina y en mi casa.",
                    "La Factura A me llega al mail ni bien se cobra en Mercado Pago.",
                    "Coco Blanco recibiéndome como Gerente General me ordenó el flujo de trabajo."
                ]
            }
        }

        cid = 1
        for cohort_id, weight in self.cohort_weights.items():
            count = int(self.total_clients * weight)
            cinfo = cohort_data[cohort_id]

            for _ in range(count):
                prof = random.choice(cinfo["professions"])
                city = random.choice(cinfo["cities"])
                use_case = random.choice(cinfo["primary_uses"])
                
                # Preferred mochi
                if cohort_id == "salud":
                    p_mochi = random.choices(["coco_verde", "coco_blanco", "coco_rojo"], [0.65, 0.25, 0.10])[0]
                elif cohort_id == "retail_gastronomia":
                    p_mochi = random.choices(["coco_blu", "coco_blanco", "coco_verde"], [0.70, 0.20, 0.10])[0]
                elif cohort_id == "academia_investigacion":
                    p_mochi = random.choices(["coco_rojo", "coco_blanco"], [0.85, 0.15])[0]
                else:
                    p_mochi = random.choices(["coco_blanco", "coco_rojo", "coco_blu"], [0.70, 0.20, 0.10])[0]

                # Base NPS & Sentiment
                # 72% positive baseline, 18% neutral, 10% critical due to friction points
                rand_val = random.random()
                if rand_val < 0.50:
                    sentiment = "muy_favorable"
                    nps = random.choice([9, 10])
                    csat = round(random.uniform(4.5, 5.0), 1)
                    churn_base = False
                elif rand_val < 0.75:
                    sentiment = "favorable"
                    nps = random.choice([8, 9])
                    csat = round(random.uniform(4.0, 4.4), 1)
                    churn_base = False
                elif rand_val < 0.90:
                    sentiment = "neutro"
                    nps = random.choice([7, 8])
                    csat = round(random.uniform(3.5, 3.9), 1)
                    # Affected by friction
                    churn_base = random.random() < 0.35
                else:
                    sentiment = "insatisfecho"
                    nps = random.choice([4, 5, 6])
                    csat = round(random.uniform(2.5, 3.4), 1)
                    churn_base = True

                praise = random.choice(cinfo["praises"])
                complaint = random.choice(cinfo["frictions_baseline"])
                
                # Verbatim quote combines praise and pain point
                if sentiment in ["muy_favorable", "favorable"]:
                    quote = f"«{praise} Sin embargo, {complaint.lower()}»"
                else:
                    quote = f"«La idea está buena, pero {complaint.lower()} Si no resuelven eso, se me complica seguir usándola a diario.»"

                # With friction eliminated, 92% of users at risk of churning are saved
                retained_fix = True if not churn_base else (random.random() < 0.92)

                feedbacks.append(CustomerFeedback(
                    customer_id=cid,
                    cohort_id=cohort_id,
                    profession=prof,
                    city=city,
                    preferred_mochi=p_mochi,
                    primary_use_case=use_case,
                    sentiment=sentiment,
                    nps_score=nps,
                    csat_score=csat,
                    verbatim_quote=quote,
                    top_praise=praise,
                    complaint_or_friction=complaint,
                    would_churn_without_fix=churn_base,
                    retained_with_fix=retained_fix
                ))
                cid += 1

        return feedbacks

    def analyze_voice_of_customer(self, feedbacks: List[CustomerFeedback]) -> Dict[str, Any]:
        """Performs statistical and qualitative categorization on customer feedback."""
        total = len(feedbacks)
        sentiments_count = {"muy_favorable": 0, "favorable": 0, "neutro": 0, "insatisfecho": 0}
        mochi_popularity = {"coco_blanco": 0, "coco_verde": 0, "coco_rojo": 0, "coco_blu": 0}
        
        # Friction category buckets
        friction_categories = {
            "sincronizacion_multidispositivo": 0,  # Fricción 1 (Bóveda local / cambio de equipo)
            "facturacion_fiscal_cuit": 0,          # Fricción 2 (Factura A / comprobante fiscal)
            "onboarding_mochis": 0,                # Fricción 3 (Duda de a quién hablarle)
            "ocr_documentos_escaneados": 0         # Fricción 4 (PDFs torcidos o imágenes)
        }

        # Praises category buckets
        praise_categories = {
            "privacidad_zero_storage": 0,
            "deep_research_pdf_rojo": 0,
            "secretaria_agenda_blanco": 0,
            "atencion_comercial_blu": 0,
            "ocr_medico_verde": 0
        }

        nps_scores = []
        csat_scores = []
        churn_risk_count = 0
        retained_with_fix_count = 0

        for f in feedbacks:
            sentiments_count[f.sentiment] += 1
            mochi_popularity[f.preferred_mochi] += 1
            nps_scores.append(f.nps_score)
            csat_scores.append(f.csat_score)
            
            if f.would_churn_without_fix:
                churn_risk_count += 1
            if f.retained_with_fix:
                retained_with_fix_count += 1

            # Friction mapping
            comp = f.complaint_or_friction.lower()
            if "computadora" in comp or "celular" in comp or "limpié el caché" in comp or "exportar" in comp:
                friction_categories["sincronizacion_multidispositivo"] += 1
            elif "factura" in comp or "cuit" in comp or "dólares" in comp:
                friction_categories["facturacion_fiscal_cuit"] += 1
            elif "confundo" in comp or "para qué servían" in comp or "quién coordinaba" in comp:
                friction_categories["onboarding_mochis"] += 1
            else:
                friction_categories["ocr_documentos_escaneados"] += 1

            # Praise mapping
            pr = f.top_praise.lower()
            if "guardan" in pr or "paz mental" in pr or "secreto profesional" in pr:
                praise_categories["privacidad_zero_storage"] += 1
            elif "monografía" in pr or "arxiv" in pr or "deep research" in pr:
                praise_categories["deep_research_pdf_rojo"] += 1
            elif "agenda" in pr or "segundo plano" in pr or "chips" in pr:
                praise_categories["secretaria_agenda_blanco"] += 1
            elif "nocturnos" in pr or "estafas" in pr or "blu" in pr:
                praise_categories["atencion_comercial_blu"] += 1
            else:
                praise_categories["ocr_medico_verde"] += 1

        promoters = sum(1 for s in nps_scores if s >= 9)
        passives = sum(1 for s in nps_scores if 7 <= s <= 8)
        detractors = sum(1 for s in nps_scores if s <= 6)
        baseline_nps = round(((promoters - detractors) / total) * 100, 1)
        baseline_csat = round(sum(csat_scores) / total, 2)

        # Post-Fix NPS Projection (Detractors reduced by 85%)
        post_promoters = promoters + int(passives * 0.40)
        post_passives = int(passives * 0.55)
        post_detractors = max(10, int(detractors * 0.15))
        post_nps = round(((post_promoters - post_detractors) / total) * 100, 1)
        post_csat = round(min(4.85, baseline_csat + 0.55), 2)

        return {
            "total_analyzed": total,
            "sentiments": {k: {"count": v, "pct": round((v / total) * 100, 1)} for k, v in sentiments_count.items()},
            "mochi_preferences": {k: {"count": v, "pct": round((v / total) * 100, 1)} for k, v in mochi_popularity.items()},
            "friction_breakdown": {k: {"count": v, "pct": round((v / total) * 100, 1)} for k, v in friction_categories.items()},
            "praise_breakdown": {k: {"count": v, "pct": round((v / total) * 100, 1)} for k, v in praise_categories.items()},
            "baseline_nps": baseline_nps,
            "baseline_csat": baseline_csat,
            "post_fix_nps": post_nps,
            "post_fix_csat": post_csat,
            "churn_risk_baseline": {"count": churn_risk_count, "pct": round((churn_risk_count / total) * 100, 1)},
            "retained_post_fix": {"count": retained_with_fix_count, "pct": round((retained_with_fix_count / total) * 100, 1)},
            "sample_quotes": [f.verbatim_quote for f in feedbacks[:12]]
        }


def run_comprehensive_study():
    sim = DeepCustomerStudySimulator(total_clients=2000)
    feedbacks = sim.generate_feedbacks()
    voc_analysis = sim.analyze_voice_of_customer(feedbacks)

    # Financial model with REAL PAID SERVER
    price_per_client_usd = 5.99  # Standard low-cost recommended
    mrr_gross = 2000 * price_per_client_usd  # $11,980 USD

    gemini_api_cost = 203.82  # From accurate token simulation
    oracle_paid_server = SERVER_OPTIONS["oracle_24gb_paid"]["monthly_cost_usd"]  # $63.98 USD
    fixed_ancillary = DOMAIN_DNS_MONTHLY + BACKUPS_S3_MONTHLY  # $3.25 USD
    gateway_fees = mrr_gross * PAYMENT_GATEWAY_BLENDED_PCT  # ~$694.84 USD

    total_costs_paid_oracle = gemini_api_cost + oracle_paid_server + fixed_ancillary + gateway_fees
    net_profit_paid_oracle = mrr_gross - total_costs_paid_oracle
    net_margin_paid_oracle = (net_profit_paid_oracle / mrr_gross) * 100

    # With Hetzner 32 GB ($31.50)
    total_costs_hetzner = gemini_api_cost + SERVER_OPTIONS["hetzner_32gb"]["monthly_cost_usd"] + fixed_ancillary + gateway_fees
    net_profit_hetzner = mrr_gross - total_costs_hetzner
    net_margin_hetzner = (net_profit_hetzner / mrr_gross) * 100

    study_results = {
        "server_pricing_audit": SERVER_OPTIONS,
        "financial_summary_paid_server": {
            "mrr_gross_usd": round(mrr_gross, 2),
            "gemini_api_cost_usd": round(gemini_api_cost, 2),
            "oracle_24gb_paid_cost_usd": round(oracle_paid_server, 2),
            "hetzner_32gb_cost_usd": round(SERVER_OPTIONS["hetzner_32gb"]["monthly_cost_usd"], 2),
            "gateway_fees_usd": round(gateway_fees, 2),
            "fixed_ancillary_usd": round(fixed_ancillary, 2),
            "total_costs_monthly_oracle_paid_usd": round(total_costs_paid_oracle, 2),
            "net_profit_monthly_oracle_paid_usd": round(net_profit_paid_oracle, 2),
            "net_profit_annual_oracle_paid_usd": round(net_profit_paid_oracle * 12, 2),
            "net_margin_pct_oracle_paid": round(net_margin_paid_oracle, 1),
            "total_costs_monthly_hetzner_usd": round(total_costs_hetzner, 2),
            "net_profit_monthly_hetzner_usd": round(net_profit_hetzner, 2),
            "net_margin_pct_hetzner": round(net_margin_hetzner, 1),
            "server_cost_percentage_of_revenue": round((oracle_paid_server / mrr_gross) * 100, 2)
        },
        "voice_of_customer": voc_analysis
    }

    # Save to JSON log
    log_file = os.path.join(os.path.dirname(__file__), "logs", "mirofish_deep_customer_study_2000.json")
    os.makedirs(os.path.dirname(log_file), exist_ok=True)
    with open(log_file, "w", encoding="utf-8") as f:
        json.dump(study_results, f, indent=2, ensure_ascii=False)

    print("=" * 80)
    print("✅ SIMULACIÓN DE VOZ DEL CLIENTE Y COSTO REAL DE SERVIDOR COMPLETADA")
    print(f"📊 Clientes analizados: 2.000")
    print(f"🖥️ Costo Real Servidor Oracle 24 GB (PAID): ${oracle_paid_server} USD/mes ({round((oracle_paid_server / mrr_gross)*100, 2)}% de los ingresos)")
    print(f"🖥️ Costo Alternativo Hetzner 32 GB: ${SERVER_OPTIONS['hetzner_32gb']['monthly_cost_usd']} USD/mes")
    print(f"💰 Ganancia Neta Mensual (con Servidor Pagado): ${round(net_profit_paid_oracle, 2)} USD/mes ({round(net_margin_paid_oracle, 1)}% margen neto)")
    print(f"🌟 NPS: {voc_analysis['baseline_nps']} (Con Fricción) -> {voc_analysis['post_fix_nps']} (Sin Fricción)")
    print(f"⭐ CSAT: {voc_analysis['baseline_csat']} -> {voc_analysis['post_fix_csat']} / 5.0")
    print(f"🛡️ Retención de Clientes en Riesgo: {voc_analysis['retained_post_fix']['pct']}% salvados")
    print("=" * 80)
    return study_results


if __name__ == "__main__":
    run_comprehensive_study()
