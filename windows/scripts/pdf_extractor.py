"""
=============================================================================
COCO SQUAD — Extractor Universal de PDF y Documentos en Memoria RAM
=============================================================================
Extrae el texto plano real de archivos PDF en memoria RAM utilizando de forma
jerárquica:
1. pypdf (estándar moderno de alto rendimiento)
2. pdfplumber (análisis tipográfico y tablas complejas)
3. pymupdf / fitz (renderizado y parsing de streams binarios)
4. PyPDF2 (fallback legado)
5. Gemini Flash OCR en memoria (si las librerías locales no detectan texto seleccionable)

REGLA DE ORO: Si no hay extracción de texto real, no se responde ni se
disparan búsquedas web genéricas para evitar alucinaciones.
=============================================================================
"""

import io
import os
import base64
import logging
from typing import Optional, Tuple

logger = logging.getLogger("pdf_extractor")

def extract_text_from_pdf_bytes(pdf_bytes: bytes, filename: str = "documento.pdf", max_chars: int = 50000) -> Tuple[str, str]:
    """
    Extrae texto plano real de un buffer en memoria RAM de un PDF.
    Retorna (texto_extraido, metodo_utilizado).
    Si el documento no tiene texto seleccionable o está protegido/vacío, retorna ("", "fallo").
    """
    if not pdf_bytes or len(pdf_bytes) < 10:
        return "", "buffer_vacio"

    extracted_pages = []

    # ── MÉTODO 1: pypdf ────────────────────────────────────────────────────────
    try:
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        num_pages = len(reader.pages)
        for i, page in enumerate(reader.pages):
            page_text = page.extract_text() or ""
            if page_text.strip():
                extracted_pages.append(f"[Página {i+1}]:\n{page_text.strip()}")
            if sum(len(p) for p in extracted_pages) >= max_chars:
                break
        
        full_text = "\n\n".join(extracted_pages).strip()
        if len(full_text) >= 40:
            logger.info(f"✅ [pypdf] Extraídos {len(full_text)} caracteres de {num_pages} páginas ({filename})")
            return full_text[:max_chars], "pypdf"
    except Exception as e:
        logger.warning(f"⚠️ [pypdf] Falló en {filename}: {e}")

    # ── MÉTODO 2: pdfplumber ───────────────────────────────────────────────────
    extracted_pages.clear()
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            num_pages = len(pdf.pages)
            for i, page in enumerate(pdf.pages):
                page_text = page.extract_text() or ""
                if page_text.strip():
                    extracted_pages.append(f"[Página {i+1}]:\n{page_text.strip()}")
                if sum(len(p) for p in extracted_pages) >= max_chars:
                    break
        
        full_text = "\n\n".join(extracted_pages).strip()
        if len(full_text) >= 40:
            logger.info(f"✅ [pdfplumber] Extraídos {len(full_text)} caracteres de {num_pages} páginas ({filename})")
            return full_text[:max_chars], "pdfplumber"
    except Exception as e:
        logger.warning(f"⚠️ [pdfplumber] Falló en {filename}: {e}")

    # ── MÉTODO 3: pymupdf / fitz ───────────────────────────────────────────────
    extracted_pages.clear()
    try:
        import pymupdf
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        num_pages = len(doc)
        for i, page in enumerate(doc):
            page_text = page.get_text() or ""
            if page_text.strip():
                extracted_pages.append(f"[Página {i+1}]:\n{page_text.strip()}")
            if sum(len(p) for p in extracted_pages) >= max_chars:
                break
        
        full_text = "\n\n".join(extracted_pages).strip()
        if len(full_text) >= 40:
            logger.info(f"✅ [pymupdf] Extraídos {len(full_text)} caracteres de {num_pages} páginas ({filename})")
            return full_text[:max_chars], "pymupdf"
    except Exception as e:
        logger.warning(f"⚠️ [pymupdf] Falló en {filename}: {e}")

    # ── MÉTODO 4: PyPDF2 fallback legado ───────────────────────────────────────
    extracted_pages.clear()
    try:
        import PyPDF2
        reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
        for i, page in enumerate(reader.pages):
            page_text = page.extract_text() or ""
            if page_text.strip():
                extracted_pages.append(f"[Página {i+1}]:\n{page_text.strip()}")
            if sum(len(p) for p in extracted_pages) >= max_chars:
                break
        
        full_text = "\n\n".join(extracted_pages).strip()
        if len(full_text) >= 40:
            logger.info(f"✅ [PyPDF2] Extraídos {len(full_text)} caracteres ({filename})")
            return full_text[:max_chars], "pypdf2"
    except Exception as e:
        logger.warning(f"⚠️ [PyPDF2] Falló en {filename}: {e}")

    # ── MÉTODO 5: Gemini Multimodal Vision / OCR en memoria ────────────────────
    gemini_key = os.getenv("GEMINI_API_KEY", "")
    if gemini_key:
        try:
            import google.generativeai as genai
            genai.configure(api_key=gemini_key)
            for mod_name in ['gemini-flash-latest', 'gemini-pro-latest']:
                try:
                    model = genai.GenerativeModel(mod_name)
                    part = {"mime_type": "application/pdf", "data": pdf_bytes}
                    prompt = (
                        "Actúa como analista y transcriptor académico. Extrae y describe detalladamente "
                        "el contenido conceptual, títulos, secciones, numeraciones (ej. punto 1.6, etc.) "
                        "y argumentos desarrollados por el autor en este documento escaneado para estudio."
                    )
                    resp = model.generate_content([part, prompt])
                    ocr_text = ""
                    try:
                        if resp and resp.text:
                            ocr_text = resp.text.strip()
                    except Exception:
                        if resp and resp.candidates and resp.candidates[0].content and resp.candidates[0].content.parts:
                            ocr_text = "".join(p.text for p in resp.candidates[0].content.parts if hasattr(p, "text")).strip()

                    if ocr_text and len(ocr_text) >= 40:
                        logger.info(f"✅ [Gemini OCR {mod_name}] Extraídos {len(ocr_text)} caracteres ({filename})")
                        return ocr_text[:max_chars], f"gemini_{mod_name}"
                except Exception as g_err:
                    logger.warning(f"⚠️ [Gemini OCR {mod_name}] error: {g_err}")
        except Exception as gem_ex:
            logger.warning(f"⚠️ [Gemini Config] error: {gem_ex}")

    logger.error(f"❌ Imposible extraer texto legible de {filename} tras agotar todos los parsers en memoria.")
    return "", "sin_texto_seleccionable"


