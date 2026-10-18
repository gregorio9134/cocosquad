// Coco Squad Mobile — File Guard & Large File Delegation
// Enforces modular guardrails: Coco Blanco handles files <= 2MB and <= 4 pages.
// Documents exceeding 2MB or 4 pages are delegated to Red (coco_rojo).

import { saveToVault, type VaultRecord } from "./vault";

export interface FileGuardDecision {
  allowed: boolean;
  shouldDelegateToRed: boolean;
  reason?: string;
  suggestedAgent?: string;
  pageCount?: number;
  sizeBytes: number;
  sizeStr: string;
}

export const COCO_MAX_PAGES = 4;
export const COCO_MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export const COCO_DELEGATION_MESSAGE =
  "Ese documento supera mi límite de lectura rápida (máx. 2 MB o 4 págs). Se lo derivo a Red para un análisis exhaustivo.";

/**
 * Parses or estimates page count from a PDF or text file in browser memory without external server.
 */
export async function getDocumentPageCount(file: File): Promise<number> {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

  if (isPdf) {
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

      if (maxPages > 0) return maxPages;

      // 2. Reverse order: /Count N ... /Type /Pages
      const reverseRegex = /\/Count\s+(\d+)[\s\S]*?\/Type\s*\/Pages/gi;
      while ((match = reverseRegex.exec(text)) !== null) {
        const count = parseInt(match[1], 10);
        if (!isNaN(count) && count > maxPages) {
          maxPages = count;
        }
      }

      if (maxPages > 0) return maxPages;

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

  // Non-PDF documents: estimate 1 page per 3 KB of text (approx 500 words per page)
  return Math.max(1, Math.ceil(file.size / (1024 * 3)));
}

/**
 * Format file size into human-readable string.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Evaluates whether a document received by Coco Blanco exceeds the 2 MB / 4 page threshold.
 */
export async function evaluateCocoDocumentThreshold(file: File): Promise<{
  exceedsThreshold: boolean;
  pageCount: number;
  sizeBytes: number;
  reason?: string;
}> {
  const sizeBytes = file.size;
  const pageCount = await getDocumentPageCount(file);
  const exceedsSize = sizeBytes > COCO_MAX_BYTES;
  const exceedsPages = pageCount > COCO_MAX_PAGES;

  const exceedsThreshold = exceedsSize || exceedsPages;

  let reason: string | undefined;
  if (exceedsThreshold) {
    reason = COCO_DELEGATION_MESSAGE;
  }

  return {
    exceedsThreshold,
    pageCount,
    sizeBytes,
    reason,
  };
}

export { saveToVault, type VaultRecord };
