#!/usr/bin/env python3
"""
=============================================================================
MiroFish Hybrid Routing Stress Simulation: The Hidden Risks & Real Trade-offs
=============================================================================
Audits the REAL pitfalls of combining:
1. Free models (OpenRouter :free / Groq free / Gemini free)
2. Gemini 2.0 Flash Pay-As-You-Go
3. Gemini Live API (Real-time voice streaming)

Evaluates:
- Rate limit 429 spikes & fallback latency penalty
- Prompt compliance & character consistency degradations
- Live voice cost explosion vs quota limits
- Data privacy compliance risks (medical/legal secrecy on free tiers)
- Net customer NPS and churn impact when free tier degrades
=============================================================================
"""

import os
import sys
import json
import time
import math
import random
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional

EXCHANGE_RATE = 1200.0

# API Pricing Constants
GEMINI_PAYG_TEXT_IN_PER_M = 0.10
GEMINI_PAYG_TEXT_OUT_PER_M = 0.40

# Gemini Live Audio Streaming Pricing
# Live audio input: ~$0.70 / 1M tokens (~$0.008/min)
# Live audio output: ~$8.50 / 1M tokens (~$0.035/min)
# Combined blended minute of real-time bidirectional voice conversation:
COST_PER_LIVE_VOICE_MINUTE_USD = 0.042  # ~$0.042 USD per conversational minute

SERVER_PAID_ORACLE_MONTHLY = 63.98
GATEWAY_FEE_PCT = 0.058


@dataclass
class HybridUserBehavior:
    user_id: int
    cohort_id: str
    monthly_chat_msgs: int
    monthly_docs: int
    monthly_voice_minutes: float
    free_tier_eligibility: bool  # False if user has strict privacy needs (health/legal)
    experienced_429_delay: bool = False
    experienced_character_break: bool = False
    total_latency_seconds: float = 0.0
    churned: bool = False
    churn_reason: Optional[str] = None
    nps_score: int = 8
    csat_score: float = 4.0


