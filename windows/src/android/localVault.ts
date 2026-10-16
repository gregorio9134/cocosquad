// Coco Squad Mobile — Local Vault (IndexedDB)
// 100% client-side, zero-knowledge local storage for devoured files and attachments.
// Files never persist on the Oracle server; they remain exclusively in the user's browser.

export interface DevouredRecord {
  id: string;
  name: string;
  size: number;
  sizeStr: string;
  mimeType: string;
  pageCount?: number;
  agentId: string;
  base64: string;
  dataUri?: string;
  timestamp: number;
  analysis?: string;
}

const DB_NAME = "CocoSquadVault";
const DB_VERSION = 1;
const STORE_NAME = "devoured_files";

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
        store.createIndex("agentId", "agentId", { unique: false });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Stores a devoured file locally in the browser's IndexedDB.
 */
export async function saveDevouredFileRecord(record: DevouredRecord): Promise<void> {
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
    console.warn("[LocalVault] Error saving devoured file to IndexedDB:", err);
  }
}

/**
 * Retrieves all stored files from IndexedDB, optionally filtered by agentId.
 */
export async function getDevouredRecords(agentId?: string): Promise<DevouredRecord[]> {
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

      req.onsuccess = () => resolve((req.result as DevouredRecord[]) || []);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    console.warn("[LocalVault] Error retrieving devoured records:", err);
    return [];
  }
}

/**
 * Retrieves a single file by its ID from IndexedDB.
 */
export async function getDevouredRecordById(id: string): Promise<DevouredRecord | null> {
  try {
    const db = await openVaultDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);

      req.onsuccess = () => resolve((req.result as DevouredRecord) || null);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    console.warn("[LocalVault] Error reading file by id:", err);
    return null;
  }
}

/**
 * Deletes a file record from IndexedDB.
 */
export async function deleteDevouredRecord(id: string): Promise<void> {
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
    console.warn("[LocalVault] Error deleting devoured file:", err);
  }
}
