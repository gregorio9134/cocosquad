#!/usr/bin/env python3
"""
test_green_vision_scenarios.py
Prueba los 3 escenarios clave solicitados por el usuario para Green:
1. Detección de Receta Médica / Orden Clínica con guiado a turnos (Doble Alternativa).
2. Detección y verificación de Comprobante de Pago.
3. Detección y manejo pedagógico de Foto Borrosa o Ilegible.
"""

import json
import urllib.request

API_URL = "http://150.136.59.173:8080/api/chat"

def query_green(msg: str, file_payload: dict = None) -> dict:
    payload = {
        "message": msg,
        "chat_id": "test_green_vision_sim",
        "tenant_id": 1,
        "coco_id": "verde",
        "file": file_payload
    }
    req = urllib.request.Request(
        API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))

print("==================================================================")
print("TEST 1: RECETA MÉDICA / ORDEN CLÍNICA")
print("==================================================================")
# Simulamos una orden clínica escaneada/adjunta
msg_receta = (
    "[ANÁLISIS DOCUMENTAL VISUAL DE LA IMAGEN (receta_orden_kinesio.jpg)]:\n"
    "- Tipo: Receta médica de derivación traumatológica.\n"
    "- Paciente: Martín Domínguez, DNI 34.892.110.\n"
    "- Diagnóstico: Lumbalgia mecánica aguda con contractura paravertebral.\n"
    "- Prescripción: 10 sesiones de fisioterapia y kinesiología motora.\n"
    "- Profesional: Dra. Marcela Gómez, Matrícula Nacional 88.421.\n"
    "- Fecha y validez: 14 de octubre de 2026, orden vigente con firma y sello."
)
res1 = query_green(msg_receta)
print("Respuesta Green:")
print(res1.get("reply") or res1.get("respuesta"))
print("Metadatos:", json.dumps(res1.get("metadatos", {}), indent=2, ensure_ascii=False))

print("\n==================================================================")
print("TEST 2: COMPROBANTE DE PAGO BANCARIO")
print("==================================================================")
msg_pago = (
    "[ANÁLISIS DOCUMENTAL VISUAL DE LA IMAGEN (comprobante_banco.png)]:\n"
    "- Tipo: Comprobante de transferencia inmediata.\n"
    "- Monto: $22.000 ARS.\n"
    "- Fecha y hora: 15/10/2026 14:15 hs.\n"
    "- Emisor: Laura Benítez (Banco Santander).\n"
    "- Destinatario: Centro Médico Integral (Alias: centro.kinesio.pago).\n"
    "- Código de operación: #TRX-8849201."
)
res2 = query_green(msg_pago)
print("Respuesta Green:")
print(res2.get("reply") or res2.get("respuesta"))
print("Metadatos:", json.dumps(res2.get("metadatos", {}), indent=2, ensure_ascii=False))

print("\n==================================================================")
print("TEST 3: FOTO BORROSA O ILEGIBLE")
print("==================================================================")
msg_borrosa = (
    "[ANÁLISIS DOCUMENTAL VISUAL DE LA IMAGEN (foto_receta_oscura.jpg)]:\n"
    "- Tipo: Fotografía de documento con iluminación precaria y desenfoque severo.\n"
    "- Problema: La imagen está fuera de foco y tiene un reflejo de flash sobre el centro.\n"
    "- Datos ilegibles: No se puede leer el diagnóstico manuscrito ni la cantidad de sesiones indicada. La firma y matrícula inferior aparecen cortadas."
)
res3 = query_green(msg_borrosa)
print("Respuesta Green:")
print(res3.get("reply") or res3.get("respuesta"))
print("Metadatos:", json.dumps(res3.get("metadatos", {}), indent=2, ensure_ascii=False))
