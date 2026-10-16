path = '/home/ubuntu/agente-staging/functional_core.py'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip = False
i = 0
while i < len(lines):
    line = lines[i]
    if "elif 'image' in mime or any(str(file_data.get('name'" in line:
        # We replace the entire block up to "if image_analysis:"
        new_lines.append(line)
        new_lines.append('            image_analysis = ""\n')
        new_lines.append('            if os.getenv("GEMINI_API_KEY"):\n')
        new_lines.append('                try:\n')
        new_lines.append('                    import google.generativeai as genai\n')
        new_lines.append('                    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))\n')
        new_lines.append("                    img_mime = mime if mime.startswith('image/') else 'image/jpeg'\n")
        new_lines.append("                    part = {'mime_type': img_mime, 'data': b64_data}\n")
        new_lines.append('                    prompt = """Eres un auditor documental y clínico experto. Analiza con máxima precisión esta imagen enviada por un cliente:\n\n1. RECETA MÉDICA / ORDEN CLÍNICA (manuscrita o impresa): Extrae diagnóstico/patología indicada, cantidad y tipo de sesiones prescritas (ej: \'10 sesiones de kinesiología\'), datos del paciente y profesional (médico, matrícula, fecha, firma/sello).\n2. COMPROBANTE DE PAGO / TRANSFERENCIA BANCARIA: Extrae monto y moneda exactos, fecha/hora, emisor, destinatario, código de operación / referencia bancaria.\n3. FOTO BORROSA O ILEGIBLE: Si la imagen está desenfocada, tiene sombras o no se distingue con total nitidez un dato crítico (como la firma, el diagnóstico o el monto), señala con precisión qué parte resulta ilegible o dudosa.\n4. OTRO DOCUMENTO O IMAGEN: Describe con exactitud todos los detalles y textos visibles."""\n')
        new_lines.append("                    for mod_name in ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest']:\n")
        new_lines.append('                        try:\n')
        new_lines.append('                            model = genai.GenerativeModel(mod_name)\n')
        new_lines.append('                            response = model.generate_content([prompt, part])\n')
        new_lines.append('                            if response and response.text:\n')
        new_lines.append('                                image_analysis = response.text.strip()\n')
        new_lines.append('                                break\n')
        new_lines.append('                        except Exception as me:\n')
        new_lines.append('                            logger.warning(f"Error con modelo {mod_name}: {me}")\n')
        new_lines.append('                except Exception as e:\n')
        new_lines.append('                    logger.error(f"Error procesando imagen con Gemini Vision: {e}")\n')

        # advance i until "if image_analysis:"
        i += 1
        while i < len(lines) and "if image_analysis:" not in lines[i]:
            i += 1
        continue
    new_lines.append(line)
    i += 1

content = "".join(new_lines)
content = content.replace("model = genai.GenerativeModel('gemini-3.8-flash')", "model = genai.GenerativeModel('gemini-3.5-flash-lite')")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Patch applied cleanly by line scanning!")
