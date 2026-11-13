import { describe, expect, it } from 'vitest';
import { createSafeStorage, type KeyValueStore } from './safeStorage';

const isNumber = (v: unknown): v is number => typeof v === 'number';

function workingStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
    removeItem: (k) => {
      data.delete(k);
    },
  };
}

describe('createSafeStorage', () => {
  it('persists JSON to the backing store when it works', () => {
    const backing = workingStore();
    const store = createSafeStorage(() => backing);
    store.write('n', 42);
    expect(backing.data.get('n')).toBe('42');
    expect(store.read('n', isNumber)).toBe(42);
  });

  it('falls back to memory when localStorage access throws (e.g. blocked cookies)', () => {
    const store = createSafeStorage(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    store.write('n', 7);
    expect(store.read('n', isNumber)).toBe(7);
  });

  it('switches to memory when a write fails later (e.g. quota exceeded)', () => {
    const backing = workingStore();
    const store = createSafeStorage(() => backing);
    const working = backing.setItem;
    backing.setItem = () => {
      throw new DOMException('full', 'QuotaExceededError');
    };
    store.write('n', 1);
    expect(store.read('n', isNumber)).toBe(1);

    // Stays in memory for the session rather than flip-flopping between stores.
    backing.setItem = working;
    store.write('m', 2);
    expect(backing.data.has('m')).toBe(false);
    expect(store.read('m', isNumber)).toBe(2);
  });

  it('returns null for corrupt JSON or values that fail validation', () => {
    const backing = workingStore();
    const store = createSafeStorage(() => backing);
    backing.data.set('bad', '{not json');
    backing.data.set('wrong', '"text"');
    expect(store.read('bad', isNumber)).toBeNull();
    expect(store.read('wrong', isNumber)).toBeNull();
    expect(store.read('missing', isNumber)).toBeNull();
  });
});
