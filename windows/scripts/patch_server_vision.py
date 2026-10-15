import os
import re

# 1. Patch functional_core.py
core_path = '/home/ubuntu/agente-staging/functional_core.py'
with open(core_path, 'r', encoding='utf-8') as f:
    core_code = f.read()

old_block = """        elif 'pdf' in mime or 'image' in mime:
            pdf_text = ""
            if 'pdf' in mime:
                try:
                    import PyPDF2
                    reader = PyPDF2.PdfReader(BytesIO(raw_bytes))
                    for page in reader.pages:
                        txt = page.extract_text()
                        if txt:
                            pdf_text += txt + "\\n"
                except Exception:
                    pass
            if not pdf_text.strip() and os.getenv("GEMINI_API_KEY"):
                try:
                    import google.generativeai as genai
                    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
                    ext = ".pdf" if 'pdf' in mime else ".jpg"
                    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp_f:
                        tmp_f.write(raw_bytes)
                        tmp_filename = tmp_f.name
                    model = genai.GenerativeModel('gemini-1.5-flash')
                    response = model.generate_content([genai.upload_file(tmp_filename), "Extrae el texto completo o describe la imagen en detalle."])
                    pdf_text = response.text
                    os.remove(tmp_filename)
                except Exception:
                    pass
            if pdf_text:
                mensaje += f"\\n\\n[Documento adjunto - contenido extraído]:\\n{pdf_text[:8000]}\""""

new_block = """        elif 'image' in mime or any(str(file_data.get('name', '')).lower().endswith(ext) for ext in ('.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp')):
            image_analysis = ""
            if os.getenv("GEMINI_API_KEY"):
                try:
                    import google.generativeai as genai
                    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
                    model = genai.GenerativeModel('gemini-3.8-flash')
                    img_mime = mime if mime.startswith('image/') else 'image/jpeg'
                    part = {'mime_type': img_mime, 'data': b64_data}
                    prompt = "Analiza detalladamente esta imagen, describe con precisión todo lo que ves (elementos visuales, colores, detalles, contexto clínico o técnico si aplica) y extrae cualquier texto, número o dato relevante visible."
                    response = model.generate_content([prompt, part])
                    if response and response.text:
                        image_analysis = response.text.strip()
                except Exception as e:
                    logger.error(f"Error procesando imagen con Gemini Vision: {e}")
            if image_analysis:
                mensaje += f"\\n\\n[ANÁLISIS VISUAL DE LA IMAGEN ADJUNTA ({file_data.get('name', 'imagen')}):\\n{image_analysis}]\\n\\n[INSTRUCCIÓN]: El usuario envió esta imagen adjunta. Tienes arriba su análisis visual directo. Responde a sus preguntas y explica los detalles con precisión, sin decir jamás que no puedes ver archivos adjuntos."
            else:
                mensaje += f"\\n\\n[Imagen adjunta recibida: {file_data.get('name', 'imagen')}]"

        elif 'pdf' in mime or str(file_data.get('name', '')).lower().endswith('.pdf'):
            pdf_text = ""
            try:
                import PyPDF2
                reader = PyPDF2.PdfReader(BytesIO(raw_bytes))
                for page in reader.pages:
                    txt = page.extract_text()
                    if txt:
                        pdf_text += txt + "\\n"
            except Exception:
                pass
            if not pdf_text.strip() and os.getenv("GEMINI_API_KEY"):
                try:
                    import google.generativeai as genai
                    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
                    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_f:
                        tmp_f.write(raw_bytes)
                        tmp_filename = tmp_f.name
                    model = genai.GenerativeModel('gemini-3.8-flash')
                    response = model.generate_content([genai.upload_file(tmp_filename), "Extrae el texto completo y resume los puntos clave de este documento PDF."])
                    pdf_text = response.text
                    os.remove(tmp_filename)
                except Exception as e:
                    logger.error(f"Error extrayendo PDF con Gemini: {e}")
            if pdf_text:
                mensaje += f"\\n\\n[Documento PDF adjunto ({file_data.get('name', 'documento')}) - contenido extraído]:\\n{pdf_text[:12000]}\""""

if old_block in core_code:
    core_code = core_code.replace(old_block, new_block)
    with open(core_path, 'w', encoding='utf-8') as f:
        f.write(core_code)
    print("✓ functional_core.py successfully patched!")
