#!/usr/bin/env python3
"""
JARVIS OCI HUNTER v5.0 — Cazador Automatizado Oracle Cloud Always Free
Objetivo: Instancia ARM VM.Standard.A1.Flex (2 OCPUs / 12 GB RAM / 50 GB Boot Volume)
- Escaneo continuo sobre todos los dominios de disponibilidad (ADs).
- Intervalo de reintento prudente: 45 a 60 segundos con jitter anti-patrón.
- Captura limpia de excepciones: 'Out of host capacity' (500) y 'TooManyRequests' (429).
- Validación de Aprovisionamiento Real: Espera estado 'RUNNING' con IP pública antes de alertar.
- Notificación automática a Telegram al confirmar la captura.
"""

import os
import sys
import time
import json
import random
import socket
import warnings

# Suprimir advertencias de dependencias en urllib3/requests para mantener logs limpios
warnings.filterwarnings("ignore")

try:
    import requests
except ImportError:
    requests = None

try:
    import oci
except ImportError:
    oci = None

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Buscar configuración OCI en ~/.oci/config o en el directorio base
HOME_OCI_CONFIG = os.path.expanduser("~/.oci/config")
LOCAL_OCI_CONFIG = os.path.join(BASE_DIR, "oci_config")
CONFIG_PATH = HOME_OCI_CONFIG if os.path.exists(HOME_OCI_CONFIG) else LOCAL_OCI_CONFIG

KEY_PUB_PATH = os.path.join(BASE_DIR, "ampere_key.pub")
CAPTURED_STATE_FILE = os.path.join(BASE_DIR, "hunter_captured_state.json")
LOG_FILE = os.path.join(BASE_DIR, "hunter.log")

CUSTOM_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"

def _cargar_env_local():
    """Carga variables desde el .env del directorio del script (el servicio systemd no lo carga)."""
    ruta = os.path.join(BASE_DIR, ".env")
    if not os.path.exists(ruta):
        return
    with open(ruta, "r", encoding="utf-8") as f:
        for linea in f:
            linea = linea.strip()
            if not linea or linea.startswith("#") or "=" not in linea:
                continue
            clave, valor = linea.split("=", 1)
            clave = clave.replace("export ", "").strip()
            os.environ.setdefault(clave, valor.strip().strip('"').strip("'"))

_cargar_env_local()

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
OWNER_TELEGRAM_ID = os.getenv("OWNER_TELEGRAM_ID") or os.getenv("TELEGRAM_ADMIN_CHAT_ID", "")

# Especificaciones Always Free solicitadas: 2 OCPUs, 12 GB RAM, 50 GB SSD
TARGET_OCPUS = 2.0
TARGET_RAM_GB = 12.0
TARGET_BOOT_GB = 50
TARGET_LABEL = "12GB"
TARGET_SHAPE = "VM.Standard.A1.Flex"

# ─── TELEGRAM NOTIFICATION ───────────────────────────────────────────────────

