"""
Parche quirúrgico para functional_core.py en el servidor Oracle Staging:
1. Inyecta extracción de PDF con pdf_extractor en _procesar_archivo_sincrono
2. Desactiva web_search_param si hay documento adjunto o activo en mensaje
3. Sanitiza la respuesta con clean_prompt_artifacts
"""
import re
import sys

def patch_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        code = f.read()

    # 1. Parchear _procesar_archivo_sincrono para usar pdf_extractor
    old_pdf_block = """        if 'pdf' in mime:
            pdf_text = ""
            try:
                import PyPDF2
                reader = PyPDF2.PdfReader(BytesIO(raw_bytes))
                for page in reader.pages:
                    txt = page.extract_text()
                    if txt:
                        pdf_text += txt + "\n"
            except Exception:
                pass"""

    new_pdf_block = """        if 'pdf' in mime or (file_data.get('name') and file_data.get('name').lower().endswith('.pdf')):
            pdf_text = ""
            try:
                from pdf_extractor import extract_text_from_file_data
                extracted_ram, m_method = extract_text_from_file_data(file_data)
                if extracted_ram:
                    pdf_text = extracted_ram
            except Exception as e_ext:
                pass
            if not pdf_text:
                try:
                    import PyPDF2
                    reader = PyPDF2.PdfReader(BytesIO(raw_bytes))
                    for page in reader.pages:
                        txt = page.extract_text()
                        if txt:
                            pdf_text += txt + "\\n"
                except Exception:
                    pass"""

    if old_pdf_block in code:
        code = code.replace(old_pdf_block, new_pdf_block)
        print("✅ Parche 1 aplicado: pdf_extractor en _procesar_archivo_sincrono")
    else:
        print("⚠️ Parche 1: no se encontró bloque exacto, intentando regex...")
        code = re.sub(
            r"if 'pdf' in mime:\s+pdf_text = \"\"\s+try:\s+import PyPDF2[\s\S]+?except Exception:\s+pass",
            new_pdf_block,
            code
        )
        print("✅ Parche 1 aplicado vía regex")

    # 2. Desactivar web_search si hay documento en procesar_mensaje_funcional
    old_search_block = """    session_id = f"{tenant_id}_{user_id}"
    import asyncio
    perfil = asyncio.run(get_patient_profile(session_id))

    mensaje_final = mensaje
    if perfil:
        mensaje_final = f"[PERFIL DEL USUARIO: {perfil}]\\n\\n{mensaje}"
    if web_search_param:"""

    new_search_block = """    session_id = f"{tenant_id}_{user_id}"
    import asyncio
    perfil = asyncio.run(get_patient_profile(session_id))

    # REGLA ESTRICTA: Si hay documento adjunto o previo, forzar web_search_param = False
    if file_data or "Documento PDF adjunto" in mensaje or "DOCUMENTO ADJUNTO" in mensaje or "DOCUMENTO PREVIO" in mensaje:
        web_search_param = False

    mensaje_final = mensaje
    if perfil:
        mensaje_final = f"[PERFIL DEL USUARIO: {perfil}]\\n\\n{mensaje}"
    if web_search_param:"""

    if old_search_block in code:
        code = code.replace(old_search_block, new_search_block)
        print("✅ Parche 2 aplicado: forzar web_search_param = False en procesar_mensaje_funcional")
    else:
        print("⚠️ Parche 2: intentando regex...")
        code = re.sub(
            r"(session_id = f\"\{tenant_id\}_\{user_id\}\"[\s\S]+?perfil = asyncio\.run\(get_patient_profile\(session_id\)\)\s+)(mensaje_final = mensaje)",
            r"\1# REGLA ESTRICTA: Si hay documento adjunto o previo, forzar web_search_param = False\n    if file_data or 'Documento PDF adjunto' in mensaje or 'DOCUMENTO ADJUNTO' in mensaje or 'DOCUMENTO PREVIO' in mensaje:\n        web_search_param = False\n\n    \2",
            code
        )
        print("✅ Parche 2 aplicado vía regex")

    # 3. Limpieza de artefactos antes de retornar
    old_return_block = """        import threading
        threading.Thread(target=run_profile_extraction_async, args=(user_id, session_id), daemon=True).start()
        
        return respuesta"""

    new_return_block = """        import threading
        threading.Thread(target=run_profile_extraction_async, args=(user_id, session_id), daemon=True).start()
        
        try:
            from session_memory import clean_prompt_artifacts
            respuesta = clean_prompt_artifacts(respuesta)
        except Exception:
            pass

        return respuesta"""

    if old_return_block in code:
        code = code.replace(old_return_block, new_return_block)
        print("✅ Parche 3 aplicado: clean_prompt_artifacts en functional_core")
    else:
        print("⚠️ Parche 3: intentando regex...")
        code = re.sub(
            r"(threading\.Thread\(target=run_profile_extraction_async[^\)]+\)\.start\(\)\s+)(return respuesta)",
            r"\1try:\n            from session_memory import clean_prompt_artifacts\n            respuesta = clean_prompt_artifacts(respuesta)\n        except Exception:\n            pass\n\n        \2",
            code
        )
        print("✅ Parche 3 aplicado vía regex")

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(code)
    print("💾 functional_core.py guardado exitosamente.")

if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "/home/ubuntu/agente-staging/functional_core.py"
    patch_file(path)