else:
    print("Notice: old_block not found in functional_core.py, checking if already patched...")
    if "gemini-3.8-flash" in core_code:
        print("✓ functional_core.py already contains gemini-3.8-flash!")
    else:
        print("ERROR: could not locate block in functional_core.py")

# 2. Patch api/routers/chat.py
chat_path = '/home/ubuntu/agente-staging/api/routers/chat.py'
with open(chat_path, 'r', encoding='utf-8') as f:
    chat_code = f.read()

target_chat = """    file_data = data.get('file', None)
    mode_req = data.get('mode', 'recepcion')
    tenant_id = int(data.get('tenant_id', 1))
    web_search = data.get('web_search', False)

    if mode_req == 'recepcion' or str(data.get('chat_id', '')).startswith('rec_'):
        tenant_id = 1

    modo_tutor = (mode_req == 'tutor_astra' or mode_req == 'academico')
    active_engine = get_tenant_engine(tenant_id)

    coco_id = data.get('coco_id') or 'coco_blanco'
    todos = data.get('todos', [])
    notes = data.get('notes', [])

    if not file_data and 'contexto' in data and isinstance(data['contexto'], dict):
        ctx = data['contexto']
        b64 = ctx.get('archivo_base64')
        if b64:
            nombre = ctx.get('nombre', 'documento.txt')
            mime = 'application/pdf' if nombre.endswith('.pdf') else ('image/jpeg' if nombre.endswith(('.png', '.jpg', '.jpeg')) else 'text/plain')
            file_data = {'data': b64, 'name': nombre, 'mime': mime}

    if not user_msg and not file_data:
        raise HTTPException(status_code=400, detail="Mensaje vacio")"""

replacement_chat = """    file_data = data.get('file', None)
    mode_req = data.get('mode', 'recepcion')
    tenant_id = int(data.get('tenant_id', 1))
    web_search = data.get('web_search', False)

    if mode_req == 'recepcion' or str(data.get('chat_id', '')).startswith('rec_'):
        tenant_id = 1

    modo_tutor = (mode_req == 'tutor_astra' or mode_req == 'academico')
    active_engine = get_tenant_engine(tenant_id)

    coco_id = data.get('coco_id') or 'coco_blanco'
    todos = data.get('todos', [])
    notes = data.get('notes', [])

    if not file_data and 'contexto' in data and isinstance(data['contexto'], dict):
        ctx = data['contexto']
        b64 = ctx.get('archivo_base64') or ctx.get('base64')
        if b64:
            nombre = ctx.get('nombre') or ctx.get('name') or 'documento.txt'
            mime = 'application/pdf' if nombre.endswith('.pdf') else ('image/jpeg' if nombre.endswith(('.png', '.jpg', '.jpeg', '.webp')) else 'text/plain')
            file_data = {'data': b64, 'name': nombre, 'mime': mime}

    if not file_data:
        b64 = data.get('attachment') or data.get('image')
        if b64:
            nombre = data.get('filename') or data.get('name') or 'imagen.jpg'
            mime = data.get('mime_type') or data.get('mime') or ('image/jpeg' if nombre.endswith(('.png', '.jpg', '.jpeg', '.webp')) else 'application/octet-stream')
            file_data = {'data': b64, 'name': nombre, 'mime': mime}

    if not user_msg and file_data:
        if 'image' in str(file_data.get('mime', '')) or any(str(file_data.get('name', '')).lower().endswith(ext) for ext in ('.png', '.jpg', '.jpeg', '.webp', '.gif')):
            user_msg = "Analiza detalladamente esta imagen, describe qué ves y extrae cualquier texto o dato relevante."
        else:
            user_msg = f"Analiza detalladamente este archivo ({file_data.get('name', 'adjunto')}) y resume sus puntos clave."

    if not user_msg and not file_data:
        raise HTTPException(status_code=400, detail="Mensaje vacio")"""

if target_chat in chat_code:
    chat_code = chat_code.replace(target_chat, replacement_chat)
    with open(chat_path, 'w', encoding='utf-8') as f:
        f.write(chat_code)
    print("✓ api/routers/chat.py successfully patched!")
else:
    print("Notice: target_chat not found in api/routers/chat.py, checking if already patched...")
    if "Analiza detalladamente esta imagen" in chat_code:
        print("✓ api/routers/chat.py already patched!")
    else:
        print("ERROR: could not locate block in api/routers/chat.py")
