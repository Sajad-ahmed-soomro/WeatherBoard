import { HttpError, NetworkError, ParseError, abortError } from './errors';

interface FetchJsonOptions {
  signal?: AbortSignal | undefined;
  headers?: Record<string, string>;
  timeoutMs?: number;
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
  const { signal, headers, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
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
    response = await fetch(url, { signal: controller.signal, ...(headers ? { headers } : {}) });
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
    return (await response.json()) as unknown;
  } catch {
    if (signal?.aborted) throw abortError();
    throw new ParseError('body');
  }
}
