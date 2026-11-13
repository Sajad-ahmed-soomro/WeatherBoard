/**
 * Minimal promise wrapper over one IndexedDB object store, usable from the page and the
 * service worker (which cannot read localStorage). Values must be structured-cloneable.
 */
export interface IdbStore {
  get(key: string): Promise<unknown>;
  /** Read-modify-write in one transaction, so the page and service worker can't interleave. */
  update<T>(key: string, change: (current: unknown) => { value: unknown; result: T }): Promise<T>;
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

export function createIdbStore(dbName: string, storeName: string, factory: () => IDBFactory = () => indexedDB): IdbStore {
  let db: Promise<IDBDatabase> | null = null;

  const open = (): Promise<IDBDatabase> => {
    if (!db) {
      const req = factory().open(dbName, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(storeName)) req.result.createObjectStore(storeName);
      };
      db = request(req).catch((err: unknown) => {
        db = null;
        throw err;
      });
    }
    return db;
  };

  return {
    async get(key) {
      const tx = (await open()).transaction(storeName, 'readonly');
      return request(tx.objectStore(storeName).get(key));
    },

    async update(key, change) {
      const tx = (await open()).transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const current = await request(store.get(key));
      const { value, result } = change(current);
      store.put(value, key);
      await done(tx);
      return result;
    },
  };
}