def enviar_notificacion_telegram(mensaje):
    """Envía alerta de Telegram ÚNICAMENTE ante captura confirmada y en estado RUNNING."""
    if not requests or not TELEGRAM_BOT_TOKEN or not OWNER_TELEGRAM_ID:
        return
    try:
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        payload = {
            "chat_id": OWNER_TELEGRAM_ID,
            "text": mensaje,
            "parse_mode": "Markdown"
        }
        resp = requests.post(url, json=payload, headers={"User-Agent": CUSTOM_USER_AGENT}, timeout=10)
        if resp.status_code == 200:
            print("[Telegram] 🚀 Notificación de captura enviada exitosamente!")
        else:
            print(f"[Telegram] Error enviando alerta: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"[Telegram] Error de red al notificar: {e}")

# ─── GESTIÓN DE ESTADO PERSISTENTE ───────────────────────────────────────────

def cargar_estado():
    if os.path.exists(CAPTURED_STATE_FILE):
        try:
            with open(CAPTURED_STATE_FILE, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def guardar_estado(estado):
    try:
        with open(CAPTURED_STATE_FILE, "w") as f:
            json.dump(estado, f, indent=2)
    except Exception as e:
        print(f"[Estado] Error persistiendo estado: {e}")

# ─── INICIALIZACIÓN CLIENTES OCI ─────────────────────────────────────────────

compute_client = None
identity_client = None
network_client = None
COMPARTMENT_ID = None
SSH_PUBLIC_KEY = None
OCI_DISPONIBLE = False

def inicializar_clientes_oci():
    global compute_client, identity_client, network_client, COMPARTMENT_ID, SSH_PUBLIC_KEY, OCI_DISPONIBLE
    try:
        if not oci:
            raise Exception("El paquete 'oci' de Python no está instalado.")

        if not os.path.exists(CONFIG_PATH):
            raise Exception(f"No se encontró archivo de configuración OCI en: {CONFIG_PATH}")

        cfg = oci.config.from_file(CONFIG_PATH, "DEFAULT")
        cfg["additional_user_agent"] = CUSTOM_USER_AGENT

        compute_client = oci.core.ComputeClient(cfg)
        identity_client = oci.identity.IdentityClient(cfg)
        network_client = oci.core.VirtualNetworkClient(cfg)
        COMPARTMENT_ID = cfg["tenancy"]

        # Buscar clave SSH pública
        if os.path.exists(KEY_PUB_PATH):
            with open(KEY_PUB_PATH, "r") as f:
                SSH_PUBLIC_KEY = f.read().strip()
        else:
            home_key = os.path.expanduser("~/.ssh/authorized_keys")
            if os.path.exists(home_key):
                with open(home_key, "r") as f:
                    SSH_PUBLIC_KEY = f.readline().strip()
            else:
                raise Exception("No se encontró clave pública SSH para aprovisionar.")

        OCI_DISPONIBLE = True
        print("✅ Oracle Cloud SDK inicializado con éxito.")
        return True
    except Exception as e:
        print(f"⚠️ Error inicializando OCI SDK: {e}")
        OCI_DISPONIBLE = False
        return False

# ─── METADATOS Y DESCUBRIMIENTO DINÁMICO ──────────────────────────────────────

_CACHED_SUBNET_ID = None
_CACHED_IMAGE_ID = None
_CACHED_ADS = None

def get_subnet_id():
    subnets = network_client.list_subnets(compartment_id=COMPARTMENT_ID).data
    if not subnets:
        raise Exception("No se encontraron subredes en la VCN.")
    return subnets[0].id

def get_availability_domains():
    ads = identity_client.list_availability_domains(COMPARTMENT_ID).data
    return [ad.name for ad in ads]

def get_latest_ubuntu_arm_image():
    images = compute_client.list_images(
        compartment_id=COMPARTMENT_ID,
        operating_system="Canonical Ubuntu",
        shape=TARGET_SHAPE
    ).data
    if not images:
        images = compute_client.list_images(compartment_id=COMPARTMENT_ID, shape=TARGET_SHAPE).data
    if not images:
        raise Exception("No se encontró imagen ARM de Canonical Ubuntu.")
    images.sort(key=lambda x: x.time_created, reverse=True)
    return images[0].id

def get_cached_metadata():
    global _CACHED_SUBNET_ID, _CACHED_IMAGE_ID, _CACHED_ADS
    if not _CACHED_SUBNET_ID:
        _CACHED_SUBNET_ID = get_subnet_id()
    if not _CACHED_IMAGE_ID:
        _CACHED_IMAGE_ID = get_latest_ubuntu_arm_image()
    if not _CACHED_ADS:
        _CACHED_ADS = get_availability_domains()
    return _CACHED_SUBNET_ID, _CACHED_IMAGE_ID, _CACHED_ADS

def verificar_instancia_real_activa(instance_id):
    """Consulta la API de OCI para verificar si la instancia existe y sigue viva."""
    if not compute_client or not instance_id:
        return False
    try:
        inst = compute_client.get_instance(instance_id).data
        if inst.lifecycle_state in ["PROVISIONING", "RUNNING", "STARTING"]:
            return True
        return False
    except Exception:
        return False

def obtener_ip_publica(instance_id):
    """Busca la IP pública asignada a la VNIC primaria de la instancia."""
    try:
        vnics = compute_client.list_vnic_attachments(compartment_id=COMPARTMENT_ID, instance_id=instance_id).data
        for v in vnics:
            if v.lifecycle_state == "ATTACHED":
                vnic = network_client.get_vnic(v.vnic_id).data
                if vnic.public_ip:
                    return vnic.public_ip
    except Exception:
        pass
    return "En asignación..."

def intentar_lanzar_instancia(ad, subnet_id, image_id, ocpus, memory_gb, boot_gb, name):
    request = oci.core.models.LaunchInstanceDetails(
        compartment_id=COMPARTMENT_ID,
        availability_domain=ad,
        shape=TARGET_SHAPE,
        shape_config=oci.core.models.LaunchInstanceShapeConfigDetails(ocpus=ocpus, memory_in_gbs=memory_gb),
        source_details=oci.core.models.InstanceSourceViaImageDetails(image_id=image_id, boot_volume_size_in_gbs=boot_gb),
        create_vnic_details=oci.core.models.CreateVnicDetails(subnet_id=subnet_id, assign_public_ip=True),
        metadata={"ssh_authorized_keys": SSH_PUBLIC_KEY},
        display_name=name
    )
    response = compute_client.launch_instance(request)
    return response.data.id

# ─── CICLO PRINCIPAL DE CACERÍA ──────────────────────────────────────────────

def hunt_oracle_ciclo():
    if not OCI_DISPONIBLE:
        if not inicializar_clientes_oci():
            print("[OCI] SDK no disponible aún. Reintentando inicialización...")
            time.sleep(30)
            return False

    try:
        estado = cargar_estado()
        capturados = estado.get("capturados", [])

        # Auditar si la captura guardada realmente existe y sigue corriendo en OCI
        for label in list(capturados):
            detalles = estado.get(label, {})
            inst_id = detalles.get("instance_id")
            if not verificar_instancia_real_activa(inst_id):
                print(f"[Auditoría] La instancia '{label}' ({inst_id}) no está activa en OCI. Reanudando cacería...")
                capturados.remove(label)
                if label in estado:
                    del estado[label]
                estado["capturados"] = capturados
                guardar_estado(estado)

        if TARGET_LABEL in capturados:
            print(f"[Oracle] 🏆 ¡Instancia {TARGET_LABEL} ya capturada y confirmada en RUNNING!")
            return True

        pendiente = estado.get("pendiente")
        if pendiente and pendiente.get("instance_id"):
            try:
                inst_p = compute_client.get_instance(pendiente["instance_id"]).data
                st_p = inst_p.lifecycle_state
            except Exception as e:
                print(f"[Pendiente] No se pudo consultar la instancia pendiente: {e}")
                return False
            if st_p == "RUNNING":
                ip_p = obtener_ip_publica(pendiente["instance_id"])
                estado["pendiente"] = None
                c_p = estado.get("capturados", [])
                if TARGET_LABEL not in c_p:
                    c_p.append(TARGET_LABEL)
                estado["capturados"] = c_p
                estado[TARGET_LABEL] = {"instance_id": pendiente["instance_id"], "ad": pendiente.get("ad"), "ip_publica": ip_p, "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")}
                guardar_estado(estado)
                enviar_notificacion_telegram(
                    "🎉 *¡INSTANCIA ORACLE ARM 12 GB CAPTURADA Y ACTIVA!*\n\n"
                    f"🌐 *IP Pública:* `{ip_p}`\n🆔 *Instance ID:* `{pendiente['instance_id']}`"
                )
                return True
            if st_p in ("TERMINATING", "TERMINATED"):
                print(f"[Pendiente] Oracle terminó la instancia pendiente ({st_p}). Se reanuda la cacería.")
                estado["pendiente"] = None
                guardar_estado(estado)
            else:
                print(f"[Pendiente] Instancia {pendiente['instance_id']} en estado {st_p}. Espero antes de lanzar otra.")
                return False

        subnet_id, image_id, ads = get_cached_metadata()

        for ad in ads:
            ad_short = ad.split(":")[-1]
            now_str = time.strftime("%H:%M:%S")

            try:
                instance_name = f"JARVIS-ARM-{TARGET_LABEL}"
                instance_id = intentar_lanzar_instancia(
                    ad, subnet_id, image_id, TARGET_OCPUS, TARGET_RAM_GB, TARGET_BOOT_GB, instance_name
                )

                print(f"\n⚡ [{now_str}] ¡SOLICITUD ACEPTADA POR ORACLE! Instance ID: {instance_id}")
                print(f"⏳ Verificando en {ad_short} (esperando estado RUNNING con IP pública)...")

                confirmada = False
                for intento_wait in range(25):
                    time.sleep(6)
                    try:
                        inst = compute_client.get_instance(instance_id).data
                        if inst.lifecycle_state == "RUNNING":
                            confirmada = True
                            break
                        elif inst.lifecycle_state in ["TERMINATING", "TERMINATED"]:
                            print(f"❌ Oracle canceló la instancia durante la creación (Estado: {inst.lifecycle_state}).")
                            break
                        else:
                            print(f"    ... estado actual: {inst.lifecycle_state}")
                    except Exception:
                        pass

                if not confirmada:
                    print("⚠️ La instancia no completó el ciclo RUNNING. Se verificará en el próximo ciclo antes de lanzar otra.")
                    estado_pend = cargar_estado()
                    estado_pend["pendiente"] = {"instance_id": instance_id, "ad": ad_short, "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")}
                    guardar_estado(estado_pend)
                    return False

                # ¡CAPTURA 100% CONFIRMADA Y VIVA!
                ip_publica = obtener_ip_publica(instance_id)
                print("\n" + "=" * 60)
                print("🎉 ¡INSTANCIA ARM 12 GB CONFIRMADA Y ACTIVA!")
                print(f"ID: {instance_id} | Zona: {ad_short} | IP: {ip_publica}")
                print("=" * 60 + "\n")

                estado_actual = cargar_estado()
                c_list = estado_actual.get("capturados", [])
                if TARGET_LABEL not in c_list:
                    c_list.append(TARGET_LABEL)
                estado_actual["capturados"] = c_list
                estado_actual[TARGET_LABEL] = {
                    "instance_id": instance_id,
                    "ad": ad_short,
                    "ip_publica": ip_publica,
                    "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
                }
                guardar_estado(estado_actual)

                msg = (
                    "🎉 *¡INSTANCIA ORACLE ARM 12 GB CAPTURADA Y ACTIVA!*\n\n"
                    f"⚡ *Especificaciones:* 2 OCPUs · 12 GB RAM · {TARGET_BOOT_GB} GB SSD\n"
                    f"🌐 *IP Pública:* `{ip_publica}`\n"
                    f"📍 *Zona:* `{ad_short}`\n"
                    f"🆔 *Instance ID:* `{instance_id}`\n"
                    f"⏰ *Hora:* `{time.strftime('%Y-%m-%d %H:%M:%S')}`\n\n"
                    "✅ _El servidor está en estado RUNNING en Oracle Cloud y listo para operar._"
                )
                enviar_notificacion_telegram(msg)
                return True

            except oci.exceptions.ServiceError as oci_err:
                err_msg = oci_err.message or str(oci_err)
                if oci_err.status == 500 or "Out of host capacity" in err_msg or "Out of capacity" in err_msg:
                    print(f"[{now_str}] 🎯 [{ad_short}] Sin capacidad libre para 12GB (Out of host capacity).")
                elif oci_err.status == 429 or "TooManyRequests" in err_msg:
                    print(f"[{now_str}] ⚠️ Rate limit 429 detectado. Pausando 120s por seguridad...")
                    time.sleep(random.uniform(110.0, 130.0))
                    return False
                elif oci_err.status in [401, 403]:
                    print(f"[{now_str}] ⚠️ Error de autenticación OCI ({oci_err.status}): {err_msg[:80]}")
                    time.sleep(60)
                    return False
                else:
                    print(f"[{now_str}] ℹ️ [{ad_short}] Respuesta Oracle ({oci_err.status}): {err_msg[:80]}")

            except Exception as e:
                err_str = str(e)
                if "Out of host capacity" in err_str or "Out of capacity" in err_str:
                    print(f"[{now_str}] 🎯 [{ad_short}] Sin capacidad libre para 12GB (Out of host capacity).")
                elif "429" in err_str:
                    print(f"[{now_str}] ⚠️ Rate limit 429 detectado. Pausando 120s por seguridad...")
                    time.sleep(random.uniform(110.0, 130.0))
                    return False
                else:
                    print(f"[{now_str}] ℹ️ [{ad_short}] Error: {err_str[:80]}")

            # Pausa de seguridad sutil entre cada AD
            time.sleep(random.uniform(2.5, 4.0))

        return False

    except (socket.error, Exception) as net_err:
        print(f"[Red] Evento de red o conexión: {net_err}")
        time.sleep(15)
        return False

