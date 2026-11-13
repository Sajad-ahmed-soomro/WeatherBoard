import { readFetchedAt } from '../pwa/weatherCacheRules';
import { HttpError, NetworkError, ParseError, abortError } from './errors';

interface FetchJsonOptions {
  signal?: AbortSignal | undefined;
  headers?: Record<string, string>;
  timeoutMs?: number;
  /** 'no-store' also tells our service worker not to cache the response. */
  cache?: RequestCache;
}

export interface JsonWithMeta {
  body: unknown;
  /** When the service worker fetched this from the network; null when it came straight from the network. */
  fetchedAt: number | null;
}

const DEFAULT_TIMEOUT_MS = 10_000;

/** Parses a Retry-After header (delta-seconds or HTTP date) into milliseconds. */
export function parseRetryAfter(value: string | null, now = Date.now()): number | null {
  if (value === null || value.trim() === '') return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - now);
}

/**
 * fetch + JSON with a timeout. Throws:
 * - AbortError when the caller's signal aborts,
 * - NetworkError on connection failure or timeout,
 * - HttpError on non-2xx, ParseError on invalid JSON.
 */
export async function fetchJson(url: string, options: FetchJsonOptions = {}): Promise<unknown> {
  return (await fetchJsonWithMeta(url, options)).body;
}

/** fetchJson, plus the service worker's fetched-at stamp so cached data shows its real age. */
export async function fetchJsonWithMeta(url: string, options: FetchJsonOptions = {}): Promise<JsonWithMeta> {
  const { signal, headers, cache, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  if (signal?.aborted) throw abortError();

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const forwardAbort = () => controller.abort();
  signal?.addEventListener('abort', forwardAbort, { once: true });

  let response: Response;
  try {
    response = await fetch(url, { signal: controller.signal, ...(headers ? { headers } : {}), ...(cache ? { cache } : {}) });
  } catch {
    if (timedOut) throw new NetworkError('Request timed out');
    if (signal?.aborted) throw abortError();
    throw new NetworkError();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
  }

  if (!response.ok) {
    throw new HttpError(response.status, parseRetryAfter(response.headers.get('Retry-After')));
  }

  try {
    return { body: (await response.json()) as unknown, fetchedAt: readFetchedAt(response.headers) };
  } catch {
    if (signal?.aborted) throw abortError();
    throw new ParseError('body');
  }
}
