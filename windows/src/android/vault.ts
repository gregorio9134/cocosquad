// Coco Squad Mobile — Bóveda Local (CocoVaultDB)
// 100% Client-Side, Zero-Storage en servidor (Privacidad Absoluta)
// Los archivos devorados residen exclusivamente en IndexedDB del navegador.

export interface VaultRecord {
  id: string; // Hash único o UUID del archivo
  hash: string; // SHA-256 hex del contenido
  name: string;
  size: number;
  sizeStr: string;
  mimeType: string;
  pageCount?: number;
  agentId: string; // 'coco_blanco' | 'coco_verde' | 'coco_rojo' | 'coco_azul'
  agentName: string;
  base64: string;
  dataUri?: string;
  extractedText?: string;
  timestamp: number;
  dateStr: string;
  analysis?: string;
}

const DB_NAME = "CocoVaultDB";
const DB_VERSION = 1;
const STORE_NAME = "vault_files";

/**
 * Computes a unique SHA-256 hash for a File or ArrayBuffer using Web Crypto API.
 */
export async function computeFileHash(fileOrBuffer: File | ArrayBuffer): Promise<string> {
  try {
    const buffer = fileOrBuffer instanceof File ? await fileOrBuffer.arrayBuffer() : fileOrBuffer;
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch (err) {
    console.warn("[Vault] Fallback hash generator:", err);
    return `hash_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}

/**
 * Opens or initializes CocoVaultDB in IndexedDB.
 */
function openVaultDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB no está disponible en este entorno."));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("hash", "hash", { unique: false });
        store.createIndex("agentId", "agentId", { unique: false });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Guarda un archivo devorado en la Bóveda Local (CocoVaultDB).
 */
export async function saveToVault(record: VaultRecord): Promise<void> {
  try {
    const db = await openVaultDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    console.warn("[Vault] Error guardando archivo en CocoVaultDB:", err);
  }
}

/**
 * Obtiene todos los archivos almacenados en la Bóveda Local, ordenados por fecha descendente.
 */
export async function getAllFromVault(agentId?: string): Promise<VaultRecord[]> {
  try {
    const db = await openVaultDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);

      let req: IDBRequest;
      if (agentId) {
        const index = store.index("agentId");
        req = index.getAll(agentId);
      } else {
        req = store.getAll();
      }

      req.onsuccess = () => {
        const list = (req.result as VaultRecord[]) || [];
        // Ordenar por timestamp descendente (más recientes primero)
        list.sort((a, b) => b.timestamp - a.timestamp);
        resolve(list);
      };
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    console.warn("[Vault] Error leyendo archivos de CocoVaultDB:", err);
    return [];
  }
}

/**
 * Obtiene un documento de la Bóveda por su ID o Hash.
 */
export async function getFromVault(id: string): Promise<VaultRecord | null> {
  try {
    const db = await openVaultDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);

      req.onsuccess = () => resolve((req.result as VaultRecord) || null);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    console.warn("[Vault] Error recuperando archivo por ID:", err);
    return null;
  }
}

/**
 * Elimina un documento de la Bóveda Local.
 */
export async function deleteFromVault(id: string): Promise<void> {
  try {
    const db = await openVaultDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    console.warn("[Vault] Error eliminando archivo de CocoVaultDB:", err);
  }
}

/**
 * Limpia la Bóveda Local (Zero-Storage reset).
 */
export async function clearVault(): Promise<void> {
  try {
    const db = await openVaultDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    console.warn("[Vault] Error vaciando CocoVaultDB:", err);
  }
}
