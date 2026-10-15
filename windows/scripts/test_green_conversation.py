#!/usr/bin/env python3
import json
import urllib.request

API_URL = "http://150.136.59.173:8080/api/chat"

def send_chat(msg: str, coco_id: str = "verde", file_data: dict = None) -> dict:
    payload = {
        "message": msg,
        "chat_id": "test_green_sim",
        "tenant_id": 1,
        "coco_id": coco_id,
        "file": file_data
    }
    req = urllib.request.Request(
        API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))

print("=== PRUEBA 1: Consulta comercial y agenda (Doble Alternativa) ===")
res1 = send_chat("Hola! Quería consultar qué servicios ofrecen y si tienen algún turno disponible para esta semana.")
print("Respuesta Green:")
print(res1.get("reply") or res1.get("respuesta"))
print("Metadatos:", json.dumps(res1.get("metadatos", {}), indent=2, ensure_ascii=False))
print("-" * 60)

print("\n=== PRUEBA 2: Solicitud de intervención humana ===")
res2 = send_chat("Perfecto, pero para coordinar el caso prefiero hablar con un asesor o una persona humana, por favor.")
print("Respuesta Green:")
print(res2.get("reply") or res2.get("respuesta"))
print("Metadatos:", json.dumps(res2.get("metadatos", {}), indent=2, ensure_ascii=False))
print("-" * 60)

print("\n=== PRUEBA 3: Recepción y verificación de comprobante de pago ===")
res3 = send_chat("Hola Green! Ya hice la transferencia de $18.500 para confirmar la reserva. El comprobante tiene código de operación TRX-98472.")
print("Respuesta Green:")
print(res3.get("reply") or res3.get("respuesta"))
print("Metadatos:", json.dumps(res3.get("metadatos", {}), indent=2, ensure_ascii=False))
print("-" * 60)
