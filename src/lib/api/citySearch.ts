import { AppError, HttpError, abortError, isAbortError, toAppError } from './errors';
import { fetchCities as defaultFetchCities } from './geodb';
import { LruCache } from './lruCache';
import type { City } from './types';

/**
 * GeoDB's free tier allows 1 request/second. Debounce + abort in the UI does not
 * enforce that on its own, so this client:
 * - spaces requests at least `minGapMs` apart,
 * - keeps only the latest waiting query (older waiters reject with AbortError),
 * - serves repeated queries from an LRU cache with zero network calls,
 * - retries a 429 once after Retry-After (default 1 s), then throws a rate_limit AppError.
 */

export interface SearchRequestOptions {
  signal?: AbortSignal;
  /** Called when a 429 triggers the single automatic retry. */
  onRetry?: () => void;
}

export interface CitySearchClient {
  search(query: string, options?: SearchRequestOptions): Promise<City[]>;
  /** Synchronous cache lookup, so cached results can render without a loading state. */
  peek(query: string): City[] | undefined;
}

interface CitySearchOptions {
  fetchCities?: (namePrefix: string, signal?: AbortSignal) => Promise<City[]>;
  minGapMs?: number;
  cacheSize?: number;
  defaultRetryAfterMs?: number;
}

export function normaliseQuery(query: string): string {
  return query.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
}

function isRateLimited(err: unknown): err is HttpError {
  return err instanceof HttpError && err.status === 429;
}

export function createCitySearchClient(options: CitySearchOptions = {}): CitySearchClient {
  const {
    fetchCities = defaultFetchCities,
    minGapMs = 1100,
    cacheSize = 50,
    defaultRetryAfterMs = 1000,
  } = options;

  const cache = new LruCache<string, City[]>(cacheSize);
  let nextSlotAt = 0;
  let supersedeWaiting: (() => void) | null = null;

  function waitTurn(delayMs: number, signal: AbortSignal | undefined): Promise<void> {
    supersedeWaiting?.();
    return new Promise((resolve, reject) => {
      const finish = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        if (supersedeWaiting === supersede) supersedeWaiting = null;
      };
      const onAbort = () => {
        finish();
        reject(abortError());
      };
      const supersede = () => {
        finish();
        reject(abortError('Superseded by a newer search'));
      };
      const timer = setTimeout(() => {
        finish();
        resolve();
      }, delayMs);
      supersedeWaiting = supersede;
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  async function send(key: string, signal: AbortSignal | undefined, minDelayMs: number): Promise<City[]> {
    const delay = Math.max(minDelayMs, nextSlotAt - Date.now());
    if (delay > 0) {
      await waitTurn(delay, signal);
    } else {
      supersedeWaiting?.();
    }
    if (signal?.aborted) throw abortError();
    nextSlotAt = Date.now() + minGapMs;
    return fetchCities(key, signal);
  }

  async function fetchWithRetry(key: string, { signal, onRetry }: SearchRequestOptions): Promise<City[]> {
    try {
      return await send(key, signal, 0);
    } catch (err) {
      if (!isRateLimited(err)) throw err;
      onRetry?.();
      try {
        return await send(key, signal, err.retryAfterMs ?? defaultRetryAfterMs);
      } catch (retryErr) {
        if (isRateLimited(retryErr)) {
          throw new AppError('rate_limit', 'City search is busy right now. Wait a moment, then try again.', {
            id: 'retry',
            label: 'Try again',
          });
        }
        throw retryErr;
      }
    }
  }

  return {
    peek(query) {
      return cache.get(normaliseQuery(query));
    },

    async search(query, options = {}) {
      const key = normaliseQuery(query);
      const cached = cache.get(key);
      if (cached) return cached;
      try {
        const cities = await fetchWithRetry(key, options);
        cache.set(key, cities);
        return cities;
      } catch (err) {
        if (isAbortError(err)) throw err;
        throw toAppError(err, 'search');
      }
    },
  };
}
