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

/**
 * Zero-Knowledge E2EE Vault Encryption / Decryption Utilities
 */
async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as any,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export interface VaultExportBundle {
  version: number;
  timestamp: number;
  records: VaultRecord[];
  todos?: any[];
  notes?: any[];
  agenda?: any[];
}

export async function exportVaultEncrypted(
  passphrase: string,
  extraData?: { todos?: any[]; notes?: any[]; agenda?: any[] }
): Promise<string> {
  const records = await getAllFromVault();
  const bundle: VaultExportBundle = {
    version: 1,
    timestamp: Date.now(),
    records,
    todos: extraData?.todos || [],
    notes: extraData?.notes || [],
    agenda: extraData?.agenda || [],
  };

  const enc = new TextEncoder();
  const plaintext = enc.encode(JSON.stringify(bundle));

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as any },
    key,
    plaintext
  );

  return JSON.stringify({
    format: "cocovault_e2ee_v1",
    salt: bufferToBase64(salt),
    iv: bufferToBase64(iv),
    data: bufferToBase64(ciphertext),
  });
}

export async function importVaultEncrypted(
  encryptedJson: string,
  passphrase: string
): Promise<{ success: boolean; count: number; todos?: any[]; notes?: any[]; agenda?: any[]; error?: string }> {
  try {
    const parsed = JSON.parse(encryptedJson);
    if (!parsed.salt || !parsed.iv || !parsed.data) {
      throw new Error("Formato de respaldo cifrado inválido.");
    }

    const salt = base64ToBuffer(parsed.salt);
    const iv = base64ToBuffer(parsed.iv);
    const ciphertext = base64ToBuffer(parsed.data);

    const key = await deriveKey(passphrase, salt);
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as any },
      key,
      ciphertext as any
    );

    const dec = new TextDecoder();
    const bundle: VaultExportBundle = JSON.parse(dec.decode(decryptedBuffer));

    let count = 0;
    if (bundle.records && Array.isArray(bundle.records)) {
      for (const rec of bundle.records) {
        await saveToVault(rec);
        count++;
      }
    }

    return {
      success: true,
      count,
      todos: bundle.todos,
      notes: bundle.notes,
      agenda: bundle.agenda,
    };
  } catch (err: any) {
    console.error("[Vault] Error descifrando respaldo:", err);
    return {
      success: false,
      count: 0,
      error: "Contraseña incorrecta o archivo de respaldo dañado.",
    };
  }
}
