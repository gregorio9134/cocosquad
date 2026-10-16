// Coco Squad Mobile — File Guard & Large File Delegation
// Enforces modular guardrails: delegates large PDFs (>5 pages or >5 MB) from Coco to Red

import { saveDevouredFileRecord, type DevouredRecord } from "./localVault";

export interface FileGuardDecision {
  allowed: boolean;
  reason?: string;
  suggestedAgent?: string;
  pageCount?: number;
  sizeBytes: number;
  sizeStr: string;
}

const MAX_COCO_PDF_PAGES = 5;
const MAX_COCO_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export const COCO_LARGE_FILE_REJECTION_MESSAGE =
  "¡Uff, este documento es gigante para mí! 📚 Mi compañero Red es el especialista en investigar libros, papers y archivos extensos. Arrastralo o subilo en su pestaña para que lo analice a fondo.";

/**
 * Parses page count from a PDF file in browser memory without external dependencies.
 */
export async function getPdfPageCount(file: File): Promise<number> {
  try {
    const buffer = await file.arrayBuffer();
    const text = new TextDecoder("latin1").decode(buffer);

    // 1. Match /Type /Pages ... /Count N
    const pagesCountRegex = /\/Type\s*\/Pages[\s\S]*?\/Count\s+(\d+)/gi;
    let match: RegExpExecArray | null;
    let maxPages = 0;
    while ((match = pagesCountRegex.exec(text)) !== null) {
      const count = parseInt(match[1], 10);
      if (!isNaN(count) && count > maxPages) {
        maxPages = count;
      }
    }

    if (maxPages > 0) {
      return maxPages;
    }

    // 2. Reverse order: /Count N ... /Type /Pages
    const reverseRegex = /\/Count\s+(\d+)[\s\S]*?\/Type\s*\/Pages/gi;
    while ((match = reverseRegex.exec(text)) !== null) {
      const count = parseInt(match[1], 10);
      if (!isNaN(count) && count > maxPages) {
        maxPages = count;
      }
    }

    if (maxPages > 0) {
      return maxPages;
    }

    // 3. Fallback: Count /Type /Page (excluding /Type /Pages)
    const pageObjects = text.match(/\/Type\s*\/Page\b/g);
    if (pageObjects && pageObjects.length > 0) {
      return pageObjects.length;
    }

    return 1;
  } catch (err) {
    console.warn("[FileGuard] Error analyzing PDF page count:", err);
    return 1;
  }
}

/**
 * Format file size into human-readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Evaluates whether the file can be processed by the given agent,
 * or whether it should be delegated to Red (coco_rojo).
 */
export async function evaluateFileForAgent(file: File, agentId: string): Promise<FileGuardDecision> {
  const sizeBytes = file.size;
  const sizeStr = formatFileSize(sizeBytes);
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

  // Red (coco_rojo) has no size or page count restrictions: specialist in deep research
  if (agentId === "coco_rojo") {
    let pageCount: number | undefined;
    if (isPdf) {
      pageCount = await getPdfPageCount(file);
    }
    return {
      allowed: true,
      pageCount,
      sizeBytes,
      sizeStr,
    };
  }

  // Coco Blanco restriction: max 5 pages or max 5 MB for PDFs, or max 5MB for large docs
  if (agentId === "coco_blanco") {
    let pageCount: number | undefined;

    if (isPdf) {
      pageCount = await getPdfPageCount(file);
      if (pageCount > MAX_COCO_PDF_PAGES || sizeBytes > MAX_COCO_FILE_SIZE_BYTES) {
        return {
          allowed: false,
          reason: COCO_LARGE_FILE_REJECTION_MESSAGE,
          suggestedAgent: "coco_rojo",
          pageCount,
          sizeBytes,
          sizeStr,
        };
      }
    } else if (sizeBytes > MAX_COCO_FILE_SIZE_BYTES) {
      return {
        allowed: false,
        reason: COCO_LARGE_FILE_REJECTION_MESSAGE,
        suggestedAgent: "coco_rojo",
        pageCount,
        sizeBytes,
        sizeStr,
      };
    }
  }

  // All other agents/files within limits
  return {
    allowed: true,
    sizeBytes,
    sizeStr,
  };
}

export { saveDevouredFileRecord, type DevouredRecord };