# ─── BUCLE PRINCIPAL CON JITTER SEGURO (45 - 60s) ───────────────────────────

if __name__ == "__main__":
    print("=" * 65)
    print("🚀 INICIANDO JARVIS OCI HUNTER v5.0")
    print(f"🎯 Objetivo: {TARGET_SHAPE} · {TARGET_OCPUS} OCPUs · {TARGET_RAM_GB} GB RAM · {TARGET_BOOT_GB} GB SSD")
    print("⏱️  Frecuencia: Reintentos cada 45 a 60 segundos con jitter anti-patrón")
    print("🛡️  Manejo: Tolerancia a 'Out of host capacity' sin interrupción de bucle")
    print("📱 Alerta Telegram: Disparo automático tras confirmación RUNNING con IP")
    print("=" * 65)

    inicializar_clientes_oci()

    # Reset de estado inicial si no hay instancia viva en OCI
    estado_ini = cargar_estado()
    if TARGET_LABEL in estado_ini.get("capturados", []):
        inst_id = estado_ini.get(TARGET_LABEL, {}).get("instance_id")
        if not verificar_instancia_real_activa(inst_id):
            print("🔄 Purgando registro local obsoleto para activar cacería real...")
            guardar_estado({})

    intentos = 0
    while True:
        intentos += 1
        capturado = hunt_oracle_ciclo()
        if capturado:
            print("\n🏆 ¡MISIÓN CUMPLIDA! Servidor ARM 12 GB capturado exitosamente.")
            break

        pausa = random.uniform(45.0, 60.0)
        now_str = time.strftime("%H:%M:%S")
        print(f"[{now_str}] ⏳ Ciclo #{intentos} finalizado. Próximo escaneo en {pausa:.1f}s...")
        time.sleep(pausa)