def extract_text_from_file_data(file_data: dict, max_chars: int = 50000) -> Tuple[str, str]:
    """
    Recibe el diccionario file_data (name, base64, data, mime) y extrae su texto plano.
    """
    if not file_data or not isinstance(file_data, dict):
        return "", "no_file_data"

    filename = file_data.get("name") or file_data.get("filename") or "documento.pdf"
    b64_raw = file_data.get("data") or file_data.get("base64") or ""
    if not b64_raw:
        return "", "no_b64"

    if "," in b64_raw:
        b64_raw = b64_raw.split(",")[1]

    try:
        raw_bytes = base64.b64decode(b64_raw)
    except Exception as e:
        logger.error(f"Error decodificando base64 de {filename}: {e}")
        return "", "b64_corrupto"

    lower_name = filename.lower()
    mime = (file_data.get("mime") or "").lower()

    if lower_name.endswith(".pdf") or "pdf" in mime:
        return extract_text_from_pdf_bytes(raw_bytes, filename=filename, max_chars=max_chars)

    # Texto plano, markdown, CSV, JSON
    if any(lower_name.endswith(ext) for ext in [".txt", ".md", ".csv", ".json", ".log", ".yaml", ".yml"]):
        try:
            text = raw_bytes.decode("utf-8", errors="replace")
            return text[:max_chars], "plain_text"
        except Exception as e:
            logger.warning(f"Error decodificando texto plano: {e}")

    return "", "formato_no_soportado"