class HybridArchitectureStressTester:
    def __init__(self, total_users: int = 2000):
        self.total_users = total_users
        random.seed(999)

    def run_simulation(self, voice_policy: str = "unlimited_voice") -> Dict[str, Any]:
        """
        voice_policy: 'unlimited_voice' vs 'capped_30m' vs 'no_voice'
        """
        users: List[HybridUserBehavior] = []

        # Real-world network parameters for OpenRouter :free / Groq free
        # Free tier public rate limit ceiling: 25 requests / min platform-wide
        # Above that, 429 RateLimit or 503 Overloaded occurs.
        free_tier_failure_rate_peak = 0.18   # 18% failure/timeout rate in peak hours
        character_break_rate_free = 0.09     # 9% of complex actions lost/mangled on free models
        latency_p50_free = 2.8               # 2.8 seconds TTFT
        latency_p95_free = 9.4               # 9.4 seconds under queueing

        latency_p50_gemini_payg = 0.45       # 450 ms TTFT
        latency_p95_gemini_payg = 1.1        # 1.1 s TTFT

        # Token counters
        free_tier_tokens_in = 0
        free_tier_tokens_out = 0
        gemini_payg_tokens_in = 0
        gemini_payg_tokens_out = 0
        total_voice_minutes = 0.0

        for uid in range(1, self.total_users + 1):
            # Cohort distribution
            c_rand = random.random()
            if c_rand < 0.25:
                cohort = "salud"
                # Health cohort CANNOT use public free models due to patient data privacy laws
                strict_privacy = True
                msgs = random.randint(180, 420)
                docs = random.randint(6, 14)
                voice_mins = random.uniform(10, 45) if voice_policy != "no_voice" else 0
            elif c_rand < 0.55:
                cohort = "retail_gastronomia"
                strict_privacy = False
                msgs = random.randint(300, 650)
                docs = random.randint(2, 6)
                voice_mins = random.uniform(15, 60) if voice_policy != "no_voice" else 0
            elif c_rand < 0.75:
                cohort = "academia_investigacion"
                strict_privacy = False
                msgs = random.randint(120, 320)
                docs = random.randint(8, 20)
                voice_mins = random.uniform(5, 25) if voice_policy != "no_voice" else 0
            else:
                cohort = "servicios_profesionales"
                strict_privacy = random.random() < 0.60 # Lawyers/accountants require privacy
                msgs = random.randint(220, 500)
                docs = random.randint(4, 12)
                voice_mins = random.uniform(20, 80) if voice_policy != "no_voice" else 0

            # Apply Voice Policy limits
            if voice_policy == "capped_30m":
                voice_mins = min(30.0, voice_mins)
            elif voice_policy == "no_voice":
                voice_mins = 0.0

            total_voice_minutes += voice_mins

            # Routing decision for text messages:
            # If strict_privacy is True -> 100% Gemini PAYG (Enterprise Data Privacy compliant)
            # If strict_privacy is False -> 65% Free Tier, 35% Gemini PAYG (documents/heavy tasks)
            user_exp_429 = False
            user_char_break = False
            accum_latency = 0.0

            for m in range(msgs):
                # Is it a document query? (Always Gemini PAYG)
                is_doc_or_vision = (random.random() < 0.15)
                
                if strict_privacy or is_doc_or_vision:
                    # Routed to Gemini 2.0 Flash PAYG
                    gemini_payg_tokens_in += 950
                    gemini_payg_tokens_out += 360
                    accum_latency += random.uniform(latency_p50_gemini_payg, latency_p95_gemini_payg)
                else:
                    # Attempt routing to Free Tier
                    is_peak_hour = (random.random() < 0.40)
                    fail_chance = free_tier_failure_rate_peak if is_peak_hour else 0.05

                    if random.random() < fail_chance:
                        # 429 or timeout -> Fallback triggered
                        user_exp_429 = True
                        # Penalty: waited 6s for timeout + 0.8s for fallback to Gemini
                        accum_latency += 6.8
                        gemini_payg_tokens_in += 950
                        gemini_payg_tokens_out += 360
                    else:
                        # Success on free tier
                        free_tier_tokens_in += 950
                        free_tier_tokens_out += 360
                        accum_latency += random.uniform(latency_p50_free, latency_p95_free)

                        # Check for character consistency break on open model
                        if random.random() < character_break_rate_free:
                            user_char_break = True

            # Evaluate churn & sentiment based on actual experienced friction
            base_nps = 9
            churn = False
            churn_reason = None

            if user_exp_429 and user_char_break:
                base_nps -= 4
                if random.random() < 0.38:
                    churn = True
                    churn_reason = "Lentitud por timeouts y respuestas fuera de personaje en horas pico"
            elif user_exp_429:
                base_nps -= 2
                if random.random() < 0.18:
                    churn = True
                    churn_reason = "La app se cuelga a veces varios segundos antes de responder"
            elif user_char_break:
                base_nps -= 2
                if random.random() < 0.12:
                    churn = True
                    churn_reason = "El mochi a veces responde raro, robótico o pierde el estilo"

            nps = max(1, min(10, base_nps + random.choice([-1, 0, 1])))
            csat = round(max(1.5, min(5.0, (nps / 2.0) + random.uniform(-0.1, 0.1))), 2)

            users.append(HybridUserBehavior(
                user_id=uid,
                cohort_id=cohort,
                monthly_chat_msgs=msgs,
                monthly_docs=docs,
                monthly_voice_minutes=voice_mins,
                free_tier_eligibility=(not strict_privacy),
                experienced_429_delay=user_exp_429,
                experienced_character_break=user_char_break,
                total_latency_seconds=accum_latency,
                churned=churn,
                churn_reason=churn_reason,
                nps_score=nps,
                csat_score=csat
            ))

        # Financial Calculations
        mrr_gross = self.total_users * 5.99  # $11,980 USD

        # Token Costs
        cost_gemini_payg_text = (
            (gemini_payg_tokens_in / 1_000_000) * GEMINI_PAYG_TEXT_IN_PER_M +
            (gemini_payg_tokens_out / 1_000_000) * GEMINI_PAYG_TEXT_OUT_PER_M
        )
        cost_free_tier = 0.0  # $0.00
        cost_gemini_live_voice = total_voice_minutes * COST_PER_LIVE_VOICE_MINUTE_USD

        total_ai_cost = cost_gemini_payg_text + cost_gemini_live_voice
        total_infra = SERVER_PAID_ORACLE_MONTHLY + 3.25
        gateway_fees = mrr_gross * GATEWAY_FEE_PCT

        total_opex = total_ai_cost + total_infra + gateway_fees
        net_profit = mrr_gross - total_opex
        net_margin = (net_profit / mrr_gross) * 100

        # Quality metrics
        promoters = sum(1 for u in users if u.nps_score >= 9)
        detractors = sum(1 for u in users if u.nps_score <= 6)
        global_nps = round(((promoters - detractors) / len(users)) * 100, 1)
        global_csat = round(sum(u.csat_score for u in users) / len(users), 2)
        total_churned = sum(1 for u in users if u.churned)
        users_affected_by_delays = sum(1 for u in users if u.experienced_429_delay)
        users_affected_by_char_breaks = sum(1 for u in users if u.experienced_character_break)

        return {
            "voice_policy": voice_policy,
            "total_users": self.total_users,
            "total_voice_minutes": round(total_voice_minutes, 1),
            "cost_gemini_payg_text_usd": round(cost_gemini_payg_text, 2),
            "cost_gemini_live_voice_usd": round(cost_gemini_live_voice, 2),
            "total_ai_cost_usd": round(total_ai_cost, 2),
            "total_opex_usd": round(total_opex, 2),
            "mrr_gross_usd": round(mrr_gross, 2),
            "net_profit_usd": round(net_profit, 2),
            "net_margin_pct": round(net_margin, 1),
            "global_nps": global_nps,
            "global_csat": global_csat,
            "churn_count": total_churned,
            "churn_rate_pct": round((total_churned / self.total_users) * 100, 1),
            "users_affected_by_delays_pct": round((users_affected_by_delays / self.total_users) * 100, 1),
            "users_affected_by_char_breaks_pct": round((users_affected_by_char_breaks / self.total_users) * 100, 1),
            "reasons_sample": [u.churn_reason for u in users if u.churn_reason][:5]
        }


