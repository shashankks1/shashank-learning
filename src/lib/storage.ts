import type { ImageMap } from '../types';

/*
 * Persistence layer. IndexedDB is the primary store (large quota, holds screenshots).
 * If it can't open (private mode in some browsers, blocked storage), we fall back to
 * localStorage, and finally to memory only — in which case the UI tells the learner
 * to export. Nothing here throws to the caller without a clear status.
 */

const DB_NAME = 'level1-builder';
const DB_VERSION = 1;
const STATE_STORE = 'state';
const IMAGE_STORE = 'images';
const STATE_KEY = 'app';
const LS_STATE_KEY = 'level1-builder:state';
const LS_IMAGE_PREFIX = 'level1-builder:image:';
const LS_SNAPSHOT_PREFIX = 'level1-builder:snapshot:';

export type StorageMode = 'indexeddb' | 'localstorage' | 'memory';

export type LoadResult =
  | { status: 'empty' }
  | { status: 'ok'; raw: unknown }
  | { status: 'unreadable'; rawText: string; error: string };

export interface Snapshot {
  key: string;
  text: string;
}

export interface Storage {
  mode: StorageMode;
  load(): Promise<LoadResult>;
  save(data: unknown): Promise<void>;
  /** Keep a copy of damaged data before anything overwrites it. */
  quarantine(rawText: string): Promise<void>;
  /** Named copies kept aside (damaged data, sync conflict losers). */
  putSnapshot(key: string, text: string): Promise<void>;
  listSnapshots(): Promise<Snapshot[]>;
  deleteSnapshot(key: string): Promise<void>;
  getImage(id: string): Promise<string | null>;
  putImage(id: string, dataUrl: string): Promise<void>;
  deleteImage(id: string): Promise<void>;
  allImages(): Promise<ImageMap>;
  replaceImages(images: ImageMap): Promise<void>;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error('Transaction aborted'));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STATE_STORE)) db.createObjectStore(STATE_STORE);
      if (!db.objectStoreNames.contains(IMAGE_STORE)) db.createObjectStore(IMAGE_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB is blocked by another tab'));
  });
}

function indexedDbStorage(db: IDBDatabase): Storage {
  const store = (name: string, mode: IDBTransactionMode) => {
    const transaction = db.transaction(name, mode);
    return { transaction, objectStore: transaction.objectStore(name) };
  };

  return {
    mode: 'indexeddb',
    async load() {
      const { objectStore } = store(STATE_STORE, 'readonly');
      const value = await requestToPromise(objectStore.get(STATE_KEY));
      if (value === undefined) return { status: 'empty' };
      if (typeof value === 'string') {
        try {
          return { status: 'ok', raw: JSON.parse(value) };
        } catch (error) {
          return { status: 'unreadable', rawText: value, error: String(error) };
        }
      }
      return { status: 'ok', raw: value };
    },
    async save(data) {
      // Stored as a JSON string so what we save is exactly what we can export and re-import.
      const { transaction, objectStore } = store(STATE_STORE, 'readwrite');
      objectStore.put(JSON.stringify(data), STATE_KEY);
      await transactionDone(transaction);
    },
    async quarantine(rawText) {
      await this.putSnapshot(`damaged-${Date.now()}`, rawText);
    },
    async putSnapshot(key, text) {
      const { transaction, objectStore } = store(STATE_STORE, 'readwrite');
      objectStore.put(text, key);
      await transactionDone(transaction);
    },
    async listSnapshots() {
      const { objectStore } = store(STATE_STORE, 'readonly');
      const [keys, values] = await Promise.all([requestToPromise(objectStore.getAllKeys()), requestToPromise(objectStore.getAll())]);
      return keys
        .map((key, index) => ({ key: String(key), text: values[index] }))
        .filter((item): item is Snapshot => item.key !== STATE_KEY && typeof item.text === 'string');
    },
    async deleteSnapshot(key) {
      if (key === STATE_KEY) return;
      const { transaction, objectStore } = store(STATE_STORE, 'readwrite');
      objectStore.delete(key);
      await transactionDone(transaction);
    },
    async getImage(id) {
      const { objectStore } = store(IMAGE_STORE, 'readonly');
      const value = await requestToPromise(objectStore.get(id));
      return typeof value === 'string' ? value : null;
    },
    async putImage(id, dataUrl) {
      const { transaction, objectStore } = store(IMAGE_STORE, 'readwrite');
      objectStore.put(dataUrl, id);
      await transactionDone(transaction);
    },
    async deleteImage(id) {
      const { transaction, objectStore } = store(IMAGE_STORE, 'readwrite');
      objectStore.delete(id);
      await transactionDone(transaction);
    },
    async allImages() {
      const { objectStore } = store(IMAGE_STORE, 'readonly');
      const [keys, values] = await Promise.all([
        requestToPromise(objectStore.getAllKeys()),
        requestToPromise(objectStore.getAll()),
      ]);
      const images: ImageMap = {};
      keys.forEach((key, index) => {
        if (typeof values[index] === 'string') images[String(key)] = values[index];
      });
      return images;
    },
    async replaceImages(images) {
      const { transaction, objectStore } = store(IMAGE_STORE, 'readwrite');
      objectStore.clear();
      for (const [id, dataUrl] of Object.entries(images)) objectStore.put(dataUrl, id);
      await transactionDone(transaction);
    },
  };
}

