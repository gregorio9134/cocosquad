// Coco Squad Mobile — extracción de texto de documentos dentro del dispositivo.
// El PDF o texto se lee en el navegador; el servidor solo recibe el texto resultante
// y no guarda el documento. Los PDFs escaneados (sin capa de texto) devuelven null
// para que el flujo de siempre (OCR en el servidor) los siga procesando.

import * as pdfjs from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export const MAX_DOCUMENT_CHARS = 25000;

export interface ExtractedDocument {
  name: string;
  text: string;
  pages: number;
  truncated: boolean;
}

const PLAIN_TEXT_EXTENSIONS = [".txt", ".md", ".csv"];

function limitText(raw: string): { text: string; truncated: boolean } {
  if (raw.length <= MAX_DOCUMENT_CHARS) return { text: raw, truncated: false };
  return { text: raw.slice(0, MAX_DOCUMENT_CHARS), truncated: true };
}

export async function extractDocumentText(file: File): Promise<ExtractedDocument | null> {
  const lower = file.name.toLowerCase();

  try {
    if (lower.endsWith(".pdf") || file.type === "application/pdf") {
      const data = new Uint8Array(await file.arrayBuffer());
      const doc = await pdfjs.getDocument({ data }).promise;
      try {
        let collected = "";
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const content = await page.getTextContent();
          collected += `\n[Página ${i}]\n` + content.items.map((item) => ("str" in item ? item.str : "")).join(" ") + "\n";
          if (collected.length > MAX_DOCUMENT_CHARS) break;
        }
        const trimmed = collected.trim();
        if (!trimmed) return null;
        const limited = limitText(trimmed);
        return { name: file.name, text: limited.text, pages: doc.numPages, truncated: limited.truncated };
      } finally {
        await doc.destroy();
      }
    }

    if (PLAIN_TEXT_EXTENSIONS.some((ext) => lower.endsWith(ext)) || file.type.startsWith("text/")) {
      const trimmed = (await file.text()).trim();
      if (!trimmed) return null;
      const limited = limitText(trimmed);
      return { name: file.name, text: limited.text, pages: 1, truncated: limited.truncated };
    }
  } catch (err) {
    console.warn("[documentText] No se pudo extraer el texto en el dispositivo:", err);
  }

  return null;
}
