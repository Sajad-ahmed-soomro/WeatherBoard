/** The subset of the Web Storage API we rely on. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SafeStorage {
  /** False when localStorage is blocked (private mode, disabled cookies, quota) and data lives in memory only. */
  readonly persistent: boolean;
  read<T>(key: string, isValid: (value: unknown) => value is T): T | null;
  write(key: string, value: unknown): void;
}

function memoryStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

const PROBE_KEY = '__weatherboard_probe__';

function probe(getBacking: () => KeyValueStore): KeyValueStore | null {
  try {
    const backing = getBacking();
    backing.setItem(PROBE_KEY, '1');
    backing.removeItem(PROBE_KEY);
    return backing;
  } catch {
    return null;
  }
}

/**
 * JSON storage that never throws. If localStorage is unavailable at start-up, or a
 * write fails later (e.g. quota), it switches to an in-memory store for the session.
 */
export function createSafeStorage(getBacking: () => KeyValueStore = () => window.localStorage): SafeStorage {
  const memory = memoryStore();
  let backing = probe(getBacking) ?? memory;

  return {
    get persistent() {
      return backing !== memory;
    },

    read(key, isValid) {
      try {
        const raw = backing.getItem(key);
        if (raw === null) return null;
        const value: unknown = JSON.parse(raw);
        return isValid(value) ? value : null;
      } catch {
        return null;
      }
    },

    write(key, value) {
      const raw = JSON.stringify(value);
      try {
        backing.setItem(key, raw);
      } catch {
        backing = memory;
        memory.setItem(key, raw);
      }
    },
  };
}

export const storage = createSafeStorage();