def main():
    print("=" * 80)
    print("🔬 SIMULACIÓN DE RIESGOS REALES: ARQUITECTURA HÍBRIDA (FREE + PAYG + LIVE)")
    print("=" * 80)

    tester = HybridArchitectureStressTester(total_users=2000)

    # Escenario A: Voz Ilimitada sin cuota
    res_unlimited = tester.run_simulation(voice_policy="unlimited_voice")

    # Escenario B: Voz con Cuota Sensata (30 min/mes incluidos en Pro)
    res_capped = tester.run_simulation(voice_policy="capped_30m")

    # Escenario C: Solo Texto Híbrido (Sin Voz Live)
    res_no_voice = tester.run_simulation(voice_policy="no_voice")

    print("\n--- ESCENARIO 1: VOZ ILIMITADA (EL RIESGO OCULTO DE COSTOS) ---")
    print(f"Minutos de voz totales consumidos: {res_unlimited['total_voice_minutes']} mins")
    print(f"Gasto en Gemini Live Voice: ${res_unlimited['cost_gemini_live_voice_usd']} USD/mes (¡Atención!)")
    print(f"Gasto en Texto PAYG: ${res_unlimited['cost_gemini_payg_text_usd']} USD/mes")
    print(f"Costo Total de IA: ${res_unlimited['total_ai_cost_usd']} USD/mes")
    print(f"Ganancia Neta: ${res_unlimited['net_profit_usd']} USD/mes (Margen: {res_unlimited['net_margin_pct']}%)")
    print(f"NPS: {res_unlimited['global_nps']} | Churn: {res_unlimited['churn_rate_pct']}% ({res_unlimited['churn_count']} clientes)")

    print("\n--- ESCENARIO 2: VOZ CON CUOTA SENSATA (30 MINUTOS / MES INCLUIDOS) ---")
    print(f"Minutos de voz totales: {res_capped['total_voice_minutes']} mins")
    print(f"Gasto en Gemini Live Voice: ${res_capped['cost_gemini_live_voice_usd']} USD/mes")
    print(f"Gasto en Texto PAYG: ${res_capped['cost_gemini_payg_text_usd']} USD/mes")
    print(f"Costo Total de IA: ${res_capped['total_ai_cost_usd']} USD/mes")
    print(f"Ganancia Neta: ${res_capped['net_profit_usd']} USD/mes (Margen: {res_capped['net_margin_pct']}%)")
    print(f"NPS: {res_capped['global_nps']} | Churn: {res_capped['churn_rate_pct']}%")

    print("\n--- ANÁLISIS DE FALLAS EN MODELOS FREE PÚBLICOS ---")
    print(f"Usuarios afectados por demoras/timeouts 429 en horas pico: {res_capped['users_affected_by_delays_pct']}%")
    print(f"Usuarios afectados por pérdidas de personalidad/formato: {res_capped['users_affected_by_char_breaks_pct']}%")
    print("Muestra de motivos de quejas:")
    for r in res_capped['reasons_sample']:
        print(f"  • {r}")

    # Save to JSON log
    out_path = os.path.join(os.path.dirname(__file__), "logs", "mirofish_hybrid_risks_study.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({
            "unlimited_voice": res_unlimited,
            "capped_voice": res_capped,
            "no_voice": res_no_voice
        }, f, indent=2, ensure_ascii=False)
    print(f"\n📁 Resultados guardados en: {out_path}")


if __name__ == "__main__":
    main()
