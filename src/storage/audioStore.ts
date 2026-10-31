import { LOCAL_STORAGE_PREFIX } from '../config';
const DATABASE_NAME = LOCAL_STORAGE_PREFIX;
const DATABASE_VERSION = 1;
const STORE_NAME = 'audio';

// Si salvano byte e tipo invece del Blob: forma più semplice da conservare in IndexedDB su tutti i browser.
interface StoredAudio {
  mimeType: string;
  data: ArrayBuffer;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Errore IndexedDB'));
  });
}

/** File audio sul telefono, in attesa di essere caricati su Drive (chiave: id della nota). */
export class AudioStore {
  private database: Promise<IDBDatabase> | null = null;

  constructor(private readonly factory: IDBFactory = indexedDB) {}

  async put(id: string, audio: Blob): Promise<void> {
    const stored: StoredAudio = { mimeType: audio.type, data: await audio.arrayBuffer() };
    await this.run('readwrite', (store) => store.put(stored, id));
  }

  async get(id: string): Promise<Blob | null> {
    const stored = (await this.run('readonly', (store) => store.get(id))) as StoredAudio | undefined;
    return stored ? new Blob([stored.data], { type: stored.mimeType }) : null;
  }

  async delete(id: string): Promise<void> {
    await this.run('readwrite', (store) => store.delete(id));
  }

  private open(): Promise<IDBDatabase> {
    this.database ??= new Promise((resolve, reject) => {
      const request = this.factory.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Impossibile aprire IndexedDB'));
    });
    this.database.catch(() => {
      this.database = null;
    });
    return this.database;
  }

  private async run<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const database = await this.open();
    const transaction = database.transaction(STORE_NAME, mode);
    const result = requestResult(operation(transaction.objectStore(STORE_NAME)));
    // La scrittura è definitiva solo a transazione completata.
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Transazione IndexedDB fallita'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Transazione IndexedDB annullata'));
    });
    return result;
  }
}