function localStorageStorage(): Storage {
  return {
    mode: 'localstorage',
    async load() {
      const text = localStorage.getItem(LS_STATE_KEY);
      if (text === null) return { status: 'empty' };
      try {
        return { status: 'ok', raw: JSON.parse(text) };
      } catch (error) {
        return { status: 'unreadable', rawText: text, error: String(error) };
      }
    },
    async save(data) {
      localStorage.setItem(LS_STATE_KEY, JSON.stringify(data));
    },
    async quarantine(rawText) {
      await this.putSnapshot(`damaged-${Date.now()}`, rawText);
    },
    async putSnapshot(key, text) {
      localStorage.setItem(`${LS_SNAPSHOT_PREFIX}${key}`, text);
    },
    async listSnapshots() {
      const snapshots: Snapshot[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(LS_SNAPSHOT_PREFIX)) snapshots.push({ key: key.slice(LS_SNAPSHOT_PREFIX.length), text: localStorage.getItem(key) ?? '' });
      }
      return snapshots;
    },
    async deleteSnapshot(key) {
      localStorage.removeItem(`${LS_SNAPSHOT_PREFIX}${key}`);
    },
    async getImage(id) {
      return localStorage.getItem(LS_IMAGE_PREFIX + id);
    },
    async putImage(id, dataUrl) {
      localStorage.setItem(LS_IMAGE_PREFIX + id, dataUrl);
    },
    async deleteImage(id) {
      localStorage.removeItem(LS_IMAGE_PREFIX + id);
    },
    async allImages() {
      const images: ImageMap = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(LS_IMAGE_PREFIX)) images[key.slice(LS_IMAGE_PREFIX.length)] = localStorage.getItem(key) ?? '';
      }
      return images;
    },
    async replaceImages(images) {
      const existing = await this.allImages();
      for (const id of Object.keys(existing)) localStorage.removeItem(LS_IMAGE_PREFIX + id);
      for (const [id, dataUrl] of Object.entries(images)) localStorage.setItem(LS_IMAGE_PREFIX + id, dataUrl);
    },
  };
}

export function memoryStorage(): Storage {
  let state: string | null = null;
  const images = new Map<string, string>();
  const snapshots = new Map<string, string>();
  return {
    mode: 'memory',
    async load() {
      if (state === null) return { status: 'empty' };
      return { status: 'ok', raw: JSON.parse(state) };
    },
    async save(data) {
      state = JSON.stringify(data);
    },
    async quarantine() {},
    async putSnapshot(key, text) {
      snapshots.set(key, text);
    },
    async listSnapshots() {
      return [...snapshots].map(([key, text]) => ({ key, text }));
    },
    async deleteSnapshot(key) {
      snapshots.delete(key);
    },
    async getImage(id) {
      return images.get(id) ?? null;
    },
    async putImage(id, dataUrl) {
      images.set(id, dataUrl);
    },
    async deleteImage(id) {
      images.delete(id);
    },
    async allImages() {
      return Object.fromEntries(images);
    },
    async replaceImages(next) {
      images.clear();
      for (const [id, dataUrl] of Object.entries(next)) images.set(id, dataUrl);
    },
  };
}

function localStorageWorks(): boolean {
  try {
    const probe = '__level1_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/** Pick the best available store. Never rejects. */
export async function openStorage(): Promise<Storage> {
  try {
    const db = await openDatabase();
    return indexedDbStorage(db);
  } catch {
    if (localStorageWorks()) return localStorageStorage();
    return memoryStorage();
  }
}
